import { Controller, Post, Body, Headers, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FiscalSupabaseService } from '../services/fiscal-supabase.service';
import { FocusNFeClientService } from '../focus-nfe/focus-nfe-client.service';

/**
 * Webhook chamado pela Focus NFe quando o status da NFe muda.
 * Configurar no painel Focus NFe a URL: https://seu-dominio.com/fiscal/webhook/focusnfe
 *
 * Autenticação: defina FOCUS_NFE_WEBHOOK_TOKEN no .env.
 * A Focus NFe enviará o token no header Authorization.
 */
@Controller('fiscal/webhook')
export class FiscalWebhookController {
  private readonly logger = new Logger(FiscalWebhookController.name);

  constructor(
    private readonly supabase: FiscalSupabaseService,
    private readonly focusClient: FocusNFeClientService,
    private readonly config: ConfigService,
  ) { }

  @Post('focusnfe')
  @HttpCode(HttpStatus.OK)
  async focusNfe(
    @Body() raw: unknown,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ received: boolean; error?: string }> {
    // --- Autenticação do webhook ---
    const expectedToken = this.config.get<string>('FOCUS_NFE_WEBHOOK_TOKEN');
    if (expectedToken) {
      const bearerToken = authHeader?.replace(/^Bearer\s+/i, '').trim();
      if (bearerToken !== expectedToken) {
        this.logger.warn(`Webhook rejeitado: token inválido (header=${authHeader?.slice(0, 20)}...)`);
        return { received: false, error: 'unauthorized' };
      }
    }

    const body = this.extractBody(raw);
    const ref = body.ref as string | undefined;
    const status = body.status as string | undefined;

    this.logger.log(`Webhook Focus NFe: ref=${ref} status=${status}`);

    if (!ref) {
      this.logger.warn('Webhook sem ref, ignorando');
      return { received: true };
    }

    const invoice = await this.supabase.findInvoiceByFocusId(ref);
    if (!invoice) {
      this.logger.warn(`NFe ref=${ref} não encontrada em fiscal_invoices`);
      return { received: true };
    }

    await this.supabase.createEvento(invoice.id, 'webhook_focusnfe', body);

    const statusNormalizado = this.normalizarStatus(status);
    const update: {
      status: 'AUTORIZADO' | 'REJEITADO' | 'CANCELADO' | 'ERRO' | 'PROCESSANDO';
      chave_acesso?: string;
      xml_url?: string;
      pdf_url?: string;
      error_message?: string;
      numero_nf?: number;
    } = {
      status: statusNormalizado,
    };

    if (body.chave_nfe) {
      update.chave_acesso = body.chave_nfe as string;
    }
    // Capturar numero_nf real da SEFAZ
    if (body.numero != null) {
      const num = Number(body.numero);
      if (num > 0) update.numero_nf = num;
    }
    const xmlPath = (body.caminho_xml_nota_fiscal as string) || '';
    if (xmlPath) {
      update.xml_url = this.focusClient.buildFocusNFeUrl(xmlPath);
    }
    const danfePath = (body.caminho_danfe as string) || (body.caminho_pdf_nota_fiscal as string) || '';
    if (danfePath) {
      update.pdf_url = this.focusClient.buildFocusNFeUrl(danfePath);
    }
    if (statusNormalizado !== 'AUTORIZADO' && (body.mensagem_sefaz ?? body.mensagem)) {
      update.error_message = (body.mensagem_sefaz ?? body.mensagem) as string;
    }

    await this.supabase.updateInvoiceStatus(invoice.id, update);
    this.logger.log(`Invoice ${invoice.id} atualizado para status=${statusNormalizado}`);

    return { received: true };
  }

  /** Extrai o body real (suporta payload direto ou formato n8n com array/body). */
  private extractBody(raw: unknown): Record<string, unknown> {
    if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === 'object' && 'body' in raw[0]) {
      return (raw[0] as { body: Record<string, unknown> }).body;
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }
    return {};
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
