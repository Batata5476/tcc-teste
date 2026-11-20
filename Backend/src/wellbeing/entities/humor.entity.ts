import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('humor_func')
export class Humor {
  @PrimaryGeneratedColumn()
  pk_id_humor: number;

  @Column()
  humor_func: number;

  @Column({ type: 'timestamptz' })
  dth_humor: Date;

  @Column()
  fk_id_func: number;
}
