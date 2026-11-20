import { IsString, IsDateString, IsArray, IsInt, IsOptional, ArrayNotEmpty, IsUrl } from 'class-validator';

export class UpdateMeetingDto {
  @IsOptional()
  @IsDateString()
  data_reuniao?: string;

  @IsOptional()
  @IsString()
  horario_reuniao?: string;

  @IsOptional()
  @IsString()
  assunto_reuniao?: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  link_reuniao?: string;

  @IsOptional()
  @IsString()
  tipo_reuniao?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  participants?: number[];
}
