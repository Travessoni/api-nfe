import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Injectable,
  OnModuleDestroy,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateLancamentoDto, TipoLancamento } from './dto/create-lancamento.dto';
import { CreateCategoriaDto, TipoCategoria } from './dto/create-categoria.dto';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { TransferenciaDto } from './dto/transferencia.dto';

@Injectable()
export class FinancialService implements OnModuleDestroy {
  private client: SupabaseClient | null = null;

  constructor(private config: ConfigService) {}

  getClient(): SupabaseClient {
    if (!this.client) {
      const url = this.config.get<string>('SUPABASE_URL');
      const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) {
        throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios');
      }
      this.client = createClient(url, key);
    }
    return this.client;
  }

  async onModuleDestroy() {
    this.client = null;
  }

  // ============================================================
  // LANÇAMENTOS (caixas_e_bancos)
  // ============================================================

  /**
   * Cria um novo lançamento financeiro.
   * - Valida compatibilidade categoria.tipo × lançamento.tipo
   * - Garante que contaDestino só é preenchido em transferências
   * - O saldo é atualizado automaticamente pela trigger do banco
   */
  async createLancamento(dto: CreateLancamentoDto) {
    // Validar contaDestino
    if (dto.tipo !== TipoLancamento.TRANSFERENCIA && dto.contaDestino) {
      throw new BadRequestException(
        '"contaDestino" só pode ser preenchido quando tipo = "transferencia"',
      );
    }

    // Validar compatibilidade categoria × tipo
    if (dto.categoria && dto.tipo !== TipoLancamento.TRANSFERENCIA) {
      await this.validarCategoriaCompativel(dto.categoria, dto.tipo);
    }

    const insert: Record<string, unknown> = {
      categoria: dto.categoria ?? null,
      data: dto.data,
      valor: dto.valor,
      tipo: dto.tipo,
      competencia: dto.competencia ?? dto.data,
      '"contaBancaria"': undefined, // handled below
      historico: dto.historico ?? null,
      cliente: dto.cliente ?? null,
      '"contaDestino"': undefined, // handled below
    };

    // Use the column name directly (Supabase JS handles quoting)
    const { data, error } = await this.getClient()
      .from('caixas_e_bancos')
      .insert({
        categoria: dto.categoria ?? null,
        data: dto.data,
        valor: dto.valor,
        tipo: dto.tipo,
        competencia: dto.competencia ?? dto.data,
        contaBancaria: dto.contaBancaria,
        historico: dto.historico ?? null,
        cliente: dto.cliente ?? null,
        contaDestino: dto.tipo === TipoLancamento.TRANSFERENCIA ? (dto.contaDestino ?? null) : null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`caixas_e_bancos insert: ${error.message}`);
    return data;
  }

  /**
   * Lista lançamentos com paginação e filtros.
   */
  async listLancamentos(params: {
    page?: number;
    limit?: number;
    dataInicio?: string;
    dataFim?: string;
    contaBancaria?: string;
    tipo?: string;
    categoria?: string;
  } = {}) {
    const { page = 1, limit = 20, dataInicio, dataFim, contaBancaria, tipo, categoria } = params;

    let query = this.getClient()
      .from('caixas_e_bancos')
      .select(
        '*, financeiro_categorias(id, nome, tipo, cor), financeiro_instituicoes!caixas_e_bancos_contaBancaria_fkey(id, nome)',
        { count: 'exact' },
      )
      .eq('estornado', false);

    if (dataInicio) {
      query = query.gte('data', dataInicio);
    }
    if (dataFim) {
      query = query.lte('data', dataFim);
    }
    if (contaBancaria) {
      query = query.eq('contaBancaria', contaBancaria);
    }
    if (tipo) {
      query = query.eq('tipo', tipo);
    }
    if (categoria) {
      query = query.eq('categoria', categoria);
    }

    const offset = (page - 1) * limit;
    query = query
      .order('data', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw new Error(`caixas_e_bancos list: ${error.message}`);

    return {
      data: data ?? [],
      count: count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Busca um lançamento por ID.
   */
  async findLancamentoById(id: number) {
    const { data, error } = await this.getClient()
      .from('caixas_e_bancos')
      .select(
        '*, financeiro_categorias(id, nome, tipo, cor), financeiro_instituicoes!caixas_e_bancos_contaBancaria_fkey(id, nome)',
      )
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`caixas_e_bancos select: ${error.message}`);
    if (!data) throw new NotFoundException(`Lançamento ${id} não encontrado`);
    return data;
  }

  /**
   * Estorna um lançamento (sem DELETE).
   * 1. Marca o registro original como estornado = true (trigger reverte saldo)
   * 2. Cria um novo registro invertido com estorno_origem_id
   */
  async estornarLancamento(id: number) {
    // Buscar original
    const { data: original, error: findError } = await this.getClient()
      .from('caixas_e_bancos')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findError) throw new Error(`caixas_e_bancos select: ${findError.message}`);
    if (!original) throw new NotFoundException(`Lançamento ${id} não encontrado`);
    if (original.estornado) {
      throw new BadRequestException(`Lançamento ${id} já foi estornado`);
    }

    // 1. Marcar como estornado (trigger reverte saldo)
    const { error: updateError } = await this.getClient()
      .from('caixas_e_bancos')
      .update({ estornado: true })
      .eq('id', id);

    if (updateError) throw new Error(`caixas_e_bancos update estorno: ${updateError.message}`);

    // 2. Criar registro invertido
    const tipoInvertido =
      original.tipo === 'Entrada' ? 'Saída' : original.tipo === 'Saída' ? 'Entrada' : original.tipo;

    const { data: estorno, error: insertError } = await this.getClient()
      .from('caixas_e_bancos')
      .insert({
        categoria: original.categoria,
        data: new Date().toISOString().split('T')[0],
        valor: original.valor,
        tipo: tipoInvertido,
        competencia: original.competencia,
        contaBancaria: original.contaBancaria,
        historico: `Estorno do lançamento #${id}${original.historico ? ' - ' + original.historico : ''}`,
        cliente: original.cliente,
        contaDestino: null,
        estorno_origem_id: id,
      })
      .select('*')
      .single();

    if (insertError) throw new Error(`caixas_e_bancos insert estorno: ${insertError.message}`);

    return { original: { ...original, estornado: true }, estorno };
  }

  /**
   * Transferência atômica entre contas.
   * Cria dois lançamentos: saída na origem + entrada no destino.
   * Se um falhar, reverte o outro.
   */
  async transferencia(dto: TransferenciaDto) {
    if (dto.contaOrigem === dto.contaDestino) {
      throw new BadRequestException('Conta de origem e destino não podem ser iguais');
    }

    // Validar categoria se fornecida
    if (dto.categoria) {
      // Para transferência, categoria não é obrigatória
      // mas se fornecida, não precisa validar receita/despesa
    }

    // 1. Criar saída na conta origem
    const { data: saida, error: saidaError } = await this.getClient()
      .from('caixas_e_bancos')
      .insert({
        categoria: dto.categoria ?? null,
        data: dto.data,
        valor: dto.valor,
        tipo: 'Saída',
        competencia: dto.competencia ?? dto.data,
        contaBancaria: dto.contaOrigem,
        historico: dto.historico ?? 'Transferência entre contas',
        contaDestino: dto.contaDestino,
      })
      .select('*')
      .single();

    if (saidaError) {
      throw new Error(`Erro ao criar saída da transferência: ${saidaError.message}`);
    }

    // 2. Criar entrada na conta destino
    const { data: entrada, error: entradaError } = await this.getClient()
      .from('caixas_e_bancos')
      .insert({
        categoria: dto.categoria ?? null,
        data: dto.data,
        valor: dto.valor,
        tipo: 'Entrada',
        competencia: dto.competencia ?? dto.data,
        contaBancaria: dto.contaDestino,
        historico: dto.historico ?? 'Transferência entre contas',
        contaDestino: null,
      })
      .select('*')
      .single();

    if (entradaError) {
      // Rollback: estornar a saída criada
      await this.getClient()
        .from('caixas_e_bancos')
        .update({ estornado: true })
        .eq('id', saida.id);

      throw new Error(`Erro ao criar entrada da transferência (saída revertida): ${entradaError.message}`);
    }

    return { saida, entrada };
  }

  /**
   * Resumo de entradas e saídas (para os cards).
   */
  async getResumo(params: {
    contaBancaria?: string;
    dataInicio?: string;
    dataFim?: string;
  } = {}) {
    let query = this.getClient()
      .from('caixas_e_bancos')
      .select('tipo, valor')
      .eq('estornado', false);

    if (params.contaBancaria) {
      query = query.eq('contaBancaria', params.contaBancaria);
    }
    if (params.dataInicio) {
      query = query.gte('data', params.dataInicio);
    }
    if (params.dataFim) {
      query = query.lte('data', params.dataFim);
    }

    const { data, error } = await query;

    if (error) throw new Error(`caixas_e_bancos resumo: ${error.message}`);

    let totalEntradas = 0;
    let totalSaidas = 0;

    for (const row of data ?? []) {
      const valor = Number(row.valor) || 0;
      if (row.tipo === 'Entrada') {
        totalEntradas += valor;
      } else if (row.tipo === 'Saída') {
        totalSaidas += valor;
      }
    }

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
    };
  }

  // ============================================================
  // CATEGORIAS (financeiro_categorias)
  // ============================================================

  async createCategoria(dto: CreateCategoriaDto) {
    const insert: Record<string, unknown> = {
      nome: dto.nome,
      cor: dto.cor ?? null,
      tipo: dto.tipo,
    };
    if (dto.idCategoriaPai) {
      insert['idCategoriaPai'] = dto.idCategoriaPai;
    }

    const { data, error } = await this.getClient()
      .from('financeiro_categorias')
      .insert(insert)
      .select('*')
      .single();

    if (error) throw new Error(`financeiro_categorias insert: ${error.message}`);
    return data;
  }

  async listCategorias(params: { search?: string; tipo?: string } = {}) {
    let query = this.getClient()
      .from('financeiro_categorias')
      .select('*')
      .order('nome', { ascending: true });

    if (params.tipo) {
      query = query.eq('tipo', params.tipo);
    }

    if (params.search && params.search.trim() !== '') {
      // Busca usando nome_normalized (accent-insensitive)
      query = query.ilike('nome_normalized', `%${params.search.toLowerCase()}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`financeiro_categorias list: ${error.message}`);
    return data ?? [];
  }

  /**
   * Retorna categorias organizadas em hierarquia pai/filho.
   */
  async listCategoriasHierarquicas(params: { search?: string; tipo?: string } = {}) {
    const all = await this.listCategorias(params);

    // Separar pais e filhos
    const pais = all.filter((c: Record<string, unknown>) => !c['idCategoriaPai']);
    const filhos = all.filter((c: Record<string, unknown>) => !!c['idCategoriaPai']);

    return pais.map((pai: Record<string, unknown>) => ({
      ...pai,
      filhos: filhos.filter((f: Record<string, unknown>) => f['idCategoriaPai'] === pai['id']),
    }));
  }

  async findCategoriaById(id: string) {
    const { data, error } = await this.getClient()
      .from('financeiro_categorias')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`financeiro_categorias select: ${error.message}`);
    if (!data) throw new NotFoundException(`Categoria ${id} não encontrada`);
    return data;
  }

  async updateCategoria(id: string, dto: Partial<CreateCategoriaDto>) {
    const update: Record<string, unknown> = {};
    if (dto.nome !== undefined) update['nome'] = dto.nome;
    if (dto.cor !== undefined) update['cor'] = dto.cor;
    if (dto.tipo !== undefined) update['tipo'] = dto.tipo;
    if (dto.idCategoriaPai !== undefined) update['idCategoriaPai'] = dto.idCategoriaPai;

    const { data, error } = await this.getClient()
      .from('financeiro_categorias')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`financeiro_categorias update: ${error.message}`);
    return data;
  }

  async deleteCategoria(id: string) {
    const { error } = await this.getClient()
      .from('financeiro_categorias')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`financeiro_categorias delete: ${error.message}`);
    return { deleted: true };
  }

  // ============================================================
  // INSTITUIÇÕES (financeiro_instituicoes)
  // ============================================================

  async createInstituicao(dto: CreateInstituicaoDto) {
    const { data, error } = await this.getClient()
      .from('financeiro_instituicoes')
      .insert({
        nome: dto.nome,
        logo: dto.logo ?? null,
        saldo: dto.saldo ?? 0,
        criado_por: dto.criado_por ?? null,
      })
      .select('*')
      .single();

    if (error) throw new Error(`financeiro_instituicoes insert: ${error.message}`);
    return data;
  }

  async listInstituicoes() {
    const { data, error } = await this.getClient()
      .from('financeiro_instituicoes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw new Error(`financeiro_instituicoes list: ${error.message}`);
    return data ?? [];
  }

  async findInstituicaoById(id: string) {
    const { data, error } = await this.getClient()
      .from('financeiro_instituicoes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`financeiro_instituicoes select: ${error.message}`);
    if (!data) throw new NotFoundException(`Instituição ${id} não encontrada`);
    return data;
  }

  async updateInstituicao(id: string, dto: Partial<CreateInstituicaoDto>) {
    const update: Record<string, unknown> = {};
    if (dto.nome !== undefined) update['nome'] = dto.nome;
    if (dto.logo !== undefined) update['logo'] = dto.logo;
    if (dto.criado_por !== undefined) update['criado_por'] = dto.criado_por;
    // saldo NUNCA é atualizado diretamente — apenas via trigger

    const { data, error } = await this.getClient()
      .from('financeiro_instituicoes')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(`financeiro_instituicoes update: ${error.message}`);
    return data;
  }

  async deleteInstituicao(id: string) {
    const { error } = await this.getClient()
      .from('financeiro_instituicoes')
      .delete()
      .eq('id', id);

    if (error) throw new Error(`financeiro_instituicoes delete: ${error.message}`);
    return { deleted: true };
  }

  // ============================================================
  // Helpers
  // ============================================================

  /**
   * Valida que a categoria é compatível com o tipo do lançamento.
   * - entrada → categoria.tipo = 'receita'
   * - saida   → categoria.tipo = 'despesa'
   */
  private async validarCategoriaCompativel(categoriaId: string, tipoLancamento: TipoLancamento) {
    const categoria = await this.findCategoriaById(categoriaId);
    const tipoCategoria = (categoria as Record<string, unknown>)['tipo'] as string || '';

    const esperado: Record<string, string> = {
      [TipoLancamento.ENTRADA]: TipoCategoria.RECEITA,
      [TipoLancamento.SAIDA]: TipoCategoria.DESPESA,
    };

    if (esperado[tipoLancamento] && tipoCategoria !== esperado[tipoLancamento]) {
      throw new BadRequestException(
        `Categoria do tipo "${tipoCategoria}" é incompatível com lançamento do tipo "${tipoLancamento}". ` +
          `Esperado: categoria do tipo "${esperado[tipoLancamento]}"`,
      );
    }
  }
}
