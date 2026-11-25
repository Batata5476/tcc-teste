import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Company } from './entities/company.entity';
import { Setor } from './entities/setor.entity';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { ROLES } from '../auth/authorization.constants';

const DEFAULT_COMPANY_SECTORS = [
  'Geral',
  'Administrativo',
  'Operações',
  'Tecnologia',
  'Recursos Humanos',
  'Comercial',
];

const DEMO_PASSWORD_HASH = '$2b$10$yDsJtBW57nfV1JX3UbVNRugjfXBnbmViR2TIG1aFbgJ2XwUiZhSfW'; // Teste@123

function formatIsoDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
    @InjectRepository(Setor)
    private setorRepository: Repository<Setor>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private dataSource: DataSource,
  ) {}

  private validatePasswordPolicy(password: string) {
    const minLength = Boolean(password && password.length >= 8);
    const hasUpper = /[A-Z]/.test(password || '');
    const hasLower = /[a-z]/.test(password || '');
    const hasNumber = /[0-9]/.test(password || '');
    const hasSymbol = /[^A-Za-z0-9]/.test(password || '');

    if (!minLength || !hasUpper || !hasLower || !hasNumber || !hasSymbol) {
      throw new BadRequestException(
        'A senha deve conter no mínimo 8 caracteres, incluindo uma letra maiúscula, uma minúscula, um número e um caractere especial.',
      );
    }
  }

  async findSectors(empresaId: number) {
    let sectors = await this.setorRepository.find({
      where: { empresa_id: empresaId },
      order: { id: 'ASC' },
    });

    if (sectors.length === 0) {
      const defaults = DEFAULT_COMPANY_SECTORS.map((nome) =>
        this.setorRepository.create({ empresa_id: empresaId, nome }),
      );
      sectors = await this.setorRepository.save(defaults);
    }

    return {
      status: 'success',
      data: sectors,
    };
  }

  async createSector(empresaId: number, nome: string) {
    const cleanName = (nome || '').trim();
    if (!cleanName) {
      throw new BadRequestException('O nome do setor é obrigatório.');
    }

    const existing = await this.setorRepository.findOne({
      where: { empresa_id: empresaId, nome: cleanName },
    });
    if (existing) {
      return {
        status: 'success',
        message: 'Setor já existente',
        data: existing,
      };
    }

    const saved = await this.setorRepository.save(
      this.setorRepository.create({ empresa_id: empresaId, nome: cleanName }),
    );
    return {
      status: 'success',
      message: 'Setor criado com sucesso',
      data: saved,
    };
  }

  private pointsTableReady = false;

  private async ensurePointsConfigTable(): Promise<void> {
    if (this.pointsTableReady) return;
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS empresa_config_pontos (
        empresa_id INT PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
        pontos_ativos BOOLEAN NOT NULL DEFAULT TRUE,
        atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.pointsTableReady = true;
  }

  async getPointsSettings(empresaId: number) {
    await this.ensurePointsConfigTable();
    const rows = await this.dataSource.query(
      `SELECT pontos_ativos FROM empresa_config_pontos WHERE empresa_id = $1 LIMIT 1`,
      [empresaId],
    );
    const pointsEnabled = rows && rows.length > 0 ? Boolean(rows[0].pontos_ativos) : true;
    return {
      status: 'success',
      data: { pointsEnabled },
    };
  }

  async updatePointsSettings(empresaId: number, pointsEnabled: boolean) {
    await this.ensurePointsConfigTable();
    await this.dataSource.query(
      `INSERT INTO empresa_config_pontos (empresa_id, pontos_ativos, atualizado_em)
       VALUES ($1, $2, NOW())
       ON CONFLICT (empresa_id)
       DO UPDATE SET pontos_ativos = EXCLUDED.pontos_ativos, atualizado_em = NOW()`,
      [empresaId, Boolean(pointsEnabled)],
    );
    return {
      status: 'success',
      message: pointsEnabled
        ? 'Sistema de pontos ativado com sucesso'
        : 'Sistema de pontos desativado com sucesso',
      data: { pointsEnabled: Boolean(pointsEnabled) },
    };
  }

  async applyPresentationPreset(empresaId: number, adminUserId: number) {
    await this.ensurePointsConfigTable();

    const company = await this.companyRepository.findOne({ where: { id: empresaId } });
    if (!company) {
      throw new NotFoundException('Empresa não encontrada');
    }

    // Garante coordenadas padrão caso a empresa ainda não tenha GPS salvo
    const lat = company.latitude !== null && company.latitude !== undefined ? Number(company.latitude) : -23.55052;
    const lng = company.longitude !== null && company.longitude !== undefined ? Number(company.longitude) : -46.633308;
    if (company.latitude === null || company.latitude === undefined || company.longitude === null || company.longitude === undefined) {
      await this.companyRepository.update(empresaId, { latitude: lat, longitude: lng });
    }

    await this.updatePointsSettings(empresaId, true);

    const funcRole = await this.roleRepository.findOne({ where: { nome: ROLES.EMPLOYEE } });
    const roleFuncId = funcRole?.id ?? null;

    // Garante setores essenciais
    const requiredSectors = ['Geral', 'Recursos Humanos', 'Desenvolvimento', 'Marketing', 'Vendas'];
    const sectorMap = new Map<string, number>();
    for (const secName of requiredSectors) {
      const res = await this.createSector(empresaId, secName);
      sectorMap.set(secName, res.data.id);
    }

    // Helper para criar ou reutilizar colaborador de demonstração sem conflito de e-mail/CPF entre empresas
    const ensureDemoUser = async (spec: {
      idx: number;
      nome: string;
      baseEmail: string;
      baseCpf: number;
      cargo: string;
      setor: string;
      pontos: number;
      telefone: string;
    }): Promise<number> => {
      const existingByBase = await this.userRepository.findOne({
        where: { email: spec.baseEmail },
      });

      if (existingByBase && existingByBase.empresa_id === empresaId) {
        await this.userRepository.update(existingByBase.id, {
          status: 'ACTIVE',
          primeiro_acesso: false,
          cargo: spec.cargo,
          setor_id: sectorMap.get(spec.setor) ?? existingByBase.setor_id,
          pontos_acumulados: spec.pontos,
          telefone: spec.telefone,
        });
        return existingByBase.id;
      }

      const scopedEmail = existingByBase
        ? spec.baseEmail.replace('@', `.emp${empresaId}@`)
        : spec.baseEmail;
      const existingScoped = await this.userRepository.findOne({
        where: { email: scopedEmail },
      });

      if (existingScoped && existingScoped.empresa_id === empresaId) {
        await this.userRepository.update(existingScoped.id, {
          status: 'ACTIVE',
          primeiro_acesso: false,
          cargo: spec.cargo,
          setor_id: sectorMap.get(spec.setor) ?? existingScoped.setor_id,
          pontos_acumulados: spec.pontos,
          telefone: spec.telefone,
        });
        return existingScoped.id;
      }

      const cpfCandidate = existingByBase
        ? String(31000000000 + empresaId * 100 + spec.idx)
        : String(spec.baseCpf);

      const created = this.userRepository.create({
        empresa_id: empresaId,
        role_id: roleFuncId,
        setor_id: sectorMap.get(spec.setor) ?? null,
        nome: spec.nome,
        email: scopedEmail,
        cpf: cpfCandidate,
        senha: DEMO_PASSWORD_HASH,
        cargo: spec.cargo,
        status: 'ACTIVE',
        primeiro_acesso: false,
        pontos_acumulados: spec.pontos,
        telefone: spec.telefone,
      });
      const saved = await this.userRepository.save(created);
      return saved.id;
    };

    // Verifica se já existe um colaborador principal na empresa (ex.: Funcionario Teste)
    const existingCompanyEmployees = await this.userRepository.find({
      where: { empresa_id: empresaId },
      order: { id: 'ASC' },
    });
    const nonAdminExisting = existingCompanyEmployees.find(
      (u) => u.id !== adminUserId && u.status !== 'DELETED',
    );

    let mainFuncId: number;
    if (nonAdminExisting) {
      await this.userRepository.update(nonAdminExisting.id, {
        status: 'ACTIVE',
        primeiro_acesso: false,
        pontos_acumulados: 300,
      });
      mainFuncId = nonAdminExisting.id;
    } else {
      mainFuncId = await ensureDemoUser({
        idx: 0,
        nome: 'Funcionario Teste',
        baseEmail: 'funcionario@teste.com',
        baseCpf: 12345678900,
        cargo: 'Analista de Sistemas',
        setor: 'Desenvolvimento',
        pontos: 300,
        telefone: '(11) 99800-1001',
      });
    }

    const marianaId = await ensureDemoUser({
      idx: 1,
      nome: 'Mariana Costa',
      baseEmail: 'mariana.rh@coopera.com',
      baseCpf: 31000000101,
      cargo: 'Especialista de RH',
      setor: 'Recursos Humanos',
      pontos: 500,
      telefone: '(11) 99800-1002',
    });

    const lucasId = await ensureDemoUser({
      idx: 2,
      nome: 'Lucas Almeida',
      baseEmail: 'lucas.dev@coopera.com',
      baseCpf: 31000000102,
      cargo: 'Desenvolvedor Full-Stack',
      setor: 'Desenvolvimento',
      pontos: 400,
      telefone: '(11) 99800-1003',
    });

    const beatrizId = await ensureDemoUser({
      idx: 3,
      nome: 'Beatriz Souza',
      baseEmail: 'beatriz.mkt@coopera.com',
      baseCpf: 31000000103,
      cargo: 'Analista de Comunicação',
      setor: 'Marketing',
      pontos: 200,
      telefone: '(11) 99800-1004',
    });

    const rafaelId = await ensureDemoUser({
      idx: 4,
      nome: 'Rafael Mendes',
      baseEmail: 'rafael.vendas@coopera.com',
      baseCpf: 31000000104,
      cargo: 'Consultor Comercial',
      setor: 'Vendas',
      pontos: 100,
      telefone: '(11) 99800-1005',
    });

    const today = formatIsoDateOffset(0);
    const tomorrow = formatIsoDateOffset(1);
    const yesterday = formatIsoDateOffset(-1);
    const twoDaysAgo = formatIsoDateOffset(-2);

    await this.dataSource.transaction(async (manager) => {
      // Limpa registros anteriores da empresa para permitir recarregar o preset sem duplicar
      await manager.query(
        `DELETE FROM tarefas WHERE pk_id_tarefas IN (SELECT fk_id_tarefa FROM func_tarefa WHERE fk_cod_empresa = $1)`,
        [empresaId],
      );
      await manager.query(
        `DELETE FROM reuniao WHERE pk_id_reuniao IN (
           SELECT mp.fk_id_reuniao FROM participantes_reu mp
           INNER JOIN usuario u ON u.id = mp.fk_id_func
           WHERE u.empresa_id = $1
         ) OR solicitante_id IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
        [empresaId],
      );
      await manager.query(
        `DELETE FROM humor_func WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
        [empresaId],
      );
      await manager.query(
        `DELETE FROM entrada_saida WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
        [empresaId],
      );
      await manager.query(
        `DELETE FROM his_medico WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
        [empresaId],
      );
      await manager.query(`DELETE FROM chats WHERE fk_cod_empresa = $1`, [empresaId]);

      // 1. TAREFAS (títulos <= 30 chars, cobrindo Urgentes, Outras, Pendentes/Atrasadas e Concluídas)
      const tasksSeed = [
        { title: 'Revisar metas da sprint', date: today, priority: 1, status: 3, userId: mainFuncId },
        { title: 'Validar folha de ponto', date: today, priority: 1, status: 2, userId: mainFuncId },
        { title: 'Fechar indicadores de RH', date: today, priority: 1, status: 3, userId: marianaId },
        { title: 'Atualizar guia onboarding', date: today, priority: 2, status: 3, userId: mainFuncId },
        { title: 'Preparar pauta semanal', date: today, priority: 2, status: 2, userId: lucasId },
        { title: 'Apresentar release v2.0', date: tomorrow, priority: 1, status: 3, userId: mainFuncId },
        { title: 'Revisar campanha interna', date: tomorrow, priority: 2, status: 3, userId: beatrizId },
        { title: 'Enviar relatório mensal', date: twoDaysAgo, priority: 1, status: 3, userId: mainFuncId },
        { title: 'Arquivar termos assinados', date: yesterday, priority: 2, status: 3, userId: rafaelId },
        { title: 'Configurar portal Coopera', date: today, priority: 1, status: 1, userId: mainFuncId },
        { title: 'Homologar Ponto-E mobile', date: today, priority: 1, status: 1, userId: lucasId },
        { title: 'Treinamento boas-vindas', date: yesterday, priority: 2, status: 1, userId: marianaId },
        { title: 'Comunicado trimestral', date: yesterday, priority: 2, status: 1, userId: beatrizId },
      ];

      for (const t of tasksSeed) {
        const insertedTask = await manager.query(
          `INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
           VALUES ($1, $2, $3, $4) RETURNING pk_id_tarefas`,
          [t.title, t.date, t.priority, t.status],
        );
        const taskId = insertedTask[0].pk_id_tarefas;
        await manager.query(
          `INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES ($1, $2, $3)`,
          [t.userId, empresaId, taskId],
        );
      }

      // 2. REUNIÕES (PENDENTE, AGENDADA, CONCLUIDA e RECUSADA)
      const meetingsSeed = [
        {
          date: today,
          time: '15:30:00',
          subject: 'Alinhamento de metas da Sprint',
          link: 'https://meet.google.com/landing',
          status: 'PENDENTE',
          requester: mainFuncId,
          reason: null,
          participants: [mainFuncId, adminUserId],
        },
        {
          date: tomorrow,
          time: '10:00:00',
          subject: 'Feedback individual de clima 1:1',
          link: null,
          status: 'PENDENTE',
          requester: marianaId,
          reason: null,
          participants: [marianaId, adminUserId],
        },
        {
          date: today,
          time: '16:30:00',
          subject: 'Reunião Geral de Resultados',
          link: 'https://meet.google.com/landing',
          status: 'AGENDADA',
          requester: adminUserId,
          reason: null,
          participants: [mainFuncId, marianaId, lucasId, beatrizId],
        },
        {
          date: tomorrow,
          time: '09:30:00',
          subject: 'Planejamento Semanal de Equipe',
          link: 'https://meet.google.com/landing',
          status: 'AGENDADA',
          requester: adminUserId,
          reason: null,
          participants: [mainFuncId, lucasId],
        },
        {
          date: yesterday,
          time: '14:00:00',
          subject: 'Kickoff de Implantação Coopera',
          link: 'https://meet.google.com/landing',
          status: 'CONCLUIDA',
          requester: adminUserId,
          reason: null,
          participants: [mainFuncId, marianaId],
        },
        {
          date: today,
          time: '11:00:00',
          subject: 'Alteração emergencial de escala',
          link: null,
          status: 'RECUSADA',
          requester: lucasId,
          reason: 'Conflito de agenda com fechamento',
          participants: [lucasId, mainFuncId],
        },
      ];

      for (const m of meetingsSeed) {
        const insertedMeeting = await manager.query(
          `INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id, motivo_recusa)
           VALUES ($1, $2, $3, $4, 'empresarial', $5, $6, $7) RETURNING pk_id_reuniao`,
          [m.date, m.time, m.subject, m.link, m.status, m.requester, m.reason],
        );
        const meetingId = insertedMeeting[0].pk_id_reuniao;
        const uniqueParts = Array.from(new Set(m.participants));
        for (const pId of uniqueParts) {
          await manager.query(
            `INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES ($1, $2)`,
            [meetingId, pId],
          );
        }
      }

      // 3. HUMOR DA EQUIPE (5 emoções representadas; deixa HOJE livre para o colaborador principal!)
      const moodsSeed = [
        { mood: 5, hoursAgo: 2, userId: marianaId },
        { mood: 5, hoursAgo: 3, userId: lucasId },
        { mood: 4, hoursAgo: 2, userId: beatrizId },
        { mood: 3, hoursAgo: 1, userId: rafaelId },
        { mood: 5, hoursAgo: 26, userId: mainFuncId },
        { mood: 4, hoursAgo: 27, userId: marianaId },
        { mood: 4, hoursAgo: 28, userId: lucasId },
        { mood: 3, hoursAgo: 29, userId: beatrizId },
        { mood: 2, hoursAgo: 50, userId: rafaelId },
        { mood: 5, hoursAgo: 51, userId: mainFuncId },
        { mood: 4, hoursAgo: 52, userId: marianaId },
        { mood: 3, hoursAgo: 74, userId: lucasId },
        { mood: 5, hoursAgo: 75, userId: beatrizId },
        { mood: 1, hoursAgo: 98, userId: rafaelId },
      ];

      for (const h of moodsSeed) {
        const dth = new Date(Date.now() - h.hoursAgo * 3600 * 1000);
        await manager.query(
          `INSERT INTO humor_func (humor_func, dth_humor, fk_id_func) VALUES ($1, $2, $3)`,
          [h.mood, dth, h.userId],
        );
      }

      // 4. PONTO ELETRÔNICO (Histórico recente; deixa HOJE livre no colaborador principal!)
      const workSeed = [
        { entrada: '08:00:00', saida: '17:00:00', date: yesterday, total: '09:00:00', userId: mainFuncId, open: false },
        { entrada: '08:05:00', saida: '17:10:00', date: twoDaysAgo, total: '09:05:00', userId: mainFuncId, open: false },
        { entrada: '08:00:00', saida: '17:00:00', date: yesterday, total: '09:00:00', userId: marianaId, open: false },
        { entrada: '08:10:00', saida: '08:10:00', date: today, total: '00:00:00', userId: marianaId, open: true },
        { entrada: '08:00:00', saida: '17:05:00', date: yesterday, total: '09:05:00', userId: lucasId, open: false },
      ];

      for (const w of workSeed) {
        await manager.query(
          `INSERT INTO entrada_saida (entrada, saida, data_ponto, total_dia, fk_id_func, latitude_registro, longitude_registro, latitude_saida, longitude_saida)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [w.entrada, w.saida, w.date, w.total, w.userId, lat, lng, w.open ? null : lat, w.open ? null : lng],
        );
      }

      // 5. HISTÓRICO MÉDICO E OCORRÊNCIAS
      const medSeed = [
        { atestado: 'ASO Periódico Anual - Apto', ocorrencia: 'Exame periódico ocupacional concluído junto ao RH.', userId: mainFuncId },
        { atestado: 'Declaração de Comparecimento (2h)', ocorrencia: 'Consulta odontológica preventiva comunicada previamente.', userId: marianaId },
        { atestado: null, ocorrencia: 'Atraso pontual (20 min) justificado por interdição na via.', userId: lucasId },
        { atestado: 'Atestado Médico CRM-SP 142890 (1 dia)', ocorrencia: 'Afastamento médico de 1 dia validado pela gestão.', userId: rafaelId },
      ];

      for (const med of medSeed) {
        await manager.query(
          `INSERT INTO his_medico (atestado_func, ocorrencias, fk_id_func) VALUES ($1, $2, $3)`,
          [med.atestado, med.ocorrencia, med.userId],
        );
      }

      // 6. CONVERSAS DO CHAT CORPORATIVO
      const createDemoChat = async (
        userA: number,
        userB: number,
        msgs: { sender: number; text: string; minutesAgo: number }[],
      ) => {
        if (userA === userB) return;
        const chatRes = await manager.query(
          `INSERT INTO chats (tipo_chat, fk_cod_empresa) VALUES ('direct', $1) RETURNING pk_id_chat`,
          [empresaId],
        );
        const chatId = chatRes[0].pk_id_chat;
        await manager.query(
          `INSERT INTO participantes_conversas (fk_id_chat, fk_id_func) VALUES ($1, $2), ($1, $3)`,
          [chatId, userA, userB],
        );
        for (const m of msgs) {
          const sentAt = new Date(Date.now() - m.minutesAgo * 60 * 1000);
          await manager.query(
            `INSERT INTO mensagens (conteudo_mensagens, data_envio, fk_id_chat, fk_id_func)
             VALUES ($1, $2, $3, $4)`,
            [m.text, sentAt, chatId, m.sender],
          );
        }
      };

      await createDemoChat(adminUserId, mainFuncId, [
        { sender: adminUserId, text: 'Bom dia! As prioridades da sprint já estão disponíveis na Central.', minutesAgo: 45 },
        { sender: mainFuncId, text: 'Bom dia! Já iniciei a validação da folha de ponto e solicitei alinhamento às 15h30.', minutesAgo: 30 },
        { sender: adminUserId, text: 'Perfeito! Vou revisar a solicitação na aba de Reuniões.', minutesAgo: 15 },
      ]);

      await createDemoChat(adminUserId, marianaId, [
        { sender: marianaId, text: 'Olá! O índice de bem-estar da equipe subiu para 4.0 nesta semana.', minutesAgo: 120 },
        { sender: adminUserId, text: 'Excelente resultado, Mariana! Vamos destacar esses dados na reunião geral.', minutesAgo: 60 },
      ]);

      await createDemoChat(mainFuncId, marianaId, [
        { sender: marianaId, text: 'Oi! Seu exame periódico (ASO) já consta como validado no histórico médico.', minutesAgo: 180 },
        { sender: mainFuncId, text: 'Muito obrigado pelo retorno rápido, Mariana!', minutesAgo: 130 },
      ]);
    });

    return {
      status: 'success',
      message: 'Preset de apresentação aplicado com sucesso!',
      data: {
        colaboradoresAtivos: 5,
        tarefasCriadas: 13,
        reunioesCriadas: 6,
        registrosHumor: 14,
        conversasChat: 3,
      },
    };
  }

  async findAll(empresaId: number) {
    const companies = await this.companyRepository.find({
      where: { id: empresaId },
    });
    return {
      status: 'success',
      message: 'Empresas listadas com sucesso',
      data: companies,
    };
  }

  async findOne(id: number, empresaId: number) {
    const company = await this.companyRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException(`Empresa com ID ${id} não encontrada`);
    }

    if (company.id !== empresaId) {
      throw new ForbiddenException('Você não tem permissão para acessar esta empresa');
    }

    return {
      status: 'success',
      message: 'Empresa encontrada',
      data: company,
    };
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const { senha_empresa, cnpj, nome, email, tipo_empresa, latitude, longitude } = createCompanyDto;
    this.validatePasswordPolicy(senha_empresa);
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanEmail = email.trim().toLowerCase();

    // Verificar se o CNPJ já está cadastrado
    const existingCnpj = await this.companyRepository.findOne({
      where: { cnpj: cleanCnpj },
    });
    if (existingCnpj) {
      throw new ConflictException('CNPJ já cadastrado');
    }

    // Verificar se o E-mail corporativo já está cadastrado
    const existingEmail = await this.companyRepository.findOne({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      throw new ConflictException('E-mail corporativo já cadastrado');
    }

    const adminRole = await this.roleRepository.findOne({
      where: { nome: ROLES.MASTER_ADMIN },
    });
    if (!adminRole) {
      throw new NotFoundException('Role Administrador Master não encontrada no banco');
    }

    // Transação atômica para criação da empresa, setores padrão e usuário Master
    const result = await this.dataSource.transaction(async (transactionalEntityManager) => {
      // Verificar também se o e-mail já está em uso por algum usuário
      const existingUserEmail = await transactionalEntityManager.findOne(User, {
        where: { email: cleanEmail },
      });
      if (existingUserEmail) {
        throw new ConflictException('Este e-mail já está em uso no sistema');
      }

      const company = transactionalEntityManager.create(Company, {
        cnpj: cleanCnpj,
        nome: nome.trim(),
        email: cleanEmail,
        tipo_empresa: tipo_empresa?.trim() || null,
        latitude,
        longitude,
      });
      const savedCompany = await transactionalEntityManager.save(Company, company);

      const defaultSectors = DEFAULT_COMPANY_SECTORS.map((sectorName) =>
        transactionalEntityManager.create(Setor, {
          empresa_id: savedCompany.id,
          nome: sectorName,
        }),
      );
      const savedSectors = await transactionalEntityManager.save(Setor, defaultSectors);

      const hashedPassword = await bcrypt.hash(senha_empresa, 10);
      const uniqueCpf = String(10000000000 + savedCompany.id);

      const masterUser = transactionalEntityManager.create(User, {
        empresa_id: savedCompany.id,
        role_id: adminRole.id,
        setor_id: savedSectors[0]?.id ?? null,
        nome: `Admin ${savedCompany.nome}`,
        email: savedCompany.email,
        cpf: uniqueCpf,
        senha: hashedPassword,
        status: 'ACTIVE',
        primeiro_acesso: false,
        cargo: ROLES.MASTER_ADMIN,
      });
      await transactionalEntityManager.save(User, masterUser);

      return savedCompany;
    });

    return {
      status: 'success',
      message: 'Empresa e Usuário Master criados com sucesso',
      data: result,
    };
  }

  async update(id: number, updateCompanyDto: UpdateCompanyDto, empresaId: number) {
    await this.findOne(id, empresaId); // Verifica existência e permissão
    const cleanedDto: any = {};
    if (updateCompanyDto.nome !== undefined) cleanedDto.nome = updateCompanyDto.nome.trim();
    if (updateCompanyDto.email !== undefined) cleanedDto.email = updateCompanyDto.email.trim().toLowerCase();
    if (updateCompanyDto.cnpj !== undefined) cleanedDto.cnpj = updateCompanyDto.cnpj.replace(/\D/g, '');
    if (updateCompanyDto.tipo_empresa !== undefined) cleanedDto.tipo_empresa = updateCompanyDto.tipo_empresa.trim();
    // Salva as coordenadas que o administrador capturou presencialmente pelo GPS.
    if (updateCompanyDto.latitude !== undefined) cleanedDto.latitude = updateCompanyDto.latitude;
    if (updateCompanyDto.longitude !== undefined) cleanedDto.longitude = updateCompanyDto.longitude;

    await this.companyRepository.update(id, cleanedDto);
    const updated = await this.findOne(id, empresaId);
    return {
      status: 'success',
      message: 'Empresa atualizada com sucesso',
      data: updated.data,
    };
  }

  async remove(id: number, empresaId: number) {
    const response = await this.findOne(id, empresaId);

    // Soft disable dos usuários associados à empresa antes ou inativação para evitar violar FKs
    await this.userRepository.update({ empresa_id: id }, { status: 'DELETED' });
    await this.companyRepository.remove(response.data as Company);

    return {
      status: 'success',
      message: 'Empresa removida com sucesso',
    };
  }
}
