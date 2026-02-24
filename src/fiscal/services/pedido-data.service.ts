/**
 * Serviço que lê APENAS das tabelas existentes.
 * NÃO altera: pedidos_venda, itens_venda, regras*, naturezaOperacao.
 * Ajuste os nomes das tabelas/colunas conforme seu schema Supabase.
 */
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

export interface PedidoVendaRow {
  id: number;
  contatos_id: number;
  totalPedido?: number;
  totalFrete?: number;
  totalDesconto?: number;
  [key: string]: unknown;
}

/** Schema real: valorUnit, quantidade, subtotal, produto (FK). descricao/ncm e tributação vêm de produtos + produto_tributacao (via categoria). */
export interface ItemVendaRow {
  id: number;
  pedido_id: number;
  produto?: number;
  valorUnit?: number;
  quantidade: number;
  subtotal?: number;
  descricao?: string;
  ncm?: string;
  cfop?: string;
  unidade?: string;
  /** De produto_tributacao (match categoria.descricao = tipo) */
  codigo_ncm?: string;
  icms_origem?: string;
  icms_situacao_tributaria?: string;
  pis_situacao_tributaria?: string;
  cofins_situacao_tributaria?: string;
  [key: string]: unknown;
}

/** Endereços: rua, numero, bairro, cidade, estado, cep (empresa e contato usam esta tabela). */
export interface EnderecoRow {
  id: number;
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  complemento?: string;
  [key: string]: unknown;
}

/** Schema real empresas: nome, nomeFantasia, cnpj, iE, endereco (FK enderecos.id). */
export interface EmpresaRow {
  id: number;
  cnpj: string;
  nome: string;
  nomeFantasia?: string;
  iE?: string;
  endereco?: number;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  [key: string]: unknown;
}

/** Schema real contatos: contato_id (PK), nome, cpf_cnpj, ie, email. Endereço em enderecos.contato_id. */
export interface ClienteRow {
  contato_id: number;
  nome: string;
  cpf_cnpj?: string;
  ie?: string;
  email?: string;
  celular?: string;
  telefoneFixo?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  pais?: string;
  [key: string]: unknown;
}

export interface NaturezaOperacaoRow {
  id: number;
  descricao: string;
  [key: string]: unknown;
}

/** Regras tributárias (leitura) - ajuste campos conforme suas tabelas */
export interface RegraICMSRow {
  id: number;
  cst?: string;
  cfop?: string;
  origem?: number;
  [key: string]: unknown;
}

/** Retorno da função get_tributacao_by_produto_id (categoria + produto_tributacao). */
export interface TributacaoByProdutoRow {
  categoria_id: number;
  descricao_categoria: string | null;
  tributacao_id: number | null;
  codigo_ncm: string | null;
  icms_origem: string | null;
  icms_situacao_tributaria: string | null;
  pis_situacao_tributaria: string | null;
  cofins_situacao_tributaria: string | null;
  tipo: string | null;
  pis_aliquota_porcentual: number | null;
  cofins_aliquota_porcentual: number | null;
}

@Injectable()
export class PedidoDataService {
  private client: SupabaseClient | null = null;

  constructor(private config: ConfigService) {}

