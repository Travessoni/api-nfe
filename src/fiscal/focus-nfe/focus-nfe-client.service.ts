import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const HTTP_TIMEOUT_MS = 30_000; // 30 seconds

/** Erro de validação da API (422) — NÃO deve fazer retry. */
export class FocusNFeValidationError extends Error {
  readonly retryable = false;
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'FocusNFeValidationError';
    this.statusCode = statusCode;
  }
}

/** Erro temporário da API (429, 5xx) — DEVE fazer retry. */
export class FocusNFeTemporaryError extends Error {
  readonly retryable = true;
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'FocusNFeTemporaryError';
    this.statusCode = statusCode;
  }
}

export type FocusNFeAmbiente = 'homologacao' | 'producao';

const BASE_URL = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
};




function normalizarCnpj(cnpj: string): string {
  return (cnpj || '').replace(/\D/g, '');
}

/** Tokens da empresa vindos do banco (tokenHomologacao / tokenProducao). */
export interface FocusNFeTokensFromDb {
  homologacao?: string;
  producao?: string;
}

export interface FocusNFeEmitirResult {
  ref: string;
  status?: string;
  mensagem?: string;
  [key: string]: unknown;
}

export interface FocusNFeConsultaResult {
  ref: string;
  status: string;
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: number;
  caminho_xml_nota_fiscal?: string;
  caminho_pdf_nota_fiscal?: string;
  caminho_danfe?: string;
  [key: string]: unknown;
}

/** Resposta da API Focus NFe GET /v2/cnpjs/{cnpj} */
export interface FocusNFeCnpjInfo {
  inscricao_estadual?: string;
  inscricoes_estaduais?: Array<{ inscricao_estadual?: string; uf?: string }>;
  razao_social?: string;
  nome_fantasia?: string;
  [key: string]: unknown;
}

@Injectable()
export class FocusNFeClientService {
  constructor(private config: ConfigService) { }

  /**
   * Retorna o token Focus NFe para a emissão/consulta.
   * Prioridade:
   *  1) tokensFromDb (tokenHomologacao / tokenProducao da tabela empresas)
   *  2) FOCUS_NFE_TOKEN do .env (fallback global — NÃO recomendado em multi-empresa)
   *
   * Cada empresa DEVE ter seu próprio token cadastrado no banco.
   */
  getToken(cnpjEmitente?: string, tokensFromDb?: FocusNFeTokensFromDb | null): string {
    const ambiente = this.getAmbiente();

    // 1) Token da empresa no banco — fonte primária
    if (tokensFromDb) {
      const tokenDb = ambiente === 'producao' ? tokensFromDb.producao : tokensFromDb.homologacao;
      if (tokenDb != null && String(tokenDb).trim() !== '') {
        return String(tokenDb).trim();
      }
    }

    // 2) Fallback: FOCUS_NFE_TOKEN do .env (global)
    const globalToken = this.config.get<string>('FOCUS_NFE_TOKEN');
    if (globalToken && globalToken.trim() !== '') {
      return globalToken.trim();
    }

    // Nenhum token encontrado — erro descritivo
    const cnpjDisplay = cnpjEmitente ? normalizarCnpj(cnpjEmitente) : '(não informado)';
    const campoToken = ambiente === 'producao' ? 'tokenProducao' : 'tokenHomologacao';
    throw new Error(
      `Token Focus NFe não encontrado para a empresa CNPJ ${cnpjDisplay}. ` +
      `Cadastre o campo "${campoToken}" na tabela empresas ou configure FOCUS_NFE_TOKEN no .env.`,
    );
  }

  private getAmbiente(): FocusNFeAmbiente {
    /* MODO TESTE: homologação. Para produção: FOCUS_NFE_AMBIENTE=producao no .env */
    const env = this.config.get<string>('FOCUS_NFE_AMBIENTE');
    return env === 'producao' ? 'producao' : 'homologacao';
  }

  private getBaseUrl(): string {
    return BASE_URL[this.getAmbiente()];
  }

  /**
   * Monta URL completa para caminho relativo (ex: /arquivos_development/.../DANFE.pdf).
   * Se o path já for URL absoluta, retorna como está.
   */
  buildFocusNFeUrl(path: string): string {
    if (!path || typeof path !== 'string') return '';
    const trimmed = path.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const base = this.getBaseUrl();
    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${base}${normalized}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    cnpjEmitente?: string,
    tokensFromDb?: FocusNFeTokensFromDb | null,
  ): Promise<T> {
    const token = this.getToken(cnpjEmitente, tokensFromDb);
    const url = `${this.getBaseUrl()}${path}`;
    const auth = Buffer.from(`${token}:`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw new FocusNFeTemporaryError(0, `Focus NFe timeout após ${HTTP_TIMEOUT_MS}ms: ${method} ${path}`);
      }
      throw new FocusNFeTemporaryError(0, `Focus NFe erro de rede: ${(e as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
    const text = await res.text();
    let data: T;
    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new FocusNFeTemporaryError(res.status, `Focus NFe resposta inválida: ${res.status} ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg = (data as { mensagem?: string }).mensagem ?? text;
      // 422 = validação (schema XML, campos) — não retentar
      // 401/403 = autenticação — não retentar
      // 429, 500, 502, 503 = temporário — retentar
      if (res.status === 422 || res.status === 401 || res.status === 403) {
        throw new FocusNFeValidationError(res.status, `Focus NFe ${res.status}: ${msg}`);
      }
      throw new FocusNFeTemporaryError(res.status, `Focus NFe ${res.status}: ${msg}`);
    }
    return data;
  }

