import { Type } from 'class-transformer';
import { IsDateString, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateWorkDto {
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  entrada?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/)
  saida?: string;

  @IsOptional()
  @IsDateString()
  data_ponto?: string;

  // As coordenadas são opcionais em outras edições; o service exige ambas ao registrar a saída.
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}
