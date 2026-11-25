import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface BackupItem {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  formattedDate: string;
}

const dateFormatterBR = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'America/Sao_Paulo',
});

function formatDateBR(value: Date | string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return dateFormatterBR.format(d);
}

function sqlLiteral(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function toIsoDateOnly(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;
  private readonly isServerless: boolean;
  private tableReady = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.backupDir = this.isServerless
      ? path.join('/tmp', 'backups')
      : path.resolve(process.cwd(), '..', 'BD', 'backups');
    if (!this.isServerless) {
      try {
        if (!fs.existsSync(this.backupDir)) {
          fs.mkdirSync(this.backupDir, { recursive: true });
        }
      } catch (err: any) {
        this.logger.warn(`Diretório local de backups não pôde ser criado: ${err?.message}`);
      }
    }
  }

  private async ensureBackupTable(): Promise<void> {
    if (this.tableReady) return;
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS empresa_backups (
        id SERIAL PRIMARY KEY,
        empresa_id INT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
        criado_por INT,
        filename VARCHAR(180) UNIQUE NOT NULL,
        payload JSONB NOT NULL,
        sql_export TEXT NOT NULL,
        size_bytes INT NOT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.tableReady = true;
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private buildSqlScript(empresaId: number, createdAtIso: string, snapshot: any): string {
    const lines: string[] = [
      `-- =============================================================================`,
      `-- BACKUP CORPORATIVO COOPERA - EMPRESA #${empresaId}`,
      `-- Gerado em: ${createdAtIso}`,
      `-- Compatível com PostgreSQL / Supabase`,
      `-- =============================================================================`,
      `BEGIN;`,
      ``,
    ];

    if (snapshot.empresa) {
      const e = snapshot.empresa;
      lines.push(
        `UPDATE empresa SET nome = ${sqlLiteral(e.nome)}, email = ${sqlLiteral(e.email)}, tipo_empresa = ${sqlLiteral(e.tipo_empresa)}, latitude = ${sqlLiteral(e.latitude)}, longitude = ${sqlLiteral(e.longitude)} WHERE id = ${Number(empresaId)};`,
      );
    }

    for (const s of snapshot.setores || []) {
      lines.push(
        `INSERT INTO setor (id, empresa_id, nome) VALUES (${Number(s.id)}, ${Number(empresaId)}, ${sqlLiteral(s.nome)}) ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;`,
      );
    }

    for (const u of snapshot.usuarios || []) {
      lines.push(
        `INSERT INTO usuario (id, empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone) VALUES (${Number(u.id)}, ${Number(empresaId)}, ${sqlLiteral(u.role_id)}, ${sqlLiteral(u.setor_id)}, ${sqlLiteral(u.nome)}, ${sqlLiteral(u.email)}, ${sqlLiteral(u.cpf)}, ${sqlLiteral(u.senha)}, ${sqlLiteral(u.cargo)}, ${sqlLiteral(u.status)}, ${sqlLiteral(u.primeiro_acesso)}, ${Number(u.pontos_acumulados || 0)}, ${sqlLiteral(u.telefone)}) ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, cargo = EXCLUDED.cargo, status = EXCLUDED.status, pontos_acumulados = EXCLUDED.pontos_acumulados;`,
      );
    }

    for (const t of snapshot.tarefas || []) {
      lines.push(
        `-- Tarefa: ${String(t.tipo_tarefa || '').replace(/\r?\n/g, ' ')} (${toIsoDateOnly(t.validade_tarefa)}, status=${t.status_tarefa})`,
      );
    }

    for (const r of snapshot.reunioes || []) {
      lines.push(
        `-- Reunião: ${String(r.assunto_reuniao || '').replace(/\r?\n/g, ' ')} (${toIsoDateOnly(r.data_reuniao)} ${r.horario_reuniao}, status=${r.status_reuniao})`,
      );
    }

    lines.push(``, `COMMIT;`, ``);
    return lines.join('\n');
  }

  // 1. CRIAR BACKUP (100% Nativo via TypeORM/PostgreSQL — funciona na Vercel + Supabase e Local)
  async createBackup(empresaId: number, userId: number): Promise<BackupItem> {
    await this.ensureBackupTable();

    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    const dbName = this.configService.get<string>('DB_DATABASE') || 'COOPERA';
    const filename = `backup_${dbName}_empresa${empresaId}_${timestamp}.sql`;

    this.logger.log(`Iniciando backup nativo da empresa #${empresaId} pelo usuário #${userId}...`);

    try {
      const empresaRows = await this.dataSource.query(
        `SELECT id, cnpj, nome, email, tipo_empresa, latitude, longitude FROM empresa WHERE id = $1 LIMIT 1`,
        [empresaId],
      );
      if (!empresaRows || empresaRows.length === 0) {
        throw new NotFoundException(`Empresa #${empresaId} não encontrada`);
      }

      let pointsEnabled = true;
      try {
        const ptsRows = await this.dataSource.query(
          `SELECT pontos_ativos FROM empresa_config_pontos WHERE empresa_id = $1 LIMIT 1`,
          [empresaId],
        );
        if (ptsRows && ptsRows.length > 0) {
          pointsEnabled = Boolean(ptsRows[0].pontos_ativos);
        }
      } catch {
        pointsEnabled = true;
      }

      const setores = await this.dataSource.query(
        `SELECT id, empresa_id, nome FROM setor WHERE empresa_id = $1 ORDER BY id ASC`,
        [empresaId],
      );

      const usuarios = await this.dataSource.query(
        `SELECT id, empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status,
                primeiro_acesso, activation_code, token, token_expiracao, pontos_acumulados,
                foto_func, foto, telefone
         FROM usuario
         WHERE empresa_id = $1
         ORDER BY id ASC`,
        [empresaId],
      );

      const usuarioPermissoes = await this.dataSource.query(
        `SELECT up.usuario_id, up.permissao_id
         FROM usuario_permissao up
         INNER JOIN usuario u ON u.id = up.usuario_id
         WHERE u.empresa_id = $1`,
        [empresaId],
      );

      const tarefas = await this.dataSource.query(
        `SELECT DISTINCT t.pk_id_tarefas, t.validade_tarefa, t.tipo_tarefa, t.prioridade_tarefa, t.status_tarefa
         FROM tarefas t
         INNER JOIN func_tarefa ft ON ft.fk_id_tarefa = t.pk_id_tarefas
         WHERE ft.fk_cod_empresa = $1
         ORDER BY t.pk_id_tarefas ASC`,
        [empresaId],
      );

      const funcTarefas = await this.dataSource.query(
        `SELECT pk_id_func_tarefa, fk_id_func, fk_cod_empresa, fk_id_tarefa
         FROM func_tarefa
         WHERE fk_cod_empresa = $1
         ORDER BY pk_id_func_tarefa ASC`,
        [empresaId],
      );

      const reunioes = await this.dataSource.query(
        `SELECT DISTINCT r.pk_id_reuniao, r.data_reuniao, r.horario_reuniao, r.assunto_reuniao,
                r.link_reuniao, r.tipo_reuniao, r.status_reuniao, r.solicitante_id, r.motivo_recusa
         FROM reuniao r
         LEFT JOIN participantes_reu pr ON pr.fk_id_reuniao = r.pk_id_reuniao
         LEFT JOIN usuario u1 ON u1.id = pr.fk_id_func
         LEFT JOIN usuario u2 ON u2.id = r.solicitante_id
         WHERE u1.empresa_id = $1 OR u2.empresa_id = $1
         ORDER BY r.pk_id_reuniao ASC`,
        [empresaId],
      );

      const reuniaoIds = reunioes.map((r: any) => Number(r.pk_id_reuniao));
      const participantesReu =
        reuniaoIds.length > 0
          ? await this.dataSource.query(
              `SELECT pk_id_participantes_reu, fk_id_reuniao, fk_id_func
               FROM participantes_reu
               WHERE fk_id_reuniao = ANY($1::int[])
               ORDER BY pk_id_participantes_reu ASC`,
              [reuniaoIds],
            )
          : [];

      const entradasSaidas = await this.dataSource.query(
        `SELECT es.pk_id_ponto, es.entrada, es.saida, es.data_ponto, es.total_dia, es.fk_id_func,
                es.latitude_registro, es.longitude_registro, es.latitude_saida, es.longitude_saida
         FROM entrada_saida es
         INNER JOIN usuario u ON u.id = es.fk_id_func
         WHERE u.empresa_id = $1
         ORDER BY es.pk_id_ponto ASC`,
        [empresaId],
      );

      const humores = await this.dataSource.query(
        `SELECT h.pk_id_humor, h.humor_func, h.dth_humor, h.fk_id_func
         FROM humor_func h
         INNER JOIN usuario u ON u.id = h.fk_id_func
         WHERE u.empresa_id = $1
         ORDER BY h.pk_id_humor ASC`,
        [empresaId],
      );

      const historicoMedico = await this.dataSource.query(
        `SELECT hm.pk_id_his_medico, hm.atestado_func, hm.ocorrencias, hm.fk_id_func
         FROM his_medico hm
         INNER JOIN usuario u ON u.id = hm.fk_id_func
         WHERE u.empresa_id = $1
         ORDER BY hm.pk_id_his_medico ASC`,
        [empresaId],
      );

      const chats = await this.dataSource.query(
        `SELECT pk_id_chat, tipo_chat, fk_cod_empresa
         FROM chats
         WHERE fk_cod_empresa = $1
         ORDER BY pk_id_chat ASC`,
        [empresaId],
      );

      const chatIds = chats.map((c: any) => Number(c.pk_id_chat));
      const participantesConversas =
        chatIds.length > 0
          ? await this.dataSource.query(
              `SELECT pk_id_participantes_conversa, fk_id_chat, fk_id_func
               FROM participantes_conversas
               WHERE fk_id_chat = ANY($1::int[])
               ORDER BY pk_id_participantes_conversa ASC`,
              [chatIds],
            )
          : [];

      const mensagens =
        chatIds.length > 0
          ? await this.dataSource.query(
              `SELECT pk_id_mensagens, conteudo_mensagens, data_envio, fk_id_chat, fk_id_func, fk_id_midia
               FROM mensagens
               WHERE fk_id_chat = ANY($1::int[])
               ORDER BY pk_id_mensagens ASC`,
              [chatIds],
            )
          : [];

      const snapshot = {
        version: 1,
        empresaId,
        createdAt: now.toISOString(),
        pointsEnabled,
        empresa: empresaRows[0],
        setores,
        usuarios,
        usuarioPermissoes,
        tarefas,
        funcTarefas,
        reunioes,
        participantesReu,
        entradasSaidas,
        humores,
        historicoMedico,
        chats,
        participantesConversas,
        mensagens,
      };

      const sqlExport = this.buildSqlScript(empresaId, now.toISOString(), snapshot);
      const serializedJson = JSON.stringify(snapshot);
      const sizeBytes = Buffer.byteLength(serializedJson, 'utf8') + Buffer.byteLength(sqlExport, 'utf8');

      await this.dataSource.query(
        `INSERT INTO empresa_backups (empresa_id, criado_por, filename, payload, sql_export, size_bytes, criado_em)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
        [empresaId, userId, filename, serializedJson, sqlExport, sizeBytes, now],
      );

      // Mantém os 15 backups mais recentes por empresa para otimizar armazenamento
      await this.dataSource.query(
        `DELETE FROM empresa_backups
         WHERE empresa_id = $1
           AND id NOT IN (
             SELECT id FROM empresa_backups
             WHERE empresa_id = $1
             ORDER BY criado_em DESC
             LIMIT 15
           )`,
        [empresaId],
      );

      // Em ambiente local, salva também cópia .sql na pasta BD/backups
      if (!this.isServerless) {
        try {
          if (fs.existsSync(this.backupDir)) {
            fs.writeFileSync(path.join(this.backupDir, filename), sqlExport, 'utf8');
          }
        } catch {
          // Ignora falha de escrita local pois o snapshot já está persistido no PostgreSQL
        }
      }

      const item: BackupItem = {
        filename,
        sizeBytes,
        sizeFormatted: this.formatFileSize(sizeBytes),
        createdAt: now.toISOString(),
        formattedDate: formatDateBR(now),
      };

      this.logger.log(`Backup concluído com sucesso: ${filename} (${item.sizeFormatted})`);
      return item;
    } catch (error: any) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Falha ao gerar backup da empresa #${empresaId}: ${error?.message}`);
      throw new InternalServerErrorException(
        `Não foi possível gerar o backup da empresa: ${error?.message || 'erro interno'}`,
      );
    }
  }

  // 2. LISTAR BACKUPS (isolado por empresa e persistido no PostgreSQL)
  async listBackups(empresaId: number): Promise<BackupItem[]> {
    await this.ensureBackupTable();

    const rows = await this.dataSource.query(
      `SELECT filename, size_bytes, criado_em
       FROM empresa_backups
       WHERE empresa_id = $1
       ORDER BY criado_em DESC`,
      [empresaId],
    );

    return (rows || []).map((row: any) => {
      const sizeBytes = Number(row.size_bytes || 0);
      const createdDate = new Date(row.criado_em);
      return {
        filename: String(row.filename),
        sizeBytes,
        sizeFormatted: this.formatFileSize(sizeBytes),
        createdAt: createdDate.toISOString(),
        formattedDate: formatDateBR(createdDate),
      };
    });
  }

  // 3. RESTAURAR BACKUP (transação atômica isolada por empresa)
  async restoreBackup(
    filename: string,
    empresaId: number,
    userId: number,
  ): Promise<{ message: string; filename: string }> {
    if (!filename || typeof filename !== 'string') {
      throw new BadRequestException('Nome do arquivo de backup não informado.');
    }

    const safeFilename = path.basename(filename);
    if (!safeFilename.endsWith('.sql') || !/^[a-zA-Z0-9._-]+$/.test(safeFilename)) {
      throw new BadRequestException('Nome de arquivo de backup inválido.');
    }

    await this.ensureBackupTable();

    const rows = await this.dataSource.query(
      `SELECT empresa_id, payload FROM empresa_backups WHERE filename = $1 LIMIT 1`,
      [safeFilename],
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Backup "${safeFilename}" não encontrado.`);
    }

    if (Number(rows[0].empresa_id) !== Number(empresaId)) {
      throw new ForbiddenException('Este arquivo de backup não pertence à sua empresa.');
    }

    const snapshot =
      typeof rows[0].payload === 'string' ? JSON.parse(rows[0].payload) : rows[0].payload;

    this.logger.warn(
      `RESTAURAÇÃO iniciada pelo usuário #${userId} (empresa #${empresaId}) a partir de: ${safeFilename}`,
    );

    try {
      await this.dataSource.transaction(async (manager) => {
        // 1. Restaura dados cadastrais da empresa e configuração de pontos
        if (snapshot.empresa) {
          const e = snapshot.empresa;
          await manager.query(
            `UPDATE empresa
             SET nome = $1, email = $2, tipo_empresa = $3, latitude = $4, longitude = $5
             WHERE id = $6`,
            [e.nome, e.email, e.tipo_empresa, e.latitude, e.longitude, empresaId],
          );
        }

        await manager.query(`
          CREATE TABLE IF NOT EXISTS empresa_config_pontos (
            empresa_id INT PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
            pontos_ativos BOOLEAN NOT NULL DEFAULT TRUE,
            atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await manager.query(
          `INSERT INTO empresa_config_pontos (empresa_id, pontos_ativos, atualizado_em)
           VALUES ($1, $2, NOW())
           ON CONFLICT (empresa_id)
           DO UPDATE SET pontos_ativos = EXCLUDED.pontos_ativos, atualizado_em = NOW()`,
          [empresaId, snapshot.pointsEnabled !== false],
        );

        // 2. Remove registros operacionais atuais da empresa antes de recriar do snapshot
        await manager.query(`DELETE FROM chats WHERE fk_cod_empresa = $1`, [empresaId]);
        await manager.query(
          `DELETE FROM his_medico WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
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
          `DELETE FROM reuniao WHERE pk_id_reuniao IN (
             SELECT pr.fk_id_reuniao FROM participantes_reu pr
             INNER JOIN usuario u ON u.id = pr.fk_id_func
             WHERE u.empresa_id = $1
           ) OR solicitante_id IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
          [empresaId],
        );
        await manager.query(
          `DELETE FROM tarefas WHERE pk_id_tarefas IN (
             SELECT fk_id_tarefa FROM func_tarefa WHERE fk_cod_empresa = $1
           )`,
          [empresaId],
        );
        await manager.query(
          `DELETE FROM usuario_permissao WHERE usuario_id IN (SELECT id FROM usuario WHERE empresa_id = $1)`,
          [empresaId],
        );

        // 3. Restaura setores e monta mapa de IDs
        const sectorIdMap = new Map<number, number>();
        const snapshotSectorIds: number[] = [];
        for (const s of snapshot.setores || []) {
          const oldId = Number(s.id);
          const existingSec = await manager.query(`SELECT id, empresa_id FROM setor WHERE id = $1`, [oldId]);
          if (!existingSec || existingSec.length === 0) {
            await manager.query(
              `INSERT INTO setor (id, empresa_id, nome) VALUES ($1, $2, $3)`,
              [oldId, empresaId, s.nome],
            );
            sectorIdMap.set(oldId, oldId);
            snapshotSectorIds.push(oldId);
          } else if (Number(existingSec[0].empresa_id) === Number(empresaId)) {
            await manager.query(`UPDATE setor SET nome = $1 WHERE id = $2`, [s.nome, oldId]);
            sectorIdMap.set(oldId, oldId);
            snapshotSectorIds.push(oldId);
          } else {
            const ins = await manager.query(
              `INSERT INTO setor (empresa_id, nome) VALUES ($1, $2) RETURNING id`,
              [empresaId, s.nome],
            );
            const newId = Number(ins[0].id);
            sectorIdMap.set(oldId, newId);
            snapshotSectorIds.push(newId);
          }
        }

        // 4. Restaura usuários da empresa (preservando o usuário admin logado caso necessário)
        const userIdMap = new Map<number, number>();
        const keptUserIds: number[] = [];

        for (const u of snapshot.usuarios || []) {
          const oldUid = Number(u.id);
          const mappedSectorId =
            u.setor_id !== null && u.setor_id !== undefined
              ? (sectorIdMap.get(Number(u.setor_id)) ?? null)
              : null;

          const existingById = await manager.query(
            `SELECT id, empresa_id FROM usuario WHERE id = $1`,
            [oldUid],
          );

          if (existingById && existingById.length > 0 && Number(existingById[0].empresa_id) === Number(empresaId)) {
            await manager.query(
              `UPDATE usuario
               SET role_id = $1, setor_id = $2, nome = $3, email = $4, cpf = $5, senha = $6,
                   cargo = $7, status = $8, primeiro_acesso = $9, activation_code = $10,
                   token = $11, token_expiracao = $12, pontos_acumulados = $13,
                   foto_func = $14, foto = $15, telefone = $16
               WHERE id = $17`,
              [
                u.role_id,
                mappedSectorId,
                u.nome,
                u.email,
                u.cpf,
                u.senha,
                u.cargo,
                u.status,
                Boolean(u.primeiro_acesso),
                u.activation_code ?? null,
                u.token ?? null,
                u.token_expiracao ?? null,
                Number(u.pontos_acumulados || 0),
                u.foto_func ?? null,
                u.foto ?? null,
                u.telefone ?? null,
                oldUid,
              ],
            );
            userIdMap.set(oldUid, oldUid);
            keptUserIds.push(oldUid);
          } else if (!existingById || existingById.length === 0) {
            await manager.query(
              `INSERT INTO usuario (
                 id, empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status,
                 primeiro_acesso, activation_code, token, token_expiracao, pontos_acumulados,
                 foto_func, foto, telefone
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
              [
                oldUid,
                empresaId,
                u.role_id,
                mappedSectorId,
                u.nome,
                u.email,
                u.cpf,
                u.senha,
                u.cargo,
                u.status,
                Boolean(u.primeiro_acesso),
                u.activation_code ?? null,
                u.token ?? null,
                u.token_expiracao ?? null,
                Number(u.pontos_acumulados || 0),
                u.foto_func ?? null,
                u.foto ?? null,
                u.telefone ?? null,
              ],
            );
            userIdMap.set(oldUid, oldUid);
            keptUserIds.push(oldUid);
          }
        }

        // Remove colaboradores criados depois do backup (preservando sempre o admin que disparou a restauração)
        if (!keptUserIds.includes(Number(userId))) {
          keptUserIds.push(Number(userId));
        }
        if (keptUserIds.length > 0) {
          await manager.query(
            `DELETE FROM usuario WHERE empresa_id = $1 AND NOT (id = ANY($2::int[]))`,
            [empresaId, keptUserIds],
          );
        }
        if (snapshotSectorIds.length > 0) {
          await manager.query(
            `DELETE FROM setor WHERE empresa_id = $1 AND NOT (id = ANY($2::int[]))`,
            [empresaId, snapshotSectorIds],
          );
        }

        // 5. Restaura permissões customizadas de usuários
        for (const up of snapshot.usuarioPermissoes || []) {
          const mappedUid = userIdMap.get(Number(up.usuario_id));
          if (mappedUid) {
            await manager.query(
              `INSERT INTO usuario_permissao (usuario_id, permissao_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [mappedUid, Number(up.permissao_id)],
            );
          }
        }

        // 6. Restaura tarefas e vínculos func_tarefa
        const taskIdMap = new Map<number, number>();
        for (const t of snapshot.tarefas || []) {
          const ins = await manager.query(
            `INSERT INTO tarefas (validade_tarefa, tipo_tarefa, prioridade_tarefa, status_tarefa)
             VALUES ($1, $2, $3, $4) RETURNING pk_id_tarefas`,
            [toIsoDateOnly(t.validade_tarefa), t.tipo_tarefa, Number(t.prioridade_tarefa), Number(t.status_tarefa)],
          );
          taskIdMap.set(Number(t.pk_id_tarefas), Number(ins[0].pk_id_tarefas));
        }

        for (const ft of snapshot.funcTarefas || []) {
          const mappedUid = userIdMap.get(Number(ft.fk_id_func));
          const mappedTid = taskIdMap.get(Number(ft.fk_id_tarefa));
          if (mappedUid && mappedTid) {
            await manager.query(
              `INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES ($1, $2, $3)`,
              [mappedUid, empresaId, mappedTid],
            );
          }
        }

        // 7. Restaura reuniões e participantes
        const meetingIdMap = new Map<number, number>();
        for (const r of snapshot.reunioes || []) {
          const mappedRequester =
            r.solicitante_id !== null && r.solicitante_id !== undefined
              ? (userIdMap.get(Number(r.solicitante_id)) ?? null)
              : null;
          const ins = await manager.query(
            `INSERT INTO reuniao (
               data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao,
               tipo_reuniao, status_reuniao, solicitante_id, motivo_recusa
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING pk_id_reuniao`,
            [
              toIsoDateOnly(r.data_reuniao),
              r.horario_reuniao,
              r.assunto_reuniao,
              r.link_reuniao ?? null,
              r.tipo_reuniao,
              r.status_reuniao,
              mappedRequester,
              r.motivo_recusa ?? null,
            ],
          );
          meetingIdMap.set(Number(r.pk_id_reuniao), Number(ins[0].pk_id_reuniao));
        }

        for (const pr of snapshot.participantesReu || []) {
          const mappedMid = meetingIdMap.get(Number(pr.fk_id_reuniao));
          const mappedUid = userIdMap.get(Number(pr.fk_id_func));
          if (mappedMid && mappedUid) {
            await manager.query(
              `INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES ($1, $2)`,
              [mappedMid, mappedUid],
            );
          }
        }

        // 8. Restaura registros de ponto, humor e histórico médico
        for (const es of snapshot.entradasSaidas || []) {
          const mappedUid = userIdMap.get(Number(es.fk_id_func));
          if (mappedUid) {
            await manager.query(
              `INSERT INTO entrada_saida (
                 entrada, saida, data_ponto, total_dia, fk_id_func,
                 latitude_registro, longitude_registro, latitude_saida, longitude_saida
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
              [
                es.entrada,
                es.saida,
                toIsoDateOnly(es.data_ponto),
                es.total_dia,
                mappedUid,
                es.latitude_registro ?? null,
                es.longitude_registro ?? null,
                es.latitude_saida ?? null,
                es.longitude_saida ?? null,
              ],
            );
          }
        }

        for (const h of snapshot.humores || []) {
          const mappedUid = userIdMap.get(Number(h.fk_id_func));
          if (mappedUid) {
            await manager.query(
              `INSERT INTO humor_func (humor_func, dth_humor, fk_id_func) VALUES ($1, $2, $3)`,
              [Number(h.humor_func), new Date(h.dth_humor), mappedUid],
            );
          }
        }

        for (const hm of snapshot.historicoMedico || []) {
          const mappedUid = userIdMap.get(Number(hm.fk_id_func));
          if (mappedUid) {
            await manager.query(
              `INSERT INTO his_medico (atestado_func, ocorrencias, fk_id_func) VALUES ($1, $2, $3)`,
              [hm.atestado_func ?? null, hm.ocorrencias ?? null, mappedUid],
            );
          }
        }

        // 9. Restaura chats, participantes e mensagens
        const chatIdMap = new Map<number, number>();
        for (const c of snapshot.chats || []) {
          const ins = await manager.query(
            `INSERT INTO chats (tipo_chat, fk_cod_empresa) VALUES ($1, $2) RETURNING pk_id_chat`,
            [c.tipo_chat, empresaId],
          );
          chatIdMap.set(Number(c.pk_id_chat), Number(ins[0].pk_id_chat));
        }

        for (const pc of snapshot.participantesConversas || []) {
          const mappedCid = chatIdMap.get(Number(pc.fk_id_chat));
          const mappedUid = userIdMap.get(Number(pc.fk_id_func));
          if (mappedCid && mappedUid) {
            await manager.query(
              `INSERT INTO participantes_conversas (fk_id_chat, fk_id_func) VALUES ($1, $2)`,
              [mappedCid, mappedUid],
            );
          }
        }

        for (const m of snapshot.mensagens || []) {
          const mappedCid = chatIdMap.get(Number(m.fk_id_chat));
          const mappedUid = userIdMap.get(Number(m.fk_id_func));
          if (mappedCid && mappedUid) {
            await manager.query(
              `INSERT INTO mensagens (conteudo_mensagens, data_envio, fk_id_chat, fk_id_func, fk_id_midia)
               VALUES ($1, $2, $3, $4, $5)`,
              [m.conteudo_mensagens, new Date(m.data_envio), mappedCid, mappedUid, m.fk_id_midia ?? null],
            );
          }
        }

        // 10. Realinha sequences principais após restauração de IDs explícitos
        await manager.query(
          `SELECT setval(pg_get_serial_sequence('setor', 'id'), COALESCE((SELECT MAX(id) FROM setor), 1), true)`,
        );
        await manager.query(
          `SELECT setval(pg_get_serial_sequence('usuario', 'id'), COALESCE((SELECT MAX(id) FROM usuario), 1), true)`,
        );
      });

      this.logger.log(`Restauração concluída com sucesso para a empresa #${empresaId}: ${safeFilename}`);
      return {
        message: 'Backup restaurado com sucesso no banco de dados!',
        filename: safeFilename,
      };
    } catch (error: any) {
      this.logger.error(`Falha ao restaurar backup (${safeFilename}): ${error?.message}`);
      throw new InternalServerErrorException(
        `Erro ao restaurar backup: ${error?.message || 'falha interna'}`,
      );
    }
  }
}
