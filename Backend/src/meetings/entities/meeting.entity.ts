import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('reuniao')
export class Meeting {
  @PrimaryGeneratedColumn()
  pk_id_reuniao: number;

  @Column({ type: 'date' })
  data_reuniao: Date;

  @Column({ type: 'time' })
  horario_reuniao: string;

  @Column({ length: 100 })
  assunto_reuniao: string;

  @Column({ type: 'text', nullable: true })
  link_reuniao: string | null;

  @Column({ length: 30 })
  tipo_reuniao: string;

  @Column({ length: 20, default: 'AGENDADA' })
  status_reuniao: string;

  @Column({ nullable: true })
  solicitante_id: number;

  @Column({ type: 'text', nullable: true })
  motivo_recusa: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'solicitante_id' })
  solicitante: User;
}