  /**
   * Garante payload no formato da API Focus NFe (items).
   */
  private toApiPayload(payload: unknown): Record<string, unknown> {
    const obj = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
    const items = obj.items ?? obj.itens;
    const { itens: _removed, ...rest } = obj;
    return { ...rest, items: Array.isArray(items) ? items : [] };
  }

  /**
   * Envia NFe para processamento.
   * POST /v2/nfe?ref=REFERENCIA
   * @param tokensFromDb Tokens da empresa no banco (tokenHomologacao/tokenProducao). Quando presentes, têm prioridade.
   */
  async emitir(
    referencia: string,
    payload: unknown,
    cnpjEmitente?: string,
    tokensFromDb?: FocusNFeTokensFromDb | null,
  ): Promise<FocusNFeEmitirResult> {
    const refEnc = encodeURIComponent(referencia);
    const apiPayload = this.toApiPayload(payload);
    const cnpj = cnpjEmitente ?? (payload && typeof payload === 'object' && (payload as Record<string, unknown>).cnpj_emitente
      ? String((payload as Record<string, unknown>).cnpj_emitente)
      : undefined);
    return this.request<FocusNFeEmitirResult>(
      'POST',
      `/v2/nfe?ref=${refEnc}`,
      apiPayload,
      cnpj ? normalizarCnpj(cnpj) : undefined,
      tokensFromDb,
    );
  }

  /**
   * Cancela NFe autorizada.
   * DELETE /v2/nfe/REFERENCIA
   * @param tokensFromDb Tokens da empresa no banco. Quando presentes, têm prioridade.
   */
  async cancelar(
    referencia: string,
    justificativa: string,
    cnpjEmitente?: string,
    tokensFromDb?: FocusNFeTokensFromDb | null,
  ): Promise<FocusNFeConsultaResult> {
    const refEnc = encodeURIComponent(referencia);
    return this.request<FocusNFeConsultaResult>(
      'DELETE',
      `/v2/nfe/${refEnc}`,
      { justificativa: justificativa.trim() },
      cnpjEmitente ? normalizarCnpj(cnpjEmitente) : undefined,
      tokensFromDb,
    );
  }

  /**
   * Consulta status da NFe.
   * GET /v2/nfe/REFERENCIA
   * @param tokensFromDb Tokens da empresa no banco. Quando presentes, têm prioridade.
   */
  async consultar(
    referencia: string,
    cnpjEmitente?: string,
    tokensFromDb?: FocusNFeTokensFromDb | null,
  ): Promise<FocusNFeConsultaResult> {
    const refEnc = encodeURIComponent(referencia);
    return this.request<FocusNFeConsultaResult>(
      'GET',
      `/v2/nfe/${refEnc}`,
      undefined,
      cnpjEmitente ? normalizarCnpj(cnpjEmitente) : undefined,
      tokensFromDb,
    );
  }

  /**
   * Retorna a URL base para download (XML/PDF).
   * O download real é feito por GET na API; não persistimos o arquivo.
   */
  getDownloadPath(referencia: string, tipo: 'xml' | 'pdf'): string {
    const refEnc = encodeURIComponent(referencia);
    const suf = tipo === 'xml' ? 'xml' : 'pdf';
    return `/v2/nfe/${refEnc}.${suf}`;
  }

  /**
   * Consulta dados do CNPJ na Focus NFe (inscrição estadual, etc.).
   * GET /v2/cnpjs/{cnpj} — cnpj deve conter apenas dígitos.
   * @param tokensFromDb Tokens da empresa no banco (quando consultando uma empresa cadastrada). Quando presentes, têm prioridade.
   */
  async getCnpjInfo(
    cnpj: string,
    tokensFromDb?: FocusNFeTokensFromDb | null,
  ): Promise<FocusNFeCnpjInfo> {
    const digits = normalizarCnpj(cnpj);
    if (digits.length !== 14) {
      throw new Error('CNPJ deve conter 14 dígitos');
    }
    const path = `/v2/cnpjs/${encodeURIComponent(digits)}`;
    return this.request<FocusNFeCnpjInfo>('GET', path, undefined, digits, tokensFromDb);
  }

  /**
   * Faz GET no endpoint de download e retorna o stream (body) e content-type.
   * @param tokensFromDb Tokens da empresa no banco. Quando presentes, têm prioridade.
   */
  async download(
    referencia: string,
    tipo: 'xml' | 'pdf',
    cnpjEmitente?: string,
    tokensFromDb?: FocusNFeTokensFromDb | null,
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string }> {
    const path = this.getDownloadPath(referencia, tipo);
    const token = this.getToken(
      cnpjEmitente ? normalizarCnpj(cnpjEmitente) : undefined,
      tokensFromDb,
    );
    const url = `${this.getBaseUrl()}${path}`;
    const auth = Buffer.from(`${token}:`).toString('base64');
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Focus NFe download ${tipo} ${res.status}: ${text.slice(0, 200)}`);
    }
    const body = res.body;
    if (!body) throw new Error('Focus NFe: resposta sem body');
    const contentType =
      tipo === 'xml'
        ? 'application/xml'
        : 'application/pdf';
    return { body, contentType: res.headers.get('content-type') || contentType };
  }
}
