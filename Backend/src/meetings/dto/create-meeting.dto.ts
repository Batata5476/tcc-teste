import { IsString, IsDateString, IsArray, IsInt, IsOptional, Matches, IsUrl } from 'class-validator';

export class CreateMeetingDto {
  @IsDateString()
  data_reuniao: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, {
    message: 'horario_reuniao deve estar no formato HH:mm ou HH:mm:ss',
  })
  horario_reuniao: string;

  @IsString()
  assunto_reuniao: string;

  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  link_reuniao?: string;

  @IsString()
  tipo_reuniao: string;

  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  participants?: number[];
}
