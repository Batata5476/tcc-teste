import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Chat } from './chat.entity';

@Entity('participantes_conversas')
export class ChatParticipant {
  @PrimaryGeneratedColumn()
  pk_id_participantes_conversa: number;

  @Column()
  fk_id_chat: number;

  @Column()
  fk_id_func: number;

  @ManyToOne(() => Chat)
  @JoinColumn({ name: 'fk_id_chat' })
  chat: Chat;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'fk_id_func' })
  funcionario: User;
}
