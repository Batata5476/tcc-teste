import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateTaskPayloadDto {
  @IsString()
  tipo_tarefa: string;

  @IsString()
  validade_tarefa: string;

  @IsNumber()
  prioridade_tarefa: number;

  @IsNumber()
  @IsOptional()
  fk_id_func?: number;
}
