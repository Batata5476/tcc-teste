import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasksService } from './tasks.service';
import { Task } from './entities/task.entity';
import { FuncTarefa } from './entities/func-tarefa.entity';
import { User } from '../users/entities/user.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ROLES } from '../auth/authorization.constants';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: any;
  let funcTarefaRepository: any;
  let userRepository: any;

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
    taskRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve({ pk_id_tarefas: 100, ...entity })),
      findOne: jest.fn(),
    };

    funcTarefaRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn((entity) => Promise.resolve(entity)),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: taskRepository,
        },
        {
          provide: getRepositoryToken(FuncTarefa),
          useValue: funcTarefaRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if assigned employee does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          {
            tipo_tarefa: 'Test Task',
            validade_tarefa: '2026-10-01',
            prioridade_tarefa: 1,
            fk_id_func: 999,
          },
          mockCallerAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if assigned employee belongs to another company', async () => {
      userRepository.findOne.mockResolvedValue({ id: 999, empresa_id: 99 });

      await expect(
        service.create(
          {
            tipo_tarefa: 'Test Task',
            validade_tarefa: '2026-10-01',
            prioridade_tarefa: 1,
            fk_id_func: 999,
          },
          mockCallerAdmin,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully create a task for a valid employee', async () => {
      userRepository.findOne.mockResolvedValue({ id: 10, empresa_id: 1, nome: 'João' });

      const response = await service.create(
        {
          tipo_tarefa: 'Nova Tarefa',
          validade_tarefa: '2026-10-01',
          prioridade_tarefa: 1,
          fk_id_func: 10,
        },
        mockCallerAdmin,
      );

      expect(taskRepository.save).toHaveBeenCalled();
      expect(funcTarefaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fk_id_func: 10,
          fk_cod_empresa: 1,
          fk_id_tarefa: 100,
        }),
      );
      expect(response.status).toBe('success');
      expect(response.data.tipo_tarefa).toBe('Nova Tarefa');
    });

    it('should assign task to caller automatically when created by an employee', async () => {
      userRepository.findOne.mockResolvedValue({ id: 10, empresa_id: 1, nome: 'João' });

      const response = await service.create(
        {
          tipo_tarefa: 'Tarefa Pessoal',
          validade_tarefa: '2026-10-05',
          prioridade_tarefa: 2,
        },
        mockCallerUser,
      );

      expect(funcTarefaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          fk_id_func: 10,
          fk_cod_empresa: 1,
        }),
      );
      expect(response.status).toBe('success');
    });
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      funcTarefaRepository.find.mockResolvedValue([]);

      await expect(service.updateStatus(999, 1, mockCallerUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own task', async () => {
      funcTarefaRepository.find.mockResolvedValue([
        { fk_id_tarefa: 1, fk_id_func: 99, fk_cod_empresa: 1, status_tarefa: 3 },
      ]);

      await expect(service.updateStatus(1, 1, mockCallerUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should update status successfully and award +100 points when completed', async () => {
      taskRepository.findOne.mockResolvedValue({ pk_id_tarefas: 1, status_tarefa: 3 });
      const relation = {
        fk_id_tarefa: 1,
        fk_id_func: 10,
        fk_cod_empresa: 1,
        status_tarefa: 3,
      };
      funcTarefaRepository.find.mockResolvedValue([relation]);
      funcTarefaRepository.findOne.mockResolvedValue(relation);

      const response = await service.updateStatus(1, 1, mockCallerUser);
      expect(response.status).toBe('success');
      expect(response.data.status_tarefa).toBe(1);
      expect(userRepository.increment).toHaveBeenCalledWith(
        { id: 10 },
        'pontos_acumulados',
        100,
      );
    });
  });
});
