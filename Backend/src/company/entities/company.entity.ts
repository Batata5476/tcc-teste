import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('empresa')
export class Company {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  cnpj: string;

  @Column()
  nome: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  tipo_empresa: string;

  // Colunas para armazenar latitue e longitude da empresa
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;
}
