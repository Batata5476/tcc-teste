
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Occurrence } from './entities/occurrence.entity';
import { User } from '../users/entities/user.entity';
import { CreateOccurrenceDto } from './dto/create-occurrence.dto';
import { UpdateOccurrenceDto } from './dto/update-occurrence.dto';
import { isAdminRole, isEmployeeRole } from '../auth/authorization.constants';

@Injectable()
export class OccurrencesService {
  constructor(
    @InjectRepository(Occurrence)
    private readonly occurrenceRepository: Repository<Occurrence>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async validateOccurrenceAccess(occurrenceId: number, caller: any): Promise<Occurrence> {
    const callerId = caller.sub;
    const isCompanyAdmin =
      isAdminRole(caller.role);

    const occurrence = await this.occurrenceRepository.findOne({
      where: { pk_id_his_medico: occurrenceId },
    });

    if (!occurrence) {
      throw new NotFoundException(`Registro médico com ID ${occurrenceId} não encontrado`);
    }

if (isEmployeeRole(caller.role)) {
  if (occurrence.fk_id_func !== callerId) {
    throw new ForbiddenException(
      'Você não possui acesso a este registro médico',
    );
  }
} else if (isCompanyAdmin) {
  const employee = await this.userRepository.findOne({
    where: { id: occurrence.fk_id_func },
  });

  if (!employee || employee.empresa_id !== caller.empresa_id) {
    throw new ForbiddenException(
      'Este registro médico não pertence a um funcionário da sua empresa',
    );
  }
} else {
  throw new ForbiddenException(
    'Seu perfil não possui acesso aos registros médicos',
  );
}

return occurrence;
  }
    
  async create(createOccurrenceDto: CreateOccurrenceDto, caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);
    let targetFuncId = caller.sub;

    if (isCompanyAdmin) {
      if (!createOccurrenceDto.fk_id_func) {
        throw new ForbiddenException('Informe o ID do colaborador para lançar a ocorrência');
      }
      const employee = await this.userRepository.findOne({
        where: { id: createOccurrenceDto.fk_id_func },
      });
      if (!employee || employee.empresa_id !== caller.empresa_id) {
        throw new ForbiddenException('Colaborador não pertence à sua empresa');
      }
      targetFuncId = createOccurrenceDto.fk_id_func;
    } else if (!isEmployeeRole(caller.role)) {
      throw new ForbiddenException('Você não possui permissão para registrar ocorrências');
    }

    const occurrence = this.occurrenceRepository.create({
      atestado_func: createOccurrenceDto.atestado_func,
      ocorrencias: createOccurrenceDto.ocorrencias,
      fk_id_func: targetFuncId,
    });

    const saved = await this.occurrenceRepository.save(occurrence);

    return {
      status: 'success',
      message: 'Ocorrência registrada com sucesso',
      data: saved,
    };
  }

    async findAll(caller: any) {
    const callerId = caller.sub;
    const isCompanyAdmin =
      isAdminRole(caller.role);

    if (isEmployeeRole(caller.role)) {
      const occurrences = await this.occurrenceRepository.find({
        where: { fk_id_func: callerId },
        order: { pk_id_his_medico: 'DESC' },
      });

      return {
        status: 'success',
        data: occurrences,
      };

    } else if (isCompanyAdmin) {
      const occurrences = await this.occurrenceRepository
        .createQueryBuilder('occurrence')
        .innerJoin(
          User,
          'user',
          'occurrence.fk_id_func = user.id',
        )
        .where(
          'user.empresa_id = :companyId',
          { companyId: caller.empresa_id },
        )
        .orderBy(
          'occurrence.pk_id_his_medico',
          'DESC',
        )
        .getMany();

      return {
        status: 'success',
        data: occurrences,
      };

    } else {
      throw new ForbiddenException(
        'Seu perfil não possui acesso aos registros médicos',
      );
    }
  }
  
  async findOne(id: number, caller: any) {
    const occurrence = await this.validateOccurrenceAccess(id, caller);
    return {
      status: 'success',
      data: occurrence,
    };
  }

  async update(id: number, updateDto: UpdateOccurrenceDto, caller: any) {
    if (!isEmployeeRole(caller.role) && !isAdminRole(caller.role)) {
      throw new ForbiddenException('Você não possui permissão para atualizar registros médicos');
    }

    const occurrence = await this.validateOccurrenceAccess(id, caller);

    if (updateDto.atestado_func !== undefined) {
      occurrence.atestado_func = updateDto.atestado_func;
    }
    if (updateDto.ocorrencias !== undefined) {
      occurrence.ocorrencias = updateDto.ocorrencias;
    }

    const updated = await this.occurrenceRepository.save(occurrence);

    return {
      status: 'success',
      message: 'Registro médico atualizado com sucesso',
      data: updated,
    };
  }

  async remove(id: number, caller: any) {
    if (!isEmployeeRole(caller.role) && !isAdminRole(caller.role)) {
      throw new ForbiddenException('Você não possui permissão para excluir registros médicos');
    }

    const occurrence = await this.validateOccurrenceAccess(id, caller);

    await this.occurrenceRepository.remove(occurrence);

    return {
      status: 'success',
      message: 'Registro médico removido com sucesso',
    };
  }
}
