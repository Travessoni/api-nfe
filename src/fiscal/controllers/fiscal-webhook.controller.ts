import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { FiscalSupabaseService } from '../services/fiscal-supabase.service';

/**
 * Webhook chamado pela Focus NFe quando o status da NFe muda.
 * Configurar no painel Focus NFe a URL: https://seu-dominio.com/fiscal/webhook/focusnfe
 */
@Controller('fiscal/webhook')
export class FiscalWebhookController {
  private readonly logger = new Logger(FiscalWebhookController.name);

  constructor(private readonly supabase: FiscalSupabaseService) {}

  @Post('focusnfe')
  @HttpCode(HttpStatus.OK)
  async focusNfe(@Body() body: Record<string, unknown>): Promise<{ received: boolean }> {
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
      status: 'AUTORIZADO' | 'REJEITADO' | 'ERRO' | 'PROCESSANDO';
      chave_acesso?: string;
      xml_url?: string;
      pdf_url?: string;
      error_message?: string;
    } = {
      status: statusNormalizado,
    };

    if (body.chave_nfe) {
      update.chave_acesso = body.chave_nfe as string;
    }
    if (body.caminho_xml_nota_fiscal) {
      update.xml_url = body.caminho_xml_nota_fiscal as string;
    }
    if (body.caminho_pdf_nota_fiscal) {
      update.pdf_url = body.caminho_pdf_nota_fiscal as string;
    }
    if (statusNormalizado !== 'AUTORIZADO' && (body.mensagem_sefaz ?? body.mensagem)) {
      update.error_message = (body.mensagem_sefaz ?? body.mensagem) as string;
    }

    await this.supabase.updateInvoiceStatus(invoice.id, update);
    this.logger.log(`Invoice ${invoice.id} atualizado para status=${statusNormalizado}`);

    return { received: true };
  }

  private normalizarStatus(status: string | undefined): 'AUTORIZADO' | 'REJEITADO' | 'ERRO' | 'PROCESSANDO' {
    if (!status) return 'PROCESSANDO';
    const s = status.toLowerCase();
    if (s === 'autorizado' || s === 'autorizada') return 'AUTORIZADO';
    if (s === 'rejeitado' || s === 'rejeitada' || s === 'erro') return 'REJEITADO';
    if (s === 'erro_validacao' || s === 'erro_autorizacao') return 'ERRO';
    return 'PROCESSANDO';
  }
}
