import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseUUIDPipe,
  ParseIntPipe,
  Res,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { FiscalEmissaoService } from '../services/fiscal-emissao.service';
import { FiscalSupabaseService } from '../services/fiscal-supabase.service';
import { FiscalSyncService } from '../services/fiscal-sync.service';
import { FocusNFeClientService } from '../focus-nfe/focus-nfe-client.service';
import { PedidoDataService } from '../services/pedido-data.service';
import { buildFocusNFePayload } from '../focus-nfe/build-payload';

@Controller('fiscal')
export class FiscalController {
  constructor(
    private readonly emissaoService: FiscalEmissaoService,
    private readonly supabase: FiscalSupabaseService,
    private readonly fiscalSync: FiscalSyncService,
    private readonly focusClient: FocusNFeClientService,
    private readonly pedidoData: PedidoDataService,
  ) {}

  /** Sincroniza notas em PROCESSANDO há mais de 2 min consultando a Focus NFe (fallback quando webhook não chega). */
  @Post('sync')
  async sync(): Promise<{ ok: number; erro: number; atualizados: number }> {
    return this.fiscalSync.syncProcessando();
  }

  @Post('emitir/:pedidoId')
  async emitir(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
    @Body() body?: { empresa_id?: number; natureza_operacao_id?: number },
  ): Promise<{ invoiceId: string; status: string; focus_id: string | null; mensagem: string }> {
    if (pedidoId < 1) throw new NotFoundException('pedidoId inválido');
    return this.emissaoService.emitir(pedidoId, body);
  }

  @Post('preview-chamada')
  async previewChamada(
    @Body() body: { pedidoId: number; empresa_id?: number; natureza_operacao_id?: number },
  ): Promise<Record<string, unknown>> {
    const pedidoId = Number(body?.pedidoId);
    if (!pedidoId || pedidoId < 1) {
      throw new BadRequestException('Informe um pedidoId válido.');
    }
    const pedido = await this.pedidoData.getPedido(pedidoId);
    if (!pedido) throw new NotFoundException(`Pedido ${pedidoId} não encontrado`);
    const empresaId = body?.empresa_id ?? (pedido as { empresa_id?: number }).empresa_id ?? null;
    const naturezaId =
      body?.natureza_operacao_id ?? (pedido as { natureza_operacao_id?: number }).natureza_operacao_id ?? null;
    if (empresaId == null) {
      throw new BadRequestException('Selecione uma empresa no painel ou cadastre empresa_id no pedido.');
    }
    if (naturezaId == null) {
      throw new BadRequestException('Selecione uma natureza de operação no painel ou cadastre no pedido.');
    }
    const [itens, empresa, cliente, natureza] = await Promise.all([
      this.pedidoData.getItensVendaEnrichedForFiscal(pedidoId),
      empresaId != null ? this.pedidoData.getEmpresa(empresaId) : Promise.resolve(null),
      (pedido as { contatos_id?: number }).contatos_id != null
        ? this.pedidoData.getCliente((pedido as { contatos_id: number }).contatos_id)
        : Promise.resolve(null),
      naturezaId != null ? this.pedidoData.getNaturezaOperacao(naturezaId) : Promise.resolve(null),
    ]);
    if (!empresa) throw new BadRequestException('Empresa não encontrada.');
    if (!cliente) throw new BadRequestException('Cliente não encontrado.');
    if (!natureza) throw new BadRequestException('Natureza de operação não encontrada.');
    if (!itens.length) throw new BadRequestException('Pedido sem itens.');
    const payload = buildFocusNFePayload(
      pedido,
      itens,
      empresa,
      cliente,
      natureza,
    );
    return payload as unknown as Record<string, unknown>;
  }

  @Get('empresas')
  async listEmpresas(): Promise<{ id: number; razao_social: string; nome_fantasia?: string }[]> {
    try {
      return await this.pedidoData.listEmpresas();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({
        message: 'Erro ao listar empresas. Verifique se a tabela empresa ou empresas existe no Supabase.',
        detail: msg,
      });
    }
  }

  @Get('naturezas')
  async listNaturezas(): Promise<{ id: number; descricao: string }[]> {
    try {
      return await this.pedidoData.listNaturezas();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({
        message: 'Erro ao listar naturezas. Verifique se a tabela naturezaOperacao (ou similar) existe no Supabase.',
        detail: msg,
      });
    }
  }

  @Get('invoices')
  async listInvoices(): Promise<
    { id: string; pedido_id: number; status: string; numero_nf: number | null; created_at: string }[]
  > {
    const rows = await this.supabase.listInvoices(50);
    return rows.map((r) => ({
      id: r.id,
      pedido_id: r.pedido_id,
      status: r.status,
      numero_nf: r.numero_nf,
      created_at: r.created_at,
    }));
  }

  @Get(':invoiceId/situacoes')
  async getSituacoes(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<{ data: string; descricao: string; situacao: string }[]> {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    const situacoes: { data: string; descricao: string; situacao: string }[] = [];
    const push = (data: string, descricao: string, situacao: string) => {
      situacoes.push({ data, descricao: descricao || '-', situacao: situacao || '-' });
    };
    const fmtDate = (d: string | null) =>
      d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }) : '-';
    const eventos = await this.supabase.listEventosByInvoiceId(invoiceId);
    for (const ev of eventos) {
      const p = (ev.payload || {}) as Record<string, unknown>;
      const desc =
        (p.mensagem_sefaz as string) || (p.mensagem as string) || (p.mensagem_rejeicao as string) || ev.tipo_evento || '-';
      const sit = (p.status as string) || (p.status_sefaz as string) || ev.tipo_evento || '-';
      push(fmtDate(ev.created_at), desc, String(sit).toUpperCase());
    }
    push(
      fmtDate(invoice.updated_at ?? invoice.created_at),
      invoice.error_message || invoice.status,
      invoice.status,
    );
    return situacoes;
  }

  @Get(':invoiceId/chamada')
  async getChamada(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<Record<string, unknown> | { message: string }> {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    const payload = await this.supabase.findPayloadEnviado(invoiceId);
    if (!payload) {
      return { message: 'Chamada ainda não foi enviada à API (aguarde processamento ou confira as situações).' };
    }
    return payload;
  }

  @Get(':invoiceId/xml')
  async getXml(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Res() res: Response,
  ): Promise<void> {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    if (!invoice.focus_id) {
      res.status(HttpStatus.BAD_REQUEST).json({
        message: 'NFe ainda não possui focus_id (aguarde processamento).',
      });
      return;
    }
    const { body, contentType } = await this.focusClient.download(
      invoice.focus_id,
      'xml',
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfe-${invoice.chave_acesso ?? invoice.focus_id}.xml"`,
    );
    const nodeStream = Readable.fromWeb(body as any);
    nodeStream.pipe(res);
  }

  @Get(':invoiceId/pdf')
  async getPdf(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Res() res: Response,
  ): Promise<void> {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    if (!invoice.focus_id) {
      res.status(HttpStatus.BAD_REQUEST).json({
        message: 'NFe ainda não possui focus_id (aguarde processamento).',
      });
      return;
    }
    const { body, contentType } = await this.focusClient.download(
      invoice.focus_id,
      'pdf',
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfe-${invoice.chave_acesso ?? invoice.focus_id}.pdf"`,
    );
    const nodeStream = Readable.fromWeb(body as any);
    nodeStream.pipe(res);
  }
}
