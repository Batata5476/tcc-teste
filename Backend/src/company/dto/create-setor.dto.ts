import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateSetorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  nome: string;
}

