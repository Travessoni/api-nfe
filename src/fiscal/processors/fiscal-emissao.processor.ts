import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { FiscalSupabaseService } from '../services/fiscal-supabase.service';
import { PedidoDataService, extrairCstDeSituacaoTributaria } from '../services/pedido-data.service';
import { buildFocusNFePayload, normalizePayloadIcms, enrichItemsWithDifalFromRegra, getAliquotaInternaUF } from '../focus-nfe/build-payload';
import { getAliquotaInterestadualCONFAZ, getAliquotaInternaPorUF } from '../focus-nfe/difal-aliquotas';
import { RegraTributariaNaoEncontradaError } from '../types/fiscal.types';
import { FocusNFeClientService, FocusNFeValidationError } from '../focus-nfe/focus-nfe-client.service';

export const FISCAL_QUEUE_NAME = 'fiscal-emissao';

export interface EmissaoJobPayload {
  invoiceId: string;
  pedidoId: number;
  referencia: string;
  empresa_id?: number;
  natureza_operacao_id?: number;
  /** Quando presente, envia este payload à API em vez de montar a partir do pedido. */
  payload?: Record<string, unknown>;
}

@Processor(FISCAL_QUEUE_NAME)
export class FiscalEmissaoProcessor extends WorkerHost {
  constructor(
    private readonly supabase: FiscalSupabaseService,
    private readonly pedidoData: PedidoDataService,
    private readonly focusClient: FocusNFeClientService,
  ) {
    super();
  }

