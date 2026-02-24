export type FiscalInvoiceStatus =
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'AUTORIZADO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'ERRO';

export interface FiscalInvoiceRow {
  id: string;
  pedido_id: number;
  empresa_id: number;
  natureza_operacao_id: number;
  numero_nf: number | null;
  serie: string;
  focus_id: string | null;
  chave_acesso: string | null;
  status: FiscalInvoiceStatus;
  xml_url: string | null;
  pdf_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiscalSequenciaRow {
  id: number;
  empresa_id: number;
  serie: string;
  ultimo_numero: number;
  created_at: string;
  updated_at: string;
}

export interface FiscalEventoRow {
  id: number;
  invoice_id: string;
  tipo_evento: string;
  payload: Record<string, unknown>;
  created_at: string;
}
