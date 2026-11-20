import { IsString, IsEmail, IsOptional, MinLength, IsInt, IsArray, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  nome?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  foto?: string;

  @IsString()
  @IsOptional()
  foto_func?: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  senha?: string;

  @IsString()
  @IsOptional()
  cargo?: string;

  @IsInt()
  @IsOptional()
  setor_id?: number;

  @IsString()
  @IsOptional()
  role_name?: string;

  @IsArray()
  @IsOptional()
  permissions?: string[];

  @IsString()
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'BLOCKED', 'DISABLED', 'DELETED'])
  status?: string;

  @IsString()
  @IsOptional()
  telefone?: string;
}
