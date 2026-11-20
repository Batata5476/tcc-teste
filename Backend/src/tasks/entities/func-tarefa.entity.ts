import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Company } from '../../company/entities/company.entity';
import { Task } from './task.entity';

@Entity('func_tarefa')
export class FuncTarefa {
  @PrimaryGeneratedColumn()
  pk_id_func_tarefa: number;

  @Column()
  fk_id_func: number;

  @Column()
  fk_cod_empresa: number;

  @Column()
  fk_id_tarefa: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'fk_id_func' })
  funcionario: User;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'fk_cod_empresa' })
  empresa: Company;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'fk_id_tarefa' })
  tarefa: Task;
}
