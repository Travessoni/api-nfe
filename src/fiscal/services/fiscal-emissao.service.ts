import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FiscalSupabaseService } from './fiscal-supabase.service';
import { PedidoDataService } from './pedido-data.service';
import { FISCAL_QUEUE_NAME, EmissaoJobPayload } from '../processors/fiscal-emissao.processor';

const SERIE_DEFAULT = '1';

@Injectable()
export class FiscalEmissaoService {
  constructor(
    private readonly supabase: FiscalSupabaseService,
    private readonly pedidoData: PedidoDataService,
    @InjectQueue(FISCAL_QUEUE_NAME) private readonly queue: Queue,
  ) {}

  /**
   * Idempotência: se já existir fiscal_invoice para o pedido_id com status
   * AUTORIZADO ou PROCESSANDO, não emite de novo.
   */
  async emitir(
    pedidoId: number,
    overrides?: { empresa_id?: number; natureza_operacao_id?: number },
  ): Promise<{
    invoiceId: string;
    status: string;
    focus_id: string | null;
    mensagem: string;
  }> {
    const existente = await this.supabase.findInvoiceByPedidoId(pedidoId);

    if (existente) {
      if (existente.status === 'AUTORIZADO') {
        return {
          invoiceId: existente.id,
          status: existente.status,
          focus_id: existente.focus_id,
          mensagem: 'NFe já emitida para este pedido (idempotência).',
        };
      }
      if (existente.status === 'PROCESSANDO') {
        return {
          invoiceId: existente.id,
          status: existente.status,
          focus_id: existente.focus_id,
          mensagem: 'NFe já está em processamento para este pedido.',
        };
      }
      if (existente.status === 'PENDENTE') {
        const referencia = existente.focus_id!;
        await this.queue.add(
          'emitir',
          {
            invoiceId: existente.id,
            pedidoId,
            referencia,
            empresa_id: existente.empresa_id,
            natureza_operacao_id: existente.natureza_operacao_id,
          } as EmissaoJobPayload,
          {
            jobId: existente.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 1000 },
          },
        );
        return {
          invoiceId: existente.id,
          status: 'PROCESSANDO',
          focus_id: referencia,
          mensagem: 'Reenvio para fila de emissão (retry).',
        };
      }
      throw new BadRequestException(
        `Pedido já possui NFe com status ${existente.status}. ${existente.error_message ?? ''}`,
      );
    }

    const pedido = await this.pedidoData.getPedido(pedidoId);
    if (!pedido) {
      throw new NotFoundException(`Pedido ${pedidoId} não encontrado`);
    }

    const empresaId = overrides?.empresa_id ?? (pedido as { empresa_id?: number }).empresa_id ?? null;
    const naturezaOperacaoId =
      overrides?.natureza_operacao_id ?? (pedido as { natureza_operacao_id?: number }).natureza_operacao_id ?? null;

    if (empresaId == null) {
      throw new BadRequestException(
        'Empresa não informada. Selecione uma empresa no painel ou cadastre empresa_id no pedido.',
      );
    }
    if (naturezaOperacaoId == null) {
      throw new BadRequestException(
        'Natureza de operação não informada. Selecione no painel ou cadastre natureza_operacao_id no pedido.',
      );
    }

    const empresaIdNum = Number(empresaId);
    const naturezaOperacaoIdNum = Number(naturezaOperacaoId);
    const numeroNf = await this.supabase.getNextNumeroNf(empresaIdNum, SERIE_DEFAULT);
    const referencia = `PEDIDO-${pedidoId}-${Date.now()}`;

    const invoice = await this.supabase.createInvoice({
      pedido_id: pedidoId,
      empresa_id: empresaIdNum,
      natureza_operacao_id: naturezaOperacaoIdNum,
      numero_nf: numeroNf,
      serie: SERIE_DEFAULT,
      focus_id: referencia,
      status: 'PENDENTE',
    });

    await this.queue.add(
      'emitir',
      {
        invoiceId: invoice.id,
        pedidoId,
        referencia,
        empresa_id: empresaIdNum,
        natureza_operacao_id: naturezaOperacaoIdNum,
      } as EmissaoJobPayload,
      {
        jobId: invoice.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 1000 },
      },
    );

    return {
      invoiceId: invoice.id,
      status: 'PROCESSANDO',
      focus_id: referencia,
      mensagem: 'NFe enviada para processamento. Aguarde o webhook ou consulte o status.',
    };
  }
}
