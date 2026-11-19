import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { FuncTarefa } from './entities/func-tarefa.entity';
import { User } from '../users/entities/user.entity';
import { isAdminRole, ROLES } from '../auth/authorization.constants';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(FuncTarefa)
    private readonly funcTarefaRepository: Repository<FuncTarefa>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async validateTaskAccess(taskId: number, caller: any): Promise<FuncTarefa> {
    const callerId = caller.sub;
    const isCompanyAdmin =
      isAdminRole(caller.role);

    const relations = await this.funcTarefaRepository.find({
      where: { fk_id_tarefa: taskId },
    });

    if (relations.length === 0) {
      throw new NotFoundException('Tarefa não encontrada');
    }

    if (!isCompanyAdmin) {
      const userRelation = relations.find((r) => r.fk_id_func === callerId);
      if (!userRelation) {
        throw new ForbiddenException('Você não possui acesso a esta tarefa');
      }
      return userRelation;
    } else {
      const companyRelation = relations.find((r) => r.fk_cod_empresa === caller.empresa_id);
      if (!companyRelation) {
        throw new ForbiddenException('Esta tarefa não pertence à sua empresa');
      }
      return companyRelation;
    }
  }

  async create(
    data: {
      tipo_tarefa: string;
      validade_tarefa: Date | string;
      prioridade_tarefa: number;
      fk_id_func?: number;
    },
    caller: any,
  ) {
    const isCompanyAdmin =
      isAdminRole(caller.role);

    const callerId = caller.empresa_id;

    // Se for funcionário, atribui automaticamente a ele mesmo
    if (!isCompanyAdmin) {
      data.fk_id_func = caller.sub;
    }

    if (!data.fk_id_func) {
      throw new BadRequestException('É necessário informar o funcionário (fk_id_func) para atribuir a tarefa');
    }

    // Validar se o funcionário existe e pertence à mesma empresa
    const employee = await this.userRepository.findOne({
      where: { id: data.fk_id_func },
    });

    if (!employee) {
      throw new NotFoundException('Funcionário não encontrado');
    }

    if (employee.empresa_id !== callerId) {
      throw new ForbiddenException('Este funcionário não pertence à sua empresa');
    }

    // 1. Cria a tarefa
    // Normaliza a data: trata string YYYY-MM-DD como data LOCAL para evitar
    // conversão UTC que deslocaria o dia (ex: '2026-08-30' → 29T03:00Z em UTC-3)
    let validadeNormalizada: string;
    if (typeof data.validade_tarefa === 'string') {
      const match = data.validade_tarefa.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) {
        validadeNormalizada = match[1];
      } else {
        const d = new Date(data.validade_tarefa);
        validadeNormalizada = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
    } else {
      const d = new Date(data.validade_tarefa);
      validadeNormalizada = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }

    const task = this.taskRepository.create({
      tipo_tarefa: data.tipo_tarefa,
      validade_tarefa: validadeNormalizada,
      prioridade_tarefa: data.prioridade_tarefa,
      status_tarefa: 3, // 3 = Pendente por padrão
    });

    const savedTask = await this.taskRepository.save(task);

    // 2. Cria a associação em func_tarefa
    const funcTarefa = this.funcTarefaRepository.create({
      fk_id_func: data.fk_id_func,
      fk_cod_empresa: callerId,
      fk_id_tarefa: savedTask.pk_id_tarefas,
    });

    await this.funcTarefaRepository.save(funcTarefa);

    return {
      status: 'success',
      message: 'Tarefa criada e atribuída com sucesso',
      data: savedTask,
    };
  }

  async findAllByEmployee(caller: any) {
    let associations: FuncTarefa[];
    if (caller.role === ROLES.MASTER_ADMIN) {
      associations = await this.funcTarefaRepository.find({
        where: { fk_cod_empresa: caller.empresa_id },
        relations: ['tarefa'],
      });
    } else {
      associations = await this.funcTarefaRepository.find({
        where: { fk_id_func: caller.sub },
        relations: ['tarefa'],
      });
    }

    const tasks = associations
      .filter((assoc) => assoc.tarefa !== null)
      .map((assoc) => {
        const rawDate: any = assoc.tarefa.validade_tarefa;
        let dueDateStr: string;
        if (rawDate) {
          if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
            dueDateStr = rawDate.split('T')[0];
          } else {
            const d = new Date(rawDate);
            // pg driver converte tipo DATE do Postgres para Date JS meianoite UTC (00:00:00.000Z).
            // Usar getUTCFullYear/getUTCMonth/getUTCDate preserva exatamente o dia gravado no banco sem subtrair fuso local.
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            dueDateStr = `${year}-${month}-${day}`;
          }
        } else {
          dueDateStr = '';
        }

        return {
          id: assoc.tarefa.pk_id_tarefas,
          name: assoc.tarefa.tipo_tarefa,
          points: '100',
          priority: assoc.tarefa.prioridade_tarefa,
          status: assoc.tarefa.status_tarefa,
          dueDate: dueDateStr,
        };
      });

    return {
      status: 'success',
      data: tasks,
    };
  }

  // Busca as associações de tarefas e funcionários filtrando pelo ID da empresa  
    async findAllByCompany(companyId: number) {
    const associations = await this.funcTarefaRepository.find({
      where: { fk_cod_empresa: companyId },
      relations: ['tarefa', 'funcionario'],
    });
    
    // // Filtra as associações válidas e mapeia os dados da tarefa formatados
    const tasks = associations
      .filter((assoc) => assoc.tarefa !== null)
      .map((assoc) => {
        const rawDate = assoc.tarefa.validade_tarefa;
        let dueDateStr: string;
        if (rawDate) {
          const d = new Date(rawDate);
          const localYear = d.getUTCFullYear();
          const localMonth = String(d.getUTCMonth() + 1).padStart(2, '0');
          const localDay = String(d.getUTCDate()).padStart(2, '0');
          dueDateStr = `${localYear}-${localMonth}-${localDay}`;
        } else {
          dueDateStr = '';
        }
        
        // Retorna os dados resumidos da tarefa e o nome do funcionário associado
        return {
          id: assoc.tarefa.pk_id_tarefas,
          name: assoc.tarefa.tipo_tarefa,
          employeeName: assoc.funcionario ? assoc.funcionario.nome : 'Funcionário',
          points: '100',
          priority: assoc.tarefa.prioridade_tarefa,
          status: assoc.tarefa.status_tarefa,
          dueDate: dueDateStr,
        };
      });

    return {
      status: 'success',
      data: tasks,
    };
  }

  async updateStatus(taskId: number, status: number, caller: any) {
    await this.validateTaskAccess(taskId, caller);

    const task = await this.taskRepository.findOne({
      where: { pk_id_tarefas: taskId },
    });

    if (!task) {
      throw new NotFoundException(`Tarefa com ID ${taskId} não encontrada`);
    }

    const isCompanyAdmin =
      isAdminRole(caller.role);

    // Regras de transição de status
    // Funcionários: 3→2, 2→1, 3→1 (conclusão direta permitida)
    // Empresa: qualquer transição exceto re-abrir (1→3)
    if (!isCompanyAdmin) {
      const currentStatus = task.status_tarefa;
      const isAllowed =
        (currentStatus === 3 && (status === 2 || status === 1)) || // Pendente -> Em andamento ou Concluída
        (currentStatus === 2 && status === 1);                      // Em andamento -> Concluída

      if (!isAllowed) {
        throw new ForbiddenException(
          `Transição de status inválida (de ${currentStatus} para ${status})`,
        );
      }
    } else {
      // Empresa pode mudar qualquer status menos re-abrir (1→3)
      if (task.status_tarefa === 1 && status === 3) {
        throw new ForbiddenException('Não é possível reabrir uma tarefa já concluída');
      }
    }

    const previousStatus = task.status_tarefa;
    task.status_tarefa = status;
    const updated = await this.taskRepository.save(task);

    // Se o novo status for 1 (Concluída) e antes não era 1, incrementa 100 pontos para o usuário atribuído
    if (status === 1 && previousStatus !== 1) {
      const relation = await this.funcTarefaRepository.findOne({
        where: { fk_id_tarefa: taskId },
      });
      if (relation && relation.fk_id_func) {
        await this.userRepository.increment(
          { id: relation.fk_id_func },
          'pontos_acumulados',
          100,
        );
      }
    }

    return {
      status: 'success',
      message: 'Status da tarefa atualizado com sucesso',
      data: updated,
    };
  }

  async findOneUser(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`Funcionário com ID ${userId} não encontrado`);
    }
    return user;
  }

  async findOne(id: number, caller: any) {
    await this.validateTaskAccess(id, caller);

    const task = await this.taskRepository.findOne({
      where: { pk_id_tarefas: id },
    });
    if (!task) {
      throw new NotFoundException(`Tarefa com ID ${id} não encontrada`);
    }
    return {
      status: 'success',
      data: task,
    };
  }

  async remove(id: number, caller: any) {
    const isCompanyAdmin =
      isAdminRole(caller.role);

    if (!isCompanyAdmin) {
      throw new ForbiddenException('Apenas empresas podem excluir tarefas');
    }

    await this.validateTaskAccess(id, caller);

    const task = await this.taskRepository.findOne({
      where: { pk_id_tarefas: id },
    });
    if (!task) {
      throw new NotFoundException(`Tarefa com ID ${id} não encontrada`);
    }
    await this.taskRepository.remove(task);
    return {
      status: 'success',
      message: 'Tarefa removida com sucesso',
    };
  }
}
