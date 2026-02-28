import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FiscalInvoiceRow,
  FiscalInvoiceStatus,
  FiscalSequenciaRow,
  FiscalEventoRow,
} from '../types/fiscal.types';

@Injectable()
export class FiscalSupabaseService implements OnModuleDestroy {
  private client: SupabaseClient | null = null;

  constructor(private config: ConfigService) { }

  getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) {
        throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
      }
      this.client = createClient(url, key);
    }
    return this.client;
  }

  async onModuleDestroy() {
    this.client = null;
  }

  // --- fiscal_invoices ---

  /** Retorna a NFe mais recente do pedido. */
  async findInvoiceByPedidoId(pedidoId: number): Promise<FiscalInvoiceRow | null> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`fiscal_invoices select: ${error.message}`);
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return row as FiscalInvoiceRow | null;
  }

  /** Retorna o rascunho mais recente do pedido (para múltiplas NFe por pedido). */
  async findRascunhoByPedidoId(pedidoId: number): Promise<FiscalInvoiceRow | null> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .eq('pedido_id', pedidoId)
      .eq('status', 'RASCUNHO')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`fiscal_invoices select rascunho: ${error.message}`);
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return row as FiscalInvoiceRow | null;
  }

  async findInvoiceById(id: string): Promise<FiscalInvoiceRow | null> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`fiscal_invoices select: ${error.message}`);
    return data as FiscalInvoiceRow | null;
  }

  async findInvoiceByFocusId(focusId: string): Promise<FiscalInvoiceRow | null> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .eq('focus_id', focusId)
      .maybeSingle();
    if (error) throw new Error(`fiscal_invoices select: ${error.message}`);
    return data as FiscalInvoiceRow | null;
  }

  async createInvoice(insert: {
    pedido_id: number;
    empresa_id: number;
    natureza_operacao_id: number;
    numero_nf: number;
    serie: string;
    focus_id: string;
    status: FiscalInvoiceStatus;
    valor_nota?: number | null;
    payload_json?: Record<string, unknown> | null;
    error_message?: string | null;
  }): Promise<FiscalInvoiceRow> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .insert(insert)
      .select('*')
      .single();
    if (error) throw new Error(`fiscal_invoices insert: ${error.message}`);
    return data as FiscalInvoiceRow;
  }

  /** Salva ou atualiza rascunho (apenas banco; não envia para API). payload_json opcional. Permite múltiplos rascunhos/notas por pedido. */
  async saveDraft(draft: {
    pedido_id: number;
    empresa_id: number;
    natureza_operacao_id: number;
    payload_json?: Record<string, unknown> | null;
  }): Promise<FiscalInvoiceRow> {
    const existente = await this.findRascunhoByPedidoId(draft.pedido_id);
    const payloadUpdate = draft.payload_json !== undefined ? { payload_json: draft.payload_json } : {};
    const valorNotaFromPayload =
      draft.payload_json && typeof (draft.payload_json as Record<string, unknown>).valor_total === 'number'
        ? Number((draft.payload_json as Record<string, unknown>).valor_total)
        : null;
    const valorNotaUpdate =
      valorNotaFromPayload != null && !Number.isNaN(valorNotaFromPayload)
        ? { valor_nota: valorNotaFromPayload }
        : {};
    if (existente?.status === 'RASCUNHO') {
      const { data, error } = await this.getClient()
        .from('fiscal_invoices')
        .update({
          empresa_id: draft.empresa_id,
          natureza_operacao_id: draft.natureza_operacao_id,
          ...payloadUpdate,
          ...valorNotaUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id)
        .select('*')
        .single();
      if (error) throw new Error(`fiscal_invoices update draft: ${error.message}`);
      return data as FiscalInvoiceRow;
    }
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .insert({
        pedido_id: draft.pedido_id,
        empresa_id: draft.empresa_id,
        natureza_operacao_id: draft.natureza_operacao_id,
        valor_nota: valorNotaFromPayload,
        numero_nf: null,
        serie: '1',
        focus_id: null,
        status: 'RASCUNHO',
        payload_json: draft.payload_json ?? null,
      })
      .select('*')
      .single();
    if (error) throw new Error(`fiscal_invoices insert draft: ${error.message}`);
    return data as FiscalInvoiceRow;
  }

  /** Reabre invoice (ex.: ERRO) para nova emissão com payload. */
  async reopenInvoiceForEmit(
    id: string,
    update: {
      focus_id: string;
      numero_nf: number;
      empresa_id: number;
      natureza_operacao_id: number;
      payload_json: Record<string, unknown>;
      valor_nota?: number | null;
    },
  ): Promise<FiscalInvoiceRow> {
    const valorNotaFromPayload =
      update.payload_json && typeof update.payload_json.valor_total === 'number'
        ? Number(update.payload_json.valor_total)
        : null;
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .update({
        status: 'PENDENTE',
        focus_id: update.focus_id,
        numero_nf: update.numero_nf,
        empresa_id: update.empresa_id,
        natureza_operacao_id: update.natureza_operacao_id,
        payload_json: update.payload_json,
        ...(valorNotaFromPayload != null && !Number.isNaN(valorNotaFromPayload)
          ? { valor_nota: valorNotaFromPayload }
          : {}),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`fiscal_invoices reopen: ${error.message}`);
    return data as FiscalInvoiceRow;
  }

  /** Converte rascunho em pendente e define focus_id e numero_nf (para envio à API). */
  async convertDraftToPendente(
    id: string,
    update: { focus_id: string; numero_nf: number; payload_json?: Record<string, unknown> | null },
  ): Promise<FiscalInvoiceRow> {
    const upd: Record<string, unknown> = {
      status: 'PENDENTE',
      focus_id: update.focus_id,
      numero_nf: update.numero_nf,
      updated_at: new Date().toISOString(),
    };
    if (update.payload_json !== undefined) {
      upd.payload_json = update.payload_json;
      const valorNotaFromPayload =
        update.payload_json && typeof update.payload_json.valor_total === 'number'
          ? Number(update.payload_json.valor_total)
          : null;
      if (valorNotaFromPayload != null && !Number.isNaN(valorNotaFromPayload)) {
        upd.valor_nota = valorNotaFromPayload;
      }
    }
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .update(upd)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`fiscal_invoices convertDraft: ${error.message}`);
    return data as FiscalInvoiceRow;
  }

  async updateInvoiceStatus(
    id: string,
    update: {
      status: FiscalInvoiceStatus;
      chave_acesso?: string | null;
      xml_url?: string | null;
      pdf_url?: string | null;
      error_message?: string | null;
      numero_nf?: number | null;
      valor_nota?: number | null;
    },
  ): Promise<FiscalInvoiceRow> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`fiscal_invoices update: ${error.message}`);
    return data as FiscalInvoiceRow;
  }

  async setInvoiceProcessing(id: string): Promise<FiscalInvoiceRow> {
    return this.updateInvoiceStatus(id, { status: 'PROCESSANDO' });
  }

  async listInvoices(params: {
    page?: number;
    limit?: number;
    status?: string;
    empresa_id?: number;
    search?: string;
  } = {}): Promise<{ data: FiscalInvoiceRow[]; count: number }> {
    const { page = 1, limit = 20, status, empresa_id, search } = params;

    let query = this.getClient()
      .from('fiscal_invoices')
      .select('*', { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (empresa_id) {
      query = query.eq('empresa_id', empresa_id);
    }
    if (search && search.trim() !== '') {
      const numSearch = Number(search.replace(/\D/g, ''));
      if (!Number.isNaN(numSearch) && numSearch > 0) {
        query = query.or(`numero_nf.eq.${numSearch},pedido_id.eq.${numSearch}`);
      }
    }

    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(`fiscal_invoices list: ${error.message}`);

    return {
      data: (data ?? []) as FiscalInvoiceRow[],
      count: count ?? 0,
    };
  }

  /** Notas em PROCESSANDO há mais de X minutos (para sincronização com Focus NFe quando webhook não chega). */
  async listInvoicesProcessandoOlderThan(minutes: number): Promise<FiscalInvoiceRow[]> {
    const before = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .eq('status', 'PROCESSANDO')
      .lt('updated_at', before)
      .not('focus_id', 'is', null);
    if (error) throw new Error(`fiscal_invoices list PROCESSANDO: ${error.message}`);
    return (data ?? []) as FiscalInvoiceRow[];
  }

  // --- fiscal_sequencia ---

  async getNextNumeroNf(empresaId: number, serie: string): Promise<number> {
    const { data, error } = await this.getClient()
      .rpc('next_numero_nf', { p_empresa_id: empresaId, p_serie: serie });
    if (error) throw new Error(`next_numero_nf RPC: ${error.message}`);
    const num = typeof data === 'number' ? data : Number(data);
    if (!num || num < 1) throw new Error(`next_numero_nf retornou valor inválido: ${data}`);
    return num;
  }

  // --- fiscal_eventos ---

  async createEvento(
    invoiceId: string,
    tipoEvento: string,
    payload: Record<string, unknown>,
  ): Promise<FiscalEventoRow> {
    const { data, error } = await this.getClient()
      .from('fiscal_eventos')
      .insert({ invoice_id: invoiceId, tipo_evento: tipoEvento, payload })
      .select('*')
      .single();
    if (error) throw new Error(`fiscal_eventos insert: ${error.message}`);
    return data as FiscalEventoRow;
  }

  async listEventosByInvoiceId(invoiceId: string): Promise<FiscalEventoRow[]> {
    const { data, error } = await this.getClient()
      .from('fiscal_eventos')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`fiscal_eventos list: ${error.message}`);
    return (data ?? []) as FiscalEventoRow[];
  }

  async findPayloadEnviado(invoiceId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.getClient()
      .from('fiscal_eventos')
      .select('payload')
      .eq('invoice_id', invoiceId)
      .eq('tipo_evento', 'payload_enviado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`fiscal_eventos findPayload: ${error.message}`);
    return data && (data as { payload?: unknown }).payload
      ? ((data as { payload: Record<string, unknown> }).payload)
      : null;
  }
}
