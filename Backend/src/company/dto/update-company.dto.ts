import { Type } from 'class-transformer';
import { IsEmail, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsString()
  @IsOptional()
  cnpj?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  tipo_empresa?: string;

  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  @IsOptional()
  longitude?: number;
}

