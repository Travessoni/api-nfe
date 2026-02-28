export type FiscalInvoiceStatus =
  | 'RASCUNHO'
  | 'PENDENTE'
  | 'PROCESSANDO'
  | 'AUTORIZADO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'ERRO';

export const REGRA_TRIBUTARIA_NAO_ENCONTRADA = 'REGRA_TRIBUTARIA_NAO_ENCONTRADA' as const;
export type ImpostoRegra =
  | 'ICMS'
  | 'PIS'
  | 'COFINS'
  | 'IPI'
  | 'RETENCOES'
  | 'IS'
  | 'IBS'
  | 'CBS';

export class RegraTributariaNaoEncontradaError extends Error {
  readonly code = REGRA_TRIBUTARIA_NAO_ENCONTRADA;
  constructor(
    public readonly imposto: ImpostoRegra,
    public readonly ufDestinatario: string,
    public readonly naturezaId: number,
    customMessage?: string,
  ) {
    super(
      customMessage ||
      `Nenhuma regra tributária encontrada para ${imposto} na UF ${ufDestinatario} e natureza ${naturezaId}. Cadastre uma regra específica para a UF ou com destinos = 'qualquer'.`,
    );
    this.name = 'RegraTributariaNaoEncontradaError';
    Object.setPrototypeOf(this, RegraTributariaNaoEncontradaError.prototype);
  }
}

export interface FiscalInvoiceRow {
  id: string;
  pedido_id: number;
  empresa_id: number;
  natureza_operacao_id: number;
  /** Valor total da nota (denormalizado do payload.valor_total). */
  valor_nota: number | null;
  numero_nf: number | null;
  serie: string;
  focus_id: string | null;
  chave_acesso: string | null;
  status: FiscalInvoiceStatus;
  xml_url: string | null;
  pdf_url: string | null;
  error_message: string | null;
  payload_json?: Record<string, unknown> | null;
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
