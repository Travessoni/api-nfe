"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePayloadIcms = normalizePayloadIcms;
exports.getAliquotaInternaUF = getAliquotaInternaUF;
exports.enrichItemsWithDifalFromRegra = enrichItemsWithDifalFromRegra;
exports.buildFocusNFePayload = buildFocusNFePayload;
exports.validarPayloadSefaz = validarPayloadSefaz;
var pedido_data_service_1 = require("../services/pedido-data.service");
var focus_nfe_types_1 = require("./focus-nfe.types");
var difal_aliquotas_1 = require("./difal-aliquotas");
/** Valida campo obrigatório e lança erro descritivo se ausente. */
function validarCampoObrigatorio(valor, campo, entidade) {
    if (!valor || String(valor).trim() === '') {
        throw new Error("".concat(entidade, ": ").concat(campo, " \u00E9 obrigat\u00F3rio mas est\u00E1 vazio. Verifique o cadastro."));
    }
}
/** Data/hora em horário de Brasília (SEFAZ exige; evita rejeição "posterior ao horário de recebimento"). Formato: YYYY-MM-DDTHH:mm:ss */
function nowBrasilia() {
    var d = new Date();
    var parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(d);
    var get = function (type) { var _a, _b; return (_b = (_a = parts.find(function (p) { return p.type === type; })) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '00'; };
    return "".concat(get('year'), "-").concat(get('month'), "-").concat(get('day'), "T").concat(get('hour'), ":").concat(get('minute'), ":").concat(get('second'));
}
function onlyNumbers(s) {
    if (!s)
        return '';
    return String(s).replace(/\D/g, '');
}
/** cpf_cnpj: 11 dígitos = CPF, senão CNPJ. */
function cpfOuCnpj(val) {
    var num = onlyNumbers(val !== null && val !== void 0 ? val : '');
    if (num.length === 11)
        return { cpf: num };
    if (num.length === 14)
        return { cnpj: num };
    return {};
}
/** Ajusta CFOP conforme destino: 5xxx = interna (mesmo UF), 6xxx = interestadual (outro UF). Evita rejeição "CFOP de operação interna e idDest diferente de 1". */
function cfopPorDestino(cfopBase, isInterestadual) {
    return sanitizeCfop(cfopBase, isInterestadual);
}
/**
 * Garante CFOP com 4 dígitos numéricos (exigido pelo schema XML da NFe).
 * - Remove caracteres não numéricos (ex.: "x108" → "108"); prefixa com 5 (interna) ou 6 (interestadual) se precisar.
 * - Se já tiver 4 dígitos começando com 5 ou 6, ajusta conforme destino (5↔6).
 */
function sanitizeCfop(cfopRaw, isInterestadual) {
    var raw = String(cfopRaw !== null && cfopRaw !== void 0 ? cfopRaw : '').trim();
    var digits = raw.replace(/\D/g, '');
    var prefix = isInterestadual ? '6' : '5';
    if (digits.length >= 4) {
        var first = digits[0];
        var rest = digits.slice(1, 4);
        if (first === '5' && isInterestadual)
            return '6' + rest;
        if (first === '6' && !isInterestadual)
            return '5' + rest;
        if (first === '5' || first === '6')
            return digits.slice(0, 4);
        return prefix + rest;
    }
    if (digits.length > 0)
        return prefix + digits.padStart(3, '0').slice(-3);
    // CFOP é obrigatório — fallback silencioso gera autuação fiscal
    throw new Error("CFOP inv\u00E1lido ou n\u00E3o configurado: \"".concat(cfopRaw, "\". Configure o CFOP na natureza de opera\u00E7\u00E3o ou no produto."));
}
/** Normaliza presenca_comprador para 1–9 (API não aceita texto). Fallback recomendado: '2' (internet). */
function normalizarPresencaComprador(val) {
    if (val == null || String(val).trim() === '')
        return '2';
    var s = String(val).trim();
    if (/^[1-9]$/.test(s))
        return s;
    var lower = s.toLowerCase();
    if (lower.includes('internet') || lower === '2')
        return '2';
    if (lower.includes('presencial') || lower === '1')
        return '1';
    return '9';
}
/**
 * Normaliza CFOP dos itens conforme UF emitente x destinatário.
 * 5xxx = operação interna (mesmo estado), 6xxx = interestadual. Evita rejeição SEFAZ quando destino é outro UF.
 */
function normalizePayloadCfopItems(payload, items) {
    var _a, _b;
    var ufEmitente = String((_a = payload.uf_emitente) !== null && _a !== void 0 ? _a : '').trim().toUpperCase();
    var ufDestinatario = String((_b = payload.uf_destinatario) !== null && _b !== void 0 ? _b : '').trim().toUpperCase();
    var isInterestadual = ufEmitente.length === 2 && ufDestinatario.length === 2 && ufEmitente !== ufDestinatario;
    return items.map(function (item) {
        var _a;
        var it = __assign({}, item);
        var cfop = String((_a = it.cfop) !== null && _a !== void 0 ? _a : '').trim();
        it.cfop = sanitizeCfop(cfop || '108', isInterestadual);
        return it;
    });
}
/**
 * Converte CST (2 dígitos) para CSOSN (3 dígitos) quando o emitente é Simples Nacional (CRT=1).
 * Evita rejeição SEFAZ: "Informado CST para emissor do Simples Nacional (CRT=1)".
 * CST 00 (tributada integralmente) → CSOSN 102 (tributada sem permissão de crédito), aceita DIFAL.
 */
var CST_PARA_CSOSN_SIMPLES_NACIONAL = {
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
function cstParaCsosnSimplesNacional(cst) {
    var _a;
    var s = String(cst !== null && cst !== void 0 ? cst : '').trim();
    if (s.length === 3 && /^\d{3}$/.test(s))
        return s; // já é CSOSN
    return (_a = CST_PARA_CSOSN_SIMPLES_NACIONAL[s]) !== null && _a !== void 0 ? _a : '102';
}
function normalizePayloadCstParaSimplesNacional(payload, items) {
    var _a;
    var regime = String((_a = payload.regime_tributario_emitente) !== null && _a !== void 0 ? _a : '').trim();
    if (regime !== '1')
        return items;
    return items.map(function (item) {
        var _a;
        var it = __assign({}, item);
        var cst = String((_a = it.icms_situacao_tributaria) !== null && _a !== void 0 ? _a : '').trim();
        if (cst.length === 2 && /^\d{2}$/.test(cst)) {
            it.icms_situacao_tributaria = cstParaCsosnSimplesNacional(cst);
        }
        return it;
    });
}
/** ICMS Próprio: presumido (regime=3) > aliquota_icms. NUNCA usa interestadual. */
function calcularIcmsProprio(p) {
    var _a;
    var cstTributa = focus_nfe_types_1.CST_COM_ICMS_TRIBUTADO.has(p.cst);
    var precisaGrupo = p.cst === '00';
    var result = {};
    if (cstTributa) {
        result.icms_modalidade_base_calculo = '3';
    }
    if (precisaGrupo) {
        var aliq = (p.regimeStr === '3' && p.presumido != null) ? p.presumido : ((_a = p.aliquotaIcmsRegra) !== null && _a !== void 0 ? _a : 0);
        result.icms_base_calculo = p.valorBruto;
        result.icms_aliquota = aliq;
        result.icms_valor = Math.round(p.valorBruto * aliq) / 100;
    }
    return result;
}
/** DIFAL (ICMSUFDest): alíquota interestadual EXCLUSIVAMENTE via CONFAZ. Presumido NÃO altera DIFAL. */
function calcularDifal(p) {
    var cstAplicaDifal = focus_nfe_types_1.CST_COM_ICMS_TRIBUTADO.has(p.cst) || focus_nfe_types_1.CSOSN_COM_DIFAL.has(p.cst);
    if (!cstAplicaDifal)
        return null;
    var aliqInter = (0, difal_aliquotas_1.getAliquotaInterestadualCONFAZ)(p.ufEmitente, p.ufDestinatario);
    if (aliqInter == null) {
        throw new Error("Al\u00EDquota interestadual n\u00E3o encontrada para UF origem ".concat(p.ufEmitente, " / destino ").concat(p.ufDestinatario, ". ") +
            "Verifique se as UFs est\u00E3o cadastradas corretamente.");
    }
    var aliqInterna = (0, difal_aliquotas_1.getAliquotaInternaPorUF)(p.ufDestinatario);
    if (aliqInterna == null || aliqInterna <= 0) {
        throw new Error("Al\u00EDquota interna UF destino n\u00E3o configurada para ".concat(p.ufDestinatario, ". ") +
            "Configure na tabela CONFAZ.");
    }
    if (aliqInterna <= 0) {
        throw new Error("Al\u00EDquota interna UF destino n\u00E3o configurada (".concat(aliqInterna, "%). ") +
            "Configure na regra ICMS para a UF ".concat(p.ufDestinatario, "."));
    }
    // Regime especial: alíquotas preenchidas, base e valor zerados (padrão Bling/E-PTA-RE)
    var baseUfDest = p.temRegimeEspecial ? 0 : p.valorBruto;
    var valorUfDest = p.temRegimeEspecial ? 0 : Math.round(p.valorBruto * Math.max(0, aliqInterna - aliqInter)) / 100;
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
/** PIS/COFINS: regra(banco) > item(produto) > default(regime). Base = valorBruto quando há alíquota > 0; caso contrário zera base/valor/aliquota. */
function calcularPisCofins(p) {
    var _a, _b, _c, _d;
    var pisCstRaw = p.regraPIS ? (0, pedido_data_service_1.extrairCstDeSituacaoTributaria)(p.regraPIS.situacaoTributaria) : null;
    var cofinsCstRaw = p.regraCOFINS ? (0, pedido_data_service_1.extrairCstDeSituacaoTributaria)(p.regraCOFINS.situacaoTributaria) : null;
    var defaultCst = p.regimeStr === '1' ? '49' : '01';
    var pisCst = (_a = pisCstRaw !== null && pisCstRaw !== void 0 ? pisCstRaw : (p.item.pis_situacao_tributaria != null ? String(p.item.pis_situacao_tributaria) : null)) !== null && _a !== void 0 ? _a : defaultCst;
    var cofinsCst = (_b = cofinsCstRaw !== null && cofinsCstRaw !== void 0 ? cofinsCstRaw : (p.item.cofins_situacao_tributaria != null ? String(p.item.cofins_situacao_tributaria) : null)) !== null && _b !== void 0 ? _b : defaultCst;
    var pisAliq = ((_c = p.regraPIS) === null || _c === void 0 ? void 0 : _c.aliquota) != null
        ? Number(p.regraPIS.aliquota)
        : (p.item.pis_aliquota_porcentual != null && p.item.pis_aliquota_porcentual !== '' ? Number(p.item.pis_aliquota_porcentual) : null);
    var cofinsAliq = ((_d = p.regraCOFINS) === null || _d === void 0 ? void 0 : _d.aliquota) != null
        ? Number(p.regraCOFINS.aliquota)
        : (p.item.cofins_aliquota_porcentual != null && p.item.cofins_aliquota_porcentual !== '' ? Number(p.item.cofins_aliquota_porcentual) : null);
    var pisAliqNum = pisAliq != null ? Number(pisAliq) : null;
    var cofinsAliqNum = cofinsAliq != null ? Number(cofinsAliq) : null;
    // Regra:
    // - Se alíquota for null ou 0 → base = 0, valor = 0, aliquota_porcentual = 0
    // - Se alíquota > 0         → base = valorBruto, valor = round(valorBruto * aliquota / 100)
    var pisTemAliqPositiva = pisAliqNum != null && pisAliqNum > 0;
    var cofinsTemAliqPositiva = cofinsAliqNum != null && cofinsAliqNum > 0;
    var pisBaseCalculo = pisTemAliqPositiva ? p.valorBruto : 0;
    var cofinsBaseCalculo = cofinsTemAliqPositiva ? p.valorBruto : 0;
    var result = {
        pis_situacao_tributaria: pisCst,
        pis_base_calculo: pisBaseCalculo,
        pis_aliquota_porcentual: pisTemAliqPositiva ? pisAliqNum : 0,
        pis_valor: pisTemAliqPositiva ? Math.round(p.valorBruto * pisAliqNum) / 100 : 0,
        cofins_situacao_tributaria: cofinsCst,
        cofins_base_calculo: cofinsBaseCalculo,
        cofins_aliquota_porcentual: cofinsTemAliqPositiva ? cofinsAliqNum : 0,
        cofins_valor: cofinsTemAliqPositiva ? Math.round(p.valorBruto * cofinsAliqNum) / 100 : 0,
    };
    return result;
}
/** Normaliza ICMS do payload: calc base, difal, e CST→CSOSN para Simples Nacional. Quando incluirFreteNaBase (indTot=1), BC = vProd + vFrete. */
function normalizePayloadIcms(payload, temRegimeEspecial, regimeStr, presumido, incluirFreteNaBase) {
    var _a, _b, _c, _d, _e, _f;
    if (temRegimeEspecial === void 0) { temRegimeEspecial = false; }
    if (regimeStr === void 0) { regimeStr = ''; }
    if (presumido === void 0) { presumido = null; }
    if (incluirFreteNaBase === void 0) { incluirFreteNaBase = true; }
    var items = ((_a = payload.items) !== null && _a !== void 0 ? _a : payload.itens);
    if (!Array.isArray(items) || items.length === 0)
        return payload;
    var normalized = __assign({}, payload);
    normalized.items = normalizePayloadCfopItems(normalized, items);
    var localDestino = Number((_b = payload.local_destino) !== null && _b !== void 0 ? _b : 0);
    var consumidorFinal = String((_c = payload.consumidor_final) !== null && _c !== void 0 ? _c : '1').trim();
    var ufEmitente = String((_d = payload.uf_emitente) !== null && _d !== void 0 ? _d : '').trim().toUpperCase();
    var ufDestinatario = String((_e = payload.uf_destinatario) !== null && _e !== void 0 ? _e : '').trim().toUpperCase();
    var precisaDifal = localDestino === 2 && consumidorFinal === '1' && ufDestinatario.length === 2;
    var itemsAfterCfop = ((_f = normalized.items) !== null && _f !== void 0 ? _f : items);
    var normalizedItems = itemsAfterCfop.map(function (item) {
        var _a, _b, _c, _d, _e, _f;
        var it = __assign({}, item);
        var cst = String((_a = it.icms_situacao_tributaria) !== null && _a !== void 0 ? _a : '').trim();
        var cstApplies = focus_nfe_types_1.CST_COM_ICMS_TRIBUTADO.has(cst) || focus_nfe_types_1.CSOSN_COM_DIFAL.has(cst);
        if (!cstApplies)
            return it;
        var valorBruto = it.valor_bruto != null
            ? Number(it.valor_bruto)
            : Number((_b = it.valor_unitario_comercial) !== null && _b !== void 0 ? _b : 0) * Number((_d = (_c = it.quantidade_comercial) !== null && _c !== void 0 ? _c : it.quantidade_tributavel) !== null && _d !== void 0 ? _d : 1);
        var valorFreteItem = incluirFreteNaBase ? Number((_e = it.valor_frete) !== null && _e !== void 0 ? _e : 0) : 0;
        var bc = Math.round((it.icms_base_calculo != null ? Number(it.icms_base_calculo) : valorBruto + valorFreteItem) * 100) / 100;
        it.icms_base_calculo = bc;
        // ICMS Próprio (separado do DIFAL)
        if (focus_nfe_types_1.CST_COM_ICMS_TRIBUTADO.has(cst)) {
            var icms = calcularIcmsProprio({ valorBruto: bc, cst: cst, regimeStr: regimeStr, presumido: presumido, aliquotaIcmsRegra: Number((_f = it.icms_aliquota) !== null && _f !== void 0 ? _f : 0) || null });
            Object.assign(it, icms);
        }
        // DIFAL (separado do ICMS próprio)
        if (precisaDifal) {
            var difal = calcularDifal({
                valorBruto: bc,
                cst: cst,
                ufEmitente: ufEmitente,
                ufDestinatario: ufDestinatario,
                temRegimeEspecial: temRegimeEspecial,
            });
            if (difal)
                Object.assign(it, difal);
        }
        return it;
    });
    normalized.items = normalizePayloadCstParaSimplesNacional(normalized, normalizedItems);
    return normalized;
}
/** Lê da regra ICMS a alíquota interna UF (aceita camelCase e snake_case do banco). */
function getAliquotaInternaUF(regra) {
    var _a, _b, _c;
    if (!regra)
        return null;
    var r = regra;
    var v = (_c = (_b = (_a = r.aliquota_internaUF) !== null && _a !== void 0 ? _a : r.aliquota_internauf) !== null && _b !== void 0 ? _b : r.aliquota_interna_uf_destino) !== null && _c !== void 0 ? _c : r.aliquota_interna_uf;
    return v != null && v !== '' ? Number(v) : null;
}
/**
 * Enriquece os itens do payload com o grupo de ICMS da UF de destino (DIFAL) quando
 * local_destino=2, consumidor_final=1 e os itens ainda não têm o grupo.
 * Usa a regra ICMS (aliquota_interestadual, aliquota_internaUF) para calcular partilha.
 */
function enrichItemsWithDifalFromRegra(payload, regraICMS, naturezaId, temRegimeEspecial) {
    var _a, _b, _c, _d, _e;
    if (temRegimeEspecial === void 0) { temRegimeEspecial = false; }
    var localDestino = Number((_a = payload.local_destino) !== null && _a !== void 0 ? _a : 0);
    var consumidorFinal = String((_b = payload.consumidor_final) !== null && _b !== void 0 ? _b : '1').trim();
    var ufEmitente = String((_c = payload.uf_emitente) !== null && _c !== void 0 ? _c : '').trim().toUpperCase();
    var ufDestinatario = String((_d = payload.uf_destinatario) !== null && _d !== void 0 ? _d : '').trim().toUpperCase();
    if (localDestino !== 2 || consumidorFinal !== '1' || ufDestinatario.length !== 2) {
        return payload;
    }
    var items = ((_e = payload.items) !== null && _e !== void 0 ? _e : payload.itens);
    if (!Array.isArray(items) || items.length === 0)
        return payload;
    var incluirFreteNaBase = payload.incluir_frete_base_ipi !== false && payload.incluir_frete_base_ipi !== 'false';
    var normalizedItems = items.map(function (item) {
        var _a, _b, _c, _d, _e;
        var it = __assign({}, item);
        var cst = String((_a = it.icms_situacao_tributaria) !== null && _a !== void 0 ? _a : '').trim();
        if (!focus_nfe_types_1.CST_COM_ICMS_TRIBUTADO.has(cst) && !focus_nfe_types_1.CSOSN_COM_DIFAL.has(cst))
            return it;
        // Se já veio com DIFAL válido, preservar
        var aliqInter = Number(it.icms_aliquota_interestadual);
        var aliqInternaDest = Number(it.icms_aliquota_interna_uf_destino);
        if (it.icms_aliquota_interna_uf_destino != null &&
            it.icms_aliquota_interestadual != null &&
            aliqInternaDest > 0 &&
            (aliqInter === 4 || aliqInter === 7 || aliqInter === 12)) {
            return it;
        }
        var valorBruto = it.valor_bruto != null
            ? Number(it.valor_bruto)
            : Number((_b = it.valor_unitario_comercial) !== null && _b !== void 0 ? _b : 0) * Number((_d = (_c = it.quantidade_comercial) !== null && _c !== void 0 ? _c : it.quantidade_tributavel) !== null && _d !== void 0 ? _d : 1);
        var valorFreteItem = incluirFreteNaBase ? Number((_e = it.valor_frete) !== null && _e !== void 0 ? _e : 0) : 0;
        var bc = it.icms_base_calculo != null ? Number(it.icms_base_calculo) : Math.round((valorBruto + valorFreteItem) * 100) / 100;
        var difal = calcularDifal({
            valorBruto: bc,
            cst: cst,
            ufEmitente: ufEmitente,
            ufDestinatario: ufDestinatario,
            temRegimeEspecial: temRegimeEspecial,
        });
        if (difal)
            Object.assign(it, difal);
        return it;
    });
    var result = __assign({}, payload);
    result.items = normalizedItems;
    if (payload.itens != null)
        result.itens = normalizedItems;
    return result;
}
/**
 * Helper to truncate string fields to 60 characters and log a warning if truncated.
 * This is required to avoid SEFAZ schema rejection (MaxLength = 60).
 */
function truncate60(value, fieldName) {
    var str = String(value !== null && value !== void 0 ? value : '').trim();
    if (str.length > 60) {
        console.warn("[FocusNFe Payload] Campo '".concat(fieldName, "' excedeu limite de 60 caracteres (").concat(str.length, "). Sendo truncado: \"").concat(str, "\""));
        return str.slice(0, 60);
    }
    return str;
}
/**
 * Monta o payload Focus NFe a partir dos dados do pedido.
 * Schema real: pedidos_venda (totalPedido, totalFrete, totalDesconto), contatos+enderecos, empresas+enderecos, itens_venda (valorUnit, quantidade, subtotal, produto).
 * regras: opcional - regras tributárias por natureza (regrasICMS, regrasPIS, regrasCOFINS, regrasIPI, regrasRETENCOES).
 */
function buildFocusNFePayload(pedido, itens, empresa, cliente, naturezaOperacao, regras, ambiente) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24;
    var now = nowBrasilia();
    var valorFrete = Number((_b = (_a = pedido.totalFrete) !== null && _a !== void 0 ? _a : pedido.valor_frete) !== null && _b !== void 0 ? _b : 0);
    var valorTotal = Number((_d = (_c = pedido.totalPedido) !== null && _c !== void 0 ? _c : pedido.valor_total) !== null && _d !== void 0 ? _d : 0);
    var valorDesconto = Number((_f = (_e = pedido.totalDesconto) !== null && _e !== void 0 ? _e : pedido.valor_desconto) !== null && _f !== void 0 ? _f : 0);
    var valorProdutos = itens.reduce(function (s, i) { var _a, _b; return s + Number((_b = (_a = i.subtotal) !== null && _a !== void 0 ? _a : i.valor_total) !== null && _b !== void 0 ? _b : 0); }, 0);
    var cnpjEmitente = onlyNumbers((_g = empresa.cnpj) !== null && _g !== void 0 ? _g : '');
    var docDest = String((_k = (_j = (_h = cliente.cpf_cnpj) !== null && _h !== void 0 ? _h : cliente.cnpj) !== null && _j !== void 0 ? _j : cliente.cpf) !== null && _k !== void 0 ? _k : '').trim();
    var dest = cpfOuCnpj(docDest);
    var ufEmitente = String((_l = empresa.uf) !== null && _l !== void 0 ? _l : '').trim().toUpperCase();
    var paisDestino = String((_m = cliente.pais) !== null && _m !== void 0 ? _m : 'Brasil').trim();
    /** UF destinatário: para Brasil, exige UF válida; para exterior, pode omitir (API aceita). */
    var ufDestinatarioRaw = String((_o = cliente.uf) !== null && _o !== void 0 ? _o : '').trim().toUpperCase();
    if (paisDestino === 'Brasil' && (!ufDestinatarioRaw || ufDestinatarioRaw.length !== 2)) {
        throw new Error('UF do destinatário não informada. Cadastre o endereço completo do cliente.');
    }
    var ufDestinatario = ufDestinatarioRaw || '';
    var isInterestadual = ufEmitente !== '' && ufDestinatario !== '' && ufEmitente !== ufDestinatario;
    /** local_destino: 1 = mesma UF, 2 = UF diferente, 3 = exterior */
    var localDestino = paisDestino !== 'Brasil' ? 3 : isInterestadual ? 2 : 1;
    /** indicador_inscricao_estadual_destinatario: 1 = contribuinte, 2 = isento, 9 = não contribuinte. */
    var ieDest = String((_p = cliente.ie) !== null && _p !== void 0 ? _p : '').trim().toUpperCase();
    var cliRecord = cliente;
    var hasIndIEDest = cliRecord.indIEDest === 1 || cliRecord.indIEDest === 2 || cliRecord.indIEDest === 9;
    var indicadorIeDest = dest.cpf
        ? 9 // CPF = pessoa física = não contribuinte
        : hasIndIEDest
            ? cliRecord.indIEDest
            : cliRecord.contribuinte_icms === true && ieDest !== '' && ieDest !== 'ISENTO'
                ? 1
                : ieDest === 'ISENTO'
                    ? 2
                    // PJ (CNPJ) com IE preenchida e válida => contribuinte (1)
                    : dest.cnpj && ieDest !== '' && ieDest !== 'ISENTO' && /^\d{2,14}$/.test(ieDest)
                        ? 1
                        : 9;
    var cli = cliente;
    var nat = naturezaOperacao;
    var hasConsumidorFinal = cli.consumidorFinal === true || cli.consumidorFinal === 'true' || nat.consumidorFinal === true || nat.consumidorFinal === 'true';
    var hasNaoConsumidorFinal = cli.consumidorFinal === false || cli.consumidorFinal === 'false' || nat.consumidorFinal === false || nat.consumidorFinal === 'false';
    // Default: contribuinte ICMS (indIEDest=1) -> não é consumidor final; CPF ou não contribuinte -> consumidor final
    var consumidorFinal = hasConsumidorFinal ? '1' : hasNaoConsumidorFinal ? '0' : (indicadorIeDest === 1 ? '0' : '1');
    var precisaDifal = localDestino === 2 && consumidorFinal === '1';
    var naturezaId = Number((_q = naturezaOperacao.id) !== null && _q !== void 0 ? _q : 0);
    var regraICMS = (_r = regras === null || regras === void 0 ? void 0 : regras.icms) !== null && _r !== void 0 ? _r : null;
    var regraPIS = (_s = regras === null || regras === void 0 ? void 0 : regras.pis) !== null && _s !== void 0 ? _s : null;
    var regraCOFINS = (_t = regras === null || regras === void 0 ? void 0 : regras.cofins) !== null && _t !== void 0 ? _t : null;
    var rIcms = regraICMS;
    var cfopBaseRegra = rIcms ? ((_v = (_u = rIcms.cfop) !== null && _u !== void 0 ? _u : rIcms.CFOP) !== null && _v !== void 0 ? _v : '').toString().trim() : '';
    var aliquotaIcmsRegra = (rIcms === null || rIcms === void 0 ? void 0 : rIcms.aliquota_icms) != null ? Number(rIcms.aliquota_icms) : null;
    var aliquotaInternaUFDestinoRegra = getAliquotaInternaUF(rIcms);
    // Regime presumido: alíquota efetiva de ICMS (campo regrasICMS.presumido)
    // 0 ou null = não configurado (usar aliquota_icms); valor > 0 = usar como alíquota efetiva
    var presumidoRaw = rIcms === null || rIcms === void 0 ? void 0 : rIcms.presumido;
    var presumidoNum = presumidoRaw != null && String(presumidoRaw).trim() !== '' ? Number(presumidoRaw) : null;
    var presumido = (presumidoNum != null && presumidoNum > 0) ? presumidoNum : null;
    if (presumidoNum != null && presumidoNum < 0) {
        throw new Error('Regra ICMS com regime presumido inválido. O campo presumido não pode ser negativo.');
    }
    // Regime tributário é propriedade EXCLUSIVA da empresa
    var emp = empresa;
    var regimeStr = emp.codRegime_tributario != null ? String(emp.codRegime_tributario).trim() : '';
    if (!regimeStr) {
        throw new Error("Empresa ".concat(cnpjEmitente, ": regime tribut\u00E1rio (codRegime_tributario) n\u00E3o configurado. Cadastre 1 (Simples Nacional), 2 (Simples Excesso) ou 3 (Regime Normal)."));
    }
    /** indTot = 1: frete compõe a base de cálculo de ICMS, PIS e COFINS (BC = vProd + vFrete). indTot = 0: BC = vProd. */
    var incluirFreteNaBase = nat.incluir_frete_base_ipi !== false && nat.incluir_frete_base_ipi !== 'false';
    // Pré-calcula o frete por item (mesmo rateio usado depois) para usar na base de cálculo quando indTot = 1
    var valorFreteRounded = Math.round(valorFrete * 100) / 100;
    var fretePorItem = new Array(itens.length).fill(0);
    if (valorFreteRounded > 0 && itens.length > 0) {
        if (itens.length === 1) {
            fretePorItem[0] = valorFreteRounded;
        }
        else {
            var valorProdutosSafe = valorProdutos > 0 ? valorProdutos : 1;
            var somaFrete = 0;
            for (var i = 0; i < itens.length; i++) {
                var subtotal = Number((_x = (_w = itens[i].subtotal) !== null && _w !== void 0 ? _w : itens[i].valor_total) !== null && _x !== void 0 ? _x : 0);
                var vBruto = Math.round(subtotal * 100) / 100;
                fretePorItem[i] = Math.round((vBruto / valorProdutosSafe) * valorFreteRounded * 100) / 100;
                somaFrete += fretePorItem[i];
            }
            var diff = Math.round((valorFreteRounded - somaFrete) * 100) / 100;
            if (diff !== 0)
                fretePorItem[itens.length - 1] = Math.round((fretePorItem[itens.length - 1] + diff) * 100) / 100;
        }
    }
    var itensPayload = itens.map(function (item, idx) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
        var qtd = Number((_a = item.quantidade) !== null && _a !== void 0 ? _a : 0);
        var vUnit = Number((_c = (_b = item.valorUnit) !== null && _b !== void 0 ? _b : item.valor_unitario) !== null && _c !== void 0 ? _c : 0);
        var valorBrutoNum = Math.round(qtd * vUnit * 100) / 100;
        /** Base para tributos: vProd + vFrete quando indTot = 1 (incluirFreteNaBase); senão só vProd. */
        var baseParaTributos = Math.round((valorBrutoNum + (incluirFreteNaBase ? fretePorItem[idx] : 0)) * 100) / 100;
        var ncmRaw = (_e = (_d = item.codigo_ncm) !== null && _d !== void 0 ? _d : item.ncm) !== null && _e !== void 0 ? _e : '';
        var ncm = (ncmRaw ? String(ncmRaw).replace(/\D/g, '').padStart(8, '0').slice(0, 8) : '00000000') || '00000000';
        // Priorizar CST da regra ICMS sobre CST do produto
        var cstDaRegra = regraICMS ? (0, pedido_data_service_1.extrairCstDeSituacaoTributaria)(regraICMS.situacaoTributaria) : null;
        var cstDefault = regimeStr === '1' ? '400' : regimeStr === '3' ? '00' : '400';
        var cst = String((_f = cstDaRegra !== null && cstDaRegra !== void 0 ? cstDaRegra : item.icms_situacao_tributaria) !== null && _f !== void 0 ? _f : cstDefault).trim();
        var it = item;
        // ── ICMS Próprio: base = vProd + vFrete quando indTot = 1 ──
        var icmsProprio = calcularIcmsProprio({
            valorBruto: baseParaTributos,
            cst: cst,
            regimeStr: regimeStr,
            presumido: presumido,
            aliquotaIcmsRegra: aliquotaIcmsRegra,
        });
        // ── PIS/COFINS: base = vProd + vFrete quando indTot = 1 ──
        var pisCofins = calcularPisCofins({
            valorBruto: baseParaTributos,
            regraPIS: regraPIS,
            regraCOFINS: regraCOFINS,
            item: it,
            regimeStr: regimeStr,
        });
        var ipiCst = (regras === null || regras === void 0 ? void 0 : regras.ipi)
            ? ((_k = (_g = (0, pedido_data_service_1.extrairCstDeSituacaoTributaria)(regras.ipi.situacaoTributaria)) !== null && _g !== void 0 ? _g : (_j = String((_h = regras.ipi.situacaoTributaria) !== null && _h !== void 0 ? _h : '').trim().match(/^\d+/)) === null || _j === void 0 ? void 0 : _j[0]) !== null && _k !== void 0 ? _k : null)
            : null;
        var ipiCodEnquadramento = ((_l = regras === null || regras === void 0 ? void 0 : regras.ipi) === null || _l === void 0 ? void 0 : _l.codEnquadramento) != null ? String(regras.ipi.codEnquadramento) : null;
        var base = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ numero_item: String(idx + 1), codigo_produto: String((_p = (_o = (_m = item.produto) !== null && _m !== void 0 ? _m : it.produto_id) !== null && _o !== void 0 ? _o : item.id) !== null && _p !== void 0 ? _p : idx + 1), descricao: String((_q = item.descricao) !== null && _q !== void 0 ? _q : 'Item'), cfop: cfopPorDestino(String((_r = item.cfop) !== null && _r !== void 0 ? _r : cfopBaseRegra), isInterestadual), unidade_comercial: String((_s = item.unidade) !== null && _s !== void 0 ? _s : 'UN'), quantidade_comercial: qtd, valor_unitario_comercial: Math.round(vUnit * 100) / 100, valor_unitario_tributavel: Math.round(vUnit * 100) / 100, unidade_tributavel: String((_t = item.unidade) !== null && _t !== void 0 ? _t : 'UN'), codigo_ncm: ncm, quantidade_tributavel: qtd, valor_bruto: valorBrutoNum, icms_situacao_tributaria: cst, icms_origem: (_u = item.icms_origem) !== null && _u !== void 0 ? _u : '0', codigo_barras_comercial: String((_v = it.ean) !== null && _v !== void 0 ? _v : 'SEM GTIN'), codigo_barras_tributavel: String((_w = it.ean) !== null && _w !== void 0 ? _w : 'SEM GTIN') }, icmsProprio), pisCofins), (it.ibs_cbs_situacao_tributaria != null && { ibs_cbs_situacao_tributaria: String(it.ibs_cbs_situacao_tributaria) })), (it.ibs_cbs_classificacao_tributaria != null && { ibs_cbs_classificacao_tributaria: String(it.ibs_cbs_classificacao_tributaria) })), (it.ibs_cbs_base_calculo != null && { ibs_cbs_base_calculo: Number(it.ibs_cbs_base_calculo) })), (it.ibs_uf_aliquota != null && { ibs_uf_aliquota: Number(it.ibs_uf_aliquota) })), (it.ibs_uf_valor != null && { ibs_uf_valor: Number(it.ibs_uf_valor) })), (it.ibs_mun_aliquota != null && { ibs_mun_aliquota: Number(it.ibs_mun_aliquota) })), (it.ibs_mun_valor != null && { ibs_mun_valor: Number(it.ibs_mun_valor) })), (it.ibs_valor_total != null && { ibs_valor_total: Number(it.ibs_valor_total) })), (it.cbs_aliquota != null && { cbs_aliquota: Number(it.cbs_aliquota) })), (it.cbs_valor != null && { cbs_valor: Number(it.cbs_valor) })), (ipiCst != null && { ipi_situacao_tributaria: ipiCst })), (ipiCodEnquadramento != null && { ipi_codigo_enquadramento_legal: ipiCodEnquadramento }));
        // ── DIFAL: base = vProd + vFrete quando indTot = 1 ──
        if (precisaDifal) {
            var temRegimeEspecial = !!emp.tem_regime_especial;
            var difal = calcularDifal({
                valorBruto: baseParaTributos,
                cst: cst,
                ufEmitente: ufEmitente,
                ufDestinatario: ufDestinatario,
                temRegimeEspecial: temRegimeEspecial,
            });
            if (difal)
                Object.assign(base, difal);
        }
        return base;
    });
    // Distribuir valor_frete nos itens (SEFAZ 535: total do frete deve ser igual à soma dos fretes dos itens)
    if (valorFreteRounded > 0 && itensPayload.length > 0) {
        if (itensPayload.length === 1) {
            itensPayload[0].valor_frete = valorFreteRounded;
        }
        else {
            // Rateio proporcional ao valor do item: frete_item = (valor_bruto / valorProdutos) * valor_frete_total
            var valorProdutosSafe = valorProdutos > 0 ? valorProdutos : 1;
            var somaFreteItens = 0;
            for (var i = 0; i < itensPayload.length; i++) {
                var valorBruto = (_y = itensPayload[i].valor_bruto) !== null && _y !== void 0 ? _y : 0;
                var freteItem = Math.round((valorBruto / valorProdutosSafe) * valorFreteRounded * 100) / 100;
                itensPayload[i].valor_frete = freteItem;
                somaFreteItens += freteItem;
            }
            // Ajuste no último item para a soma bater exatamente com o totalizador
            var diff = Math.round((valorFreteRounded - somaFreteItens) * 100) / 100;
            if (diff !== 0) {
                var last = itensPayload[itensPayload.length - 1];
                last.valor_frete = Math.round((((_z = last.valor_frete) !== null && _z !== void 0 ? _z : 0) + diff) * 100) / 100;
            }
        }
    }
    // regimeStr/emp/nat j\u00e1 declarados antes dos itens
    var presencaComprador = normalizarPresencaComprador(nat.indicadorPresenca != null && String(nat.indicadorPresenca).trim() !== ''
        ? String(nat.indicadorPresenca).trim()
        : undefined);
    // Validações obrigatórias de emitente
    var ieEmitente = String((_1 = (_0 = empresa.iE) !== null && _0 !== void 0 ? _0 : empresa.inscricao_estadual) !== null && _1 !== void 0 ? _1 : '').trim();
    validarCampoObrigatorio(ieEmitente, 'Inscrição Estadual', 'Empresa emitente');
    validarCampoObrigatorio(cnpjEmitente, 'CNPJ', 'Empresa emitente');
    var cepEmitente = onlyNumbers((_2 = empresa.cep) !== null && _2 !== void 0 ? _2 : '').padStart(8, '0').slice(0, 8);
    if (cepEmitente === '00000000')
        throw new Error('Empresa emitente: CEP é obrigatório. Cadastre o endereço da empresa.');
    var cepDestinatario = onlyNumbers((_3 = cliente.cep) !== null && _3 !== void 0 ? _3 : '').padStart(8, '0').slice(0, 8);
    if (paisDestino === 'Brasil' && cepDestinatario === '00000000')
        throw new Error('Destinatário: CEP é obrigatório. Cadastre o endereço do cliente.');
    var telefoneDest = ((_5 = (_4 = cliente.celular) !== null && _4 !== void 0 ? _4 : cliente.telefoneFixo) !== null && _5 !== void 0 ? _5 : '').trim();
    var infoAdicionaisRaw = (_6 = nat.infoAdicionais) !== null && _6 !== void 0 ? _6 : nat.info_adicionais;
    var informacoesAdicionaisContribuinte = infoAdicionaisRaw != null && String(infoAdicionaisRaw).trim() !== '' ? String(infoAdicionaisRaw).trim() : '';
    // Ambiente vem como parâmetro (testabilidade, multi-tenant); fallback para env
    var ambienteEfetivo = (_7 = ambiente !== null && ambiente !== void 0 ? ambiente : process.env.FOCUS_NFE_AMBIENTE) !== null && _7 !== void 0 ? _7 : 'homologacao';
    var nomeDestinatario = String((_10 = (_9 = (_8 = cliente.nome) !== null && _8 !== void 0 ? _8 : cliente.razao_social) !== null && _9 !== void 0 ? _9 : cliente.nome_fantasia) !== null && _10 !== void 0 ? _10 : '').trim() || 'Destinatário';
    var payload = __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({ data_emissao: now, data_entrada_saida: now, natureza_operacao: (_11 = naturezaOperacao.descricao) !== null && _11 !== void 0 ? _11 : 'Venda de mercadoria', tipo_documento: '1', finalidade_emissao: '1', consumidor_final: consumidorFinal, local_destino: localDestino, indicador_inscricao_estadual_destinatario: indicadorIeDest }, (regimeStr && { regime_tributario_emitente: regimeStr })), { presenca_comprador: presencaComprador, cnpj_emitente: cnpjEmitente, nome_emitente: truncate60(empresa.nome, 'nome_emitente'), nome_fantasia_emitente: empresa.nomeFantasia ? truncate60(empresa.nomeFantasia, 'nome_fantasia_emitente') : undefined, logradouro_emitente: truncate60(empresa.logradouro, 'logradouro_emitente'), numero_emitente: String((_12 = empresa.numero) !== null && _12 !== void 0 ? _12 : 'S/N') }), (String((_13 = empresa.complemento) !== null && _13 !== void 0 ? _13 : '').trim() ? { complemento_emitente: String(empresa.complemento).trim() } : {})), { bairro_emitente: truncate60(empresa.bairro, 'bairro_emitente'), municipio_emitente: truncate60(empresa.municipio, 'municipio_emitente'), uf_emitente: String((_14 = empresa.uf) !== null && _14 !== void 0 ? _14 : 'MG'), cep_emitente: cepEmitente, inscricao_estadual_emitente: ieEmitente }), (empresa.telefone != null && String(empresa.telefone).trim() !== '' ? { telefone_emitente: onlyNumbers(String(empresa.telefone)) } : {})), { nome_destinatario: truncate60(nomeDestinatario, 'nome_destinatario') }), (indicadorIeDest === 1 && {
        inscricao_estadual_destinatario: ieDest === '' ? 'ISENTO' : (_15 = cliente.ie) !== null && _15 !== void 0 ? _15 : 'ISENTO',
    })), (indicadorIeDest === 2 && {
        inscricao_estadual_destinatario: 'ISENTO',
    })), (indicadorIeDest === 9 && dest.cnpj && ieDest && ieDest.toUpperCase() !== 'ISENTO' && {
        inscricao_estadual_destinatario: ieDest,
    })), { logradouro_destinatario: truncate60(cliente.logradouro, 'logradouro_destinatario'), numero_destinatario: String((_16 = cliente.numero) !== null && _16 !== void 0 ? _16 : 'S/N') }), (String((_17 = cliente.complemento) !== null && _17 !== void 0 ? _17 : '').trim() ? { complemento_destinatario: String(cliente.complemento).trim() } : {})), { bairro_destinatario: truncate60(cliente.bairro, 'bairro_destinatario'), municipio_destinatario: truncate60(cliente.municipio, 'municipio_destinatario'), uf_destinatario: ufDestinatario, pais_destinatario: (_18 = cliente.pais) !== null && _18 !== void 0 ? _18 : 'Brasil', cep_destinatario: cepDestinatario }), (cliente.email != null && { email_destinatario: truncate60(String(cliente.email), 'email_destinatario') })), (cliente.nomeFantasia != null && { nome_fantasia_destinatario: truncate60(String(cliente.nomeFantasia), 'nome_fantasia_destinatario') })), { valor_frete: Math.round(valorFrete * 100) / 100, valor_seguro: 0, valor_total: Math.round(valorTotal * 100) / 100, valor_produtos: Math.round(valorProdutos * 100) / 100, modalidade_frete: '0' }), (nat.indicadorIntermediador != null && { indicador_intermediario: String(nat.indicadorIntermediador) })), (String((_19 = nat.indicadorIntermediador) !== null && _19 !== void 0 ? _19 : '') === '1' &&
        nat.cnpj_intermediador != null && { cnpj_intermediador: onlyNumbers(String(nat.cnpj_intermediador)) })), (String((_20 = nat.indicadorIntermediador) !== null && _20 !== void 0 ? _20 : '') === '1' &&
        nat.identificador_intermediador != null && { identificador_intermediador: String(nat.identificador_intermediador) })), (informacoesAdicionaisContribuinte !== '' && { informacoes_adicionais_contribuinte: informacoesAdicionaisContribuinte })), (nat.ibs_cbs_situacao_tributaria != null && { ibs_cbs_situacao_tributaria: String(nat.ibs_cbs_situacao_tributaria) })), (nat.ibs_cbs_classificacao_tributaria != null && { ibs_cbs_classificacao_tributaria: String(nat.ibs_cbs_classificacao_tributaria) })), (nat.ibs_cbs_base_calculo != null && { ibs_cbs_base_calculo: Number(nat.ibs_cbs_base_calculo) })), (nat.ibs_uf_aliquota != null && { ibs_uf_aliquota: Number(nat.ibs_uf_aliquota) })), (nat.ibs_uf_valor != null && { ibs_uf_valor: Number(nat.ibs_uf_valor) })), (nat.ibs_mun_aliquota != null && { ibs_mun_aliquota: Number(nat.ibs_mun_aliquota) })), (nat.ibs_mun_valor != null && { ibs_mun_valor: Number(nat.ibs_mun_valor) })), (nat.ibs_valor_total != null && { ibs_valor_total: Number(nat.ibs_valor_total) })), (nat.cbs_aliquota != null && { cbs_aliquota: Number(nat.cbs_aliquota) })), (nat.cbs_valor != null && { cbs_valor: Number(nat.cbs_valor) })), (pedido.transporte_modalidade != null && { modalidade_frete: String(pedido.transporte_modalidade) })), (String((_21 = pedido.transporte_modalidade) !== null && _21 !== void 0 ? _21 : '') !== '9' && __assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (pedido.transporte_nome != null && { nome_transportador: truncate60(String(pedido.transporte_nome), 'nome_transportador') })), (pedido.transporte_cnpj != null && String(pedido.transporte_cnpj).length === 14 && { cnpj_transportador: String(pedido.transporte_cnpj) })), (pedido.transporte_cnpj != null && String(pedido.transporte_cnpj).length === 11 && { cpf_transportador: String(pedido.transporte_cnpj) })), (pedido.transporte_ie != null && { inscricao_estadual_transportador: String(pedido.transporte_ie) })), (pedido.transporte_endereco != null && { endereco_transportador: truncate60(String(pedido.transporte_endereco), 'endereco_transportador') })), (pedido.transporte_municipio != null && { municipio_transportador: truncate60(String(pedido.transporte_municipio), 'municipio_transportador') })), (pedido.transporte_uf != null && { uf_transportador: String(pedido.transporte_uf) })))), ((pedido.volume_quantidade != null || pedido.volume_especie != null || pedido.volume_marca != null || pedido.volume_numeracao != null || pedido.volume_peso_bruto != null || pedido.volume_peso_liquido != null) && {
        volumes: [__assign(__assign(__assign(__assign(__assign(__assign({}, (pedido.volume_quantidade != null && { quantidade: Number(pedido.volume_quantidade) })), (pedido.volume_especie != null && { especie: String(pedido.volume_especie) })), (pedido.volume_marca != null && { marca: String(pedido.volume_marca) })), (pedido.volume_numeracao != null && { numeracao: String(pedido.volume_numeracao) })), (pedido.volume_peso_bruto != null && { peso_bruto: Number(pedido.volume_peso_bruto) })), (pedido.volume_peso_liquido != null && { peso_liquido: Number(pedido.volume_peso_liquido) }))]
    })), { formas_pagamento: [{
                forma_pagamento: '01',
                valor_pagamento: Math.round(valorTotal * 100) / 100,
            }], items: itensPayload });
    if (valorDesconto > 0)
        payload.valor_desconto = Math.round(valorDesconto * 100) / 100;
    if (telefoneDest !== '')
        payload.telefone_destinatario = telefoneDest;
    if (dest.cnpj)
        payload.cnpj_destinatario = dest.cnpj;
    else if (dest.cpf)
        payload.cpf_destinatario = dest.cpf;
    var payloadExt = payload;
    var vProd = Math.round(valorProdutos * 100) / 100;
    var regraIS = (_22 = regras === null || regras === void 0 ? void 0 : regras.is) !== null && _22 !== void 0 ? _22 : null;
    var regraIBS = (_23 = regras === null || regras === void 0 ? void 0 : regras.ibs) !== null && _23 !== void 0 ? _23 : null;
    var regraCBS = (_24 = regras === null || regras === void 0 ? void 0 : regras.cbs) !== null && _24 !== void 0 ? _24 : null;
    var calcValor = function (r) {
        var _a, _b;
        if (!r || (r.aliquota == null && r.base == null))
            return 0;
        var aliq = Number((_a = r.aliquota) !== null && _a !== void 0 ? _a : 0);
        var base = Number((_b = r.base) !== null && _b !== void 0 ? _b : 100);
        return Math.round(vProd * (base / 100) * (aliq / 100) * 100) / 100;
    };
    if (regraIS)
        payloadExt.total_is = calcValor(regraIS);
    if (regraIBS)
        payloadExt.total_ibs = calcValor(regraIBS);
    if (regraCBS)
        payloadExt.total_cbs = calcValor(regraCBS);
    payloadExt.incluir_frete_base_ipi = incluirFreteNaBase;
    return payload;
}
/**
 * Valida limites de tamanho de campos de texto conforme o schema XML NFe 4.0 da Sefaz.
 * Retorna array com mensagens de erro, para exibição de alerta antes da emissão.
 */
function validarPayloadSefaz(payload) {
    var _a;
    var erros = [];
    var checkMax = function (valor, maxLen, nomeCampo) {
        if (valor != null && String(valor).trim().length > maxLen) {
            erros.push("Aten\u00E7\u00E3o: O campo \"".concat(nomeCampo, "\" possui ").concat(String(valor).trim().length, " caracteres (m\u00E1x. permitido: ").concat(maxLen, "). Reduza o tamanho ou abrevie o texto."));
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
    var items = (_a = payload.items) !== null && _a !== void 0 ? _a : payload.itens;
    if (Array.isArray(items)) {
        items.forEach(function (item, idx) {
            var it = item;
            checkMax(it.descricao, 120, "Descri\u00E7\u00E3o do Produto (Item ".concat(idx + 1, ")"));
        });
    }
    return erros;
}
