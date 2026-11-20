import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async log(params: {
    usuario_id?: number;
    empresa_id?: number;
    acao: string;
    entidade?: string;
    entidade_id?: number;
    ip?: string;
    user_agent?: string;
    detalhes?: string;
  }) {
    const audit = this.auditRepository.create(params);
    return this.auditRepository.save(audit);
  }
}
