import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable } from 'typeorm';
import { Permission } from './permission.entity';

@Entity('role')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nome: string;

  @ManyToMany(() => Permission, { cascade: true })
  @JoinTable({
    name: 'role_permissao',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissao_id', referencedColumnName: 'id' },
  })
  permissions: Permission[];
}
