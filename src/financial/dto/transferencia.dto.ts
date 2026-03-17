import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class TransferenciaDto {
  @IsNotEmpty()
  @IsUUID()
  contaOrigem!: string;

  @IsNotEmpty()
  @IsUUID()
  contaDestino!: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.01)
  valor!: number;

  @IsNotEmpty()
  @IsDateString()
  data!: string;

  @IsOptional()
  @IsDateString()
  competencia?: string;

  @IsOptional()
  @IsString()
  historico?: string;

  @IsOptional()
  @IsUUID()
  categoria?: string;
}
