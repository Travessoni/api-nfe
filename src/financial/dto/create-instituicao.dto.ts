import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateInstituicaoDto {
  @IsNotEmpty()
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsNumber()
  saldo?: number;

  @IsOptional()
  @IsUUID()
  criado_por?: string;
}
