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

  constructor(private config: ConfigService) {}

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

  async findInvoiceByPedidoId(pedidoId: number): Promise<FiscalInvoiceRow | null> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .eq('pedido_id', pedidoId)
      .maybeSingle();
    if (error) throw new Error(`fiscal_invoices select: ${error.message}`);
    return data as FiscalInvoiceRow | null;
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

  async updateInvoiceStatus(
    id: string,
    update: {
      status: FiscalInvoiceStatus;
      chave_acesso?: string | null;
      xml_url?: string | null;
      pdf_url?: string | null;
      error_message?: string | null;
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

  async listInvoices(limit = 50): Promise<FiscalInvoiceRow[]> {
    const { data, error } = await this.getClient()
      .from('fiscal_invoices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`fiscal_invoices list: ${error.message}`);
    return (data ?? []) as FiscalInvoiceRow[];
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
    const table = 'fiscal_sequencia';
    const { data: existing } = await this.getClient()
      .from(table)
      .select('id, ultimo_numero')
      .eq('empresa_id', empresaId)
      .eq('serie', serie)
      .maybeSingle();

    const nextNumero = existing
      ? (existing as FiscalSequenciaRow).ultimo_numero + 1
      : 1;

    if (existing) {
      const { error } = await this.getClient()
        .from(table)
        .update({ ultimo_numero: nextNumero })
        .eq('id', (existing as FiscalSequenciaRow).id);
      if (error) throw new Error(`fiscal_sequencia update: ${error.message}`);
    } else {
      const { error } = await this.getClient()
        .from(table)
        .insert({
          empresa_id: empresaId,
          serie,
          ultimo_numero: nextNumero,
        });
      if (error) throw new Error(`fiscal_sequencia insert: ${error.message}`);
    }

    return nextNumero;
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
