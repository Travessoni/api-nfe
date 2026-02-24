import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class EmitirNFeParamsDto {
  @Min(1)
  pedidoId!: number;
}

export class WebhookFocusNFeBodyDto {
  @IsString()
  ref!: string;

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  status_sefaz?: string;

  @IsOptional()
  @IsString()
  mensagem_sefaz?: string;

  @IsOptional()
  @IsString()
  chave_nfe?: string;

  @IsOptional()
  @IsNumber()
  numero?: number;

  @IsOptional()
  @IsString()
  caminho_xml_nota_fiscal?: string;

  @IsOptional()
  @IsString()
  caminho_pdf_nota_fiscal?: string;

  @IsOptional()
  @IsString()
  mensagem?: string;

  [key: string]: unknown;
}
