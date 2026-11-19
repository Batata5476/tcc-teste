import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { User } from '../users/entities/user.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { UpdateMeetingStatusDto } from './dto/update-meeting-status.dto';
import { isAdminRole } from '../auth/authorization.constants';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private readonly meetingRepository: Repository<Meeting>,
    @InjectRepository(MeetingParticipant)
    private readonly meetingParticipantRepository: Repository<MeetingParticipant>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  private async validateMeetingAccess(meetingId: number, caller: any): Promise<Meeting> {
    const callerId = caller.sub;
    const isCompanyAdmin = isAdminRole(caller.role);

    const meeting = await this.meetingRepository.findOne({
      where: { pk_id_reuniao: meetingId },
      relations: ['solicitante'],
    });

    if (!meeting) {
      throw new NotFoundException('Reunião não encontrada');
    }

    const relations = await this.meetingParticipantRepository.find({
      where: { fk_id_reuniao: meetingId },
      relations: ['funcionario'],
    });

    if (!isCompanyAdmin) {
      const isParticipant = relations.some((r) => r.fk_id_func === callerId);
      const isRequester = meeting.solicitante_id === callerId;
      if (!isParticipant && !isRequester) {
        throw new ForbiddenException('Você não possui acesso a esta reunião');
      }
    } else {
      const belongsToCompany =
        (meeting.solicitante && meeting.solicitante.empresa_id === caller.empresa_id) ||
        relations.some((r) => r.funcionario && r.funcionario.empresa_id === caller.empresa_id);

      if (!belongsToCompany) {
        throw new ForbiddenException('Esta reunião não pertence à sua empresa');
      }
    }

    return meeting;
  }

  private async validateParticipantsBelongToCompany(
    participantIds: number[],
    companyId: number,
  ): Promise<number[]> {
    const uniqueParticipantIds = [...new Set(participantIds)];

    if (uniqueParticipantIds.length === 0) {
      return [];
    }

    const participants = await this.userRepository.find({
      where: { id: In(uniqueParticipantIds) },
    });

    if (participants.length !== uniqueParticipantIds.length) {
      const foundIds = new Set(participants.map((p) => p.id));
      const missingId = uniqueParticipantIds.find((id) => !foundIds.has(id));
      throw new NotFoundException(`Funcionário convidado com ID ${missingId} não encontrado`);
    }

    const externalParticipant = participants.find((p) => p.empresa_id !== companyId);
    if (externalParticipant) {
      throw new ForbiddenException(
        `O funcionário ${externalParticipant.nome} (ID: ${externalParticipant.id}) pertence a outra empresa`,
      );
    }

    return uniqueParticipantIds;
  }

  // ─── Solicitar Reunião (Funcionário ou Empresa) ────────────────────────────
  async requestMeeting(createDto: CreateMeetingDto, caller: any) {
    const callerId = caller.sub;
    const companyId = caller.empresa_id;

    const requestedParticipants = createDto.participants || [];
    let participantIds = await this.validateParticipantsBelongToCompany(
      requestedParticipants,
      companyId,
    );

    // Garante que o solicitante esteja na lista de participantes
    if (!participantIds.includes(callerId)) {
      participantIds.push(callerId);
    }

    const savedMeeting = await this.dataSource.transaction(async (manager) => {
      const meeting = manager.create(Meeting, {
        data_reuniao: new Date(createDto.data_reuniao),
        horario_reuniao: createDto.horario_reuniao,
        assunto_reuniao: createDto.assunto_reuniao,
        link_reuniao: createDto.link_reuniao || null,
        tipo_reuniao: createDto.tipo_reuniao,
        status_reuniao: 'PENDENTE',
        solicitante_id: callerId,
      });

      const meetingResult = await manager.save(Meeting, meeting);

      const relations = participantIds.map((participantId) =>
        manager.create(MeetingParticipant, {
          fk_id_reuniao: meetingResult.pk_id_reuniao,
          fk_id_func: participantId,
        }),
      );
      await manager.save(MeetingParticipant, relations);

      return meetingResult;
    });

    return {
      status: 'success',
      message: 'Solicitação de reunião enviada com sucesso',
      data: savedMeeting,
    };
  }

  // ─── Criar Reunião Administrativa (Apenas Empresa) ────────────────────────
  async create(createMeetingDto: CreateMeetingDto, caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Apenas empresas podem agendar reuniões diretamente');
    }

    const rawParticipants = createMeetingDto.participants || [];
    if (rawParticipants.length === 0) {
      throw new BadRequestException('A reunião deve possuir ao menos um participante convidado');
    }

    const participantIds = await this.validateParticipantsBelongToCompany(
      rawParticipants,
      caller.empresa_id,
    );

    const savedMeeting = await this.dataSource.transaction(async (manager) => {
      const meeting = manager.create(Meeting, {
        data_reuniao: new Date(createMeetingDto.data_reuniao),
        horario_reuniao: createMeetingDto.horario_reuniao,
        assunto_reuniao: createMeetingDto.assunto_reuniao,
        link_reuniao: createMeetingDto.link_reuniao || null,
        tipo_reuniao: createMeetingDto.tipo_reuniao,
        status_reuniao: 'AGENDADA',
        solicitante_id: caller.sub,
      });

      const meetingResult = await manager.save(Meeting, meeting);

      const relations = participantIds.map((participantId) =>
        manager.create(MeetingParticipant, {
          fk_id_reuniao: meetingResult.pk_id_reuniao,
          fk_id_func: participantId,
        }),
      );
      await manager.save(MeetingParticipant, relations);

      return meetingResult;
    });

    return {
      status: 'success',
      message: 'Reunião agendada com sucesso',
      data: savedMeeting,
    };
  }

  // ─── Atualizar Status (Aceitar, Recusar, Cancelar) ──────────────────────────
  async updateStatus(id: number, updateStatusDto: UpdateMeetingStatusDto, caller: any) {
    const meeting = await this.validateMeetingAccess(id, caller);
    const isCompanyAdmin = isAdminRole(caller.role);
    const isRequester = meeting.solicitante_id === caller.sub;

    const newStatus = updateStatusDto.status_reuniao;

    // Se for funcionário que não é admin
    if (!isCompanyAdmin && newStatus === 'CANCELADA') {
      if (!isRequester) {
        throw new ForbiddenException('Apenas o solicitante da reunião pode alterar seu status');
      }
    } else if (newStatus === 'CONCLUIDA') {
      if (meeting.status_reuniao !== 'AGENDADA') {
        throw new BadRequestException('Apenas reuniões agendadas podem ser concluídas');
      }

      if (!isCompanyAdmin) {
        const isParticipant = await this.meetingParticipantRepository.findOne({
          where: { fk_id_reuniao: id, fk_id_func: caller.sub },
        });
        if (!isParticipant) {
          throw new ForbiddenException('Apenas participantes podem concluir esta reunião');
        }
      }
    } else if (!isCompanyAdmin) {
      throw new ForbiddenException('Funcionários só podem cancelar suas solicitações ou concluir reuniões das quais participam');
    }

    meeting.status_reuniao = newStatus;
    if (newStatus === 'RECUSADA' && updateStatusDto.motivo_recusa) {
      meeting.motivo_recusa = updateStatusDto.motivo_recusa;
    }

    const updated = await this.meetingRepository.save(meeting);

    return {
      status: 'success',
      message: `Status da reunião alterado para ${newStatus}`,
      data: updated,
    };
  }

  // ─── Listar Reuniões ───────────────────────────────────────────────────────
  async findAll(caller: any) {
    const callerId = caller.sub;
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      const participantRelations = await this.meetingParticipantRepository.find({
        where: { fk_id_func: callerId },
        relations: ['reuniao', 'reuniao.solicitante'],
      });

      const requestedMeetings = await this.meetingRepository.find({
        where: { solicitante_id: callerId },
        relations: ['solicitante'],
      });

      const allMeetingsMap = new Map<number, Meeting>();
      participantRelations.forEach((r) => {
        if (r.reuniao) allMeetingsMap.set(r.reuniao.pk_id_reuniao, r.reuniao);
      });
      requestedMeetings.forEach((m) => {
        allMeetingsMap.set(m.pk_id_reuniao, m);
      });

      const result = Array.from(allMeetingsMap.values()).sort(
        (a, b) => new Date(b.data_reuniao).getTime() - new Date(a.data_reuniao).getTime(),
      );

      return {
        status: 'success',
        data: result,
      };
    } else {
      const meetings = await this.meetingRepository.createQueryBuilder('meeting')
        .leftJoinAndSelect('meeting.solicitante', 'solicitante')
        .innerJoin(MeetingParticipant, 'mp', 'mp.fk_id_reuniao = meeting.pk_id_reuniao')
        .innerJoin(User, 'user', 'mp.fk_id_func = user.id')
        .where('user.empresa_id = :companyId', { companyId: caller.empresa_id })
        .orderBy('meeting.data_reuniao', 'DESC')
        .getMany();

      const uniqueMeetings: Meeting[] = [];
      const seenIds = new Set<number>();
      for (const m of meetings) {
        if (!seenIds.has(m.pk_id_reuniao)) {
          seenIds.add(m.pk_id_reuniao);
          uniqueMeetings.push(m);
        }
      }

      return {
        status: 'success',
        data: uniqueMeetings,
      };
    }
  }

  // ─── Detalhes da Reunião com Participantes ──────────────────────────────────
  async findOne(id: number, caller: any) {
    const meeting = await this.validateMeetingAccess(id, caller);
    const participants = await this.meetingParticipantRepository.find({
      where: { fk_id_reuniao: id },
      relations: ['funcionario'],
    });

    const formattedParticipants = participants.map((p) => ({
      id: p.funcionario ? p.funcionario.id : p.fk_id_func,
      nome: p.funcionario ? p.funcionario.nome : 'Usuário',
      email: p.funcionario ? p.funcionario.email : '',
    }));

    return {
      status: 'success',
      data: {
        ...meeting,
        participants: formattedParticipants,
      },
    };
  }

  async update(id: number, updateDto: UpdateMeetingDto, caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Apenas empresas podem atualizar reuniões');
    }

    const meeting = await this.validateMeetingAccess(id, caller);

    if (updateDto.data_reuniao !== undefined) {
      meeting.data_reuniao = new Date(updateDto.data_reuniao);
    }
    if (updateDto.horario_reuniao !== undefined) {
      meeting.horario_reuniao = updateDto.horario_reuniao;
    }
    if (updateDto.assunto_reuniao !== undefined) {
      meeting.assunto_reuniao = updateDto.assunto_reuniao;
    }
    if (updateDto.link_reuniao !== undefined) {
      meeting.link_reuniao = updateDto.link_reuniao || null;
    }
    if (updateDto.tipo_reuniao !== undefined) {
      meeting.tipo_reuniao = updateDto.tipo_reuniao;
    }

    if (updateDto.participants !== undefined) {
      const participantIds = await this.validateParticipantsBelongToCompany(
        updateDto.participants,
        caller.empresa_id,
      );

      const updated = await this.dataSource.transaction(async (manager) => {
        await manager.delete(MeetingParticipant, { fk_id_reuniao: id });

        const relations = participantIds.map((participantId) =>
          manager.create(MeetingParticipant, {
            fk_id_reuniao: id,
            fk_id_func: participantId,
          }),
        );
        await manager.save(MeetingParticipant, relations);

        return manager.save(Meeting, meeting);
      });

      return {
        status: 'success',
        message: 'Reunião atualizada com sucesso',
        data: updated,
      };
    }

    const updated = await this.meetingRepository.save(meeting);

    return {
      status: 'success',
      message: 'Reunião atualizada com sucesso',
      data: updated,
    };
  }

  async remove(id: number, caller: any) {
    const isCompanyAdmin = isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Apenas empresas podem excluir reuniões');
    }

    const meeting = await this.validateMeetingAccess(id, caller);
    await this.meetingRepository.remove(meeting);

    return {
      status: 'success',
      message: 'Reunião excluída com sucesso',
    };
  }
}
