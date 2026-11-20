import { IsInt, IsOptional, IsString, Length } from 'class-validator';

export class CreateMessageDto {
  @IsInt()
  fk_id_chat: number;

  @IsString()
  @Length(1, 200)
  conteudo_mensagens: string;

  @IsInt()
  @IsOptional()
  fk_id_midia?: number;
}
