import { Type } from 'class-transformer';
import { IsEmail, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  cnpj: string;

  @IsEmail()
  email: string;

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

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/, {
    message: 'A senha deve conter no mínimo 8 caracteres, incluindo letras maiúsculas, minúsculas, números e símbolos.',
  })
  senha_empresa: string;
}
