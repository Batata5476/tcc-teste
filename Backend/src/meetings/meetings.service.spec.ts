import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MeetingsService } from './meetings.service';
import { Meeting } from './entities/meeting.entity';
import { MeetingParticipant } from './entities/meeting-participant.entity';
import { User } from '../users/entities/user.entity';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ROLES } from '../auth/authorization.constants';

describe('MeetingsService', () => {
  let service: MeetingsService;
  let meetingRepository: any;
  let meetingParticipantRepository: any;
  let userRepository: any;
  let dataSource: any;

  const mockCallerUser = {
    sub: 10,
    empresa_id: 1,
    role: ROLES.EMPLOYEE,
  };

  const mockCallerAdmin = {
    sub: 1,
    empresa_id: 1,
    role: ROLES.ADMIN,
  };

  beforeEach(async () => {
    meetingRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ pk_id_reuniao: 50, ...entity })),
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    meetingParticipantRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn((cb) =>
        cb({
          create: jest.fn((entityClass, dto) => dto),
          save: jest.fn((entityClass, entity) =>
            Promise.resolve(Array.isArray(entity) ? entity : { pk_id_reuniao: 50, ...entity }),
          ),
          delete: jest.fn(),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingsService,
        {
          provide: getRepositoryToken(Meeting),
          useValue: meetingRepository,
        },
        {
          provide: getRepositoryToken(MeetingParticipant),
          useValue: meetingParticipantRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<MeetingsService>(MeetingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestMeeting', () => {
    it('should create a meeting request with status PENDENTE', async () => {
      userRepository.find.mockResolvedValue([
        { id: 10, empresa_id: 1, nome: 'João' },
      ]);

      const result = await service.requestMeeting(
        {
          data_reuniao: '2026-11-10',
          horario_reuniao: '14:00',
          assunto_reuniao: 'Alinhamento de Projeto',
          tipo_reuniao: 'Alinhamento',
        },
        mockCallerUser,
      );

      expect(result.status).toBe('success');
      expect(result.data.status_reuniao).toBe('PENDENTE');
      expect(result.data.solicitante_id).toBe(10);
    });

    it('should throw ForbiddenException if invited participant belongs to another company', async () => {
      userRepository.find.mockResolvedValue([
        { id: 99, empresa_id: 99, nome: 'Maria' },
      ]);

      await expect(
        service.requestMeeting(
          {
            data_reuniao: '2026-11-10',
            horario_reuniao: '14:00',
            assunto_reuniao: 'Reunião Externa',
            tipo_reuniao: 'Geral',
            participants: [99],
          },
          mockCallerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create (admin creation)', () => {
    it('should throw ForbiddenException if user is not company admin', async () => {
      await expect(
        service.create(
          {
            data_reuniao: '2026-11-10',
            horario_reuniao: '14:00',
            assunto_reuniao: 'Reunião Geral',
            tipo_reuniao: 'Geral',
            participants: [10],
          },
          mockCallerUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no participants provided by admin', async () => {
      await expect(
        service.create(
          {
            data_reuniao: '2026-11-10',
            horario_reuniao: '14:00',
            assunto_reuniao: 'Reunião Geral',
            tipo_reuniao: 'Geral',
            participants: [],
          },
          mockCallerAdmin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create an admin meeting with status AGENDADA', async () => {
      userRepository.find.mockResolvedValue([
        { id: 10, empresa_id: 1, nome: 'João' },
      ]);

      const result = await service.create(
        {
          data_reuniao: '2026-11-10',
          horario_reuniao: '14:00',
          assunto_reuniao: 'Reunião Diretoria',
          tipo_reuniao: 'Geral',
          participants: [10],
        },
        mockCallerAdmin,
      );

      expect(result.status).toBe('success');
      expect(result.data.status_reuniao).toBe('AGENDADA');
    });
  });

  describe('updateStatus', () => {
    it('should allow admin to change status to AGENDADA or RECUSADA', async () => {
      const mockMeeting = {
        pk_id_reuniao: 50,
        solicitante_id: 10,
        status_reuniao: 'PENDENTE',
        solicitante: { empresa_id: 1 },
      };
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingParticipantRepository.find.mockResolvedValue([
        { fk_id_func: 10, funcionario: { empresa_id: 1 } },
      ]);
      meetingRepository.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.updateStatus(
        50,
        { status_reuniao: 'AGENDADA' },
        mockCallerAdmin,
      );

      expect(result.status).toBe('success');
      expect(result.data.status_reuniao).toBe('AGENDADA');
    });

    it('should allow employee to cancel their own requested meeting', async () => {
      const mockMeeting = {
        pk_id_reuniao: 50,
        solicitante_id: 10,
        status_reuniao: 'PENDENTE',
        solicitante: { empresa_id: 1 },
      };
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingParticipantRepository.find.mockResolvedValue([]);
      meetingRepository.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.updateStatus(
        50,
        { status_reuniao: 'CANCELADA' },
        mockCallerUser,
      );

      expect(result.status).toBe('success');
      expect(result.data.status_reuniao).toBe('CANCELADA');
    });

    it('should allow a participant to complete an agendada meeting', async () => {
      const mockMeeting = {
        pk_id_reuniao: 50,
        solicitante_id: 1,
        status_reuniao: 'AGENDADA',
        solicitante: { empresa_id: 1 },
      };
      meetingRepository.findOne.mockResolvedValue(mockMeeting);
      meetingParticipantRepository.find.mockResolvedValue([
        { fk_id_func: 10, funcionario: { empresa_id: 1 } },
      ]);
      meetingParticipantRepository.findOne.mockResolvedValue({ fk_id_func: 10 });
      meetingRepository.save.mockImplementation((m) => Promise.resolve(m));

      const result = await service.updateStatus(
        50,
        { status_reuniao: 'CONCLUIDA' },
        mockCallerUser,
      );

      expect(result.status).toBe('success');
      expect(result.data.status_reuniao).toBe('CONCLUIDA');
    });

    it('should reject completing a meeting that is not scheduled', async () => {
      meetingRepository.findOne.mockResolvedValue({
        pk_id_reuniao: 50,
        solicitante_id: 10,
        status_reuniao: 'PENDENTE',
        solicitante: { empresa_id: 1 },
      });
      meetingParticipantRepository.find.mockResolvedValue([]);

      await expect(
        service.updateStatus(
          50,
          { status_reuniao: 'CONCLUIDA' },
          mockCallerUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