  private getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios');
      this.client = createClient(url, key);
    }
    return this.client;
  }

  async getPedido(pedidoId: number): Promise<PedidoVendaRow | null> {
    const { data, error } = await this.getClient()
      .from('pedidos_venda')
      .select('*')
      .eq('id', pedidoId)
      .maybeSingle();
    if (error) throw new Error(`pedidos_venda: ${error.message}`);
    return data as PedidoVendaRow | null;
  }

  async getItensVenda(pedidoId: number): Promise<ItemVendaRow[]> {
    const { data, error } = await this.getClient()
      .from('itens_venda')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('id');
    if (error) throw new Error(`itens_venda: ${error.message}`);
    return (data ?? []) as ItemVendaRow[];
  }

  /**
   * Itens do pedido enriquecidos com produto (descricao, ncm) e tributação por categoria
   * (produto_tributacao onde tipo = descricao da categoria) para uso no payload NFe.
   */
  async getItensVendaEnrichedForFiscal(pedidoId: number): Promise<ItemVendaRow[]> {
    const itensRaw = await this.getItensVenda(pedidoId);
    return Promise.all(
      itensRaw.map(async (item) => {
        const prodId = item.produto ?? (item as { produto_id?: number }).produto_id;
        let enriched: ItemVendaRow = { ...item };
        if (prodId != null) {
          const [prod, trib] = await Promise.all([
            this.getProduto(Number(prodId)),
            this.getTributacaoByProdutoId(Number(prodId)),
          ]);
          if (prod) {
            enriched.descricao = enriched.descricao ?? prod.descricao ?? prod.nome;
            enriched.ncm = enriched.ncm ?? prod.ncm;
          }
          if (trib?.codigo_ncm != null) enriched.codigo_ncm = trib.codigo_ncm;
          if (trib?.icms_origem != null) enriched.icms_origem = trib.icms_origem;
          if (trib?.icms_situacao_tributaria != null) enriched.icms_situacao_tributaria = trib.icms_situacao_tributaria;
          if (trib?.pis_situacao_tributaria != null) enriched.pis_situacao_tributaria = trib.pis_situacao_tributaria;
          if (trib?.cofins_situacao_tributaria != null) enriched.cofins_situacao_tributaria = trib.cofins_situacao_tributaria;
        }
        return enriched;
      }),
    );
  }

  async getEnderecoById(enderecoId: number): Promise<EnderecoRow | null> {
    const { data, error } = await this.getClient()
      .from('enderecos')
      .select('*')
      .eq('id', enderecoId)
      .maybeSingle();
    if (error) throw new Error(`enderecos: ${error.message}`);
    return data as EnderecoRow | null;
  }

  async getEnderecoByContatoId(contatoId: number): Promise<EnderecoRow | null> {
    const { data, error } = await this.getClient()
      .from('enderecos')
      .select('*')
      .eq('contato_id', contatoId)
      .maybeSingle();
    if (error) throw new Error(`enderecos: ${error.message}`);
    return data as EnderecoRow | null;
  }

  async getEmpresa(empresaId: number): Promise<EmpresaRow | null> {
    const { data, error } = await this.getClient()
      .from('empresas')
      .select('*')
      .eq('id', empresaId)
      .maybeSingle();
    if (error) throw new Error(`empresas: ${error.message}`);
    if (!data) return null;
    const row = data as Record<string, unknown>;
    const enderecoId = row.endereco != null ? Number(row.endereco) : null;
    if (enderecoId != null) {
      const endereco = await this.getEnderecoById(enderecoId);
      if (endereco) {
        row.logradouro = endereco.rua ?? row.logradouro;
        row.numero = endereco.numero ?? row.numero;
        row.bairro = endereco.bairro ?? row.bairro;
        row.municipio = endereco.cidade ?? row.municipio;
        row.uf = endereco.estado ?? row.uf;
        row.cep = endereco.cep ?? row.cep;
      }
    }
    return row as EmpresaRow;
  }

  async getCliente(contatoId: number): Promise<ClienteRow | null> {
    const { data, error } = await this.getClient()
      .from('contatos')
      .select('*')
      .eq('contato_id', contatoId)
      .maybeSingle();
    if (error) throw new Error(`contatos: ${error.message}`);
    if (!data) return null;
    const row = data as Record<string, unknown>;
    const endereco = await this.getEnderecoByContatoId(contatoId);
    if (endereco) {
      row.logradouro = endereco.rua ?? row.logradouro;
      row.numero = endereco.numero ?? row.numero;
      row.bairro = endereco.bairro ?? row.bairro;
      row.municipio = endereco.cidade ?? row.municipio;
      row.uf = endereco.estado ?? row.uf;
      row.cep = endereco.cep ?? row.cep;
    }
    row.pais = row.pais ?? 'Brasil';
    return row as ClienteRow;
  }

  async getProduto(produtoId: number): Promise<{ nome?: string; descricao?: string; ncm?: string } | null> {
    const { data, error } = await this.getClient()
      .from('produtos')
      .select('*')
      .eq('id', produtoId)
      .maybeSingle();
    if (error) return null;
    const row = data as Record<string, unknown> | null;
    if (!row) return null;
    return {
      nome: row.nome != null ? String(row.nome) : row.descricao != null ? String(row.descricao) : undefined,
      descricao: row.descricao != null ? String(row.descricao) : row.nome != null ? String(row.nome) : undefined,
      ncm: row.ncm != null ? String(row.ncm) : (row.codigo_ncm != null ? String(row.codigo_ncm) : undefined),
    };
  }

  /**
   * Tributação por produto_id: uma única query com JOINs.
   * Produtos → produto_categoria (categoria) → produto_tributacao (tipo = descricao da categoria).
   * Requer a função get_tributacao_by_produto_id no Supabase (migração 002).
   */
  async getTributacaoByProdutoId(produtoId: number): Promise<TributacaoByProdutoRow | null> {
    const { data, error } = await this.getClient()
      .rpc('get_tributacao_by_produto_id', { p_produto_id: produtoId });
    if (error) throw new Error(`get_tributacao_by_produto_id: ${error.message}`);
    const row = Array.isArray(data) ? data[0] : data;
    return (row ?? null) as TributacaoByProdutoRow | null;
  }

  async getNaturezaOperacao(id: number): Promise<NaturezaOperacaoRow | null> {
    const tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
    for (const table of tablesToTry) {
      const { data, error } = await this.getClient()
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return data as NaturezaOperacaoRow;
      if (error && !error.message.includes('does not exist') && !error.message.includes('relation') && !error.message.includes('42P01'))
        throw new Error(`naturezaOperacao: ${error.message}`);
    }
    return null;
  }

  async listEmpresas(): Promise<{ id: number; razao_social: string; nome_fantasia?: string }[]> {
    const { data, error } = await this.getClient()
      .from('empresas')
      .select('id, nome, nomeFantasia')
      .order('id');
    if (error) throw new Error(`empresas: ${error.message}`);
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      razao_social: String(row.nome ?? ''),
      nome_fantasia: row.nomeFantasia != null ? String(row.nomeFantasia) : undefined,
    }));
  }

  async listNaturezas(): Promise<{ id: number; descricao: string }[]> {
    const tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
    let lastError: string | null = null;
    for (const table of tablesToTry) {
      const { data, error } = await this.getClient()
        .from(table)
        .select('*')
        .order('id');
      if (!error) {
        return (data ?? []).map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          descricao: String(row.descricao ?? row.nome ?? ''),
        }));
      }
      lastError = error.message;
      if (!error.message.includes('does not exist') && !error.message.includes('relation') && !error.message.includes('42P01')) {
        break;
      }
    }
    throw new Error(`naturezaOperacao list: ${lastError ?? 'tabela não encontrada'}`);
  }
}
