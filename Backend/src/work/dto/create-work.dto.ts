import { Type } from 'class-transformer';
import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsString, Matches } from 'class-validator';

export class CreateWorkDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  entrada: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  saida: string;

  @IsDateString()
  data_ponto: string;

  // Converte e valida as coordenadas que o aplicativo envia ao registrar a entrada.
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  // A longitude também precisa ser numérica e estar dentro dos limites geográficos.
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;
}
