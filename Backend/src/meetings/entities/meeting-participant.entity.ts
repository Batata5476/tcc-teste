import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Meeting } from './meeting.entity';

@Entity('participantes_reu')
export class MeetingParticipant {
  @PrimaryGeneratedColumn()
  pk_id_participantes_reu: number;

  @Column()
  fk_id_reuniao: number;

  @Column()
  fk_id_func: number;

  @ManyToOne(() => Meeting, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fk_id_reuniao' })
  reuniao: Meeting;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fk_id_func' })
  funcionario: User;
}
