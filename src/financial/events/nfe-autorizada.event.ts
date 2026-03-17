/**
 * Contrato do evento NfeAutorizadaEvent.
 *
 * DEFINIDO MAS NÃO CONECTADO — implementar handler em fase futura.
 * Quando uma NF-e for autorizada, este evento será emitido pelo módulo fiscal
 * e consumido pelo módulo financeiro para gerar lançamentos automáticos.
 */
export class NfeAutorizadaEvent {
  /** ID da NF-e no sistema (fiscal_invoices.id) */
  nfeId!: string;

  /** Valor total da NF-e */
  valorTotal!: number;

  /** ID do cliente (contatos.contato_id — bigint) */
  clienteId?: number;

  /** Data de emissão da NF-e */
  dataEmissao!: Date;

  /** ID da conta bancária destino (financeiro_instituicoes.id — uuid) */
  contaBancariaDestinoId?: string;
}
