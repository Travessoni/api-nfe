import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum TipoCategoria {
  RECEITA = 'Receita',
  DESPESA = 'Despesa',
}

export class CreateCategoriaDto {
  @IsNotEmpty()
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  cor?: string;

  @IsNotEmpty()
  @IsString()
  tipo!: string;

  @IsOptional()
  @IsUUID()
  idCategoriaPai?: string;
}
