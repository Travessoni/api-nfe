/**
 * Payload NFe no formato Focus NFe (modelo 55).
 * Ref: https://doc.focusnfe.com.br e fluxo n8n existente.
 */
export interface FocusNFeItemPayload {
  numero_item: string;
  codigo_produto: string;
  descricao: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: string;
  valor_unitario_comercial: string;
  valor_unitario_tributavel?: string;
  unidade_tributavel?: string;
  codigo_ncm: string;
  quantidade_tributavel?: string;
  valor_bruto: string;
  icms_situacao_tributaria: string;
  icms_origem: string;
  /** Modalidade base de cálculo (modBC): 0=Margem, 1=Pauta, 2=Preço tabelado, 3=Valor operação. Obrigatório para ordem XML SEFAZ (modBC antes de vBC). */
  icms_modalidade_base_calculo?: string;
  pis_situacao_tributaria?: string;
  cofins_situacao_tributaria?: string;
}

export interface FocusNFePayload {
  data_emissao: string;
  data_entrada_saida: string;
  natureza_operacao: string;
  forma_pagamento?: string;
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
  inscricao_estadual_destinatario: string;
  logradouro_destinatario: string;
  numero_destinatario: string;
  bairro_destinatario: string;
  municipio_destinatario: string;
  uf_destinatario: string;
  pais_destinatario: string;
  cep_destinatario: string;
  telefone_destinatario?: string;
  // Valores
  valor_frete: string;
  valor_seguro: string;
  valor_total: string;
  valor_produtos: string;
  modalidade_frete?: string;
  items: FocusNFeItemPayload[];
}
