import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Chat } from './chat.entity';

@Entity('mensagens')
export class Message {
  @PrimaryGeneratedColumn()
  pk_id_mensagens: number;

  @Column({ length: 200 })
  conteudo_mensagens: string;

  @Column({ type: 'timestamptz' })
  data_envio: Date;

  @Column()
  fk_id_chat: number;

  @Column()
  fk_id_func: number;

  @Column({ nullable: true })
  fk_id_midia?: number;

  @ManyToOne(() => Chat)
  @JoinColumn({ name: 'fk_id_chat' })
  chat: Chat;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'fk_id_func' })
  funcionario: User;
}
