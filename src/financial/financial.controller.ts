import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateLancamentoDto } from './dto/create-lancamento.dto';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateInstituicaoDto } from './dto/create-instituicao.dto';
import { TransferenciaDto } from './dto/transferencia.dto';

@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  // ============================================================
  // LANÇAMENTOS
  // ============================================================

  @Post('lancamentos')
  createLancamento(@Body() dto: CreateLancamentoDto) {
    return this.financialService.createLancamento(dto);
  }

  @Get('lancamentos')
  listLancamentos(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('contaBancaria') contaBancaria?: string,
    @Query('tipo') tipo?: string,
    @Query('categoria') categoria?: string,
  ) {
    return this.financialService.listLancamentos({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      dataInicio,
      dataFim,
      contaBancaria,
      tipo,
      categoria,
    });
  }

  @Get('lancamentos/resumo')
  getResumo(
    @Query('contaBancaria') contaBancaria?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.financialService.getResumo({ contaBancaria, dataInicio, dataFim });
  }

  @Get('lancamentos/:id')
  findLancamento(@Param('id', ParseIntPipe) id: number) {
    return this.financialService.findLancamentoById(id);
  }

  @Post('lancamentos/:id/estorno')
  estornarLancamento(@Param('id', ParseIntPipe) id: number) {
    return this.financialService.estornarLancamento(id);
  }

  @Post('transferencias')
  transferencia(@Body() dto: TransferenciaDto) {
    return this.financialService.transferencia(dto);
  }

  // ============================================================
  // CATEGORIAS
  // ============================================================

  @Post('categorias')
  createCategoria(@Body() dto: CreateCategoriaDto) {
    return this.financialService.createCategoria(dto);
  }

  @Get('categorias')
  listCategorias(
    @Query('search') search?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.financialService.listCategorias({ search, tipo });
  }

  @Get('categorias/hierarquicas')
  listCategoriasHierarquicas(
    @Query('search') search?: string,
    @Query('tipo') tipo?: string,
  ) {
    return this.financialService.listCategoriasHierarquicas({ search, tipo });
  }

  @Get('categorias/:id')
  findCategoria(@Param('id') id: string) {
    return this.financialService.findCategoriaById(id);
  }

  @Patch('categorias/:id')
  updateCategoria(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoriaDto>,
  ) {
    return this.financialService.updateCategoria(id, dto);
  }

  @Delete('categorias/:id')
  deleteCategoria(@Param('id') id: string) {
    return this.financialService.deleteCategoria(id);
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  @Get('dashboard/resumo')
  getDashboardResumo(@Query('mes') mes: string) {
    return this.financialService.getDashboardResumo(mes);
  }

  @Get('dashboard/evolucao')
  getDashboardEvolucao(@Query('mes') mes: string) {
    return this.financialService.getDashboardEvolucao(mes);
  }

  @Get('dashboard/categorias')
  getDashboardCategorias(@Query('mes') mes: string) {
    return this.financialService.getDashboardCategorias(mes);
  }

  @Get('dashboard/contas')
  getDashboardContas(@Query('mes') mes: string) {
    return this.financialService.getDashboardContas(mes);
  }

  @Get('dashboard/alertas')
  getDashboardAlertas(
    @Query('mes') mes: string,
    @Query('tipo') tipo: string,
  ) {
    return this.financialService.getDashboardAlertas(mes, tipo || 'despesa');
  }

  // ============================================================
  // INSTITUIÇÕES (contas financeiras)
  // ============================================================

  @Post('instituicoes')
  createInstituicao(@Body() dto: CreateInstituicaoDto) {
    return this.financialService.createInstituicao(dto);
  }

  @Get('instituicoes')
  listInstituicoes() {
    return this.financialService.listInstituicoes();
  }

  @Get('instituicoes/:id')
  findInstituicao(@Param('id') id: string) {
    return this.financialService.findInstituicaoById(id);
  }

  @Patch('instituicoes/:id')
  updateInstituicao(
    @Param('id') id: string,
    @Body() dto: Partial<CreateInstituicaoDto>,
  ) {
    return this.financialService.updateInstituicao(id, dto);
  }

  @Delete('instituicoes/:id')
  deleteInstituicao(@Param('id') id: string) {
    return this.financialService.deleteInstituicao(id);
  }
}
