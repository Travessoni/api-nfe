import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  Res,
  HttpStatus,
  NotFoundException,
  InternalServerErrorException,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { Readable } from 'stream';
import { FiscalEmissaoService } from '../services/fiscal-emissao.service';
import { FiscalSupabaseService } from '../services/fiscal-supabase.service';
import { FiscalSyncService } from '../services/fiscal-sync.service';
import { FocusNFeClientService, FocusNFeCnpjInfo } from '../focus-nfe/focus-nfe-client.service';
import { PedidoDataService, TributacaoByProdutoRow, ContribuinteIcmsUpdate } from '../services/pedido-data.service';
import { buildFocusNFePayload, validarPayloadSefaz } from '../focus-nfe/build-payload';
import { RegraTributariaNaoEncontradaError } from '../types/fiscal.types';

@Controller('fiscal')
export class FiscalController {
  constructor(
    private readonly emissaoService: FiscalEmissaoService,
    private readonly supabase: FiscalSupabaseService,
    private readonly fiscalSync: FiscalSyncService,
    private readonly focusClient: FocusNFeClientService,
    private readonly pedidoData: PedidoDataService,
  ) { }

  /** Sincroniza notas em PROCESSANDO há mais de 2 min consultando a Focus NFe (fallback quando webhook não chega). */
  @Post('sync')
  async sync(): Promise<{ ok: number; erro: number; atualizados: number }> {
    return this.fiscalSync.syncProcessando();
  }

