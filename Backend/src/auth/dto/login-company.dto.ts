import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class LoginCompanyDto {
  @IsString()
  @Matches(/^\d{14}$/, { message: 'CNPJ deve conter apenas números' })
  cnpj: string;

  @IsString()
  @Length(6, 20)
  senha: string;
}
