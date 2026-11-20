import { IsString, IsEmail, IsNotEmpty, IsArray, IsOptional, IsInt } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsString()
  @IsNotEmpty()
  cpf: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  cargo: string;

  @IsInt()
  @IsNotEmpty()
  setor_id: number;

  @IsString()
  @IsNotEmpty()
  role_name: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsString()
  @IsOptional()
  telefone?: string;

  @IsString()
  @IsOptional()
  foto?: string;
}
