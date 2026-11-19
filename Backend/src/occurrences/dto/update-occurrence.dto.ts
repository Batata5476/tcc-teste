import { IsString, IsOptional, Length } from 'class-validator';

export class UpdateOccurrenceDto {
  @IsOptional()
  @IsString()
  atestado_func?: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  ocorrencias?: string;
}
