import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateFirstAccessDto {
  @IsNotEmpty()
  @IsString()
  activation_code: string;

  @IsNotEmpty()
  @IsString()
  token: string;
}
