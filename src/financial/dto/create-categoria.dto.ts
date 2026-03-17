import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum TipoCategoria {
  RECEITA = 'receita',
  DESPESA = 'despesa',
}

export class CreateCategoriaDto {
  @IsNotEmpty()
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsNotEmpty()
  @IsEnum(TipoCategoria)
  tipo!: TipoCategoria;

  @IsOptional()
  @IsUUID()
  idCategoriaPai?: string;
}
