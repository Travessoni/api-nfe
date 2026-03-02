/** CSTs que tributam ICMS e exigem icms_modalidade_base_calculo (00, 10, 20, 51, 70, 90). */
export const CST_COM_ICMS_TRIBUTADO = new Set(['00', '10', '20', '51', '70', '90']);

/** CSOSN do Simples Nacional que aceitam DIFAL (102 = tributada sem permissão de crédito). */
export const CSOSN_COM_DIFAL = new Set(['102', '900']);

/**
 * Payload NFe no formato Focus NFe (modelo 55).
 * Ref: https://doc.focusnfe.com.br — valores numéricos enviados como number.
 */
export interface FocusNFeItemPayload {
  numero_item: string;
  codigo_produto: string;
  descricao: string;
  cfop: string;
  unidade_comercial: string;
  /** API espera number. */
  quantidade_comercial: number;
  /** API espera number. */
  valor_unitario_comercial: number;
  valor_unitario_tributavel?: number;
  unidade_tributavel?: string;
  codigo_ncm: string;
  quantidade_tributavel?: number;
  /** API espera number. */
  valor_bruto: number;
  /** Frete rateado do item (soma dos itens deve ser igual ao valor_frete do totalizador — evita rejeição 535 SEFAZ). */
  valor_frete?: number;
  icms_situacao_tributaria: string;
  icms_origem: string;
  /** Apenas para CST 00, 10, 20, 51, 70, 90. */
  icms_modalidade_base_calculo?: string;
  /** Obrigatório para CST 00: base de cálculo do ICMS. */
  icms_base_calculo?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  /** DIFAL: obrigatório quando local_destino=2 e consumidor_final=1. */
  icms_base_calculo_uf_destino?: number;
  icms_aliquota_interna_uf_destino?: number;
  icms_aliquota_interestadual?: number;
  icms_valor_uf_destino?: number;
  icms_valor_uf_remetente?: number;
  pis_situacao_tributaria?: string;
  cofins_situacao_tributaria?: string;
  ipi_situacao_tributaria?: string;
  ipi_codigo_enquadramento_legal?: string;
  ipi_aliquota?: number;
  ipi_valor?: number;
  pis_base_calculo?: number;
  pis_aliquota_porcentual?: number;
  pis_valor?: number;
  cofins_base_calculo?: number;
  cofins_aliquota_porcentual?: number;
  cofins_valor?: number;
  codigo_barras_comercial?: string;
  codigo_barras_tributavel?: string;
  icms_percentual_partilha?: number;
  fcp_percentual_uf_destino?: number;
  fcp_valor_uf_destino?: number;
  fcp_base_calculo_uf_destino?: number;
  ibs_cbs_situacao_tributaria?: string;
  ibs_cbs_classificacao_tributaria?: string;
  ibs_cbs_base_calculo?: number;
  ibs_uf_aliquota?: number;
  ibs_uf_valor?: number;
  ibs_mun_aliquota?: number;
  ibs_mun_valor?: number;
  ibs_valor_total?: number;
  cbs_aliquota?: number;
  cbs_valor?: number;
}

export interface FocusNFePayload {
  data_emissao: string;
  data_entrada_saida: string;
  natureza_operacao: string;
  tipo_documento?: string;
  finalidade_emissao?: string;
  // Emitente
  cnpj_emitente: string;
  nome_emitente: string;
  nome_fantasia_emitente?: string;
  logradouro_emitente: string;
  numero_emitente: string;
  bairro_emitente: string;
  municipio_emitente: string;
  uf_emitente: string;
  cep_emitente: string;
  inscricao_estadual_emitente: string;
  telefone_emitente?: string;
  // Destinatário
  nome_destinatario: string;
  cpf_destinatario?: string;
  cnpj_destinatario?: string;
  inscricao_estadual_destinatario?: string;
  logradouro_destinatario: string;
  numero_destinatario: string;
  bairro_destinatario: string;
  municipio_destinatario: string;
  uf_destinatario: string;
  pais_destinatario: string;
  cep_destinatario: string;
  complemento_destinatario?: string;
  /** Omitir quando vazio (não enviar string vazia). */
  telefone_destinatario?: string;
  // Valores (API espera number)
  valor_frete: number;
  valor_seguro: number;
  valor_total: number;
  valor_produtos: number;
  valor_desconto?: number;
  modalidade_frete?: string;
  /** 1 = mesma UF, 2 = UF diferente, 3 = exterior. Obrigatório. */
  local_destino: 1 | 2 | 3;
  /** 1 = contribuinte ICMS, 2 = isento, 9 = não contribuinte (CPF). Obrigatório. */
  indicador_inscricao_estadual_destinatario: 1 | 2 | 9;
  /** Nome correto na API: consumidor_final. 1 = sim, 0 = não. */
  consumidor_final?: string;
  /** 1 = Simples Nacional, 2 = Simples excesso, 3 = Regime Normal */
  regime_tributario_emitente?: string;
  /** Nome correto na API: presenca_comprador. 1–9 (nunca texto). Fallback: 2 (internet). */
  presenca_comprador?: string;
  indicador_intermediario?: string;
  cnpj_intermediador?: string;
  identificador_intermediador?: string;
  /** Informações complementares ao contribuinte (ex.: texto da natureza de operação). */
  informacoes_adicionais_contribuinte?: string;
  ibs_cbs_situacao_tributaria?: string;
  ibs_cbs_classificacao_tributaria?: string;
  ibs_cbs_base_calculo?: number;
  ibs_uf_aliquota?: number;
  ibs_uf_valor?: number;
  ibs_mun_aliquota?: number;
  ibs_mun_valor?: number;
  ibs_valor_total?: number;
  cbs_aliquota?: number;
  cbs_valor?: number;
  items: FocusNFeItemPayload[];
}
