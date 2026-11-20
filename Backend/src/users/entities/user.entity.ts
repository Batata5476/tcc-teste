import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Permission } from './permission.entity';
import { Role } from './role.entity';
import { Setor } from '../../company/entities/setor.entity';

@Entity('usuario')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  empresa_id: number;

  @Column({ nullable: true })
  role_id: number;

  @Column({ nullable: true })
  setor_id: number;

  @Column()
  nome: string;

  @Column({ unique: true })
  email: string;

  /** CPF com NUMERIC(14) no banco — usar sempre como string na aplicação. */
  @Column({ type: 'numeric', precision: 14, scale: 0, unique: true })
  cpf: string;

  @Column({ select: false })
  senha: string;

  @Column({ nullable: true })
  cargo: string;

  // Status: PENDING | ACTIVE | BLOCKED | DISABLED | DELETED
  @Column({ default: 'PENDING' })
  status: string;

  @Column({ default: true })
  primeiro_acesso: boolean;

  @Column({ nullable: true, unique: true, select: false }) // select false para não retornar nenhum código de ativação no backend
  activation_code: string;

  @Column({ nullable: true, select: false })
  token: string;

  @Column({ type: 'timestamptz', nullable: true, select: false }) // Aqui tambem para não retornar a data de expiração do token no backend
  token_expiracao: Date;

  @Column({ default: 0 })
  pontos_acumulados: number;

  @Column({ nullable: true })
  foto_func: string;

  @Column({ nullable: true })
  foto: string;

  @Column({ nullable: true })
  telefone: string;

  // Relations
  @ManyToOne(() => Role, { nullable: true, eager: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Setor, { nullable: true, eager: false })
  @JoinColumn({ name: 'setor_id' })
  setor: Setor;

  @ManyToMany(() => Permission, { cascade: true, eager: false })
  @JoinTable({
    name: 'usuario_permissao',
    joinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissao_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
