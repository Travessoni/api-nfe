import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FocusNFeAmbiente = 'homologacao' | 'producao';

const BASE_URL = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
};

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
  [key: string]: unknown;
}

@Injectable()
export class FocusNFeClientService {
  constructor(private config: ConfigService) {}

  private getToken(): string {
    const token = this.config.get<string>('FOCUS_NFE_TOKEN');
    if (!token) throw new Error('FOCUS_NFE_TOKEN não configurado');
    return token;
  }

  private getAmbiente(): FocusNFeAmbiente {
    const env = this.config.get<string>('FOCUS_NFE_AMBIENTE');
    if (env === 'producao') return 'producao';
    return 'homologacao';
  }

  private getBaseUrl(): string {
    return BASE_URL[this.getAmbiente()];
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const token = this.getToken();
    const url = `${this.getBaseUrl()}${path}`;
    const auth = Buffer.from(`${token}:`).toString('base64');
    const headers: Record<string, string> = {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data: T;
    try {
      data = text ? (JSON.parse(text) as T) : ({} as T);
    } catch {
      throw new Error(`Focus NFe resposta inválida: ${res.status} ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg = (data as { mensagem?: string }).mensagem ?? text;
      throw new Error(`Focus NFe ${res.status}: ${msg}`);
    }
    return data;
  }

  /**
   * Envia NFe para processamento.
   * POST /v2/nfe?ref=REFERENCIA
   */
  async emitir(referencia: string, payload: unknown): Promise<FocusNFeEmitirResult> {
    const refEnc = encodeURIComponent(referencia);
    return this.request<FocusNFeEmitirResult>(
      'POST',
      `/v2/nfe?ref=${refEnc}`,
      payload,
    );
  }

  /**
   * Consulta status da NFe.
   * GET /v2/nfe/REFERENCIA
   */
  async consultar(referencia: string): Promise<FocusNFeConsultaResult> {
    const refEnc = encodeURIComponent(referencia);
    return this.request<FocusNFeConsultaResult>('GET', `/v2/nfe/${refEnc}`);
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
   * Faz GET no endpoint de download e retorna o stream (body) e content-type.
   * Não salva em storage; o controller fará pipe para o response.
   */
  async download(
    referencia: string,
    tipo: 'xml' | 'pdf',
  ): Promise<{ body: ReadableStream<Uint8Array>; contentType: string }> {
    const path = this.getDownloadPath(referencia, tipo);
    const token = this.getToken();
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
