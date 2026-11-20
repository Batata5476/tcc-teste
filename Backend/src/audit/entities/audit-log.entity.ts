import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Company } from '../../company/entities/company.entity';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  usuario_id: number;

  @Column({ nullable: true })
  empresa_id: number;

  @Column()
  acao: string;

  @Column({ nullable: true })
  entidade: string;

  @Column({ nullable: true })
  entidade_id: number;

  @Column({ nullable: true })
  ip: string;

  @Column({ nullable: true })
  user_agent: string;

  @CreateDateColumn({ type: 'timestamptz' })
  data: Date;

  @Column({ type: 'text', nullable: true })
  detalhes: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'usuario_id' })
  usuario: User;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'empresa_id' })
  empresa: Company;
}