  async process(job: Job<EmissaoJobPayload>): Promise<{ ok: boolean; focusRef?: string; error?: string }> {
    const { invoiceId, referencia, payload: payloadFromJob } = job.data;

    try {
      let payload: Record<string, unknown>;
      let temRegimeEspecial = false;
      const empresaId = Number(job.data.empresa_id ?? 0);
      let empresaData = null;
      if (empresaId > 0) {
        empresaData = await this.pedidoData.getEmpresa(empresaId);
        temRegimeEspecial = !!empresaData?.tem_regime_especial;
      }

      if (
        payloadFromJob &&
        typeof payloadFromJob === 'object' &&
        (Array.isArray(payloadFromJob.items) || Array.isArray(payloadFromJob.itens))
      ) {
        payload = { ...payloadFromJob } as Record<string, unknown>;
        const regimeFromEmpresa = (emp: Record<string, unknown> | null): string | null => {
          if (!emp) return null;
          const v =
            emp.codRegime_tributario ??
            emp.cod_regimeTributario ??
            emp.cod_regime_tributario ??
            emp.regime ??
            emp.crt;
          return v != null && String(v).trim() !== '' ? String(v).trim() : null;
        };
        if (payload.regime_tributario_emitente == null || String(payload.regime_tributario_emitente).trim() === '') {
          let regime = regimeFromEmpresa(empresaData as Record<string, unknown> | null);
          if (regime == null) {
            const cnpjEmit = (payload.cnpj_emitente as string) ?? '';
            if (cnpjEmit && String(cnpjEmit).replace(/\D/g, '').length === 14) {
              const empByCnpj = await this.pedidoData.getEmpresaByCnpj(cnpjEmit);
              regime = regimeFromEmpresa(empByCnpj as Record<string, unknown> | null);
            }
          }
          if (regime != null) {
            (payload as Record<string, unknown>).regime_tributario_emitente = regime;
          }
        }
        const localDestino = Number(payload.local_destino ?? 0);
        const consumidorFinal = String(payload.consumidor_final ?? '1').trim();
        const ufDestinatario = String(payload.uf_destinatario ?? '').trim().toUpperCase();
        const precisaDifal = localDestino === 2 && consumidorFinal === '1' && ufDestinatario.length === 2;

        if (precisaDifal) {
          const naturezaId = Number(job.data.natureza_operacao_id ?? 0);
          if (!naturezaId || naturezaId < 1) {
            await this.supabase.updateInvoiceStatus(invoiceId, {
              status: 'ERRO',
              error_message:
                'Natureza de operação não informada. Necessária para calcular DIFAL (ICMS UF destino).',
            });
            return { ok: false, error: 'Natureza de operação não informada para DIFAL' };
          }
          const regraICMS = await this.pedidoData.getRegraICMSParaDestino(naturezaId, ufDestinatario);

          if (!regraICMS) {
            await this.supabase.updateInvoiceStatus(invoiceId, {
              status: 'ERRO',
              error_message: 'Regra ICMS não encontrada para a UF do destinatário.',
            });
            return { ok: false, error: 'Regra ICMS não encontrada' };
          }

          // DIFAL: enrichItemsWithDifalFromRegra usa calcularDifal() internamente (CONFAZ exclusivo)
          try {
            payload = enrichItemsWithDifalFromRegra(payload, regraICMS, naturezaId, temRegimeEspecial) as Record<string, unknown>;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await this.supabase.updateInvoiceStatus(invoiceId, {
              status: 'ERRO',
              error_message: msg,
            });
            return { ok: false, error: msg };
          }
        }

        // Resolver regimeStr da empresa e presumido da regra ICMS para normalizePayloadIcms
        const empRecord = empresaData as Record<string, unknown> | null;
        const regimeStr = empRecord?.codRegime_tributario != null ? String(empRecord.codRegime_tributario).trim() : '';

        // Buscar regra ICMS para o campo presumido (mesmo quando não tem DIFAL)
        let presumido: number | null = null;
        const natIdForIcms = Number(job.data.natureza_operacao_id ?? 0);
        if (natIdForIcms > 0) {
          const ufDest = String(payload.uf_destinatario ?? '').trim().toUpperCase();
          const regraIcmsForPresumido = await this.pedidoData.getRegraICMSParaDestino(natIdForIcms, ufDest);
          if (regraIcmsForPresumido) {
            const pRaw = (regraIcmsForPresumido as Record<string, unknown>).presumido;
            if (pRaw != null && String(pRaw).trim() !== '') {
              const pNum = Number(pRaw);
              if (pNum < 0) {
                await this.supabase.updateInvoiceStatus(invoiceId, {
                  status: 'ERRO',
                  error_message: 'Regra ICMS com regime presumido inválido. O campo presumido não pode ser negativo.',
                });
                return { ok: false, error: 'Regra ICMS com regime presumido inválido' };
              }
              if (pNum > 0) presumido = pNum; // 0 = não configurado
            }
          }
        }

        // Aplicar regras PIS/COFINS do banco (se natureza disponível)
        const naturezaIdPisCofins = Number(job.data.natureza_operacao_id ?? 0);
        if (naturezaIdPisCofins > 0) {
          const ufDest = String(payload.uf_destinatario ?? '').trim().toUpperCase();
          const [regraPIS, regraCOFINS] = await Promise.all([
            this.pedidoData.getRegraPISParaDestino(naturezaIdPisCofins, ufDest),
            this.pedidoData.getRegraCOFINSParaDestino(naturezaIdPisCofins, ufDest),
          ]);
          const payloadItems = (payload.items ?? payload.itens) as Record<string, unknown>[] | undefined;
          if (Array.isArray(payloadItems)) {
            const incluirFreteNaBase = (payload as Record<string, unknown>).incluir_frete_base_ipi !== false
              && (payload as Record<string, unknown>).incluir_frete_base_ipi !== 'false';
            const pisCstRegra = regraPIS ? extrairCstDeSituacaoTributaria(String(regraPIS.situacaoTributaria ?? '')) : null;
            const cofinsCstRegra = regraCOFINS ? extrairCstDeSituacaoTributaria(String(regraCOFINS.situacaoTributaria ?? '')) : null;
            for (const item of payloadItems) {
              if (pisCstRegra) item.pis_situacao_tributaria = pisCstRegra;
              if (cofinsCstRegra) item.cofins_situacao_tributaria = cofinsCstRegra;
              const vProd = Number(item.valor_bruto ?? 0);
              const vFrete = incluirFreteNaBase ? Number(item.valor_frete ?? 0) : 0;
              const bc = Math.round((vProd + vFrete) * 100) / 100;
              if (regraPIS?.aliquota != null) {
                const aliq = Number(regraPIS.aliquota);
                item.pis_aliquota_porcentual = aliq;
                item.pis_base_calculo = bc;
                item.pis_valor = Math.round(bc * aliq) / 100;
              }
              if (regraCOFINS?.aliquota != null) {
                const aliq = Number(regraCOFINS.aliquota);
                item.cofins_aliquota_porcentual = aliq;
                item.cofins_base_calculo = bc;
                item.cofins_valor = Math.round(bc * aliq) / 100;
              }
            }
          }
        }

        payload = normalizePayloadIcms(payload, temRegimeEspecial, regimeStr, presumido) as Record<string, unknown>;
      } else {
        const { pedidoId, empresa_id: overrideEmpresaId, natureza_operacao_id: overrideNaturezaId } = job.data;
        const pedido = await this.pedidoData.getPedido(pedidoId);
        if (!pedido) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message: `Pedido ${pedidoId} não encontrado`,
          });
          return { ok: false, error: 'Pedido não encontrado' };
        }

