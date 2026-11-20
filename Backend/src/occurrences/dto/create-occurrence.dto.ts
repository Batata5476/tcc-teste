import { IsString, IsOptional, Length, IsNumber } from 'class-validator';

export class CreateOccurrenceDto {
  @IsOptional()
  @IsString()
  atestado_func?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  ocorrencias?: string;

  @IsOptional()
  @IsNumber()
  fk_id_func?: number;
}
