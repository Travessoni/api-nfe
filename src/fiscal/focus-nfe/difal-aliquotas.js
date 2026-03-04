"use strict";
/**
 * Alíquota interestadual oficial conforme CONFAZ.
 * Base legal: Resolução Senado nº 22/1989 + Resolução 13/2012 (importados 4%).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAliquotaInterestadualCONFAZ = getAliquotaInterestadualCONFAZ;
exports.getAliquotaInternaPorUF = getAliquotaInternaPorUF;
var SUL_SUDESTE_EXCETO_ES = ['MG', 'SP', 'RJ', 'PR', 'RS', 'SC'];
var NORTE_NORDESTE_CO_ES = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO'
];
/**
 * origemMercadoria:
 * 0 = nacional
 * 1,2,3,8 = importado → 4%
 */
function getAliquotaInterestadualCONFAZ(ufOrigem, ufDestino, origemMercadoria) {
    var o = String(ufOrigem !== null && ufOrigem !== void 0 ? ufOrigem : '').trim().toUpperCase();
    var d = String(ufDestino !== null && ufDestino !== void 0 ? ufDestino : '').trim().toUpperCase();
    if (o.length !== 2 || d.length !== 2)
        return null;
    // ✅ Regra 4% importados
    var origem = String(origemMercadoria !== null && origemMercadoria !== void 0 ? origemMercadoria : '0');
    if (['1', '2', '3', '8'].includes(origem)) {
        return 4;
    }
    // ✅ Regra 7%
    if (SUL_SUDESTE_EXCETO_ES.includes(o) &&
        NORTE_NORDESTE_CO_ES.includes(d)) {
        return 7;
    }
    // ✅ Regra geral 12%
    return 12;
}
/**
 * Alíquota interna do ICMS por UF (percentual vigente comum).
 * Atualizar conforme legislação de cada estado (RICMS/portarias).
 */
var ALIQUOTA_INTERNA_POR_UF = {
    AC: 18, AL: 18, AM: 18, AP: 18, BA: 19, CE: 18, DF: 18,
    ES: 17, GO: 17, MA: 18, MG: 18, MS: 17, MT: 17, PA: 17,
    PB: 18, PE: 18, PI: 18, PR: 18, RJ: 20, RN: 18, RO: 17.5,
    RR: 17, RS: 18, SC: 17, SE: 18, SP: 18, TO: 18,
};
/**
 * Retorna a alíquota interna da UF de destino para DIFAL, ou null se UF inválida.
 */
function getAliquotaInternaPorUF(uf) {
    var key = String(uf !== null && uf !== void 0 ? uf : '').trim().toUpperCase();
    if (key.length !== 2)
        return null;
    var value = ALIQUOTA_INTERNA_POR_UF[key];
    return value != null ? value : null;
}
