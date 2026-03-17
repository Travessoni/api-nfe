import {
  IsUUID,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  Min,
} from 'class-validator';

export enum TipoLancamento {
  ENTRADA = 'entrada',
  SAIDA = 'saida',
  TRANSFERENCIA = 'transferencia',
}

export class CreateLancamentoDto {
  @IsOptional()
  @IsUUID()
  categoria?: string;

  @IsNotEmpty()
  @IsDateString()
  data!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  valor!: number;

  @IsNotEmpty()
  @IsEnum(TipoLancamento)
  tipo!: TipoLancamento;

  @IsOptional()
  @IsDateString()
  competencia?: string;

  @IsNotEmpty()
  @IsUUID()
  contaBancaria!: string;

  @IsOptional()
  @IsString()
  historico?: string;

  @IsOptional()
  @IsNumber()
  cliente?: number;

  @IsOptional()
  @IsUUID()
  contaDestino?: string;
}
