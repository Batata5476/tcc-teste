import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateWorkDto } from './dto/create-work.dto';
import { UpdateWorkDto } from './dto/update-work.dto';
import { Work } from './entities/work.entity';
import { User } from '../users/entities/user.entity';
import { Company } from '../company/entities/company.entity';
import { isAdminRole, isEmployeeRole, ROLES } from '../auth/authorization.constants';
import { isPointWithinRadius } from 'geolib';

// Distância máxima entre a posição do funcionário e a localização cadastrada da empresa.
const MAX_WORK_DISTANCE_METERS = 50;

@Injectable()
export class WorkService {
  constructor(
    @InjectRepository(Work)
    private readonly workRepository: Repository<Work>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  private async validateWorkAccess(workId: number, caller: any): Promise<Work> {
    const callerId = caller.sub;
    const isCompanyAdmin = isAdminRole(caller.role);

    const work = await this.workRepository.findOne({
      where: { pk_id_ponto: workId },
    });

    if (!work) {
      throw new NotFoundException(`Registro de ponto com ID ${workId} nao encontrado`);
    }

    if (!isCompanyAdmin) {
      if (work.fk_id_func !== callerId) {
        throw new ForbiddenException('Voce nao possui acesso a este registro de ponto');
      }
    } else {
      const employee = await this.userRepository.findOne({
        where: { id: work.fk_id_func },
      });

      if (!employee || employee.empresa_id !== caller.empresa_id) {
        throw new ForbiddenException('Este registro de ponto nao pertence a um funcionario da sua empresa');
      }
    }

    return work;
  }

  async findAll(caller: any) {
    const callerId = caller.sub;
    const isCompanyMaster = caller.role === ROLES.MASTER_ADMIN;

    if (!isCompanyMaster) {
      const registros = await this.workRepository.find({
        where: { fk_id_func: callerId },
        order: { data_ponto: 'DESC', entrada: 'DESC' },
      });

      return {
        status: 'success',
        data: registros,
      };
    } else {
      const registros = await this.workRepository.createQueryBuilder('work')
        .innerJoin(User, 'user', 'work.fk_id_func = user.id')
        .where('user.empresa_id = :companyId', { companyId: caller.empresa_id })
        .orderBy('work.data_ponto', 'DESC')
        .addOrderBy('work.entrada', 'DESC')
        .getMany();

      return {
        status: 'success',
        data: registros,
      };
    }
  }

  async findOne(id: number, caller: any) {
    const work = await this.validateWorkAccess(id, caller);

    return {
      status: 'success',
      data: work,
    };
  }

  private calculateTotalDia(entrada?: string, saida?: string): string {
    if (!entrada || !saida) return '00:00:00';
    const [h1, m1, s1 = 0] = entrada.split(':').map(Number);
    const [h2, m2, s2 = 0] = saida.split(':').map(Number);

    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return '00:00:00';

    const startSec = h1 * 3600 + m1 * 60 + Number(s1);
    const endSec = h2 * 3600 + m2 * 60 + Number(s2);

    let diffSec = endSec - startSec;
    if (diffSec < 0) diffSec += 24 * 3600; // Virada de dia

    const hours = Math.floor(diffSec / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }

  private async validateCompanyLocation(employeeId: number, latitude: number, longitude: number) {
    // Busca a empresa do funcionário para comparar as duas posições.
    const employee = await this.userRepository.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Funcionario nao encontrado');
    }

    const company = await this.companyRepository.findOne({
      where: { id: employee.empresa_id },
    });
    if (!company || company.latitude === null || company.latitude === undefined || company.longitude === null || company.longitude === undefined) {
      throw new BadRequestException('A localizacao da empresa ainda nao foi configurada');
    }

    // O banco pode devolver coordenadas NUMERIC como texto; converte antes da comparação em metros.
    const withinCompanyRadius = isPointWithinRadius(
      { latitude, longitude },
      {
        latitude: Number(company.latitude),
        longitude: Number(company.longitude),
      },
      MAX_WORK_DISTANCE_METERS,
    );

    if (!withinCompanyRadius) {
      throw new ForbiddenException(`Registro de ponto permitido somente a ate ${MAX_WORK_DISTANCE_METERS} metros da empresa`);
    }
  }

  async create(createWorkDto: CreateWorkDto, caller: any) {
    if (caller.role === ROLES.MASTER_ADMIN) {
      throw new ForbiddenException(`Apenas colaboradores podem criar registros de ponto (perfil recebido: ${caller.role ?? 'nao informado'})`);
    }

    const callerId = caller.sub;
    const existingWork = await this.workRepository.findOne({
      where: { fk_id_func: callerId, data_ponto: new Date(createWorkDto.data_ponto) },
    });
    if (existingWork) {
      throw new ConflictException('Ja existe um registro de ponto para este dia');
    }

    // Bloqueia a gravação se a entrada foi registrada fora do raio da empresa.
    await this.validateCompanyLocation(callerId, createWorkDto.latitude, createWorkDto.longitude);

    const totalDia = this.calculateTotalDia(createWorkDto.entrada, createWorkDto.saida);

    const work = this.workRepository.create({
      entrada: createWorkDto.entrada,
      saida: createWorkDto.saida,
      data_ponto: new Date(createWorkDto.data_ponto),
      total_dia: totalDia,
      fk_id_func: callerId,
      // Guarda no registro a posição em que a entrada foi feita.
      latitude_registro: createWorkDto.latitude,
      longitude_registro: createWorkDto.longitude,
    });

    const saved = await this.workRepository.save(work);

    return {
      status: 'success',
      message: 'Registro de ponto criado com sucesso',
      data: saved,
    };
  }

  async update(id: number, updateDto: UpdateWorkDto, caller: any) {
    if (caller.role === ROLES.MASTER_ADMIN) {
      throw new ForbiddenException(`Apenas colaboradores podem atualizar seus registros de ponto (perfil recebido: ${caller.role ?? 'nao informado'})`);
    }

    const work = await this.validateWorkAccess(id, caller);
    if (work.fk_id_func !== caller.sub) {
      throw new ForbiddenException('Voce so pode atualizar seus proprios registros de ponto');
    }

    if (updateDto.saida !== undefined) {
      // Para registrar a saída, exige e valida novamente a posição atual do funcionário.
      if (updateDto.latitude === undefined || updateDto.longitude === undefined) {
        throw new BadRequestException('A localizacao atual e obrigatoria para registrar a saida');
      }
      await this.validateCompanyLocation(caller.sub, updateDto.latitude, updateDto.longitude);
      // Mantém separadas as coordenadas da entrada e da saída.
      work.latitude_saida = updateDto.latitude;
      work.longitude_saida = updateDto.longitude;
    }

    if (updateDto.entrada !== undefined) {
      work.entrada = updateDto.entrada;
    }
    if (updateDto.saida !== undefined) {
      work.saida = updateDto.saida;
    }
    if (updateDto.data_ponto !== undefined) {
      work.data_ponto = new Date(updateDto.data_ponto);
    }

    work.total_dia = this.calculateTotalDia(work.entrada, work.saida);

    const updated = await this.workRepository.save(work);

    return {
      status: 'success',
      message: 'Registro de ponto atualizado com sucesso',
      data: updated,
    };
  }

  async remove(id: number, caller: any) {
    if (caller.role === ROLES.MASTER_ADMIN) {
      throw new ForbiddenException(`Apenas colaboradores podem excluir seus registros de ponto (perfil recebido: ${caller.role ?? 'nao informado'})`);
    }

    const work = await this.validateWorkAccess(id, caller);
    if (work.fk_id_func !== caller.sub) {
      throw new ForbiddenException('Voce so pode excluir seus proprios registros de ponto');
    }

    await this.workRepository.remove(work);

    return {
      status: 'success',
      message: 'Registro de ponto removido com sucesso',
    };
  }
}
