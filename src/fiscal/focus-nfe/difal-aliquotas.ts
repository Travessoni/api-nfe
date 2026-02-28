/**
 * Alíquota interestadual oficial conforme CONFAZ.
 * Base legal: Resolução Senado nº 22/1989 + Resolução 13/2012 (importados 4%).
 */

const SUL_SUDESTE_EXCETO_ES = ['MG', 'SP', 'RJ', 'PR', 'RS', 'SC'];

const NORTE_NORDESTE_CO_ES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO'
];

/**
 * origemMercadoria:
 * 0 = nacional
 * 1,2,3,8 = importado → 4%
 */
export function getAliquotaInterestadualCONFAZ(
  ufOrigem: string,
  ufDestino: string,
  origemMercadoria?: string | number,
): 4 | 7 | 12 | null {

  const o = String(ufOrigem ?? '').trim().toUpperCase();
  const d = String(ufDestino ?? '').trim().toUpperCase();

  if (o.length !== 2 || d.length !== 2) return null;

  // ✅ Regra 4% importados
  const origem = String(origemMercadoria ?? '0');
  if (['1', '2', '3', '8'].includes(origem)) {
    return 4;
  }

  // ✅ Regra 7%
  if (
    SUL_SUDESTE_EXCETO_ES.includes(o) &&
    NORTE_NORDESTE_CO_ES.includes(d)
  ) {
    return 7;
  }

  // ✅ Regra geral 12%
  return 12;
}

/**
 * Alíquota interna do ICMS por UF (percentual vigente comum).
 * Atualizar conforme legislação de cada estado (RICMS/portarias).
 */
const ALIQUOTA_INTERNA_POR_UF: Record<string, number> = {
  AC: 18, AL: 18, AM: 18, AP: 18, BA: 19, CE: 18, DF: 18,
  ES: 17, GO: 17, MA: 18, MG: 18, MS: 17, MT: 17, PA: 17,
  PB: 18, PE: 18, PI: 18, PR: 18, RJ: 20, RN: 18, RO: 17.5,
  RR: 17, RS: 18, SC: 17, SE: 18, SP: 18, TO: 18,
};

/**
 * Retorna a alíquota interna da UF de destino para DIFAL, ou null se UF inválida.
 */
export function getAliquotaInternaPorUF(uf: string): number | null {
  const key = String(uf ?? '').trim().toUpperCase();
  if (key.length !== 2) return null;
  const value = ALIQUOTA_INTERNA_POR_UF[key];
  return value != null ? value : null;
}