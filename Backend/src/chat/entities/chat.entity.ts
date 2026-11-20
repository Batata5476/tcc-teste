import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn()
  pk_id_chat: number;

  @Column({ length: 8 })
  tipo_chat: string;

  @Column()
  fk_cod_empresa: number;
}
