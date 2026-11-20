import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivateFirstAccessDto {
  @IsNotEmpty()
  @IsString()
  activation_code: string;

  @IsNotEmpty()
  @IsString()
  token: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  senha: string;
}
