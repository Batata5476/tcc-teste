import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tarefas')
export class Task {
  @PrimaryGeneratedColumn()
  pk_id_tarefas: number;

  @Column({
    type: 'date',
    transformer: {
      to: (value: any) => {
        if (!value) return value;
        if (typeof value === 'string') {
          return value.split('T')[0];
        }
        if (value instanceof Date) {
          const year = value.getUTCFullYear();
          const month = String(value.getUTCMonth() + 1).padStart(2, '0');
          const day = String(value.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return value;
      },
      from: (value: any) => {
        if (!value) return value;
        if (typeof value === 'string') {
          return value.split('T')[0];
        }
        if (value instanceof Date) {
          const year = value.getUTCFullYear();
          const month = String(value.getUTCMonth() + 1).padStart(2, '0');
          const day = String(value.getUTCDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return value;
      },
    },
  })
  validade_tarefa: string;

  @Column({ length: 30 })
  tipo_tarefa: string;

  @Column()
  prioridade_tarefa: number;

  @Column()
  status_tarefa: number;
}
