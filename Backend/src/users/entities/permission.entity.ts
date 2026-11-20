import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('permissao')
export class Permission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nome: string;

  @Column({ nullable: true })
  descricao: string;

  @ManyToMany(() => User, (user) => user.permissions)
  usuarios?: User[];
}
