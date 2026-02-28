import {
  PedidoVendaRow,
  ItemVendaRow,
  EmpresaRow,
  ClienteRow,
  NaturezaOperacaoRow,
  RegraICMSRow,
  RegraPISRow,
  RegraCOFINSRow,
  RegraIPIRow,
  RegraRetencoesRow,
  RegraISRow,
  RegraIBSRow,
  RegraCBSRow,
  extrairCstDeSituacaoTributaria,
} from '../services/pedido-data.service';
import { FocusNFePayload, FocusNFeItemPayload, CST_COM_ICMS_TRIBUTADO, CSOSN_COM_DIFAL } from './focus-nfe.types';
import { RegraTributariaNaoEncontradaError } from '../types/fiscal.types';
import { getAliquotaInterestadualCONFAZ, getAliquotaInternaPorUF } from './difal-aliquotas';

/** Valida campo obrigatório e lança erro descritivo se ausente. */
function validarCampoObrigatorio(valor: string | undefined | null, campo: string, entidade: string): void {
  if (!valor || String(valor).trim() === '') {
    throw new Error(`${entidade}: ${campo} é obrigatório mas está vazio. Verifique o cadastro.`);
  }
}

/** Regras tributárias já resolvidas por destino (uma regra por imposto ou null). */
export interface RegrasTributarias {
  icms: RegraICMSRow | null;
  pis: RegraPISRow | null;
  cofins: RegraCOFINSRow | null;
  ipi: RegraIPIRow | null;
  retencoes: RegraRetencoesRow | null;
  is: RegraISRow | null;
  ibs: RegraIBSRow | null;
  cbs: RegraCBSRow | null;
}

