import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { FiscalSupabaseService } from '../services/fiscal-supabase.service';
import { PedidoDataService } from '../services/pedido-data.service';
import { buildFocusNFePayload } from '../focus-nfe/build-payload';
import { FocusNFeClientService } from '../focus-nfe/focus-nfe-client.service';

export const FISCAL_QUEUE_NAME = 'fiscal-emissao';

export interface EmissaoJobPayload {
  invoiceId: string;
  pedidoId: number;
  referencia: string;
  empresa_id?: number;
  natureza_operacao_id?: number;
}

@Processor(FISCAL_QUEUE_NAME)
export class FiscalEmissaoProcessor extends WorkerHost {
  constructor(
    private readonly supabase: FiscalSupabaseService,
    private readonly pedidoData: PedidoDataService,
    private readonly focusClient: FocusNFeClientService,
  ) {
    super();
  }

  async process(job: Job<EmissaoJobPayload>): Promise<{ ok: boolean; focusRef?: string; error?: string }> {
    const { invoiceId, pedidoId, referencia, empresa_id: overrideEmpresaId, natureza_operacao_id: overrideNaturezaId } = job.data;

    try {
      const pedido = await this.pedidoData.getPedido(pedidoId);
      if (!pedido) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: `Pedido ${pedidoId} não encontrado`,
        });
        return { ok: false, error: 'Pedido não encontrado' };
      }

      const empresaId = overrideEmpresaId ?? (pedido as { empresa_id?: number }).empresa_id ?? null;
      const naturezaId = overrideNaturezaId ?? (pedido as { natureza_operacao_id?: number }).natureza_operacao_id ?? null;

      const [itens, empresa, cliente, natureza] = await Promise.all([
        this.pedidoData.getItensVendaEnrichedForFiscal(pedidoId),
        empresaId != null ? this.pedidoData.getEmpresa(empresaId) : Promise.resolve(null),
        (pedido as { contatos_id?: number }).contatos_id != null
          ? this.pedidoData.getCliente((pedido as { contatos_id: number }).contatos_id)
          : Promise.resolve(null),
        naturezaId != null ? this.pedidoData.getNaturezaOperacao(naturezaId) : Promise.resolve(null),
      ]);

      if (!empresa) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: 'Empresa não encontrada',
        });
        return { ok: false, error: 'Empresa não encontrada' };
      }
      if (!cliente) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: 'Cliente não encontrado',
        });
        return { ok: false, error: 'Cliente não encontrado' };
      }
      if (!natureza) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: 'Natureza de operação não encontrada',
        });
        return { ok: false, error: 'Natureza de operação não encontrada' };
      }
      if (!itens.length) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: 'Pedido sem itens',
        });
        return { ok: false, error: 'Pedido sem itens' };
      }

      const payload = buildFocusNFePayload(
        pedido,
        itens,
        empresa,
        cliente,
        natureza,
      );

      await this.supabase.setInvoiceProcessing(invoiceId);
      await this.supabase.createEvento(invoiceId, 'payload_enviado', payload as unknown as Record<string, unknown>);
      await this.focusClient.emitir(referencia, payload);

      return { ok: true, focusRef: referencia };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.supabase.updateInvoiceStatus(invoiceId, {
        status: 'ERRO',
        error_message: message,
      });
      throw err;
    }
  }
}
