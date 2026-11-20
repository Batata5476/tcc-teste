import { IsString, IsIn, IsOptional } from 'class-validator';

export class UpdateMeetingStatusDto {
  @IsString()
  @IsIn(['AGENDADA', 'RECUSADA', 'CANCELADA', 'PENDENTE', 'CONCLUIDA'])
  status_reuniao: string;

  @IsString()
  @IsOptional()
  motivo_recusa?: string;
}
