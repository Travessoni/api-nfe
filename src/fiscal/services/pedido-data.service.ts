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
  /** Código regime tributário (1=Simples, 2=Simples excesso, 3=Normal). Usado no payload Focus NFe. */
  codRegime_tributario?: string;
  tem_regime_especial?: boolean;
  /** Tokens Focus NFe por ambiente (cadastrados no banco por empresa). */
  tokenHomologacao?: string;
  tokenProducao?: string;
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
  /** Indica se é consumidor final (payload: consumidor_final). */
  consumidorFinal?: boolean;
  /** Tipo contribuinte (informação fiscal). */
  tipo_contribuinte?: string;
  /** Contribuinte ICMS (preenchido pela verificação Focus NFe). */
  contribuinte_icms?: boolean;
  /** Indicador IE destinatário: 1 = contribuinte, 9 = não contribuinte. Nunca 2 (isento). */
  indIEDest?: 1 | 9;
  [key: string]: unknown;
}

export interface ContribuinteIcmsUpdate {
  ie: string;
  contribuinte_icms: boolean;
  indIEDest: 1 | 9;
}

export interface NaturezaOperacaoRow {
  id: number;
  descricao: string;
  /** FK empresas.id – natureza vinculada a uma empresa (null = global). */
  empresa?: number | null;
  /** Informações adicionais ao contribuinte (campo infoAdicionais ou info_adicionais na tabela). */
  infoAdicionais?: string;
  /** Código regime tributário (fallback para empresa). */
  cod_regimeTributario?: string;
  /** Consumidor final (fallback para contato). */
  consumidorFinal?: boolean;
  /** Indicador presença comprador (1–9). */
  indicadorPresenca?: string;
  [key: string]: unknown;
}

/** Regras ICMS por natureza (regrasICMS). */
export interface RegraICMSRow {
  id: number;
  destinos: string | null;
  cfop: string | null;
  aliquota_icms: number | null;
  situacaoTributaria: string | null;
  base_calculo_percentual: number | null;
  aliquota_internaUF: number | null;
  /** Alíquota interestadual (ex.: 7 ou 12). Obrigatório na regra para operação interestadual/DIFAL. */
  aliquota_interestadual?: number | null;
  naturezaRef: number | null;
  [key: string]: unknown;
}

/** Regras PIS por natureza (regrasPIS). */
export interface RegraPISRow {
  id: number;
  situacaoTributaria: string | null;
  aliquota: number | null;
  base: number | null;
  destinos: string | null;
  naturezaRef: number | null;
  [key: string]: unknown;
}

/** Regras COFINS por natureza (regrasCOFINS). */
export interface RegraCOFINSRow {
  id: number;
  situacaoTributaria: string | null;
  aliquota: number | null;
  base: number | null;
  destinos: string | null;
  naturezaRef: number | null;
  [key: string]: unknown;
}

/** Regras IPI por natureza (regrasIPI). */
export interface RegraIPIRow {
  id: number;
  situacaoTributaria: string | null;
  aliq: number | null;
  codEnquadramento: number | null;
  naturezaRef: number | null;
  destinos: string | null;
  [key: string]: unknown;
}

/** Regras de retenções por natureza (regrasRETENCOES). */
export interface RegraRetencoesRow {
  id: number;
  possui_retencao_csrf: boolean | null;
  aliquota_csrf: number | null;
  possui_retencao_ir: boolean | null;
  aliquota_ir: number | null;
  naturezaRef: number | null;
  destinos: string | null;
  [key: string]: unknown;
}

/** Regras IS - Imposto Seletivo por natureza (regrasIS). Reforma Tributária 2026. */
export interface RegraISRow {
  id: number;
  situacaoTributaria: string | null;
  classificacaoTributaria: string | null;
  aliquota: number | null;
  base: number | null;
  destinos: string | null;
  naturezaRef: number | null;
  [key: string]: unknown;
}

/** Regras IBS - Imposto sobre Bens e Serviços por natureza (regrasIBS). Reforma Tributária 2026. */
export interface RegraIBSRow {
  id: number;
  situacaoTributaria: string | null;
  classificacaoTributaria: string | null;
  aliquota: number | null;
  base: number | null;
  destinos: string | null;
  naturezaRef: number | null;
  [key: string]: unknown;
}

/** Regras CBS - Contribuição sobre Bens e Serviços por natureza (regrasCBS). Reforma Tributária 2026. */
export interface RegraCBSRow {
  id: number;
  situacaoTributaria: string | null;
  classificacaoTributaria: string | null;
  aliquota: number | null;
  base: number | null;
  destinos: string | null;
  naturezaRef: number | null;
  [key: string]: unknown;
}