/** Data/hora em horário de Brasília (SEFAZ exige; evita rejeição "posterior ao horário de recebimento"). Formato: YYYY-MM-DDTHH:mm:ss */
function nowBrasilia(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

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

/** Ajusta CFOP conforme destino: 5xxx = interna (mesmo UF), 6xxx = interestadual (outro UF). Evita rejeição "CFOP de operação interna e idDest diferente de 1". */
function cfopPorDestino(cfopBase: string, isInterestadual: boolean): string {
  return sanitizeCfop(cfopBase, isInterestadual);
}

/**
 * Garante CFOP com 4 dígitos numéricos (exigido pelo schema XML da NFe).
 * - Remove caracteres não numéricos (ex.: "x108" → "108"); prefixa com 5 (interna) ou 6 (interestadual) se precisar.
 * - Se já tiver 4 dígitos começando com 5 ou 6, ajusta conforme destino (5↔6).
 */
function sanitizeCfop(cfopRaw: string, isInterestadual: boolean): string {
  const raw = String(cfopRaw ?? '').trim();
  const digits = raw.replace(/\D/g, '');
  const prefix = isInterestadual ? '6' : '5';
  if (digits.length >= 4) {
    const first = digits[0];
    const rest = digits.slice(1, 4);
    if (first === '5' && isInterestadual) return '6' + rest;
    if (first === '6' && !isInterestadual) return '5' + rest;
    if (first === '5' || first === '6') return digits.slice(0, 4);
    return prefix + rest;
  }
  if (digits.length > 0) return prefix + digits.padStart(3, '0').slice(-3);
  // CFOP é obrigatório — fallback silencioso gera autuação fiscal
  throw new Error(`CFOP inválido ou não configurado: "${cfopRaw}". Configure o CFOP na natureza de operação ou no produto.`);
}

/** Normaliza presenca_comprador para 1–9 (API não aceita texto). Fallback recomendado: '2' (internet). */
function normalizarPresencaComprador(val: string | undefined): string {
  if (val == null || String(val).trim() === '') return '2';
  const s = String(val).trim();
  if (/^[1-9]$/.test(s)) return s;
  const lower = s.toLowerCase();
  if (lower.includes('internet') || lower === '2') return '2';
  if (lower.includes('presencial') || lower === '1') return '1';
  return '9';
}

/**
 * Normaliza CFOP dos itens conforme UF emitente x destinatário.
 * 5xxx = operação interna (mesmo estado), 6xxx = interestadual. Evita rejeição SEFAZ quando destino é outro UF.
 */
function normalizePayloadCfopItems(
  payload: Record<string, unknown>,
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  const ufEmitente = String(payload.uf_emitente ?? '').trim().toUpperCase();
  const ufDestinatario = String(payload.uf_destinatario ?? '').trim().toUpperCase();
  const isInterestadual = ufEmitente.length === 2 && ufDestinatario.length === 2 && ufEmitente !== ufDestinatario;

  return items.map((item) => {
    const it = { ...item } as Record<string, unknown>;
    const cfop = String(it.cfop ?? '').trim();
    it.cfop = sanitizeCfop(cfop || '108', isInterestadual);
    return it;
  });
}

/**
 * Converte CST (2 dígitos) para CSOSN (3 dígitos) quando o emitente é Simples Nacional (CRT=1).
 * Evita rejeição SEFAZ: "Informado CST para emissor do Simples Nacional (CRT=1)".
 * CST 00 (tributada integralmente) → CSOSN 102 (tributada sem permissão de crédito), aceita DIFAL.
 */
const CST_PARA_CSOSN_SIMPLES_NACIONAL: Record<string, string> = {
  '00': '102',
  '10': '102',
  '20': '102',
  '51': '102',
  '70': '102',
  '90': '102',
  '40': '400',
  '41': '400',
  '50': '500',
  '60': '400',
};

function cstParaCsosnSimplesNacional(cst: string): string {
  const s = String(cst ?? '').trim();
  if (s.length === 3 && /^\d{3}$/.test(s)) return s; // já é CSOSN
  return CST_PARA_CSOSN_SIMPLES_NACIONAL[s] ?? '102';
}

function normalizePayloadCstParaSimplesNacional(
  payload: Record<string, unknown>,
  items: Record<string, unknown>[],
): Record<string, unknown>[] {
  const regime = String(payload.regime_tributario_emitente ?? '').trim();
  if (regime !== '1') return items;
  return items.map((item) => {
    const it = { ...item } as Record<string, unknown>;
    const cst = String(it.icms_situacao_tributaria ?? '').trim();
    if (cst.length === 2 && /^\d{2}$/.test(cst)) {
      it.icms_situacao_tributaria = cstParaCsosnSimplesNacional(cst);
    }
    return it;
  });
}

// ─────────────────────────────────────────────────────────
// Funções puras de cálculo fiscal
// ─────────────────────────────────────────────────────────

interface IcmsProprioParams {
  valorBruto: number;
  cst: string;
  regimeStr: string;
  presumido: number | null;
  aliquotaIcmsRegra: number | null;
}

interface IcmsProprioResult {
  icms_base_calculo?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  icms_modalidade_base_calculo?: string;
}

/** ICMS Próprio: presumido (regime=3) > aliquota_icms. NUNCA usa interestadual. */
function calcularIcmsProprio(p: IcmsProprioParams): IcmsProprioResult {
  const cstTributa = CST_COM_ICMS_TRIBUTADO.has(p.cst);
  const precisaGrupo = p.cst === '00';
  const result: IcmsProprioResult = {};

  if (cstTributa) {
    result.icms_modalidade_base_calculo = '3';
  }
  if (precisaGrupo) {
    const aliq = (p.regimeStr === '3' && p.presumido != null) ? p.presumido : (p.aliquotaIcmsRegra ?? 0);
    result.icms_base_calculo = p.valorBruto;
    result.icms_aliquota = aliq;
    result.icms_valor = Math.round(p.valorBruto * aliq) / 100;
  }
  return result;
}

interface DifalParams {
  valorBruto: number;
  cst: string;
  ufEmitente: string;
  ufDestinatario: string;
  temRegimeEspecial: boolean;
}

interface DifalResult {
  icms_base_calculo_uf_destino: number;
  icms_aliquota_interna_uf_destino: number;
  icms_aliquota_interestadual: number;
  icms_percentual_partilha: number;
  fcp_percentual_uf_destino: number;
  fcp_valor_uf_destino: number;
  fcp_base_calculo_uf_destino: number;
  icms_valor_uf_remetente: number;
  icms_valor_uf_destino: number;
}

/** DIFAL (ICMSUFDest): alíquota interestadual EXCLUSIVAMENTE via CONFAZ. Presumido NÃO altera DIFAL. */
function calcularDifal(p: DifalParams): DifalResult | null {
  const cstAplicaDifal = CST_COM_ICMS_TRIBUTADO.has(p.cst) || CSOSN_COM_DIFAL.has(p.cst);
  if (!cstAplicaDifal) return null;

  const aliqInter = getAliquotaInterestadualCONFAZ(p.ufEmitente, p.ufDestinatario);
  if (aliqInter == null) {
    throw new Error(
      `Alíquota interestadual não encontrada para UF origem ${p.ufEmitente} / destino ${p.ufDestinatario}. ` +
      `Verifique se as UFs estão cadastradas corretamente.`,
    );
  }
  const aliqInterna = getAliquotaInternaPorUF(p.ufDestinatario);
  if (aliqInterna == null || aliqInterna <= 0) {
    throw new Error(
      `Alíquota interna UF destino não configurada para ${p.ufDestinatario}. ` +
      `Configure na tabela CONFAZ.`,
    );
  }
  if (aliqInterna <= 0) {
    throw new Error(
      `Alíquota interna UF destino não configurada (${aliqInterna}%). ` +
      `Configure na regra ICMS para a UF ${p.ufDestinatario}.`,
    );
  }

  // Regime especial: alíquotas preenchidas, base e valor zerados (padrão Bling/E-PTA-RE)
  const baseUfDest = p.temRegimeEspecial ? 0 : p.valorBruto;
  const valorUfDest = p.temRegimeEspecial ? 0 : Math.round(p.valorBruto * Math.max(0, aliqInterna - aliqInter)) / 100;

  return {
    icms_base_calculo_uf_destino: baseUfDest,
    icms_aliquota_interna_uf_destino: aliqInterna,
    icms_aliquota_interestadual: aliqInter,
    icms_percentual_partilha: 100,
    fcp_percentual_uf_destino: 0,
    fcp_valor_uf_destino: 0,
    fcp_base_calculo_uf_destino: 0,
    icms_valor_uf_remetente: 0,
    icms_valor_uf_destino: valorUfDest,
  };
}

interface PisCofinsParams {
  valorBruto: number;
  regraPIS: RegraPISRow | null;
  regraCOFINS: RegraCOFINSRow | null;
  item: Record<string, unknown>;
  regimeStr: string;
}

interface PisCofinsResult {
  pis_situacao_tributaria: string;
  pis_aliquota_porcentual?: number; // sempre retornado pela função (0 quando sem alíquota)
  pis_base_calculo?: number;        // sempre retornado pela função (0 quando sem alíquota)
  pis_valor?: number;               // sempre retornado pela função (0 quando sem alíquota)
  cofins_situacao_tributaria: string;
  cofins_aliquota_porcentual?: number; // sempre retornado pela função (0 quando sem alíquota)
  cofins_base_calculo?: number;        // sempre retornado pela função (0 quando sem alíquota)
  cofins_valor?: number;               // sempre retornado pela função (0 quando sem alíquota)
}

/** PIS/COFINS: regra(banco) > item(produto) > default(regime). Base = valorBruto quando há alíquota > 0; caso contrário zera base/valor/aliquota. */
function calcularPisCofins(p: PisCofinsParams): PisCofinsResult {
  const pisCstRaw = p.regraPIS ? extrairCstDeSituacaoTributaria(p.regraPIS.situacaoTributaria) : null;
  const cofinsCstRaw = p.regraCOFINS ? extrairCstDeSituacaoTributaria(p.regraCOFINS.situacaoTributaria) : null;
  const defaultCst = p.regimeStr === '1' ? '49' : '01';

  const pisCst = pisCstRaw ?? (p.item.pis_situacao_tributaria != null ? String(p.item.pis_situacao_tributaria) : null) ?? defaultCst;
  const cofinsCst = cofinsCstRaw ?? (p.item.cofins_situacao_tributaria != null ? String(p.item.cofins_situacao_tributaria) : null) ?? defaultCst;

  const pisAliq = p.regraPIS?.aliquota != null
    ? Number(p.regraPIS.aliquota)
    : (p.item.pis_aliquota_porcentual != null && p.item.pis_aliquota_porcentual !== '' ? Number(p.item.pis_aliquota_porcentual) : null);
  const cofinsAliq = p.regraCOFINS?.aliquota != null
    ? Number(p.regraCOFINS.aliquota)
    : (p.item.cofins_aliquota_porcentual != null && p.item.cofins_aliquota_porcentual !== '' ? Number(p.item.cofins_aliquota_porcentual) : null);

  const pisAliqNum = pisAliq != null ? Number(pisAliq) : null;
  const cofinsAliqNum = cofinsAliq != null ? Number(cofinsAliq) : null;

  // Regra:
  // - Se alíquota for null ou 0 → base = 0, valor = 0, aliquota_porcentual = 0
  // - Se alíquota > 0         → base = valorBruto, valor = round(valorBruto * aliquota / 100)
  const pisTemAliqPositiva = pisAliqNum != null && pisAliqNum > 0;
  const cofinsTemAliqPositiva = cofinsAliqNum != null && cofinsAliqNum > 0;

  const pisBaseCalculo = pisTemAliqPositiva ? p.valorBruto : 0;
  const cofinsBaseCalculo = cofinsTemAliqPositiva ? p.valorBruto : 0;

  const result: PisCofinsResult = {
    pis_situacao_tributaria: pisCst,
    pis_base_calculo: pisBaseCalculo,
    pis_aliquota_porcentual: pisTemAliqPositiva ? pisAliqNum! : 0,
    pis_valor: pisTemAliqPositiva ? Math.round(p.valorBruto * pisAliqNum!) / 100 : 0,
    cofins_situacao_tributaria: cofinsCst,
    cofins_base_calculo: cofinsBaseCalculo,
    cofins_aliquota_porcentual: cofinsTemAliqPositiva ? cofinsAliqNum! : 0,
    cofins_valor: cofinsTemAliqPositiva ? Math.round(p.valorBruto * cofinsAliqNum!) / 100 : 0,
  };

  return result;
}

/** Normaliza ICMS do payload: calc base, difal, e CST→CSOSN para Simples Nacional. Quando incluirFreteNaBase (indTot=1), BC = vProd + vFrete. */
export function normalizePayloadIcms(
  payload: Record<string, unknown>,
  temRegimeEspecial: boolean = false,
  regimeStr: string = '',
  presumido: number | null = null,
  incluirFreteNaBase: boolean = true,
): Record<string, unknown> {
  const items = (payload.items ?? payload.itens) as Record<string, unknown>[] | undefined;
  if (!Array.isArray(items) || items.length === 0) return payload;

  const normalized = { ...payload };
  normalized.items = normalizePayloadCfopItems(normalized, items);

  const localDestino = Number(payload.local_destino ?? 0);
  const consumidorFinal = String(payload.consumidor_final ?? '1').trim();
  const ufEmitente = String(payload.uf_emitente ?? '').trim().toUpperCase();
  const ufDestinatario = String(payload.uf_destinatario ?? '').trim().toUpperCase();
  const precisaDifal = localDestino === 2 && consumidorFinal === '1' && ufDestinatario.length === 2;

  const itemsAfterCfop = (normalized.items ?? items) as Record<string, unknown>[];

  const normalizedItems = itemsAfterCfop.map((item) => {
    const it = { ...item } as Record<string, unknown>;
    const cst = String(it.icms_situacao_tributaria ?? '').trim();
    const cstApplies = CST_COM_ICMS_TRIBUTADO.has(cst) || CSOSN_COM_DIFAL.has(cst);
    if (!cstApplies) return it;

    const valorBruto =
      it.valor_bruto != null
        ? Number(it.valor_bruto)
        : Number(it.valor_unitario_comercial ?? 0) * Number(it.quantidade_comercial ?? it.quantidade_tributavel ?? 1);
    const valorFreteItem = incluirFreteNaBase ? Number(it.valor_frete ?? 0) : 0;
    const bc = Math.round((it.icms_base_calculo != null ? Number(it.icms_base_calculo) : valorBruto + valorFreteItem) * 100) / 100;
    it.icms_base_calculo = bc;

    // ICMS Próprio (separado do DIFAL)
    if (CST_COM_ICMS_TRIBUTADO.has(cst)) {
      const icms = calcularIcmsProprio({ valorBruto: bc, cst, regimeStr, presumido, aliquotaIcmsRegra: Number(it.icms_aliquota ?? 0) || null });
      Object.assign(it, icms);
    }

    // DIFAL (separado do ICMS próprio)
    if (precisaDifal) {
      const difal = calcularDifal({
        valorBruto: bc, cst, ufEmitente, ufDestinatario, temRegimeEspecial,
      });
      if (difal) Object.assign(it, difal);
    }

    return it;
  });

  normalized.items = normalizePayloadCstParaSimplesNacional(normalized, normalizedItems);
  return normalized;
}

/** Regra ICMS mínima para enriquecimento DIFAL (alíquota interestadual e interna UF destino). */
export interface RegraICMSParaDifal {
  aliquota_interestadual?: number | null;
  icms_aliquota_interestadual?: number | null;
  aliquota_internaUF?: number | null;
  /** Aceita também aliquota_icms como alíquota interestadual quando destinos for interestadual. */
  aliquota_icms?: number | null;
  [key: string]: unknown;
}

/** Lê da regra ICMS a alíquota interna UF (aceita camelCase e snake_case do banco). */
export function getAliquotaInternaUF(regra: RegraICMSParaDifal | null): number | null {
  if (!regra) return null;
  const r = regra as Record<string, unknown>;
  const v =
    r.aliquota_internaUF ??
    r.aliquota_internauf ??
    r.aliquota_interna_uf_destino ??
    r.aliquota_interna_uf;
  return v != null && v !== '' ? Number(v) : null;
}


/**
 * Enriquece os itens do payload com o grupo de ICMS da UF de destino (DIFAL) quando
 * local_destino=2, consumidor_final=1 e os itens ainda não têm o grupo.
 * Usa a regra ICMS (aliquota_interestadual, aliquota_internaUF) para calcular partilha.
 */
export function enrichItemsWithDifalFromRegra(
  payload: Record<string, unknown>,
  regraICMS: RegraICMSParaDifal | null,
  naturezaId?: number,
  temRegimeEspecial: boolean = false,
): Record<string, unknown> {
  const localDestino = Number(payload.local_destino ?? 0);
  const consumidorFinal = String(payload.consumidor_final ?? '1').trim();
  const ufEmitente = String(payload.uf_emitente ?? '').trim().toUpperCase();
  const ufDestinatario = String(payload.uf_destinatario ?? '').trim().toUpperCase();
  if (localDestino !== 2 || consumidorFinal !== '1' || ufDestinatario.length !== 2) {
    return payload;
  }

  const items = (payload.items ?? payload.itens) as Record<string, unknown>[] | undefined;
  if (!Array.isArray(items) || items.length === 0) return payload;

  const incluirFreteNaBase = payload.incluir_frete_base_ipi !== false && payload.incluir_frete_base_ipi !== 'false';

  const normalizedItems = items.map((item) => {
    const it = { ...item } as Record<string, unknown>;
    const cst = String(it.icms_situacao_tributaria ?? '').trim();
    if (!CST_COM_ICMS_TRIBUTADO.has(cst) && !CSOSN_COM_DIFAL.has(cst)) return it;

    // Se já veio com DIFAL válido, preservar
    const aliqInter = Number(it.icms_aliquota_interestadual);
    const aliqInternaDest = Number(it.icms_aliquota_interna_uf_destino);
    if (
      it.icms_aliquota_interna_uf_destino != null &&
      it.icms_aliquota_interestadual != null &&
      aliqInternaDest > 0 &&
      (aliqInter === 4 || aliqInter === 7 || aliqInter === 12)
    ) {
      return it;
    }

    const valorBruto =
      it.valor_bruto != null
        ? Number(it.valor_bruto)
        : Number(it.valor_unitario_comercial ?? 0) * Number(it.quantidade_comercial ?? it.quantidade_tributavel ?? 1);
    const valorFreteItem = incluirFreteNaBase ? Number(it.valor_frete ?? 0) : 0;
    const bc = it.icms_base_calculo != null ? Number(it.icms_base_calculo) : Math.round((valorBruto + valorFreteItem) * 100) / 100;

    const difal = calcularDifal({
      valorBruto: bc, cst, ufEmitente, ufDestinatario, temRegimeEspecial,
    });
    if (difal) Object.assign(it, difal);
    return it;
  });

  const result = { ...payload };
  result.items = normalizedItems;
  if (payload.itens != null) result.itens = normalizedItems;
  return result;
}

/**
 * Monta o payload Focus NFe a partir dos dados do pedido.
 * Schema real: pedidos_venda (totalPedido, totalFrete, totalDesconto), contatos+enderecos, empresas+enderecos, itens_venda (valorUnit, quantidade, subtotal, produto).
 * regras: opcional - regras tributárias por natureza (regrasICMS, regrasPIS, regrasCOFINS, regrasIPI, regrasRETENCOES).
 */
export function buildFocusNFePayload(
  pedido: PedidoVendaRow,
  itens: ItemVendaRow[],
  empresa: EmpresaRow,
  cliente: ClienteRow,
  naturezaOperacao: NaturezaOperacaoRow,
  regras?: RegrasTributarias,
  ambiente?: string,
): FocusNFePayload {
  const now = nowBrasilia();
  const valorFrete = Number(pedido.totalFrete ?? (pedido as Record<string, unknown>).valor_frete ?? 0);
  const valorTotal = Number(pedido.totalPedido ?? (pedido as Record<string, unknown>).valor_total ?? 0);
  const valorDesconto = Number(pedido.totalDesconto ?? (pedido as Record<string, unknown>).valor_desconto ?? 0);
  const valorProdutos = itens.reduce((s, i) => s + Number(i.subtotal ?? (i as Record<string, unknown>).valor_total ?? 0), 0);

  const cnpjEmitente = onlyNumbers(empresa.cnpj ?? '');
  const docDest = String(
    cliente.cpf_cnpj ?? (cliente as Record<string, unknown>).cnpj ?? (cliente as Record<string, unknown>).cpf ?? '',
  ).trim();
  const dest = cpfOuCnpj(docDest);

  const ufEmitente = String(empresa.uf ?? '').trim().toUpperCase();
  const paisDestino = String(cliente.pais ?? 'Brasil').trim();
  /** UF destinatário: para Brasil, exige UF válida; para exterior, pode omitir (API aceita). */
  const ufDestinatarioRaw = String(cliente.uf ?? '').trim().toUpperCase();
  if (paisDestino === 'Brasil' && (!ufDestinatarioRaw || ufDestinatarioRaw.length !== 2)) {
    throw new Error('UF do destinatário não informada. Cadastre o endereço completo do cliente.');
  }
  const ufDestinatario = ufDestinatarioRaw || '';
  const isInterestadual = ufEmitente !== '' && ufDestinatario !== '' && ufEmitente !== ufDestinatario;

  /** local_destino: 1 = mesma UF, 2 = UF diferente, 3 = exterior */
  const localDestino: 1 | 2 | 3 =
    paisDestino !== 'Brasil' ? 3 : isInterestadual ? 2 : 1;

  /** indicador_inscricao_estadual_destinatario: 1 = contribuinte, 2 = isento, 9 = não contribuinte. */
  const ieDest = String(cliente.ie ?? '').trim().toUpperCase();
  const cliRecord = cliente as Record<string, unknown>;
  const hasIndIEDest = cliRecord.indIEDest === 1 || cliRecord.indIEDest === 2 || cliRecord.indIEDest === 9;
  const indicadorIeDest: 1 | 2 | 9 =
    dest.cpf
      ? 9 // CPF = pessoa física = não contribuinte
      : hasIndIEDest
        ? (cliRecord.indIEDest as 1 | 2 | 9)
        : cliRecord.contribuinte_icms === true && ieDest !== '' && ieDest !== 'ISENTO'
          ? 1
          : ieDest === 'ISENTO'
            ? 2
            // PJ (CNPJ) com IE preenchida e válida => contribuinte (1)
            : dest.cnpj && ieDest !== '' && ieDest !== 'ISENTO' && /^\d{2,14}$/.test(ieDest)
              ? 1
              : 9;

  const cli = cliente as Record<string, unknown>;
  const nat = naturezaOperacao as Record<string, unknown>;
  const hasConsumidorFinal =
    cli.consumidorFinal === true || cli.consumidorFinal === 'true' || nat.consumidorFinal === true || nat.consumidorFinal === 'true';
  const hasNaoConsumidorFinal =
    cli.consumidorFinal === false || cli.consumidorFinal === 'false' || nat.consumidorFinal === false || nat.consumidorFinal === 'false';
  // Default: contribuinte ICMS (indIEDest=1) -> não é consumidor final; CPF ou não contribuinte -> consumidor final
  const consumidorFinal = hasConsumidorFinal ? '1' : hasNaoConsumidorFinal ? '0' : (indicadorIeDest === 1 ? '0' : '1');
  const precisaDifal = localDestino === 2 && consumidorFinal === '1';

  const naturezaId = Number(naturezaOperacao.id ?? 0);
  const regraICMS = regras?.icms ?? null;
  const regraPIS = regras?.pis ?? null;
  const regraCOFINS = regras?.cofins ?? null;

  const rIcms = regraICMS as Record<string, unknown> | null;
  const cfopBaseRegra = rIcms ? (rIcms.cfop ?? rIcms.CFOP ?? '').toString().trim() : '';

  const aliquotaIcmsRegra =
    rIcms?.aliquota_icms != null ? Number(rIcms.aliquota_icms) : null;
  const aliquotaInternaUFDestinoRegra = getAliquotaInternaUF(rIcms);

  // Regime presumido: alíquota efetiva de ICMS (campo regrasICMS.presumido)
  // 0 ou null = não configurado (usar aliquota_icms); valor > 0 = usar como alíquota efetiva
  const presumidoRaw = rIcms?.presumido;
  const presumidoNum = presumidoRaw != null && String(presumidoRaw).trim() !== '' ? Number(presumidoRaw) : null;
  const presumido = (presumidoNum != null && presumidoNum > 0) ? presumidoNum : null;
  if (presumidoNum != null && presumidoNum < 0) {
    throw new Error('Regra ICMS com regime presumido inválido. O campo presumido não pode ser negativo.');
  }

  // Regime tributário é propriedade EXCLUSIVA da empresa
  const emp = empresa as Record<string, unknown>;
  const regimeStr = emp.codRegime_tributario != null ? String(emp.codRegime_tributario).trim() : '';
  if (!regimeStr) {
    throw new Error(`Empresa ${cnpjEmitente}: regime tributário (codRegime_tributario) não configurado. Cadastre 1 (Simples Nacional), 2 (Simples Excesso) ou 3 (Regime Normal).`);
  }

  /** indTot = 1: frete compõe a base de cálculo de ICMS, PIS e COFINS (BC = vProd + vFrete). indTot = 0: BC = vProd. */
  const incluirFreteNaBase = nat.incluir_frete_base_ipi !== false && nat.incluir_frete_base_ipi !== 'false';

  // Pré-calcula o frete por item (mesmo rateio usado depois) para usar na base de cálculo quando indTot = 1
  const valorFreteRounded = Math.round(valorFrete * 100) / 100;
  const fretePorItem: number[] = new Array(itens.length).fill(0);
  if (valorFreteRounded > 0 && itens.length > 0) {
    if (itens.length === 1) {
      fretePorItem[0] = valorFreteRounded;
    } else {
      const valorProdutosSafe = valorProdutos > 0 ? valorProdutos : 1;
      let somaFrete = 0;
      for (let i = 0; i < itens.length; i++) {
        const subtotal = Number(itens[i].subtotal ?? (itens[i] as Record<string, unknown>).valor_total ?? 0);
        const vBruto = Math.round(subtotal * 100) / 100;
        fretePorItem[i] = Math.round((vBruto / valorProdutosSafe) * valorFreteRounded * 100) / 100;
        somaFrete += fretePorItem[i];
      }
      const diff = Math.round((valorFreteRounded - somaFrete) * 100) / 100;
      if (diff !== 0) fretePorItem[itens.length - 1] = Math.round((fretePorItem[itens.length - 1] + diff) * 100) / 100;
    }
  }

  const itensPayload: FocusNFeItemPayload[] = itens.map((item, idx) => {
    const qtd = Number(item.quantidade ?? 0);
    const vUnit = Number(item.valorUnit ?? (item as Record<string, unknown>).valor_unitario ?? 0);
    const valorBrutoNum = Math.round(qtd * vUnit * 100) / 100;
    /** Base para tributos: vProd + vFrete quando indTot = 1 (incluirFreteNaBase); senão só vProd. */
    const baseParaTributos = Math.round((valorBrutoNum + (incluirFreteNaBase ? fretePorItem[idx]! : 0)) * 100) / 100;
    const ncmRaw = item.codigo_ncm ?? item.ncm ?? '';
    const ncm = (ncmRaw ? String(ncmRaw).replace(/\D/g, '').padStart(8, '0').slice(0, 8) : '00000000') || '00000000';
    // Priorizar CST da regra ICMS sobre CST do produto
    const cstDaRegra = regraICMS ? extrairCstDeSituacaoTributaria((regraICMS as Record<string, unknown>).situacaoTributaria as string | null) : null;
    const cstDefault = regimeStr === '1' ? '400' : regimeStr === '3' ? '00' : '400';
    const cst = String(cstDaRegra ?? item.icms_situacao_tributaria ?? cstDefault).trim();

    const it = item as Record<string, unknown>;

    // ── ICMS Próprio: base = vProd + vFrete quando indTot = 1 ──
    const icmsProprio = calcularIcmsProprio({
      valorBruto: baseParaTributos, cst, regimeStr, presumido, aliquotaIcmsRegra,
    });

    // ── PIS/COFINS: base = vProd + vFrete quando indTot = 1 ──
    const pisCofins = calcularPisCofins({
      valorBruto: baseParaTributos, regraPIS, regraCOFINS, item: it, regimeStr,
    });

    const ipiCst = regras?.ipi
      ? (extrairCstDeSituacaoTributaria(regras.ipi.situacaoTributaria) ?? String(regras.ipi.situacaoTributaria ?? '').trim().match(/^\d+/)?.[0] ?? null)
      : null;
    const ipiCodEnquadramento = regras?.ipi?.codEnquadramento != null ? String(regras.ipi.codEnquadramento) : null;

    const base: FocusNFeItemPayload = {
      numero_item: String(idx + 1),
      codigo_produto: String(item.produto ?? it.produto_id ?? item.id ?? idx + 1),
      descricao: String(item.descricao ?? 'Item'),
      cfop: cfopPorDestino(String(item.cfop ?? cfopBaseRegra), isInterestadual),
      unidade_comercial: String(item.unidade ?? 'UN'),
      quantidade_comercial: qtd,
      valor_unitario_comercial: Math.round(vUnit * 100) / 100,
      valor_unitario_tributavel: Math.round(vUnit * 100) / 100,
      unidade_tributavel: String(item.unidade ?? 'UN'),
      codigo_ncm: ncm,
      quantidade_tributavel: qtd,
      valor_bruto: valorBrutoNum,
      icms_situacao_tributaria: cst,
      icms_origem: item.icms_origem ?? '0',
      codigo_barras_comercial: String(it.ean ?? 'SEM GTIN'),
      codigo_barras_tributavel: String(it.ean ?? 'SEM GTIN'),
      // ICMS Próprio
      ...icmsProprio,
      // PIS/COFINS com base = valorBruto
      ...pisCofins,
      // IBS/CBS (pass-through)
      ...(it.ibs_cbs_situacao_tributaria != null && { ibs_cbs_situacao_tributaria: String(it.ibs_cbs_situacao_tributaria) }),
      ...(it.ibs_cbs_classificacao_tributaria != null && { ibs_cbs_classificacao_tributaria: String(it.ibs_cbs_classificacao_tributaria) }),
      ...(it.ibs_cbs_base_calculo != null && { ibs_cbs_base_calculo: Number(it.ibs_cbs_base_calculo) }),
      ...(it.ibs_uf_aliquota != null && { ibs_uf_aliquota: Number(it.ibs_uf_aliquota) }),
      ...(it.ibs_uf_valor != null && { ibs_uf_valor: Number(it.ibs_uf_valor) }),
      ...(it.ibs_mun_aliquota != null && { ibs_mun_aliquota: Number(it.ibs_mun_aliquota) }),
      ...(it.ibs_mun_valor != null && { ibs_mun_valor: Number(it.ibs_mun_valor) }),
      ...(it.ibs_valor_total != null && { ibs_valor_total: Number(it.ibs_valor_total) }),
      ...(it.cbs_aliquota != null && { cbs_aliquota: Number(it.cbs_aliquota) }),
      ...(it.cbs_valor != null && { cbs_valor: Number(it.cbs_valor) }),
      ...(ipiCst != null && { ipi_situacao_tributaria: ipiCst }),
      ...(ipiCodEnquadramento != null && { ipi_codigo_enquadramento_legal: ipiCodEnquadramento }),
    };

    // ── DIFAL: base = vProd + vFrete quando indTot = 1 ──
    if (precisaDifal) {
      const temRegimeEspecial = !!emp.tem_regime_especial;
      const difal = calcularDifal({
        valorBruto: baseParaTributos, cst, ufEmitente, ufDestinatario, temRegimeEspecial,
      });
      if (difal) Object.assign(base, difal);
    }

    return base;
  });

  // Distribuir valor_frete nos itens (SEFAZ 535: total do frete deve ser igual à soma dos fretes dos itens)
  if (valorFreteRounded > 0 && itensPayload.length > 0) {
    if (itensPayload.length === 1) {
      itensPayload[0].valor_frete = valorFreteRounded;
    } else {
      // Rateio proporcional ao valor do item: frete_item = (valor_bruto / valorProdutos) * valor_frete_total
      const valorProdutosSafe = valorProdutos > 0 ? valorProdutos : 1;
      let somaFreteItens = 0;
      for (let i = 0; i < itensPayload.length; i++) {
        const valorBruto = itensPayload[i].valor_bruto ?? 0;
        const freteItem =
          Math.round((valorBruto / valorProdutosSafe) * valorFreteRounded * 100) / 100;
        itensPayload[i].valor_frete = freteItem;
        somaFreteItens += freteItem;
      }
      // Ajuste no último item para a soma bater exatamente com o totalizador
      const diff = Math.round((valorFreteRounded - somaFreteItens) * 100) / 100;
      if (diff !== 0) {
        const last = itensPayload[itensPayload.length - 1];
        last.valor_frete = Math.round(((last.valor_frete ?? 0) + diff) * 100) / 100;
      }
    }
  }

  // regimeStr/emp/nat j\u00e1 declarados antes dos itens
  const presencaComprador = normalizarPresencaComprador(
    nat.indicadorPresenca != null && String(nat.indicadorPresenca).trim() !== ''
      ? String(nat.indicadorPresenca).trim()
      : undefined,
  );

  // Validações obrigatórias de emitente
  const ieEmitente = String(empresa.iE ?? (empresa as Record<string, unknown>).inscricao_estadual ?? '').trim();
  validarCampoObrigatorio(ieEmitente, 'Inscrição Estadual', 'Empresa emitente');
  validarCampoObrigatorio(cnpjEmitente, 'CNPJ', 'Empresa emitente');
  const cepEmitente = onlyNumbers(empresa.cep ?? '').padStart(8, '0').slice(0, 8);
  if (cepEmitente === '00000000') throw new Error('Empresa emitente: CEP é obrigatório. Cadastre o endereço da empresa.');
  const cepDestinatario = onlyNumbers(cliente.cep ?? '').padStart(8, '0').slice(0, 8);
  if (paisDestino === 'Brasil' && cepDestinatario === '00000000') throw new Error('Destinatário: CEP é obrigatório. Cadastre o endereço do cliente.');

  const telefoneDest = (cliente.celular ?? cliente.telefoneFixo ?? '').trim();

  const infoAdicionaisRaw = nat.infoAdicionais ?? nat.info_adicionais;
  const informacoesAdicionaisContribuinte =
    infoAdicionaisRaw != null && String(infoAdicionaisRaw).trim() !== '' ? String(infoAdicionaisRaw).trim() : '';

  // Ambiente vem como parâmetro (testabilidade, multi-tenant); fallback para env
  const ambienteEfetivo = ambiente ?? process.env.FOCUS_NFE_AMBIENTE ?? 'homologacao';
  const nomeDestinatario = String(cliente.nome ?? (cliente as Record<string, unknown>).razao_social ?? (cliente as Record<string, unknown>).nome_fantasia ?? '').trim() || 'Destinatário';

  const payload: FocusNFePayload = {
    data_emissao: now,
    data_entrada_saida: now,
    natureza_operacao: naturezaOperacao.descricao ?? 'Venda de mercadoria',
    tipo_documento: '1',
    finalidade_emissao: '1',
    consumidor_final: consumidorFinal,
    local_destino: localDestino,
    indicador_inscricao_estadual_destinatario: indicadorIeDest,
    ...(regimeStr && { regime_tributario_emitente: regimeStr }),
    presenca_comprador: presencaComprador,
    cnpj_emitente: cnpjEmitente,
    nome_emitente: String(empresa.nome ?? ''),
    nome_fantasia_emitente: empresa.nomeFantasia ? String(empresa.nomeFantasia) : undefined,
    logradouro_emitente: String(empresa.logradouro ?? ''),
    numero_emitente: String(empresa.numero ?? 'S/N'),
    bairro_emitente: String(empresa.bairro ?? ''),
    municipio_emitente: String(empresa.municipio ?? ''),
    uf_emitente: String(empresa.uf ?? 'MG'),
    cep_emitente: cepEmitente,
    inscricao_estadual_emitente: ieEmitente,
    telefone_emitente: (empresa as Record<string, unknown>).telefone as string | undefined,
    nome_destinatario: nomeDestinatario,
    ...(indicadorIeDest === 1 && {
      inscricao_estadual_destinatario: ieDest === '' ? 'ISENTO' : cliente.ie ?? 'ISENTO',
    }),
    ...(indicadorIeDest === 2 && {
      inscricao_estadual_destinatario: 'ISENTO',
    }),
    ...(indicadorIeDest === 9 && dest.cnpj && ieDest && ieDest.toUpperCase() !== 'ISENTO' && {
      inscricao_estadual_destinatario: ieDest,
    }),
    logradouro_destinatario: String(cliente.logradouro ?? ''),
    numero_destinatario: String(cliente.numero ?? 'S/N'),
    ...(String(cliente.complemento ?? '').trim() ? { complemento_destinatario: String(cliente.complemento).trim() } : {}),
    bairro_destinatario: String(cliente.bairro ?? ''),
    municipio_destinatario: String(cliente.municipio ?? ''),
    uf_destinatario: ufDestinatario,
    pais_destinatario: cliente.pais ?? 'Brasil',
    cep_destinatario: cepDestinatario,
    valor_frete: Math.round(valorFrete * 100) / 100,
    valor_seguro: 0,
    valor_total: Math.round(valorTotal * 100) / 100,
    valor_produtos: Math.round(valorProdutos * 100) / 100,
    modalidade_frete: '0',
    ...(nat.indicadorIntermediador != null && { indicador_intermediario: String(nat.indicadorIntermediador) }),
    ...(String(nat.indicadorIntermediador ?? '') === '1' &&
      nat.cnpj_intermediador != null && { cnpj_intermediador: onlyNumbers(String(nat.cnpj_intermediador)) }),
    ...(String(nat.indicadorIntermediador ?? '') === '1' &&
      nat.identificador_intermediador != null && { identificador_intermediador: String(nat.identificador_intermediador) }),
    ...(informacoesAdicionaisContribuinte !== '' && { informacoes_adicionais_contribuinte: informacoesAdicionaisContribuinte }),
    ...(nat.ibs_cbs_situacao_tributaria != null && { ibs_cbs_situacao_tributaria: String(nat.ibs_cbs_situacao_tributaria) }),
    ...(nat.ibs_cbs_classificacao_tributaria != null && { ibs_cbs_classificacao_tributaria: String(nat.ibs_cbs_classificacao_tributaria) }),
    ...(nat.ibs_cbs_base_calculo != null && { ibs_cbs_base_calculo: Number(nat.ibs_cbs_base_calculo) }),
    ...(nat.ibs_uf_aliquota != null && { ibs_uf_aliquota: Number(nat.ibs_uf_aliquota) }),
    ...(nat.ibs_uf_valor != null && { ibs_uf_valor: Number(nat.ibs_uf_valor) }),
    ...(nat.ibs_mun_aliquota != null && { ibs_mun_aliquota: Number(nat.ibs_mun_aliquota) }),
    ...(nat.ibs_mun_valor != null && { ibs_mun_valor: Number(nat.ibs_mun_valor) }),
    ...(nat.ibs_valor_total != null && { ibs_valor_total: Number(nat.ibs_valor_total) }),
    ...(nat.cbs_aliquota != null && { cbs_aliquota: Number(nat.cbs_aliquota) }),
    ...(nat.cbs_valor != null && { cbs_valor: Number(nat.cbs_valor) }),
    items: itensPayload,
  };

  if (valorDesconto > 0) payload.valor_desconto = Math.round(valorDesconto * 100) / 100;
  if (telefoneDest !== '') payload.telefone_destinatario = telefoneDest;

  if (dest.cnpj) payload.cnpj_destinatario = dest.cnpj;
  else if (dest.cpf) payload.cpf_destinatario = dest.cpf;

  const payloadExt = payload as FocusNFePayload & Record<string, unknown>;
  const vProd = Math.round(valorProdutos * 100) / 100;
  const regraIS = regras?.is ?? null;
  const regraIBS = regras?.ibs ?? null;
  const regraCBS = regras?.cbs ?? null;
  const calcValor = (r: { aliquota?: number | null; base?: number | null } | null): number => {
    if (!r || (r.aliquota == null && r.base == null)) return 0;
    const aliq = Number(r.aliquota ?? 0);
    const base = Number(r.base ?? 100);
    return Math.round(vProd * (base / 100) * (aliq / 100) * 100) / 100;
  };
  if (regraIS) payloadExt.total_is = calcValor(regraIS);
  if (regraIBS) payloadExt.total_ibs = calcValor(regraIBS);
  if (regraCBS) payloadExt.total_cbs = calcValor(regraCBS);
  payloadExt.incluir_frete_base_ipi = incluirFreteNaBase;

  return payload;
}

/**
 * Valida limites de tamanho de campos de texto conforme o schema XML NFe 4.0 da Sefaz.
 * Retorna array com mensagens de erro, para exibição de alerta antes da emissão.
 */
export function validarPayloadSefaz(payload: Record<string, unknown>): string[] {
  const erros: string[] = [];
  const checkMax = (valor: unknown, maxLen: number, nomeCampo: string) => {
    if (valor != null && String(valor).trim().length > maxLen) {
      erros.push(`Atenção: O campo "${nomeCampo}" possui ${String(valor).trim().length} caracteres (máx. permitido: ${maxLen}). Reduza o tamanho ou abrevie o texto.`);
    }
  };

  checkMax(payload.nome_emitente, 60, 'Nome/Razão Social do Emitente');
  checkMax(payload.nome_fantasia_emitente, 60, 'Nome Fantasia do Emitente');
  checkMax(payload.logradouro_emitente, 60, 'Logradouro do Emitente');
  checkMax(payload.numero_emitente, 60, 'Número do Endereço do Emitente');
  checkMax(payload.bairro_emitente, 60, 'Bairro do Emitente');
  checkMax(payload.municipio_emitente, 60, 'Município do Emitente');

  checkMax(payload.nome_destinatario, 60, 'Nome/Razão Social do Cliente');
  checkMax(payload.logradouro_destinatario, 60, 'Rua/Logradouro do Cliente');
  checkMax(payload.numero_destinatario, 60, 'Número do Endereço do Cliente');
  checkMax(payload.bairro_destinatario, 60, 'Bairro do Cliente');
  checkMax(payload.municipio_destinatario, 60, 'Município do Cliente');
  checkMax(payload.complemento_destinatario, 60, 'Complemento do Endereço do Cliente');

  const items = payload.items ?? payload.itens;
  if (Array.isArray(items)) {
    items.forEach((item, idx) => {
      const it = item as Record<string, unknown>;
      checkMax(it.descricao, 120, `Descrição do Produto (Item ${idx + 1})`);
    });
  }

  return erros;
}
