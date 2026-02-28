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
   * Emite NFe para o pedido. Cada emissão é independente: permite múltiplas NFe para a mesma venda.
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
    const pedido = await this.pedidoData.getPedido(pedidoId);
    if (!pedido) {
      throw new NotFoundException(`Pedido ${pedidoId} não encontrado`);
    }

    const empresaId = overrides?.empresa_id ?? null;
    const naturezaOperacaoId =
      overrides?.natureza_operacao_id ?? (pedido as { natureza_operacao_id?: number }).natureza_operacao_id ?? null;

    if (empresaId == null) {
      throw new BadRequestException(
        'Selecione a empresa no formulário (remetente da nota). A empresa não fica cadastrada no pedido.',
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

  /**
   * Emite NFe enviando o payload editado no modal (não monta a partir do pedido).
   * Cada emissão é independente: permite múltiplas NFe para a mesma venda.
   */
  async emitirComPayload(
    pedidoId: number,
    empresaId: number,
    naturezaId: number,
    payload: Record<string, unknown>,
  ): Promise<{
    invoiceId: string;
    status: string;
    focus_id: string | null;
    mensagem: string;
  }> {
    const numeroNf = await this.supabase.getNextNumeroNf(empresaId, SERIE_DEFAULT);
    const referencia = `PEDIDO-${pedidoId}-${Date.now()}`;
    const valorNotaRaw = (payload as Record<string, unknown>).valor_total;
    const valorNota =
      typeof valorNotaRaw === 'number'
        ? valorNotaRaw
        : valorNotaRaw != null && !Number.isNaN(Number(valorNotaRaw))
        ? Number(valorNotaRaw)
        : null;

    const invoice = await this.supabase.createInvoice({
      pedido_id: pedidoId,
      empresa_id: empresaId,
      natureza_operacao_id: naturezaId,
      numero_nf: numeroNf,
      serie: SERIE_DEFAULT,
      focus_id: referencia,
      status: 'PENDENTE',
      valor_nota: valorNota,
      payload_json: payload,
    });

    await this.queue.add(
      'emitir',
      {
        invoiceId: invoice.id,
        pedidoId,
        referencia,
        empresa_id: empresaId,
        natureza_operacao_id: naturezaId,
        payload,
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
