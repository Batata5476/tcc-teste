import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('his_medico')
export class Occurrence {
  @PrimaryGeneratedColumn()
  pk_id_his_medico: number;

  @Column({ nullable: true })
  atestado_func: string;

  @Column({ length: 255, nullable: true })
  ocorrencias: string;

  @Column()
  fk_id_func: number;
}