/** Extrai código CST (ex: "00") de situacaoTributaria ("00 - Tributada integralmente" ou "102"). */
export function extrairCstDeSituacaoTributaria(situacao: string | null | undefined): string | null {
  if (!situacao || typeof situacao !== 'string') return null;
  const trimmed = situacao.trim();
  // Formato "00 - Descrição" ou "102 - Descrição"
  const m = trimmed.match(/^(\d{2,3})\s*-/);
  if (m) return m[1];
  // Formato numérico puro: "00", "102", "400"
  if (/^\d{2,3}$/.test(trimmed)) return trimmed;
  return null;
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

  constructor(private config: ConfigService) { }

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
          if (trib?.tipo != null) enriched.tipo = trib.tipo;
          if (trib?.pis_aliquota_porcentual != null) enriched.pis_aliquota_porcentual = String(trib.pis_aliquota_porcentual);
          if (trib?.cofins_aliquota_porcentual != null) enriched.cofins_aliquota_porcentual = String(trib.cofins_aliquota_porcentual);
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
    try {
      const { data, error } = await this.getClient()
        .from('enderecos')
        .select('*')
        .eq('contato_id', contatoId)
        .maybeSingle();
      if (error) return null;
      return data as EnderecoRow | null;
    } catch {
      return null;
    }
  }

  /** Retorna todos os endereços do contato (para seleção no formulário de NF). */
  async getEnderecosByContatoId(contatoId: number): Promise<Array<EnderecoRow & { tipo?: string }>> {
    try {
      const { data, error } = await this.getClient()
        .from('enderecos')
        .select('*')
        .eq('contato_id', contatoId);
      if (error || !data) return [];
      return (data as Array<EnderecoRow & { tipo?: string }>) || [];
    } catch {
      return [];
    }
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

  /** Busca empresa pelo CNPJ (apenas dígitos). Usado para obter regime tributário quando o payload não traz empresa_id. */
  async getEmpresaByCnpj(cnpj: string): Promise<EmpresaRow | null> {
    const digits = (cnpj ?? '').replace(/\D/g, '');
    if (digits.length !== 14) return null;
    const { data, error } = await this.getClient()
      .from('empresas')
      .select('*')
      .eq('cnpj', digits)
      .maybeSingle();
    if (error || !data) return null;
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

  /** Retorna o nome do contato pelo pedido_id (para listagem de NF). Tenta contato_id e id na tabela contatos. */
  async getNomeContatoByPedidoId(pedidoId: number): Promise<string | null> {
    const info = await this.getPedidoInfoParaListagem(pedidoId);
    return info.nomeContato;
  }

  /** Retorna nome do contato e total do pedido (pedido_id -> pedidos_venda -> contatos_id -> contatos). */
  async getPedidoInfoParaListagem(pedidoId: number): Promise<{
    nomeContato: string | null;
    totalPedido: number | null;
  }> {
    const pedido = await this.getPedido(pedidoId);
    if (!pedido) return { nomeContato: null, totalPedido: null };
    const ped = pedido as Record<string, unknown>;
    const totalPedido =
      ped.totalPedido != null ? Number(ped.totalPedido) : ped.valor_total != null ? Number(ped.valor_total) : null;
    const contatosId =
      ped.contatos_id != null
        ? Number(ped.contatos_id)
        : ped.contato_id != null
          ? Number(ped.contato_id)
          : ped.cliente_id != null
            ? Number(ped.cliente_id)
            : null;
    if (contatosId == null) return { nomeContato: null, totalPedido };
    const fetchContato = async (table: string): Promise<Record<string, unknown> | null> => {
      const byContatoId = await this.getClient()
        .from(table)
        .select('*')
        .eq('contato_id', contatosId)
        .maybeSingle();
      if (!byContatoId.error && byContatoId.data) return byContatoId.data as Record<string, unknown>;
      const byId = await this.getClient()
        .from(table)
        .select('*')
        .eq('id', contatosId)
        .maybeSingle();
      if (!byId.error && byId.data) return byId.data as Record<string, unknown>;
      return null;
    };
    let data = await fetchContato('contatos');
    if (!data) data = await fetchContato('contato');
    const nomeContato = data
      ? (data.nome ?? data.razao_social ?? data.nome_fantasia ?? data.name ?? null) as string | null
      : null;
    return { nomeContato, totalPedido };
  }

  /**
   * Resolve o contato do pedido (pedido_id -> pedidos_venda.contatos_id -> contatos).
   * Usado pelo frontend para exibir "Cliente" no formulário de NF sem entrada manual.
   */
  async getContatoByPedidoId(pedidoId: number): Promise<{ contato_id: number | null; nome: string | null }> {
    const pedido = await this.getPedido(pedidoId);
    if (!pedido) return { contato_id: null, nome: null };
    const ped = pedido as Record<string, unknown>;
    const contatosId =
      ped.contatos_id != null
        ? Number(ped.contatos_id)
        : ped.contato_id != null
          ? Number(ped.contato_id)
          : ped.cliente_id != null
            ? Number(ped.cliente_id)
            : null;
    if (contatosId == null) return { contato_id: null, nome: null };

    const fetchContato = async (table: string): Promise<Record<string, unknown> | null> => {
      const byContatoId = await this.getClient()
        .from(table)
        .select('*')
        .eq('contato_id', contatosId)
        .maybeSingle();
      if (!byContatoId.error && byContatoId.data) return byContatoId.data as Record<string, unknown>;
      const byId = await this.getClient()
        .from(table)
        .select('*')
        .eq('id', contatosId)
        .maybeSingle();
      if (!byId.error && byId.data) return byId.data as Record<string, unknown>;
      return null;
    };

    let data = await fetchContato('contatos');
    if (!data) data = await fetchContato('contato');
    const nome = data ? ((data.nome ?? data.razao_social ?? data.nome_fantasia ?? data.name ?? null) as string | null) : null;
    return { contato_id: contatosId, nome };
  }

  /**
   * Atualiza contato com dados de contribuinte ICMS (ie, contribuinte_icms, indIEDest).
   * Tenta atualizar na tabela "contatos" por id; se a tabela for "contato", ajuste o nome.
   */
  async updateContatoContribuinte(
    contatoId: number,
    data: ContribuinteIcmsUpdate,
  ): Promise<boolean> {
    const client = this.getClient();
    const payload: Record<string, unknown> = {
      ie: data.ie || null,
      inscricao_estadual: data.ie || null,
      contribuinte_icms: data.contribuinte_icms,
      indIEDest: data.indIEDest,
    };
    const { error: errContatos } = await client
      .from('contatos')
      .update(payload)
      .eq('id', contatoId);
    if (!errContatos) return true;
    const { error: errContato } = await client
      .from('contato')
      .update({ ...payload })
      .eq('id', contatoId);
    return !errContato;
  }

  async getCliente(contatoId: number): Promise<ClienteRow | null> {
    const fetchFromTable = async (table: string): Promise<Record<string, unknown> | null> => {
      const byContatoId = await this.getClient()
        .from(table)
        .select('*')
        .eq('contato_id', contatoId)
        .maybeSingle();
      if (!byContatoId.error && byContatoId.data) return byContatoId.data as Record<string, unknown>;
      const byId = await this.getClient()
        .from(table)
        .select('*')
        .eq('id', contatoId)
        .maybeSingle();
      if (!byId.error && byId.data) {
        const r = byId.data as Record<string, unknown>;
        r.contato_id = contatoId;
        return r;
      }
      return null;
    };
    let row = await fetchFromTable('contatos');
    if (!row) row = await fetchFromTable('contato');
    if (!row) return null;
    row.contato_id = contatoId;
    this.normalizeClienteRow(row);
    const endereco = await this.getEnderecoByContatoId(contatoId);
    if (endereco) {
      row.logradouro = endereco.rua ?? row.logradouro;
      row.numero = endereco.numero ?? row.numero;
      row.bairro = endereco.bairro ?? row.bairro;
      row.municipio = endereco.cidade ?? row.municipio;
      row.uf = endereco.estado ?? row.uf;
      row.cep = endereco.cep ?? row.cep;
      row.complemento = endereco.complemento ?? row.complemento;
    }
    const enderecosList = await this.getEnderecosByContatoId(contatoId);
    row.enderecos = enderecosList.map((e) => ({
      rua: e.rua,
      logradouro: e.rua,
      numero: e.numero,
      bairro: e.bairro,
      cidade: e.cidade,
      municipio: e.cidade,
      uf: e.estado,
      estado: e.estado,
      cep: e.cep,
      complemento: e.complemento,
      tipo: (e as EnderecoRow & { tipo?: string }).tipo,
    }));
    row.pais = row.pais ?? 'Brasil';
    return row as ClienteRow;
  }

  /** Normaliza campos do contato para PJ (cnpj/razao_social) e PF (cpf/nome). */
  private normalizeClienteRow(row: Record<string, unknown>): void {
    const cpfCnpj = row.cpf_cnpj ?? row.cnpj ?? row.cpf;
    if (cpfCnpj != null && row.cpf_cnpj == null) row.cpf_cnpj = String(cpfCnpj).trim();
    const nome = row.nome ?? row.razao_social ?? row.nome_fantasia ?? row.name;
    if (nome != null && row.nome == null) row.nome = String(nome).trim();
    const ie = row.ie ?? row.inscricao_estadual;
    if (ie != null && row.ie == null) row.ie = String(ie).trim();
  }

  /** Formata dígitos como CPF (11) ou CNPJ (14) para busca em coluna formatada. */
  private formatDocForSearch(digits: string): string {
    const d = digits.replace(/\D/g, '');
    if (d.length <= 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d2) =>
        a + (b ? `.${b}` : '') + (c ? `.${c}` : '') + (d2 ? `-${d2}` : ''),
      );
    }
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d2, e) =>
      a + (b ? `.${b}` : '') + (c ? `.${c}` : '') + (d2 ? `/${d2}` : '') + (e ? `-${e}` : ''),
    );
  }

  /** Busca contatos por nome ou cpf/cnpj (tabela contatos). Várias buscas com .ilike() para ser robusto ao schema. */
  async searchContatos(busca: string): Promise<{ id: number; nome: string; nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string }[]> {
    const q = (busca || '').trim();
    if (q.length < 2) return [];
    const escaped = q.replace(/'/g, "''");
    const pattern = `%${escaped}%`;
    const client = this.getClient();
    const normalize = (r: Record<string, unknown>) => ({
      id: Number(r.id ?? r.contato_id ?? 0),
      nome: String(r.nome ?? r.nome_fantasia ?? r.razao_social ?? (r as { name?: string }).name ?? ''),
      nome_fantasia: r.nome_fantasia != null ? String(r.nome_fantasia) : undefined,
      razao_social: r.razao_social != null ? String(r.razao_social) : undefined,
      cpf_cnpj: r.cpf_cnpj != null ? String(r.cpf_cnpj) : undefined,
    });
    const seen = new Set<number>();
    const out: { id: number; nome: string; nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string }[] = [];

    const add = (rows: unknown[]) => {
      (rows || []).forEach((row) => {
        const r = row as Record<string, unknown>;
        const id = Number(r.id ?? r.contato_id);
        if (id && !seen.has(id)) {
          seen.add(id);
          out.push(normalize(r));
        }
      });
    };

    try {
      const onlyDigits = /^\d+$/.test(q);
      if (onlyDigits) {
        const digitsPattern = pattern;
        const { data: dataRaw, error: errRaw } = await client.from('contatos').select('*').ilike('cpf_cnpj', digitsPattern).limit(20);
        if (!errRaw && dataRaw?.length) add(dataRaw);
        const formatted = this.formatDocForSearch(q);
        if (formatted !== q) {
          const patternFormatted = `%${formatted.replace(/'/g, "''")}%`;
          const { data: dataFmt, error: errFmt } = await client.from('contatos').select('*').ilike('cpf_cnpj', patternFormatted).limit(20);
          if (!errFmt && dataFmt?.length) add(dataFmt);
        }
      }

      let byNome = await client.from('contatos').select('*').ilike('nome', pattern).limit(20);
      if (byNome.error) {
        const byName = await client.from('contatos').select('*').ilike('name', pattern).limit(20);
        if (!byName.error && byName.data?.length) add(byName.data);
      } else if (byNome.data?.length) {
        add(byNome.data);
      }

      if (!onlyDigits) {
        const byRazao = await client.from('contatos').select('*').ilike('razao_social', pattern).limit(20);
        if (!byRazao.error && byRazao.data?.length) add(byRazao.data);
        const byFantasia = await client.from('contatos').select('*').ilike('nome_fantasia', pattern).limit(20);
        if (!byFantasia.error && byFantasia.data?.length) add(byFantasia.data);
      }

      return out.slice(0, 20);
    } catch {
      return [];
    }
  }

  /**
   * Busca transportadoras na tabela contatos, filtrando tipo_cadastro = 'transportadora'.
   * Pesquisa principal pelo campo nome; se não encontrar, tenta razão social e nome fantasia.
   */
  async searchTransportadoras(busca: string): Promise<{ id: number; nome: string; nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string }[]> {
    const q = (busca || '').trim();
    if (q.length < 2) return [];
    const escaped = q.replace(/'/g, "''");
    const pattern = `%${escaped}%`;
    const client = this.getClient();
    const normalize = (r: Record<string, unknown>) => ({
      id: Number(r.id ?? r.contato_id ?? 0),
      nome: String(r.nome ?? r.nome_fantasia ?? r.razao_social ?? (r as { name?: string }).name ?? ''),
      nome_fantasia: r.nome_fantasia != null ? String(r.nome_fantasia) : undefined,
      razao_social: r.razao_social != null ? String(r.razao_social) : undefined,
      cpf_cnpj: r.cpf_cnpj != null ? String(r.cpf_cnpj) : undefined,
    });
    const seen = new Set<number>();
    const out: { id: number; nome: string; nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string }[] = [];
    const add = (rows: unknown[] | null | undefined) => {
      (rows || []).forEach((row) => {
        const r = row as Record<string, unknown>;
        const id = Number(r.id ?? r.contato_id);
        if (id && !seen.has(id)) {
          seen.add(id);
          out.push(normalize(r));
        }
      });
    };
    try {
      // 1) Buscar por nome
      let { data, error } = await client
        .from('contatos')
        .select('*')
        .eq('tipo_cadastro', 'transportadora')
        .ilike('nome', pattern)
        .limit(20);
      if (!error && data?.length) add(data);

      // 2) Fallback por razão social / nome fantasia
      if (!out.length) {
        const { data: dataAlt, error: errAlt } = await client
          .from('contatos')
          .select('*')
          .eq('tipo_cadastro', 'transportadora')
          .or(`razao_social.ilike.${pattern},nome_fantasia.ilike.${pattern}`)
          .limit(20);
        if (!errAlt && dataAlt?.length) add(dataAlt);
      }
      return out;
    } catch {
      return [];
    }
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

  /** Regras ICMS por natureza. Tenta tabela regrasICMS/regrasicms e coluna naturezaRef/naturezaref (Postgres pode armazenar em minúsculas). */
  async getRegrasICMSByNatureza(naturezaId: number): Promise<RegraICMSRow[]> {
    const tables = ['regrasICMS', 'regrasicms'];
    const cols = ['naturezaRef', 'naturezaref'];
    let lastError: string | null = null;
    for (const table of tables) {
      for (const col of cols) {
        const { data, error } = await this.getClient()
          .from(table)
          .select('*')
          .eq(col, naturezaId);
        if (error) lastError = error.message;
        if (!error && data?.length) return data as RegraICMSRow[];
      }
    }
    if (lastError && process.env.NODE_ENV !== 'production') {
      console.warn('[getRegrasICMSByNatureza] nenhuma linha encontrada. Último erro Supabase:', lastError);
    }
    return [];
  }

  /**
   * Retorna uma regra cujo destinos contém a UF (ex.: "SP" ou "AC, SP, MG") ou cujo destinos é "qualquer".
   * Prioridade 1: regra com destinos contendo ufDestinatario.
   * Prioridade 2: regra com destinos = 'qualquer' (case-insensitive).
   */
  private destinosContemUF(destinos: string | null | undefined, uf: string): boolean {
    if (!uf) return false;
    const ufNorm = String(uf).trim().toUpperCase();
    if (!destinos || String(destinos).trim() === '') return false;
    const partes = String(destinos)
      .split(/[,\s]+/)
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    if (partes.some((p) => p === 'QUALQUER')) return true;
    return partes.includes(ufNorm);
  }

  private pickRegraPorDestino<T extends { destinos?: string | null;[key: string]: unknown }>(
    regras: T[],
    ufDestinatario: string,
  ): T | null {
    if (!regras?.length) return null;
    const uf = String(ufDestinatario ?? '').trim().toUpperCase();
    const getDestinos = (r: T): string | null | undefined => {
      const rec = r as Record<string, unknown>;
      const d = rec.destinos ?? rec.Destinos;
      return d == null ? null : String(d);
    };
    const qualquer = (d: string | null | undefined) =>
      d != null && String(d).trim().toLowerCase() === 'qualquer';
    const matchUF = regras.find((r) => this.destinosContemUF(getDestinos(r), uf));
    if (matchUF) return matchUF;
    const matchQualquer = regras.find((r) => qualquer(getDestinos(r)));
    return matchQualquer ?? null;
  }

  /** Regra ICMS para a UF do destinatário (prioridade: destinos contém UF, depois destinos = 'qualquer'). */
  async getRegraICMSParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraICMSRow | null> {
    const regras = await this.getRegrasICMSByNatureza(naturezaId);
    return this.pickRegraPorDestino(regras, ufDestinatario);
  }

  /** Regra PIS para a UF do destinatário (tabela regrasPIS, coluna naturezaRef e destinos). */
  async getRegraPISParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraPISRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasPIS')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error || !data?.length) return null;
    return this.pickRegraPorDestino(data as RegraPISRow[], ufDestinatario);
  }

  /** Regra COFINS para a UF do destinatário (tabela regrasCOFINS, coluna naturezaRef e destinos). */
  async getRegraCOFINSParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraCOFINSRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasCOFINS')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error || !data?.length) return null;
    return this.pickRegraPorDestino(data as RegraCOFINSRow[], ufDestinatario);
  }

  /** Regra IPI para a UF do destinatário (tabela regrasIPI, coluna naturezaRef e destinos). */
  async getRegraIPIParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraIPIRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasIPI')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error || !data?.length) return null;
    return this.pickRegraPorDestino(data as RegraIPIRow[], ufDestinatario);
  }

  /** Regra Retenções por natureza (tabela regrasRETENCOES não possui coluna destinos; retorna primeira regra da natureza). */
  async getRegraRetencoesParaDestino(
    naturezaId: number,
    _ufDestinatario: string,
  ): Promise<RegraRetencoesRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasRETENCOES')
      .select('*')
      .eq('naturezaRef', naturezaId)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as RegraRetencoesRow;
  }

  /** Regra IS para a UF do destinatário (tabela regrasis, colunas naturezaRef e destinos). */
  async getRegraISParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraISRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasis')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error || !data?.length) return null;
    return this.pickRegraPorDestino(data as RegraISRow[], ufDestinatario);
  }

  /** Regra IBS para a UF do destinatário (tabela regrasibs, colunas naturezaRef e destinos). */
  async getRegraIBSParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraIBSRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasibs')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error || !data?.length) return null;
    return this.pickRegraPorDestino(data as RegraIBSRow[], ufDestinatario);
  }

  /** Regra CBS para a UF do destinatário (tabela regrascbs, colunas naturezaRef e destinos). */
  async getRegraCBSParaDestino(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<RegraCBSRow | null> {
    const { data, error } = await this.getClient()
      .from('regrascbs')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error || !data?.length) return null;
    return this.pickRegraPorDestino(data as RegraCBSRow[], ufDestinatario);
  }

  /** Regras PIS por natureza de operação (tabela regrasPIS). Retorna todas as regras para seleção por UF do destinatário. */
  async getRegrasPISByNatureza(naturezaId: number): Promise<RegraPISRow[]> {
    const { data, error } = await this.getClient()
      .from('regrasPIS')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error) return [];
    return (data ?? []) as RegraPISRow[];
  }

  /** Regras COFINS por natureza de operação (tabela regrasCOFINS). Retorna todas as regras para seleção por UF do destinatário. */
  async getRegrasCOFINSByNatureza(naturezaId: number): Promise<RegraCOFINSRow[]> {
    const { data, error } = await this.getClient()
      .from('regrasCOFINS')
      .select('*')
      .eq('naturezaRef', naturezaId);
    if (error) return [];
    return (data ?? []) as RegraCOFINSRow[];
  }

  /** Regras IPI por natureza de operação (tabela regrasIPI). */
  async getRegrasIPIByNatureza(naturezaId: number): Promise<RegraIPIRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasIPI')
      .select('*')
      .eq('naturezaRef', naturezaId)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as RegraIPIRow;
  }

  /** Regras de retenções por natureza de operação (tabela regrasRETENCOES). */
  async getRegrasRetencoesByNatureza(naturezaId: number): Promise<RegraRetencoesRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasRETENCOES')
      .select('*')
      .eq('naturezaRef', naturezaId)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as RegraRetencoesRow;
  }

  /** Regras IS por natureza (tabela regrasis, coluna naturezaRef). */
  async getRegrasISByNatureza(naturezaId: number): Promise<RegraISRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasis')
      .select('*')
      .eq('naturezaRef', naturezaId)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as RegraISRow;
  }

  /** Regras IBS por natureza (tabela regrasibs, coluna naturezaRef). */
  async getRegrasIBSByNatureza(naturezaId: number): Promise<RegraIBSRow | null> {
    const { data, error } = await this.getClient()
      .from('regrasibs')
      .select('*')
      .eq('naturezaRef', naturezaId)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as RegraIBSRow;
  }

  /** Regras CBS por natureza (tabela regrascbs, coluna naturezaRef). */
  async getRegrasCBSByNatureza(naturezaId: number): Promise<RegraCBSRow | null> {
    const { data, error } = await this.getClient()
      .from('regrascbs')
      .select('*')
      .eq('naturezaRef', naturezaId)
      .limit(1);
    if (error || !data?.length) return null;
    return data[0] as RegraCBSRow;
  }

  async getNaturezaOperacao(id: number): Promise<NaturezaOperacaoRow | null> {
    const tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
    let lastError: string | null = null;
    for (const table of tablesToTry) {
      const { data, error } = await this.getClient()
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) return data as NaturezaOperacaoRow;
      if (error) lastError = error.message;
      // continua na próxima tabela (não lança para permitir tentar as outras)
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

  /**
   * Lista naturezas de operação. Se empresaId for informado, retorna naturezas da empresa ou globais (empresa IS NULL).
   */
  async listNaturezas(empresaId?: number): Promise<{ id: number; descricao: string; empresa?: number | null }[]> {
    const tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
    let lastError: string | null = null;
    for (const table of tablesToTry) {
      const empCol = table === 'natureza_operacao' ? 'empresa_id' : 'empresa';
      let query = this.getClient().from(table).select('*').order('id');
      if (empresaId != null && empresaId > 0) {
        query = query.or(`${empCol}.eq.${empresaId},${empCol}.is.null`);
      }
      const { data, error } = await query;
      if (!error) {
        return (data ?? []).map((row: Record<string, unknown>) => {
          const emp = row.empresa != null ? Number(row.empresa) : (row.empresa_id != null ? Number(row.empresa_id) : null);
          return {
            id: Number(row.id),
            descricao: String(row.descricao ?? row.nome ?? ''),
            empresa: emp,
          };
        });
      }
      lastError = error.message;
      if (!error.message.includes('does not exist') && !error.message.includes('relation') && !error.message.includes('42P01')) {
        break;
      }
    }
    throw new Error(`naturezaOperacao list: ${lastError ?? 'tabela não encontrada'}`);
  }

  private async getNaturezaTable(): Promise<string> {
    const tablesToTry = ['naturezaOperacao', 'natureza_operacao', 'naturezas_operacao'];
    for (const table of tablesToTry) {
      const { error } = await this.getClient().from(table).select('id').limit(1);
      if (!error) return table;
    }
    return 'naturezaOperacao';
  }

  /**
   * Cria uma natureza de operação. Retorna o registro inserido com id.
   */
  async createNaturezaOperacao(payload: Record<string, unknown>): Promise<NaturezaOperacaoRow> {
    const table = await this.getNaturezaTable();
    const aliquotaFunruralVal = payload.aliquotaFunrural ?? payload.aliquota_funrural;
    const empresaNum = (payload.empresa != null && payload.empresa !== ''
      ? Number(payload.empresa)
      : (payload.empresa_id != null && payload.empresa_id !== '' ? Number(payload.empresa_id) : null));
    const empresaVal = empresaNum != null && !Number.isNaN(empresaNum) && empresaNum > 0 ? empresaNum : null;
    const row: Record<string, unknown> = {
      descricao: payload.descricao ?? '',
      serie: payload.serie ?? '1',
      tipo: payload.tipo ?? 'saida',
      cod_regimeTributario: payload.cod_regimeTributario ?? payload.cod_regime_tributario ?? null,
      indicadorPresenca: payload.indicadorPresenca ?? payload.indicador_presenca ?? null,
      fatura: payload.fatura ?? payload.faturada ?? null,
      consumidorFinal: payload.consumidorFinal ?? payload.consumidor_final ?? true,
      operacao_devolucao: payload.operacao_devolucao ?? payload.operacaoDevolucao ?? false,
      infoAdicionais: payload.infoAdicionais ?? payload.info_adicionais ?? null,
      naturezaPadrao: payload.naturezaPadrao ?? payload.natureza_padrao ?? null,
      presumido_pis_cofins: payload.presumidoPisCofins ?? payload.presumido_pis_cofins ?? null,
      somar_outras_despesas: payload.somarOutrasDespesas ?? payload.somar_outras_despesas ?? null,
      aliquota_funrural:
        aliquotaFunruralVal != null && aliquotaFunruralVal !== ''
          ? Number(aliquotaFunruralVal)
          : null,
      compra_produtor_rural: payload.compraProdutorRural ?? payload.compra_produtor_rural ?? null,
      descontar_funrural: payload.descontarFunrural ?? payload.descontar_funrural ?? null,
      tipo_perc_aprox_trib: payload.tipoPercAproxTrib ?? payload.tipo_perc_aprox_trib ?? null,
      tipo_desconto: payload.tipoDesconto ?? payload.tipo_desconto ?? null,
      incluir_frete_base_ipi:
        payload.incluirFreteBaseIpi !== undefined && payload.incluirFreteBaseIpi !== null
          ? Boolean(payload.incluirFreteBaseIpi)
          : true,
    };
    if (table === 'natureza_operacao') {
      (row as Record<string, unknown>).empresa_id = empresaVal;
    } else {
      (row as Record<string, unknown>).empresa = empresaVal;
    }
    const { data, error } = await this.getClient()
      .from(table)
      .insert(row)
      .select('*')
      .single();
    if (error) throw new Error(`naturezaOperacao insert: ${error.message}`);
    return data as NaturezaOperacaoRow;
  }

  /**
   * Atualiza uma natureza de operação por id.
   */
  async updateNaturezaOperacao(id: number, payload: Record<string, unknown>): Promise<NaturezaOperacaoRow> {
    const table = await this.getNaturezaTable();
    const aliquotaFunruralVal = payload.aliquotaFunrural ?? payload.aliquota_funrural;
    const empresaNum = (payload.empresa != null && payload.empresa !== ''
      ? Number(payload.empresa)
      : (payload.empresa_id != null && payload.empresa_id !== '' ? Number(payload.empresa_id) : null));
    const empresaVal = empresaNum != null && !Number.isNaN(empresaNum) && empresaNum > 0 ? empresaNum : null;
    const row: Record<string, unknown> = {
      descricao: payload.descricao ?? '',
      serie: payload.serie ?? '1',
      tipo: payload.tipo ?? 'saida',
      cod_regimeTributario: payload.cod_regimeTributario ?? payload.cod_regime_tributario ?? null,
      indicadorPresenca: payload.indicadorPresenca ?? payload.indicador_presenca ?? null,
      fatura: payload.fatura ?? payload.faturada ?? null,
      consumidorFinal: payload.consumidorFinal ?? payload.consumidor_final ?? true,
      operacao_devolucao: payload.operacao_devolucao ?? payload.operacaoDevolucao ?? false,
      infoAdicionais: payload.infoAdicionais ?? payload.info_adicionais ?? null,
      naturezaPadrao: payload.naturezaPadrao ?? payload.natureza_padrao ?? null,
      presumido_pis_cofins: payload.presumidoPisCofins ?? payload.presumido_pis_cofins ?? null,
      somar_outras_despesas: payload.somarOutrasDespesas ?? payload.somar_outras_despesas ?? null,
      aliquota_funrural:
        aliquotaFunruralVal != null && aliquotaFunruralVal !== ''
          ? Number(aliquotaFunruralVal)
          : null,
      compra_produtor_rural: payload.compraProdutorRural ?? payload.compra_produtor_rural ?? null,
      descontar_funrural: payload.descontarFunrural ?? payload.descontar_funrural ?? null,
      tipo_perc_aprox_trib: payload.tipoPercAproxTrib ?? payload.tipo_perc_aprox_trib ?? null,
      tipo_desconto: payload.tipoDesconto ?? payload.tipo_desconto ?? null,
      incluir_frete_base_ipi:
        payload.incluirFreteBaseIpi !== undefined && payload.incluirFreteBaseIpi !== null
          ? Boolean(payload.incluirFreteBaseIpi)
          : true,
    };
    if (table === 'natureza_operacao') {
      (row as Record<string, unknown>).empresa_id = empresaVal;
    } else {
      (row as Record<string, unknown>).empresa = empresaVal;
    }
    const { data, error } = await this.getClient()
      .from(table)
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`naturezaOperacao update: ${error.message}`);
    return data as NaturezaOperacaoRow;
  }

  /**
   * Persiste regras tributárias para uma natureza (naturezaRef = naturezaId).
   * Remove regras existentes e insere as do payload. Regras vazias = apenas delete.
   */
  async saveRegrasForNatureza(
    naturezaId: number,
    regras: {
      icms?: Array<Record<string, unknown>>;
      pis?: Array<Record<string, unknown>>;
      cofins?: Array<Record<string, unknown>>;
      ipi?: Array<Record<string, unknown>>;
      retencoes?: Array<Record<string, unknown>>;
      is?: Array<Record<string, unknown>>;
      ibs?: Array<Record<string, unknown>>;
      cbs?: Array<Record<string, unknown>>;
    },
  ): Promise<void> {
    const client = this.getClient();
    const natRef = naturezaId;

    const deleteByNatureza = async (tableOrTables: string | string[], col: string) => {
      const tables = Array.isArray(tableOrTables) ? tableOrTables : [tableOrTables];
      for (const table of tables) {
        const { error } = await client.from(table).delete().eq(col, natRef);
        if (error && !error.message.includes('does not exist') && !error.message.includes('relation')) {
          throw new Error(`${table} delete: ${error.message}`);
        }
      }
    };

    const list = (arr: Array<Record<string, unknown>> | undefined) => Array.isArray(arr) ? arr : [];

    await deleteByNatureza(['regrasICMS', 'regrasicms'], 'naturezaRef');
    for (const r of list(regras.icms)) {
      const tables = ['regrasICMS', 'regrasicms'];
      for (const table of tables) {
        const { error } = await client.from(table).insert({
          naturezaRef: natRef,
          destinos: r.destinos ?? 'Qualquer',
          cfop: r.cfop ?? null,
          aliquota_icms: r.aliquota_icms ?? r.aliquota ?? null,
          situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
          base_calculo_percentual: r.base_calculo_percentual ?? r.base ?? 100,
        });
        if (!error) break;
        if (error.message.includes('does not exist') || error.message.includes('relation')) continue;
        throw new Error(`regrasICMS insert: ${error.message}`);
      }
    }

    await deleteByNatureza('regrasPIS', 'naturezaRef');
    for (const r of list(regras.pis)) {
      const { error } = await client.from('regrasPIS').insert({
        naturezaRef: natRef,
        destinos: r.destinos ?? 'Qualquer',
        aliquota: r.aliquota ?? null,
        base: r.base ?? 100,
        situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
      });
      if (error) throw new Error(`regrasPIS insert: ${error.message}`);
    }

    await deleteByNatureza('regrasCOFINS', 'naturezaRef');
    for (const r of list(regras.cofins)) {
      const { error } = await client.from('regrasCOFINS').insert({
        naturezaRef: natRef,
        destinos: r.destinos ?? 'Qualquer',
        aliquota: r.aliquota ?? null,
        base: r.base ?? 100,
        situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
      });
      if (error) throw new Error(`regrasCOFINS insert: ${error.message}`);
    }

    await deleteByNatureza('regrasIPI', 'naturezaRef');
    for (const r of list(regras.ipi)) {
      const { error } = await client.from('regrasIPI').insert({
        naturezaRef: natRef,
        destinos: r.destinos ?? 'Qualquer',
        aliq: r.aliq ?? r.aliquota ?? null,
        codEnquadramento: r.codEnquadramento ?? r.cod_enquadramento ?? null,
        situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
      });
      if (error) throw new Error(`regrasIPI insert: ${error.message}`);
    }

    await deleteByNatureza('regrasRETENCOES', 'naturezaRef');
    const retList = list(regras.retencoes);
    if (retList.length > 0) {
      const ret = retList[0];
      const { error } = await client.from('regrasRETENCOES').insert({
        naturezaRef: natRef,
        possui_retencao_csrf: ret.possui_retencao_csrf ?? ret.possuiRetencaoCsrf ?? false,
        aliquota_csrf: ret.aliquota_csrf ?? ret.aliquotaCsrf ?? null,
        possui_retencao_ir: ret.possui_retencao_ir ?? ret.possuiRetencaoIr ?? false,
        aliquota_ir: ret.aliquota_ir ?? ret.aliquotaIr ?? null,
      });
      if (error) throw new Error(`regrasRETENCOES insert: ${error.message}`);
    }

    await deleteByNatureza('regrasis', 'naturezaRef');
    for (const r of list(regras.is)) {
      const { error } = await client.from('regrasis').insert({
        naturezaRef: natRef,
        destinos: r.destinos ?? 'Qualquer',
        aliquota: r.aliquota ?? null,
        base: r.base ?? 100,
        situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
      });
      if (error) throw new Error(`regrasis insert: ${error.message}`);
    }

    await deleteByNatureza('regrasibs', 'naturezaRef');
    for (const r of list(regras.ibs)) {
      const { error } = await client.from('regrasibs').insert({
        naturezaRef: natRef,
        destinos: r.destinos ?? 'Qualquer',
        aliquota: r.aliquota ?? null,
        base: r.base ?? 100,
        situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
      });
      if (error) throw new Error(`regrasibs insert: ${error.message}`);
    }

    await deleteByNatureza('regrascbs', 'naturezaRef');
    for (const r of list(regras.cbs)) {
      const { error } = await client.from('regrascbs').insert({
        naturezaRef: natRef,
        destinos: r.destinos ?? 'Qualquer',
        aliquota: r.aliquota ?? null,
        base: r.base ?? 100,
        situacaoTributaria: r.situacaoTributaria ?? r.situacao_tributaria ?? null,
      });
      if (error) throw new Error(`regrascbs insert: ${error.message}`);
    }
  }

  /** Busca produtos por nome (para autocomplete no formulário de NF). */
  async searchProdutosPorNome(q: string, limit = 20): Promise<{ id: number; nome: string | null; sku: string | null; preco: number | null }[]> {
    const term = String(q || '').trim();
    if (!term) return [];
    const { data, error } = await this.getClient()
      .from('produtos')
      .select('id, nome, sku, preco')
      .ilike('nome', '%' + term + '%')
      .limit(limit);
    if (error) return [];
    return (data ?? []).map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      nome: row.nome != null ? String(row.nome) : null,
      sku: row.sku != null ? String(row.sku) : null,
      preco: row.preco != null ? Number(row.preco) : null,
    }));
  }
}
