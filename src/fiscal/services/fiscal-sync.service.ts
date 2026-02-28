import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalSupabaseService } from './fiscal-supabase.service';
import { FocusNFeClientService } from '../focus-nfe/focus-nfe-client.service';
import { PedidoDataService } from './pedido-data.service';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const MINUTOS_PROCESSANDO_PARA_SINCRONIZAR = 2; // Só consulta notas em PROCESSANDO há mais de 2 min

@Injectable()
export class FiscalSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FiscalSyncService.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly supabase: FiscalSupabaseService,
    private readonly focusClient: FocusNFeClientService,
    private readonly pedidoData: PedidoDataService,
    private readonly config: ConfigService,
  ) { }

  onModuleInit() {
    const disabled = this.config.get<string>('FISCAL_SYNC_DISABLED');
    if (disabled === 'true' || disabled === '1') {
      this.logger.log('Sincronização automática desativada (FISCAL_SYNC_DISABLED)');
      return;
    }
    this.intervalId = setInterval(() => this.syncProcessando(), INTERVAL_MS);
    this.logger.log(
      `Sincronização de notas em PROCESSANDO a cada ${INTERVAL_MS / 60000} min (notas com mais de ${MINUTOS_PROCESSANDO_PARA_SINCRONIZAR} min)`,
    );
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Consulta na Focus NFe as notas que estão em PROCESSANDO há mais de X minutos
   * e atualiza o status no banco (fallback quando o webhook não chega).
   */
  async syncProcessando(): Promise<{ ok: number; erro: number; atualizados: number }> {
    let ok = 0;
    let erro = 0;
    let atualizados = 0;

    try {
      const list = await this.supabase.listInvoicesProcessandoOlderThan(MINUTOS_PROCESSANDO_PARA_SINCRONIZAR);
      if (list.length === 0) return { ok: 0, erro: 0, atualizados: 0 };

      this.logger.debug(`Sincronizando ${list.length} nota(s) em PROCESSANDO`);

      for (const invoice of list) {
        const focusId = invoice.focus_id;
        if (!focusId) continue;

        try {
          const empresa = await this.pedidoData.getEmpresa(invoice.empresa_id);
          const cnpjEmitente = empresa?.cnpj ? String(empresa.cnpj).replace(/\D/g, '') : undefined;
          const tokensFromDb = empresa
            ? { homologacao: empresa.tokenHomologacao, producao: empresa.tokenProducao }
            : undefined;
          const res = await this.focusClient.consultar(focusId, cnpjEmitente, tokensFromDb);
          ok++;

          const statusNorm = this.normalizarStatus(res.status);
          if (statusNorm === 'PROCESSANDO') continue; // Ainda processando na Focus, não atualiza

          const update: {
            status: 'AUTORIZADO' | 'REJEITADO' | 'CANCELADO' | 'ERRO';
            chave_acesso?: string;
            xml_url?: string;
            pdf_url?: string;
            error_message?: string;
            numero_nf?: number;
          } = { status: statusNorm };

          if (res.chave_nfe) update.chave_acesso = res.chave_nfe;
          // Capturar numero_nf real da SEFAZ
          const resAny = res as Record<string, unknown>;
          if (resAny.numero != null) {
            const num = Number(resAny.numero);
            if (num > 0) update.numero_nf = num;
          }
          const xmlPath = res.caminho_xml_nota_fiscal;
          if (xmlPath) update.xml_url = this.focusClient.buildFocusNFeUrl(xmlPath);
          const danfePath = (res as { caminho_danfe?: string }).caminho_danfe ?? res.caminho_pdf_nota_fiscal;
          if (danfePath) update.pdf_url = this.focusClient.buildFocusNFeUrl(danfePath);
          if (statusNorm !== 'AUTORIZADO' && (res.mensagem_sefaz ?? (res as { mensagem?: string }).mensagem)) {
            update.error_message = (res.mensagem_sefaz ?? (res as { mensagem?: string }).mensagem) ?? undefined;
          }

          await this.supabase.createEvento(invoice.id, 'sync_consulta', res as unknown as Record<string, unknown>);
          await this.supabase.updateInvoiceStatus(invoice.id, update);
          atualizados++;
          this.logger.log(`Invoice ${invoice.id} (ref=${focusId}) atualizado para ${statusNorm} via sync`);
        } catch (e) {
          erro++;
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`Sync ref=${focusId}: ${msg}`);
        }
      }

      if (atualizados > 0) {
        this.logger.log(`Sync: ${atualizados} nota(s) atualizada(s), ${erro} erro(s) de consulta`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Sync processando: ${msg}`);
    }

    return { ok, erro, atualizados };
  }

  private normalizarStatus(status: string | undefined): 'AUTORIZADO' | 'REJEITADO' | 'CANCELADO' | 'ERRO' | 'PROCESSANDO' {
    if (!status) return 'PROCESSANDO';
    const s = status.toLowerCase();
    if (s === 'autorizado' || s === 'autorizada') return 'AUTORIZADO';
    if (s === 'cancelado' || s === 'cancelada') return 'CANCELADO';
    if (s === 'rejeitado' || s === 'rejeitada' || s === 'erro') return 'REJEITADO';
    if (s === 'erro_validacao' || s === 'erro_autorizacao') return 'ERRO';
    if (s === 'processando_cancelamento') return 'PROCESSANDO';
    return 'PROCESSANDO';
  }
}