        if (overrideEmpresaId == null) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message: 'Empresa emissora não informada. A empresa (remetente) deve ser escolhida no formulário.',
          });
          return { ok: false, error: 'Empresa não informada no job' };
        }
        const empresaId = overrideEmpresaId;
        const naturezaId = overrideNaturezaId ?? (pedido as { natureza_operacao_id?: number }).natureza_operacao_id ?? null;

        const [
          itens,
          empresa,
          cliente,
          natureza,
        ] = await Promise.all([
          this.pedidoData.getItensVendaEnrichedForFiscal(pedidoId),
          empresaId != null ? this.pedidoData.getEmpresa(empresaId) : Promise.resolve(null),
          (pedido as { contatos_id?: number }).contatos_id != null
            ? this.pedidoData.getCliente((pedido as { contatos_id: number }).contatos_id)
            : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getNaturezaOperacao(naturezaId) : Promise.resolve(null),
        ]);

        if (!empresa) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message: 'Empresa não encontrada',
          });
          return { ok: false, error: 'Empresa não encontrada' };
        }
        if (!cliente) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message: 'Cliente não encontrado',
          });
          return { ok: false, error: 'Cliente não encontrado' };
        }
        const contribuinteIcms = (cliente as Record<string, unknown>).contribuinte_icms === true;
        const ieCliente = String((cliente as Record<string, unknown>).ie ?? '').trim();
        if (contribuinteIcms && (!ieCliente || ieCliente.toUpperCase() === 'ISENTO')) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message:
              'Inconsistência fiscal: cliente cadastrado como contribuinte ICMS mas Inscrição Estadual está vazia. Atualize o cadastro do cliente.',
          });
          return { ok: false, error: 'Contribuinte ICMS com IE vazia' };
        }
        if (!natureza) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message: 'Natureza de operação não encontrada',
          });
          return { ok: false, error: 'Natureza de operação não encontrada' };
        }
        if (!itens.length) {
          await this.supabase.updateInvoiceStatus(invoiceId, {
            status: 'ERRO',
            error_message: 'Pedido sem itens',
          });
          return { ok: false, error: 'Pedido sem itens' };
        }

        const ufEmitente = String(empresa.uf ?? '').trim().toUpperCase();
        const paisDestino = String(cliente.pais ?? 'Brasil').trim();
        const ufDestinatarioRaw = String(cliente.uf ?? '').trim().toUpperCase();
        const ufDestinatario =
          paisDestino === 'Brasil' && !ufDestinatarioRaw
            ? ufEmitente || 'MG'
            : ufDestinatarioRaw || (paisDestino !== 'Brasil' ? '' : 'MG');

        const [
          regraICMS,
          regraPIS,
          regraCOFINS,
          regraIPI,
          regraRetencoes,
          regraIS,
          regraIBS,
          regraCBS,
        ] = await Promise.all([
          naturezaId != null ? this.pedidoData.getRegraICMSParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraPISParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraCOFINSParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraIPIParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraRetencoesParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraISParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraIBSParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
          naturezaId != null ? this.pedidoData.getRegraCBSParaDestino(naturezaId, ufDestinatario) : Promise.resolve(null),
        ]);

        const regras = {
          icms: regraICMS,
          pis: regraPIS,
          cofins: regraCOFINS,
          ipi: regraIPI,
          retencoes: regraRetencoes,
          is: regraIS,
          ibs: regraIBS,
          cbs: regraCBS,
        };
        payload = buildFocusNFePayload(
          pedido,
          itens,
          empresa,
          cliente,
          natureza,
          regras,
        ) as unknown as Record<string, unknown>;
      }

      const indIE = (payload as Record<string, unknown>).indicador_inscricao_estadual_destinatario;
      const ieDest = String((payload as Record<string, unknown>).inscricao_estadual_destinatario ?? '').trim();
      if (indIE === 1 && (!ieDest || ieDest.toUpperCase() === 'ISENTO')) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message:
            'Inconsistência fiscal: destinatário contribuinte ICMS (indIEDest=1) com Inscrição Estadual vazia.',
        });
        return { ok: false, error: 'Contribuinte ICMS com IE vazia' };
      }

      if (indIE === 9 && (ieDest.toUpperCase() === 'ISENTO' || ieDest === '')) {
        delete (payload as Record<string, unknown>).inscricao_estadual_destinatario;
      }

      payload = normalizePayloadIcms(payload, temRegimeEspecial) as Record<string, unknown>;

      // Atualiza o valor_nota com base no payload final (valor_total da NFe)
      const valorTotalRaw = (payload as Record<string, unknown>).valor_total;
      const valorNota =
        typeof valorTotalRaw === 'number'
          ? valorTotalRaw
          : valorTotalRaw != null && !Number.isNaN(Number(valorTotalRaw))
          ? Number(valorTotalRaw)
          : null;
      if (valorNota != null && !Number.isNaN(valorNota)) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'PENDENTE',
          valor_nota: valorNota,
        });
      }

      // Token da empresa no banco (tokenHomologacao / tokenProducao): prioridade sobre env
      const empresaParaToken = empresaId > 0 ? await this.pedidoData.getEmpresa(empresaId) : null;
      const tokensFromDb = empresaParaToken
        ? {
          homologacao: empresaParaToken.tokenHomologacao,
          producao: empresaParaToken.tokenProducao,
        }
        : undefined;

      const cnpjEmitente = (payload as Record<string, unknown>).cnpj_emitente as string | undefined;
      if (!cnpjEmitente || String(cnpjEmitente).replace(/\D/g, '').length !== 14) {
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: 'CNPJ do emitente inválido ou ausente no payload.',
        });
        return { ok: false, error: 'CNPJ do emitente inválido' };
      }
      try {
        this.focusClient.getToken(cnpjEmitente, tokensFromDb);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.supabase.updateInvoiceStatus(invoiceId, {
          status: 'ERRO',
          error_message: msg,
        });
        return { ok: false, error: msg };
      }

      await this.supabase.setInvoiceProcessing(invoiceId);
      await this.supabase.createEvento(invoiceId, 'payload_enviado', payload);
      await this.focusClient.emitir(referencia, payload, cnpjEmitente, tokensFromDb);

      return { ok: true, focusRef: referencia };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.supabase.updateInvoiceStatus(invoiceId, {
        status: 'ERRO',
        error_message: message,
      });
      // Erros de validação (422, auth) NÃO devem ser retentados pelo BullMQ
      if (err instanceof FocusNFeValidationError || err instanceof RegraTributariaNaoEncontradaError) {
        return { ok: false, error: message };
      }
      // Erros temporários (500, timeout, rede) são re-thrown para BullMQ retentar
      throw err;
    }
  }
}