  @Post('rascunho')
  async salvarRascunho(
    @Body()
    body: {
      pedido_id: number;
      empresa_id: number;
      natureza_operacao_id: number;
      payload?: Record<string, unknown>;
    },
  ): Promise<{ id: string; mensagem: string }> {
    const pedidoId = Number(body?.pedido_id);
    const empresaId = Number(body?.empresa_id);
    const naturezaId = Number(body?.natureza_operacao_id);
    if (!pedidoId || pedidoId < 1) throw new BadRequestException('Informe um pedido_id válido.');
    if (!empresaId || empresaId < 1) throw new BadRequestException('Informe uma empresa.');
    if (!naturezaId || naturezaId < 1) throw new BadRequestException('Informe uma natureza de operação.');
    try {
      const row = await this.supabase.saveDraft({
        pedido_id: pedidoId,
        empresa_id: empresaId,
        natureza_operacao_id: naturezaId,
        payload_json: body?.payload ?? null,
      });
      return { id: row.id, mensagem: 'Rascunho salvo. Clique em "Emitir NF" quando quiser enviar à SEFAZ.' };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg);
    }
  }

  @Get('rascunho/:pedidoId')
  async getRascunho(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
  ): Promise<{ payload: Record<string, unknown> } | { payload: null }> {
    const row = await this.supabase.findRascunhoByPedidoId(pedidoId);
    if (!row || !row.payload_json) {
      return { payload: null };
    }
    return { payload: row.payload_json as Record<string, unknown> };
  }

  @Post('emitir-payload')
  async emitirPayload(
    @Body()
    body: {
      pedido_id: number;
      empresa_id: number;
      natureza_operacao_id: number;
      payload: Record<string, unknown>;
    },
  ): Promise<{ invoiceId: string; status: string; focus_id: string | null; mensagem: string }> {
    const pedidoId = Number(body?.pedido_id);
    const empresaId = Number(body?.empresa_id);
    const naturezaId = Number(body?.natureza_operacao_id);
    const payload = body?.payload;
    if (!pedidoId || pedidoId < 1) throw new BadRequestException('Informe pedido_id válido.');
    if (!empresaId || empresaId < 1) throw new BadRequestException('Informe empresa.');
    if (!naturezaId || naturezaId < 1) throw new BadRequestException('Informe natureza de operação.');
    if (
      !payload ||
      typeof payload !== 'object' ||
      (!Array.isArray(payload.items) && !Array.isArray(payload.itens))
    ) {
      throw new BadRequestException('Payload inválido: informe o objeto da nota (com items).');
    }
    const indIE = payload.indicador_inscricao_estadual_destinatario;
    const ieDest = (payload.inscricao_estadual_destinatario ?? '') as string;
    if (indIE === 1 && (!ieDest || String(ieDest).trim() === '' || String(ieDest).toUpperCase() === 'ISENTO')) {
      throw new BadRequestException(
        'Inconsistência fiscal: destinatário é contribuinte ICMS (indIEDest=1) mas a Inscrição Estadual está vazia. Corrija o cadastro do cliente ou informe a IE.',
      );
    }

    const errosSefaz = validarPayloadSefaz(payload);
    if (errosSefaz.length > 0) {
      throw new BadRequestException(
        'Por favor, corrija os seguintes problemas antes de emitir a nota:\n\n- ' + errosSefaz.join('\n- ')
      );
    }

    return this.emissaoService.emitirComPayload(pedidoId, empresaId, naturezaId, payload);
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
    try {
      const pedidoId = Number(body?.pedidoId);
      if (!pedidoId || pedidoId < 1) {
        throw new BadRequestException('Informe um pedidoId válido.');
      }
      const pedido = await this.pedidoData.getPedido(pedidoId);
      if (!pedido) throw new NotFoundException(`Pedido ${pedidoId} não encontrado`);
      const empresaId = body?.empresa_id ?? null;
      const naturezaId =
        body?.natureza_operacao_id ?? (pedido as { natureza_operacao_id?: number }).natureza_operacao_id ?? null;
      if (empresaId == null) {
        throw new BadRequestException('Selecione a empresa no formulário (remetente da nota).');
      }
      if (naturezaId == null) {
        throw new BadRequestException('Selecione uma natureza de operação no painel ou cadastre no pedido.');
      }
      const ped = pedido as Record<string, unknown>;
      const contatoId = this.resolveContatoId(ped);
      const [
        itens,
        empresa,
        cliente,
        natureza,
      ] = await Promise.all([
        this.pedidoData.getItensVendaEnrichedForFiscal(pedidoId),
        empresaId != null ? this.pedidoData.getEmpresa(empresaId) : Promise.resolve(null),
        contatoId != null ? this.pedidoData.getCliente(contatoId) : Promise.resolve(null),
        naturezaId != null ? this.pedidoData.getNaturezaOperacao(naturezaId) : Promise.resolve(null),
      ]);
      if (!empresa) throw new BadRequestException('Empresa não encontrada.');
      if (!cliente) throw new BadRequestException('Cliente não encontrado.');
      if (!natureza) throw new BadRequestException('Natureza de operação não encontrada.');
      if (!itens.length) throw new BadRequestException('Pedido sem itens.');

      const ufEmitente = String(empresa.uf ?? (empresa as Record<string, unknown>).estado ?? '').trim().toUpperCase();
      const cli = cliente as Record<string, unknown>;
      const paisDestino = String(cli.pais ?? 'Brasil').trim();
      const ufDestinatarioRaw = String(cli.uf ?? cli.estado ?? cli.UF ?? '').trim().toUpperCase();
      if (paisDestino === 'Brasil' && (!ufDestinatarioRaw || ufDestinatarioRaw.length !== 2)) {
        throw new BadRequestException(
          'UF do destinatário não informada. Cadastre o endereço completo do cliente.',
        );
      }
      const ufDestinatario = ufDestinatarioRaw || ufEmitente || '';

      const natId = Number(naturezaId);
      const regras = natId >= 1 ? await this.resolveTodasRegras(natId, ufDestinatario) : {
        icms: null, pis: null, cofins: null, ipi: null, retencoes: null, is: null, ibs: null, cbs: null,
      };

      if (!regras.icms && natId >= 1) {
        const list = await this.pedidoData.getRegrasICMSByNatureza(natId);
        throw new BadRequestException(
          `Nenhuma regra tributária encontrada para ICMS na UF ${ufDestinatario} e natureza ${natId}. ` +
          `Cadastre uma regra específica para a UF ou com destinos = 'qualquer'. (debug: getRegrasICMSByNatureza retornou ${list.length} regra(s) para natureza ${natId})`,
        );
      }

      const payload = buildFocusNFePayload(
        pedido,
        itens,
        empresa,
        cliente,
        natureza,
        regras,
      );

      return payload as unknown as Record<string, unknown>;
    } catch (e) {
      if (
        e instanceof BadRequestException ||
        e instanceof NotFoundException
      ) {
        throw e;
      }
      if (e instanceof RegraTributariaNaoEncontradaError) {
        throw new BadRequestException(e.message);
      }
      // Erros de validação do build-payload (regime, CFOP, IE, CEP, DIFAL) são dados incorretos → 400
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(msg);
    }
  }

  /** Debug: regras ICMS, PIS e COFINS para naturezaId e UF. GET /fiscal/debug-regras?naturezaId=1&uf=SP ou ?pedidoId=123 para usar UF do cliente. Com pedidoId + empresaId monta o payload completo. empresaId = id da empresa emissora (remetente), informado na URL — não existe em pedidos_venda. */
  @Get('debug-regras')
  async debugRegras(
    @Query('naturezaId') naturezaIdStr?: string,
    @Query('uf') uf?: string,
    @Query('pedidoId') pedidoIdStr?: string,
    @Query('empresaId') empresaIdStr?: string,
  ): Promise<Record<string, unknown>> {
    let naturezaId = Number(naturezaIdStr ?? 1);
    let ufDest = String(uf ?? '').trim().toUpperCase();
    const debug: Record<string, unknown> = { pedidoIdAsked: pedidoIdStr ?? null, contatoId: null, clienteUf: null };
    if (pedidoIdStr) {
      const pedidoId = Number(pedidoIdStr);
      if (pedidoId >= 1) {
        const pedido = await this.pedidoData.getPedido(pedidoId);
        debug.pedidoEncontrado = !!pedido;
        if (pedido) {
          const ped = pedido as Record<string, unknown>;
          naturezaId = Number(ped.natureza_operacao_id ?? ped.naturezaRef ?? naturezaId);
          const contatoId = this.resolveContatoId(ped);
          debug.contatoId = contatoId ?? null;
          if (contatoId != null) {
            const cliente = await this.pedidoData.getCliente(contatoId);
            debug.clienteEncontrado = !!cliente;
            if (cliente) {
              const cli = cliente as Record<string, unknown>;
              const ufRaw = String(cli.uf ?? cli.estado ?? cli.UF ?? '').trim().toUpperCase();
              const pais = String(cli.pais ?? 'Brasil').trim();
              debug.clienteUf = ufRaw || null;
              debug.clientePais = pais;
              ufDest = pais === 'Brasil' && ufRaw ? ufRaw : ufRaw || '';
            }
          }
        }
      }
    }
    if (!ufDest && uf) ufDest = String(uf).trim().toUpperCase();
    if (!ufDest) ufDest = 'SP';
    debug.ufUsada = ufDest;

    let regraICMS: Awaited<ReturnType<PedidoDataService['getRegraICMSParaDestino']>> = null;
    let regraPIS: Awaited<ReturnType<PedidoDataService['getRegraPISParaDestino']>> = null;
    let regraCOFINS: Awaited<ReturnType<PedidoDataService['getRegraCOFINSParaDestino']>> = null;
    if (naturezaId >= 1) {
      const todasRegras = await this.resolveTodasRegras(naturezaId, ufDest);
      regraICMS = todasRegras.icms;
      regraPIS = todasRegras.pis;
      regraCOFINS = todasRegras.cofins;
    }
    const missing = [
      !regraICMS && 'ICMS',
      !regraPIS && 'PIS',
      !regraCOFINS && 'COFINS',
    ].filter(Boolean) as string[];

    const baseResponse: Record<string, unknown> = {
      ...debug,
      naturezaId,
      uf: ufDest,
      icms: regraICMS != null ? { id: (regraICMS as Record<string, unknown>).id, cfop: (regraICMS as Record<string, unknown>).cfop, destinos: (regraICMS as Record<string, unknown>).destinos } : null,
      pis: regraPIS != null ? { id: (regraPIS as Record<string, unknown>).id } : null,
      cofins: regraCOFINS != null ? { id: (regraCOFINS as Record<string, unknown>).id } : null,
      missing,
    };

    if (!pedidoIdStr || missing.length > 0) {
      return baseResponse;
    }

    const pedidoId = Number(pedidoIdStr);
    const pedido = await this.pedidoData.getPedido(pedidoId);
    if (!pedido) return baseResponse;

    const ped = pedido as Record<string, unknown>;
    const contatoId = this.resolveContatoId(ped);
    const naturezaOperacaoId = ped.natureza_operacao_id ?? ped.naturezaRef ?? naturezaId;
    const empresaIdNum =
      empresaIdStr != null && empresaIdStr !== ''
        ? Number(empresaIdStr)
        : null;
    if (contatoId == null) {
      baseResponse.payload = null;
      baseResponse.payloadError = 'Pedido sem contato (contatos_id ou contato_id ou cliente_id).';
      return baseResponse;
    }
    if (empresaIdNum == null) {
      baseResponse.payload = null;
      baseResponse.payloadError =
        'Para montar o payload informe a empresa emissora (remetente) na URL: ?pedidoId=1729&empresaId=1';
      return baseResponse;
    }
    baseResponse.empresaIdUsed = empresaIdNum;

    const [itens, empresa, cliente, natureza] = await Promise.all([
      this.pedidoData.getItensVendaEnrichedForFiscal(pedidoId),
      this.pedidoData.getEmpresa(empresaIdNum),
      this.pedidoData.getCliente(contatoId),
      this.pedidoData.getNaturezaOperacao(Number(naturezaOperacaoId)),
    ]);
    if (!itens?.length || !empresa || !cliente || !natureza) {
      baseResponse.payload = null;
      baseResponse.payloadError = !itens?.length ? 'Pedido sem itens.' : !empresa ? 'Empresa não encontrada.' : !cliente ? 'Cliente não encontrado.' : 'Natureza não encontrada.';
      return baseResponse;
    }

    const todasRegrasPayload = await this.resolveTodasRegras(naturezaId, ufDest);
    const regras = {
      icms: todasRegrasPayload.icms,
      pis: todasRegrasPayload.pis,
      cofins: todasRegrasPayload.cofins,
      ipi: todasRegrasPayload.ipi,
      retencoes: todasRegrasPayload.retencoes,
      is: todasRegrasPayload.is,
      ibs: todasRegrasPayload.ibs,
      cbs: todasRegrasPayload.cbs,
    };
    try {
      const payload = buildFocusNFePayload(pedido, itens, empresa, cliente, natureza, regras);
      baseResponse.payload = payload as unknown as Record<string, unknown>;
    } catch (e) {
      baseResponse.payload = null;
      baseResponse.payloadError = e instanceof Error ? e.message : String(e);
    }
    return baseResponse;
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
  async listNaturezas(
    @Query('empresa_id') empresaId?: string,
  ): Promise<{ id: number; descricao: string; empresa?: number | null }[]> {
    try {
      const id = empresaId != null && empresaId !== '' ? Number(empresaId) : undefined;
      return await this.pedidoData.listNaturezas(Number.isNaN(id) ? undefined : id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({
        message: 'Erro ao listar naturezas. Verifique se a tabela naturezaOperacao (ou similar) existe no Supabase.',
        detail: msg,
      });
    }
  }

  @Post('naturezas')
  async createNatureza(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const { regras, ...naturezaPayload } = body;
      const created = await this.pedidoData.createNaturezaOperacao(naturezaPayload);
      const regrasPayload = (regras != null && typeof regras === 'object') ? regras as Record<string, unknown> : {};
      await this.pedidoData.saveRegrasForNatureza(created.id, {
        icms: regrasPayload.icms as Array<Record<string, unknown>> | undefined,
        pis: regrasPayload.pis as Array<Record<string, unknown>> | undefined,
        cofins: regrasPayload.cofins as Array<Record<string, unknown>> | undefined,
        ipi: regrasPayload.ipi as Array<Record<string, unknown>> | undefined,
        retencoes: regrasPayload.retencoes as Array<Record<string, unknown>> | undefined,
        is: regrasPayload.is as Array<Record<string, unknown>> | undefined,
        ibs: regrasPayload.ibs as Array<Record<string, unknown>> | undefined,
        cbs: regrasPayload.cbs as Array<Record<string, unknown>> | undefined,
      });
      return created as unknown as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({ message: 'Erro ao criar natureza de operação.', detail: msg });
    }
  }

  @Get('naturezas/:id')
  async getNatureza(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Record<string, unknown>> {
    const row = await this.pedidoData.getNaturezaOperacao(id);
    if (!row) {
      throw new NotFoundException('Natureza de operação não encontrada.');
    }
    const [
      regrasICMS,
      regrasPIS,
      regrasCOFINS,
      regrasIPI,
      regrasRetencoes,
      regrasIS,
      regrasIBS,
      regrasCBS,
    ] = await Promise.all([
      this.pedidoData.getRegrasICMSByNatureza(id),
      this.pedidoData.getRegrasPISByNatureza(id),
      this.pedidoData.getRegrasCOFINSByNatureza(id),
      this.pedidoData.getRegrasIPIByNatureza(id),
      this.pedidoData.getRegrasRetencoesByNatureza(id),
      this.pedidoData.getRegrasISByNatureza(id),
      this.pedidoData.getRegrasIBSByNatureza(id),
      this.pedidoData.getRegrasCBSByNatureza(id),
    ]);
    const regras = {
      icms: regrasICMS ?? [],
      pis: regrasPIS ?? [],
      cofins: regrasCOFINS ?? [],
      ipi: regrasIPI != null ? [regrasIPI] : [],
      retencoes: regrasRetencoes,
      is: regrasIS,
      ibs: regrasIBS,
      cbs: regrasCBS,
    };
    const r = row as Record<string, unknown>;
    const codRegime =
      r.cod_regimeTributario ?? r.cod_regime_tributario ?? r.codRegimeTributario ?? null;
    const indicador =
      r.indicadorPresenca ?? r.indicador_presenca ?? null;
    const empresa =
      r.empresa != null ? Number(r.empresa) : (r.empresa_id != null ? Number(r.empresa_id) : null);
    return {
      ...r,
      cod_regimeTributario:
        codRegime != null && codRegime !== '' ? String(codRegime) : null,
      indicadorPresenca:
        indicador != null && indicador !== '' ? String(indicador) : null,
      empresa,
      regras,
    };
  }

  @Put('naturezas/:id')
  async updateNatureza(
    @Param('id', ParseIntPipe) id: number,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const existing = await this.pedidoData.getNaturezaOperacao(id);
    if (!existing) {
      throw new NotFoundException('Natureza de operação não encontrada.');
    }
    try {
      const { regras, ...naturezaPayload } = body;
      const updated = await this.pedidoData.updateNaturezaOperacao(id, naturezaPayload);
      const regrasPayload = (regras != null && typeof regras === 'object') ? regras as Record<string, unknown> : {};
      await this.pedidoData.saveRegrasForNatureza(id, {
        icms: regrasPayload.icms as Array<Record<string, unknown>> | undefined,
        pis: regrasPayload.pis as Array<Record<string, unknown>> | undefined,
        cofins: regrasPayload.cofins as Array<Record<string, unknown>> | undefined,
        ipi: regrasPayload.ipi as Array<Record<string, unknown>> | undefined,
        retencoes: regrasPayload.retencoes as Array<Record<string, unknown>> | undefined,
        is: regrasPayload.is as Array<Record<string, unknown>> | undefined,
        ibs: regrasPayload.ibs as Array<Record<string, unknown>> | undefined,
        cbs: regrasPayload.cbs as Array<Record<string, unknown>> | undefined,
      });
      return updated as unknown as Record<string, unknown>;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({ message: 'Erro ao atualizar natureza de operação.', detail: msg });
    }
  }

  @Get('produtos')
  async searchProdutos(
    @Query('q') q?: string,
  ): Promise<{ id: number; nome: string | null; sku: string | null; preco: number | null }[]> {
    try {
      return await this.pedidoData.searchProdutosPorNome(q ?? '', 20);
    } catch {
      return [];
    }
  }

  @Get('produtos/:produtoId/tributacao')
  async getProdutoTributacao(
    @Param('produtoId', ParseIntPipe) produtoId: number,
  ): Promise<TributacaoByProdutoRow | { message: string }> {
    try {
      const trib = await this.pedidoData.getTributacaoByProdutoId(produtoId);
      if (!trib) {
        return { message: 'Tributação não encontrada para este produto.' };
      }
      return trib;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({
        message: 'Erro ao buscar tributação do produto.',
        detail: msg,
      });
    }
  }

  @Get('invoices')
  async listInvoices(
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('status') status?: string,
    @Query('empresa') empresaStr?: string,
    @Query('search') search?: string,
  ): Promise<{
    data: {
      id: string;
      pedido_id: number;
      empresa_id: number;
      status: string;
      numero_nf: number | null;
      created_at: string;
      data_emissao: string | null;
      nome_cliente: string | null;
      valor_total: number | null;
      pdf_url: string | null;
      xml_url: string | null;
    }[];
    totalItems: number;
    totalPages: number;
    page: number;
  }> {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const empresa_id = empresaStr ? parseInt(empresaStr, 10) : undefined;

    const { data: rows, count } = await this.supabase.listInvoices({
      page,
      limit,
      status: status || undefined,
      empresa_id: !Number.isNaN(empresa_id) ? empresa_id : undefined,
      search: search || undefined,
    });

    const result = await Promise.all(
      rows.map(async (r) => {
        const p = (r.payload_json || {}) as Record<string, unknown>;
        let pedidoInfo = { nomeContato: null as string | null, totalPedido: null as number | null };
        try {
          // getPedidoInfoParaListagem might fail if pedido doesn't exist
          const info = await this.pedidoData.getPedidoInfoParaListagem(r.pedido_id);
          pedidoInfo = { nomeContato: info.nomeContato, totalPedido: info.totalPedido };
        } catch (e) {
          // ignore error to keep listing functional
        }

        const nomeCliente =
          pedidoInfo.nomeContato ?? (p.nome_destinatario as string) ?? null;
        const valorNotaFromRow =
          r.valor_nota != null && !Number.isNaN(Number(r.valor_nota))
            ? Number(r.valor_nota)
            : null;
        const valorTotalFromPayload =
          typeof p.valor_total === 'number'
            ? p.valor_total
            : p.valor_total != null && !Number.isNaN(Number(p.valor_total))
              ? Number(p.valor_total)
              : null;
        return {
          id: r.id,
          pedido_id: r.pedido_id,
          empresa_id: r.empresa_id,
          status: r.status,
          numero_nf: r.numero_nf,
          created_at: r.created_at,
          data_emissao: (p.data_emissao as string) ?? null,
          nome_cliente: nomeCliente,
          valor_total:
            valorNotaFromRow ??
            valorTotalFromPayload ??
            pedidoInfo.totalPedido,
          pdf_url: r.pdf_url ?? null,
          xml_url: r.xml_url ?? null,
        };
      }),
    );

    return {
      data: result,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      page,
    };
  }

  @Get('contatos')
  async searchContatos(
    @Query('busca') busca: string,
  ): Promise<{ id: number; nome: string; nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string }[]> {
    try {
      return await this.pedidoData.searchContatos(busca ?? '');
    } catch {
      return [];
    }
  }

  /**
   * Busca transportadoras (contatos com tipo_cadastro = 'transportadora') para uso no formulário de NF.
   */
  @Get('transportadoras')
  async searchTransportadoras(
    @Query('busca') busca: string,
  ): Promise<{ id: number; nome: string; nome_fantasia?: string; razao_social?: string; cpf_cnpj?: string }[]> {
    try {
      return await this.pedidoData.searchTransportadoras(busca ?? '');
    } catch {
      return [];
    }
  }

  /**
   * Verifica contribuinte ICMS via API Focus NFe (GET /v2/cnpjs/{cnpj}).
   * Regras: tipo_pessoa fisica -> contribuinte_icms=false, indIEDest=9.
   * tipo_pessoa juridica: IE válida -> contribuinte_icms=true, indIEDest=1; senão false e 9.
   * Nunca retorna indIEDest=2 (isento). Se contatoId for informado, atualiza o contato no Supabase.
   */
  @Post('contatos/verificar-contribuinte')
  async verificarContribuinteIcms(
    @Body()
    body: {
      cnpj: string;
      tipo_pessoa?: string;
      contatoId?: number;
    },
  ): Promise<{ ie: string; contribuinte_icms: boolean; indIEDest: 1 | 9 }> {
    const cnpj = (body?.cnpj ?? '').toString().replace(/\D/g, '');
    if (cnpj.length !== 14) {
      throw new BadRequestException('CNPJ deve conter 14 dígitos');
    }
    const tipoPessoa = (body?.tipo_pessoa ?? 'juridica').toString().toLowerCase();
    const contatoId = body?.contatoId != null ? Number(body.contatoId) : undefined;

    const isFisica = tipoPessoa === 'fisica' || tipoPessoa === 'pf';
    let ie = '';
    let contribuinte_icms = false;
    let indIEDest: 1 | 9 = 9;

    if (isFisica) {
      contribuinte_icms = false;
      indIEDest = 9;
    } else {
      try {
        const info: FocusNFeCnpjInfo = await this.focusClient.getCnpjInfo(cnpj);
        ie = this.extractIEFromCnpjInfo(info);
        const ieValida = ie !== '' && ie.toUpperCase() !== 'ISENTO';
        contribuinte_icms = ieValida;
        indIEDest = ieValida ? 1 : 9;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new BadRequestException('Falha ao consultar CNPJ na Focus NFe: ' + msg);
      }
    }

    const update: ContribuinteIcmsUpdate = { ie, contribuinte_icms, indIEDest };
    if (contatoId != null && contatoId > 0) {
      await this.pedidoData.updateContatoContribuinte(contatoId, update);
    }
    return { ie: update.ie, contribuinte_icms: update.contribuinte_icms, indIEDest: update.indIEDest };
  }

  private extractIEFromCnpjInfo(info: FocusNFeCnpjInfo): string {
    if (info.inscricao_estadual != null && String(info.inscricao_estadual).trim() !== '') {
      return String(info.inscricao_estadual).trim();
    }
    const arr = info.inscricoes_estaduais;
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      const val = first?.inscricao_estadual;
      if (val != null && String(val).trim() !== '') return String(val).trim();
    }
    return '';
  }

  @Get('contatos/:id')
  async getContato(@Param('id', ParseIntPipe) id: number): Promise<Record<string, unknown> | null> {
    const cliente = await this.pedidoData.getCliente(id);
    return cliente as unknown as Record<string, unknown> | null;
  }

  /** Resolve "Cliente" a partir do pedido (pedido_id -> contato_id -> nome). */
  @Get('pedidos/:pedidoId/cliente')
  async getClienteByPedido(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
  ): Promise<{ contato_id: number | null; nome: string | null }> {
    try {
      return await this.pedidoData.getContatoByPedidoId(pedidoId);
    } catch {
      return { contato_id: null, nome: null };
    }
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
    let payload = await this.supabase.findPayloadEnviado(invoiceId);
    if (!payload && invoice.payload_json) {
      payload = invoice.payload_json as Record<string, unknown>;
    }
    if (!payload) {
      return { message: 'Chamada ainda não foi enviada à API (aguarde processamento ou confira as situações).' };
    }
    return payload;
  }

  /** Retorna payload e metadados da invoice para abrir o modal de edição. */
  @Get(':invoiceId/editar')
  async getEditar(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<
    | { payload: Record<string, unknown>; pedido_id: number; empresa_id: number; natureza_operacao_id: number }
    | { message: string }
  > {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    let payload = await this.supabase.findPayloadEnviado(invoiceId);
    if (!payload && invoice.payload_json) {
      payload = invoice.payload_json as Record<string, unknown>;
    }
    if (!payload) {
      return {
        message:
          'Chamada ainda não foi enviada à API (aguarde processamento ou confira as situações).',
      };
    }
    return {
      payload,
      pedido_id: invoice.pedido_id,
      empresa_id: invoice.empresa_id,
      natureza_operacao_id: invoice.natureza_operacao_id,
    };
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
    const empresa = await this.pedidoData.getEmpresa(invoice.empresa_id);
    const cnpjEmitente = empresa?.cnpj ? String(empresa.cnpj).replace(/\D/g, '') : undefined;
    const tokensFromDb = empresa
      ? { homologacao: empresa.tokenHomologacao, producao: empresa.tokenProducao }
      : undefined;
    const { body, contentType } = await this.focusClient.download(
      invoice.focus_id,
      'xml',
      cnpjEmitente,
      tokensFromDb,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfe-${invoice.chave_acesso ?? invoice.focus_id}.xml"`,
    );
    const nodeStream = Readable.fromWeb(body as any);
    nodeStream.pipe(res);
  }

  @Post(':invoiceId/cancelar')
  async cancelar(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() body: { justificativa?: string },
  ): Promise<{ message: string }> {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    if (invoice.status !== 'AUTORIZADO') {
      throw new BadRequestException('Só é possível cancelar NFe autorizada.');
    }
    const justificativa = body?.justificativa?.trim();
    if (!justificativa || justificativa.length < 15) {
      throw new BadRequestException('Justificativa obrigatória com mínimo 15 caracteres.');
    }
    if (!invoice.focus_id) {
      throw new BadRequestException('NFe sem focus_id.');
    }
    const empresa = await this.pedidoData.getEmpresa(invoice.empresa_id);
    const cnpjEmitente = empresa?.cnpj ? String(empresa.cnpj).replace(/\D/g, '') : undefined;
    const tokensFromDb = empresa
      ? { homologacao: empresa.tokenHomologacao, producao: empresa.tokenProducao }
      : undefined;
    const res = await this.focusClient.cancelar(
      invoice.focus_id,
      justificativa,
      cnpjEmitente,
      tokensFromDb,
    );
    const status = (res as { status?: string }).status;
    if (status === 'cancelado') {
      await this.supabase.updateInvoiceStatus(invoiceId, {
        status: 'CANCELADO',
        error_message: `Cancelada: ${justificativa.slice(0, 100)}`,
      });
      return { message: 'NFe cancelada com sucesso.' };
    }
    if (status === 'processando_cancelamento') {
      await this.supabase.updateInvoiceStatus(invoiceId, {
        status: 'PROCESSANDO',
        error_message: `Cancelamento em processamento: ${justificativa.slice(0, 100)}`,
      });
      return { message: 'Cancelamento em processamento. Acompanhe o status pelo webhook.' };
    }
    throw new InternalServerErrorException(
      (res as { mensagem?: string }).mensagem ?? 'Erro ao cancelar na SEFAZ.',
    );
  }

  @Post(':invoiceId/clonar')
  async clonar(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ): Promise<{ message: string; invoiceId: string }> {
    const invoice = await this.supabase.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException('Nota fiscal não encontrada');
    let payload = await this.supabase.findPayloadEnviado(invoiceId);
    if (!payload && invoice.payload_json) {
      payload = invoice.payload_json as Record<string, unknown>;
    }
    if (!payload || !Array.isArray(payload.items) && !Array.isArray(payload.itens)) {
      throw new BadRequestException('Payload da nota não encontrado para clonar.');
    }
    return this.emissaoService.emitirComPayload(
      invoice.pedido_id,
      invoice.empresa_id,
      invoice.natureza_operacao_id,
      payload as Record<string, unknown>,
    ).then((r) => ({
      message: 'Nota clonada. Nova emissão em processamento.',
      invoiceId: r.invoiceId,
    }));
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
    const empresa = await this.pedidoData.getEmpresa(invoice.empresa_id);
    const cnpjEmitente = empresa?.cnpj ? String(empresa.cnpj).replace(/\D/g, '') : undefined;
    const tokensFromDb = empresa
      ? { homologacao: empresa.tokenHomologacao, producao: empresa.tokenProducao }
      : undefined;
    const { body, contentType } = await this.focusClient.download(
      invoice.focus_id,
      'pdf',
      cnpjEmitente,
      tokensFromDb,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nfe-${invoice.chave_acesso ?? invoice.focus_id}.pdf"`,
    );
    const nodeStream = Readable.fromWeb(body as any);
    nodeStream.pipe(res);
  }

  /**
   * Valida as regras tributárias para um pedido, empresa e natureza de operação.
   * Busca a UF do destinatário via: pedido_id -> contatos_id -> enderecos.uf
   * Em seguida consulta todas as tabelas de regras filtradas por naturezaRef e destinos.
   *
   * POST /fiscal/validar-tributacao
   * Body: { pedido_id: number, empresa_id: number, natureza_operacao_id: number }
   */
  @Post('validar-tributacao')
  async validarTributacao(
    @Body() body: { pedido_id: number; empresa_id: number; natureza_operacao_id: number },
  ): Promise<Record<string, unknown>> {
    const pedidoId = Number(body?.pedido_id);
    const empresaId = Number(body?.empresa_id);
    const naturezaId = Number(body?.natureza_operacao_id);

    if (!pedidoId || pedidoId < 1) throw new BadRequestException('Informe um pedido_id válido.');
    if (!empresaId || empresaId < 1) throw new BadRequestException('Informe uma empresa.');
    if (!naturezaId || naturezaId < 1) throw new BadRequestException('Informe uma natureza de operação.');

    try {
      // PASSO 1: Obter UF do destinatário via pedido -> contato -> endereço
      const pedido = await this.pedidoData.getPedido(pedidoId);
      if (!pedido) throw new NotFoundException(`Pedido ${pedidoId} não encontrado.`);

      const ped = pedido as Record<string, unknown>;
      const contatoId = this.resolveContatoId(ped);

      if (contatoId == null) {
        throw new BadRequestException(`Pedido ${pedidoId} não possui contato vinculado (contatos_id).`);
      }

      const cliente = await this.pedidoData.getCliente(contatoId);
      if (!cliente) {
        throw new BadRequestException(`Contato ${contatoId} não encontrado.`);
      }

      const cli = cliente as Record<string, unknown>;
      const ufRaw = String(cli.uf ?? cli.estado ?? cli.UF ?? '').trim().toUpperCase();
      const pais = String(cli.pais ?? 'Brasil').trim();

      if (!ufRaw && pais.toLowerCase() === 'brasil') {
        throw new BadRequestException(
          `Não foi possível determinar a UF do destinatário (contato ${contatoId}). Cadastre o endereço do cliente.`,
        );
      }

      const ufDestinatario = ufRaw || '';

      // Buscar natureza para obter naturezaRef
      const natureza = await this.pedidoData.getNaturezaOperacao(naturezaId);
      if (!natureza) throw new NotFoundException(`Natureza de operação ${naturezaId} não encontrada.`);
      const nat = natureza as Record<string, unknown>;
      const naturezaRef = String(nat.naturezaRef ?? nat.descricao ?? naturezaId).trim();

      // PASSO 2: Consultar todas as tabelas de regras tributárias
      const regras = await this.resolveTodasRegras(naturezaId, ufDestinatario);

      return {
        uf_destinatario: ufDestinatario || null,
        natureza_operacao: naturezaRef,
        natureza_operacao_id: naturezaId,
        pedido_id: pedidoId,
        empresa_id: empresaId,
        regras_aplicadas: {
          ICMS: regras.icms ? [regras.icms] : [],
          PIS: regras.pis ? [regras.pis] : [],
          COFINS: regras.cofins ? [regras.cofins] : [],
          IPI: regras.ipi ? [regras.ipi] : [],
          ISSQN: [],
          OUTROS: [],
          RETENCOES: regras.retencoes ? [regras.retencoes] : [],
          CBS: regras.cbs ? [regras.cbs] : [],
          IBS: regras.ibs ? [regras.ibs] : [],
          IS: regras.is ? [regras.is] : [],
        },
      };
    } catch (e) {
      if (e instanceof BadRequestException || e instanceof NotFoundException) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException({ message: 'Erro ao validar tributação.', detail: msg });
    }
  }

  // ── Métodos privados auxiliares ──────────────────────────────────────────────

  /**
   * Extrai o contatoId de um pedido tentando os campos contatos_id, contato_id e cliente_id,
   * nessa ordem. Retorna null se nenhum estiver presente.
   */
  private resolveContatoId(ped: Record<string, unknown>): number | null {
    const raw = ped.contatos_id ?? ped.contato_id ?? ped.cliente_id;
    return raw != null ? Number(raw) : null;
  }

  /**
   * Busca a regra de ICMS para a natureza e UF informadas.
   * Se não encontrar regra exata, faz fallback na lista completa da natureza buscando
   * match por UF específica no campo destinos (texto separado por vírgula) ou destinos = "qualquer".
   */
  private async resolveRegraICMS(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<Awaited<ReturnType<PedidoDataService['getRegraICMSParaDestino']>>> {
    let regra = await this.pedidoData.getRegraICMSParaDestino(naturezaId, ufDestinatario);
    if (!regra && ufDestinatario.length === 2) {
      const list = await this.pedidoData.getRegrasICMSByNatureza(naturezaId);
      const ufNorm = ufDestinatario.trim().toUpperCase();
      const getDest = (r: Record<string, unknown>) => r.destinos ?? r.Destinos;
      const matchUF = (list as unknown as Record<string, unknown>[]).find((r) => {
        const d = getDest(r);
        if (!d) return false;
        const s = String(d).trim();
        if (s.toLowerCase() === 'qualquer') return true;
        return s.split(/[,\s]+/).map((p) => p.trim().toUpperCase()).filter(Boolean).includes(ufNorm);
      });
      const matchQualquer = (list as unknown as Record<string, unknown>[]).find((r) => {
        const d = getDest(r);
        return d != null && String(d).trim().toLowerCase() === 'qualquer';
      });
      regra = (matchUF ?? matchQualquer ?? null) as typeof regra;
    }
    return regra;
  }

  /**
   * Executa em paralelo a consulta de todas as regras tributárias para uma natureza e UF.
   * Usa resolveRegraICMS (com fallback) para ICMS e busca direta para os demais tributos.
   */
  private async resolveTodasRegras(
    naturezaId: number,
    ufDestinatario: string,
  ): Promise<{
    icms: Awaited<ReturnType<PedidoDataService['getRegraICMSParaDestino']>>;
    pis: Awaited<ReturnType<PedidoDataService['getRegraPISParaDestino']>>;
    cofins: Awaited<ReturnType<PedidoDataService['getRegraCOFINSParaDestino']>>;
    ipi: Awaited<ReturnType<PedidoDataService['getRegraIPIParaDestino']>>;
    retencoes: Awaited<ReturnType<PedidoDataService['getRegraRetencoesParaDestino']>>;
    is: Awaited<ReturnType<PedidoDataService['getRegraISParaDestino']>>;
    ibs: Awaited<ReturnType<PedidoDataService['getRegraIBSParaDestino']>>;
    cbs: Awaited<ReturnType<PedidoDataService['getRegraCBSParaDestino']>>;
  }> {
    const [
      icms,
      pis,
      cofins,
      ipi,
      retencoes,
      is,
      ibs,
      cbs,
    ] = await Promise.all([
      this.resolveRegraICMS(naturezaId, ufDestinatario),
      this.pedidoData.getRegraPISParaDestino(naturezaId, ufDestinatario),
      this.pedidoData.getRegraCOFINSParaDestino(naturezaId, ufDestinatario),
      this.pedidoData.getRegraIPIParaDestino(naturezaId, ufDestinatario),
      this.pedidoData.getRegraRetencoesParaDestino(naturezaId, ufDestinatario),
      this.pedidoData.getRegraISParaDestino(naturezaId, ufDestinatario),
      this.pedidoData.getRegraIBSParaDestino(naturezaId, ufDestinatario),
      this.pedidoData.getRegraCBSParaDestino(naturezaId, ufDestinatario),
    ]);
    return { icms, pis, cofins, ipi, retencoes, is, ibs, cbs };
  }
}


