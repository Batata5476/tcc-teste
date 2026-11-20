import { IsInt, Min, Max } from 'class-validator';

export class CreateWellbeingDto {
  @IsInt()
  @Min(1)
  @Max(5)
  humor_func: number;
}
