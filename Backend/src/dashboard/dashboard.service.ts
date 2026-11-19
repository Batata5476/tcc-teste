import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { Humor } from '../wellbeing/entities/humor.entity';
import { FuncTarefa } from '../tasks/entities/func-tarefa.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(Humor)
    private humorRepository: Repository<Humor>,
    @InjectRepository(FuncTarefa)
    private funcTarefaRepository: Repository<FuncTarefa>,
  ) {}

  async getUserDashboard(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['setor', 'role'],
    });

    if (!user) {
      throw new NotFoundException(`Funcionário com ID ${userId} não encontrado`);
    }

    // Conta tarefas associadas a este funcionário que estão pendentes (status = 3 ou 2)
    const associations = await this.funcTarefaRepository.find({
      where: { fk_id_func: userId },
      relations: ['tarefa'],
    });

    const pendingTasksCount = associations.filter(
      (assoc) =>
        assoc.tarefa &&
        (assoc.tarefa.status_tarefa === 3 || assoc.tarefa.status_tarefa === 2),
    ).length;

    const completedTasksCount = associations.filter(
      (assoc) => assoc.tarefa && assoc.tarefa.status_tarefa === 1,
    ).length;

    return {
      status: 'success',
      data: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cpf: user.cpf,
        telefone: user.telefone || null,
        cargo: user.cargo || null,
        role: user.role ? user.role.nome : null,
        setor: user.setor ? user.setor.nome : null,
        pontos: user.pontos_acumulados || 0,
        foto: user.foto_func || user.foto || null,
        tarefasPendentes: pendingTasksCount,
        tarefasConcluidas: completedTasksCount,
      },
    };
  }

  async getCompanyDashboard(companyId: number) {
    const companyUsers = await this.userRepository.find({
      where: { empresa_id: companyId },
      select: ['id'],
    });

    const totalFuncionarios = companyUsers.length;
    const userIds = companyUsers.map((u) => u.id);

    // Contar tarefas ligadas à empresa através de FuncTarefa
    const companyTaskAssocs = await this.funcTarefaRepository.find({
      where: { fk_cod_empresa: companyId },
      relations: ['tarefa'],
    });

    // Remover duplicatas de tarefas
    const uniqueTasksMap = new Map<number, Task>();
    companyTaskAssocs.forEach((assoc) => {
      if (assoc.tarefa) {
        uniqueTasksMap.set(assoc.tarefa.pk_id_tarefas, assoc.tarefa);
      }
    });

    const companyTasks = Array.from(uniqueTasksMap.values());
    const totalTarefas = companyTasks.length;
    const tarefasPendentes = companyTasks.filter(
      (t) => t.status_tarefa === 3 || t.status_tarefa === 2,
    ).length;
    const tarefasConcluidas = companyTasks.filter(
      (t) => t.status_tarefa === 1,
    ).length;

    // Humor filtrado pelos usuários da empresa
    let humorMedio = '0.0';
    let totalHumores = 0;
    let ultimoHumor: Humor | null = null;

    if (userIds.length > 0) {
      const humorMedioRaw = await this.humorRepository
        .createQueryBuilder('humor')
        .select('AVG(humor.humor_func)', 'media')
        .where('humor.fk_id_func IN (:...userIds)', { userIds })
        .getRawOne();

      humorMedio = Number(humorMedioRaw?.media || 0).toFixed(1);

      totalHumores = await this.humorRepository
        .createQueryBuilder('humor')
        .where('humor.fk_id_func IN (:...userIds)', { userIds })
        .getCount();

      ultimoHumor = await this.humorRepository
        .createQueryBuilder('humor')
        .where('humor.fk_id_func IN (:...userIds)', { userIds })
        .orderBy('humor.dth_humor', 'DESC')
        .getOne();
    }

    return {
      status: 'success',
      data: {
        totalFuncionarios,
        totalTarefas,
        tarefasPendentes,
        tarefasConcluidas,
        humor: {
          media: humorMedio,
          totalRegistros: totalHumores,
          ultimoRegistro: ultimoHumor,
        },
      },
    };
  }

  // Contabiliza os registros de humor por emoção (apenas totais agregados, sem dados pessoais)
  async getCompanyEmotionStats(companyId: number) {
    const rows: { humor: number | string; total: number | string }[] =
      await this.humorRepository
        .createQueryBuilder('humor')
        .innerJoin(User, 'user', 'humor.fk_id_func = user.id')
        .select('humor.humor_func', 'humor')
        .addSelect('COUNT(*)', 'total')
        .where('user.empresa_id = :companyId', { companyId })
        .groupBy('humor.humor_func')
        .getRawMany();

    const counts = rows.map((row) => ({
      humor: Number(row.humor),
      total: Number(row.total),
    }));

    return {
      status: 'success',
      data: {
        totalRegistros: counts.reduce((acc, c) => acc + c.total, 0),
        porEmocao: counts,
      },
    };
  }
}
