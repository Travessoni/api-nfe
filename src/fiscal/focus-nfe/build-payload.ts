import {
  PedidoVendaRow,
  ItemVendaRow,
  EmpresaRow,
  ClienteRow,
  NaturezaOperacaoRow,
} from '../services/pedido-data.service';
import { FocusNFePayload, FocusNFeItemPayload } from './focus-nfe.types';

const ISO_DATE = (d: Date) => d.toISOString().slice(0, 19);

function onlyNumbers(s: string | undefined): string {
  if (!s) return '';
  return String(s).replace(/\D/g, '');
}

/** cpf_cnpj: 11 dígitos = CPF, senão CNPJ. */
function cpfOuCnpj(val: string | undefined): { cpf?: string; cnpj?: string } {
  const num = onlyNumbers(val ?? '');
  if (num.length === 11) return { cpf: num };
  if (num.length === 14) return { cnpj: num };
  return {};
}

/**
 * Monta o payload Focus NFe a partir dos dados do pedido.
 * Schema real: pedidos_venda (totalPedido, totalFrete, totalDesconto), contatos+enderecos, empresas+enderecos, itens_venda (valorUnit, quantidade, subtotal, produto).
 */
export function buildFocusNFePayload(
  pedido: PedidoVendaRow,
  itens: ItemVendaRow[],
  empresa: EmpresaRow,
  cliente: ClienteRow,
  naturezaOperacao: NaturezaOperacaoRow,
): FocusNFePayload {
  const now = ISO_DATE(new Date());
  const valorFrete = Number(pedido.totalFrete ?? (pedido as Record<string, unknown>).valor_frete ?? 0);
  const valorTotal = Number(pedido.totalPedido ?? (pedido as Record<string, unknown>).valor_total ?? 0);
  const valorProdutos = itens.reduce((s, i) => s + Number(i.subtotal ?? (i as Record<string, unknown>).valor_total ?? 0), 0);

  const cnpjEmitente = onlyNumbers(empresa.cnpj ?? '');
  const dest = cpfOuCnpj(cliente.cpf_cnpj);

  const items: FocusNFeItemPayload[] = itens.map((item, idx) => {
    const qtd = Number(item.quantidade ?? 0);
    const vUnit = Number(item.valorUnit ?? (item as Record<string, unknown>).valor_unitario ?? 0);
    const valorBruto = (qtd * vUnit).toFixed(2);
    const ncmRaw = item.codigo_ncm ?? item.ncm ?? '';
    const ncm = (ncmRaw ? String(ncmRaw).replace(/\D/g, '').padStart(8, '0').slice(0, 8) : '00000000') || '00000000';
    return {
      numero_item: String(idx + 1),
      codigo_produto: String(item.produto ?? (item as Record<string, unknown>).produto_id ?? item.id ?? idx + 1),
      descricao: String(item.descricao ?? 'Item'),
      cfop: String(item.cfop ?? '5102'),
      unidade_comercial: String(item.unidade ?? 'UN'),
      quantidade_comercial: String(qtd),
      valor_unitario_comercial: vUnit.toFixed(2),
      valor_unitario_tributavel: vUnit.toFixed(2),
      unidade_tributavel: String(item.unidade ?? 'UN'),
      codigo_ncm: ncm,
      quantidade_tributavel: String(qtd),
      valor_bruto: valorBruto,
      icms_situacao_tributaria: item.icms_situacao_tributaria ?? '400',
      icms_origem: item.icms_origem ?? '0',
      icms_modalidade_base_calculo: '0',
      pis_situacao_tributaria: item.pis_situacao_tributaria ?? '07',
      cofins_situacao_tributaria: item.cofins_situacao_tributaria ?? '07',
    };
  });

  const payload: FocusNFePayload = {
    data_emissao: now,
    data_entrada_saida: now,
    natureza_operacao: naturezaOperacao.descricao ?? 'Venda de mercadoria',
    forma_pagamento: '0',
    tipo_documento: '1',
    finalidade_emissao: '1',
    cnpj_emitente: cnpjEmitente,
    nome_emitente: empresa.nome ?? '',
    nome_fantasia_emitente: empresa.nomeFantasia ?? undefined,
    logradouro_emitente: empresa.logradouro ?? '',
    numero_emitente: String(empresa.numero ?? 'S/N'),
    bairro_emitente: empresa.bairro ?? '',
    municipio_emitente: empresa.municipio ?? '',
    uf_emitente: String(empresa.uf ?? 'MG'),
    cep_emitente: onlyNumbers(empresa.cep ?? '').padStart(8, '0').slice(0, 8) || '00000000',
    inscricao_estadual_emitente: String(empresa.iE ?? (empresa as Record<string, unknown>).inscricao_estadual ?? ''),
    telefone_emitente: (empresa as Record<string, unknown>).telefone as string | undefined,
    nome_destinatario: cliente.nome ?? '',
    inscricao_estadual_destinatario: cliente.ie ?? 'ISENTO',
    logradouro_destinatario: cliente.logradouro ?? '',
    numero_destinatario: String(cliente.numero ?? 'S/N'),
    bairro_destinatario: cliente.bairro ?? '',
    municipio_destinatario: cliente.municipio ?? '',
    uf_destinatario: String(cliente.uf ?? 'EX'),
    pais_destinatario: cliente.pais ?? 'Brasil',
    cep_destinatario: onlyNumbers(cliente.cep ?? '').padStart(8, '0').slice(0, 8) || '00000000',
    telefone_destinatario: cliente.celular ?? cliente.telefoneFixo ?? '',
    valor_frete: valorFrete.toFixed(2),
    valor_seguro: '0.00',
    valor_total: valorTotal.toFixed(2),
    valor_produtos: valorProdutos.toFixed(2),
    modalidade_frete: '0',
    items,
  };

  if (dest.cnpj) payload.cnpj_destinatario = dest.cnpj;
  else if (dest.cpf) payload.cpf_destinatario = dest.cpf;

  return payload;
}
