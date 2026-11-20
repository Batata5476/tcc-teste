/**
 * Script de Inicialização do Cenário de Apresentação Oficial do TCC Coopera
 * 
 * Cria as tarefas e reuniões solicitadas vinculadas à Empresa (CNPJ 99888777000100 / ID 1)
 * e ao Funcionário (ID 2):
 *  - 1 Tarefa Urgente (Data: Hoje)
 *  - 1 Tarefa Normal (Data: Hoje)
 *  - 1 Tarefa Pendente / Atrasada (Data: Ontem)
 *  - 1 Reunião Sem Link (Hoje às 14:00, AGENDADA)
 *  - 1 Reunião Com Link do Meet: https://meet.google.com/fxm-njyg-ebm (Hoje às 16:30, AGENDADA)
 *  - 1 Reunião Solicitada por Funcionário para Recusar (Hoje às 10:00, PENDENTE)
 *  - 1 Reunião Solicitada por Funcionário para Aceitar (Hoje às 11:30, PENDENTE)
 * 
 * Em seguida, gera o backup oficial .sql na pasta BD/backups.
 */

const { Client } = require('pg');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

if (!process.env.DB_PASSWORD) {
  console.error('Configure DB_PASSWORD em Backend/.env antes de executar o script de demonstração.');
  process.exit(1);
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'COOPERA',
};

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function run() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  console.log(' Conectado ao banco de dados COOPERA.');

  try {
    // 1. Identifica a empresa e o colaborador
    const empRes = await client.query("SELECT id, nome, cnpj FROM empresa WHERE cnpj = '99888777000100' OR id = 1 LIMIT 1;");
    if (empRes.rows.length === 0) {
      throw new Error('Empresa de teste (ID 1) não encontrada.');
    }
    const empresaId = empRes.rows[0].id;

    const funcRes = await client.query("SELECT id, nome, email FROM usuario WHERE empresa_id = $1 AND role_id != 1 ORDER BY id ASC LIMIT 1;", [empresaId]);
    if (funcRes.rows.length === 0) {
      throw new Error('Funcionário de teste da empresa não encontrado.');
    }
    const funcionarioId = funcRes.rows[0].id;
    console.log(` Configurando para Empresa #${empresaId} (${empRes.rows[0].nome}) e Funcionário #${funcionarioId} (${funcRes.rows[0].nome})...`);

    // 2. Limpa dados anteriores de tarefas e reuniões desta empresa
    console.log(' Limpando tarefas e reuniões anteriores da demonstração...');
    await client.query("DELETE FROM func_tarefa WHERE fk_cod_empresa = $1;", [empresaId]);
    await client.query("DELETE FROM tarefas WHERE pk_id_tarefas NOT IN (SELECT fk_id_tarefa FROM func_tarefa);");
    await client.query("DELETE FROM participantes_reu WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = $1);", [empresaId]);
    await client.query("DELETE FROM reuniao WHERE solicitante_id IN (SELECT id FROM usuario WHERE empresa_id = $1) OR pk_id_reuniao NOT IN (SELECT fk_id_reuniao FROM participantes_reu);", [empresaId]);

    // Datas dinâmicas (Hoje e Ontem)
    const now = new Date();
    const todayStr = formatDate(now);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    console.log(` Datas de referência -> Hoje: ${todayStr} | Ontem: ${yesterdayStr}`);

    // 3. Inserção das Tarefas
    console.log(' Inserindo tarefas de demonstração...');

    // Tarefa 1: Urgente (Hoje, prioridade 1, status 3 = pendente)
    const t1 = await client.query(`
      INSERT INTO tarefas (validade_tarefa, tipo_tarefa, prioridade_tarefa, status_tarefa)
      VALUES ($1, 'Revisão Crítica Contrato', 1, 3)
      RETURNING pk_id_tarefas;
    `, [todayStr]);
    await client.query(`
      INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa)
      VALUES ($1, $2, $3);
    `, [funcionarioId, empresaId, t1.rows[0].pk_id_tarefas]);

    // Tarefa 2: Normal (Hoje, prioridade 2, status 2 = em andamento)
    const t2 = await client.query(`
      INSERT INTO tarefas (validade_tarefa, tipo_tarefa, prioridade_tarefa, status_tarefa)
      VALUES ($1, 'Documentação Técnica', 2, 2)
      RETURNING pk_id_tarefas;
    `, [todayStr]);
    await client.query(`
      INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa)
      VALUES ($1, $2, $3);
    `, [funcionarioId, empresaId, t2.rows[0].pk_id_tarefas]);

    // Tarefa 3: Pendente / Atrasada (Ontem, prioridade 2, status 3 = pendente)
    const t3 = await client.query(`
      INSERT INTO tarefas (validade_tarefa, tipo_tarefa, prioridade_tarefa, status_tarefa)
      VALUES ($1, 'Relatório de Metas Mensal', 2, 3)
      RETURNING pk_id_tarefas;
    `, [yesterdayStr]);
    await client.query(`
      INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa)
      VALUES ($1, $2, $3);
    `, [funcionarioId, empresaId, t3.rows[0].pk_id_tarefas]);

    // 4. Inserção das Reuniões
    console.log(' Inserindo reuniões de demonstração...');

    // Reunião 1: Presencial sem link (Hoje, 14:00, AGENDADA)
    const r1 = await client.query(`
      INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, tipo_reuniao, status_reuniao, solicitante_id, link_reuniao)
      VALUES ($1, '14:00:00', 'Alinhamento Estratégico de Metas Q4', 'Presencial', 'AGENDADA', $2, NULL)
      RETURNING pk_id_reuniao;
    `, [todayStr, funcionarioId]);
    await client.query(`
      INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES ($1, $2);
    `, [r1.rows[0].pk_id_reuniao, funcionarioId]);

    // Reunião 2: Com link do Meet (Hoje, 16:30, AGENDADA)
    const r2 = await client.query(`
      INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, tipo_reuniao, status_reuniao, solicitante_id, link_reuniao)
      VALUES ($1, '16:30:00', 'Apresentação e Validação do TCC com a Diretoria', 'Online', 'AGENDADA', $2, 'https://meet.google.com/fxm-njyg-ebm')
      RETURNING pk_id_reuniao;
    `, [todayStr, funcionarioId]);
    await client.query(`
      INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES ($1, $2);
    `, [r2.rows[0].pk_id_reuniao, funcionarioId]);

    // Reunião 3: Solicitada por funcionário para Recusar/Negar ao vivo (Hoje, 10:00, PENDENTE)
    const r3 = await client.query(`
      INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, tipo_reuniao, status_reuniao, solicitante_id, link_reuniao)
      VALUES ($1, '10:00:00', 'Solicitação: Ajuste de Horário de Treinamento Externo', 'Presencial', 'PENDENTE', $2, NULL)
      RETURNING pk_id_reuniao;
    `, [todayStr, funcionarioId]);
    await client.query(`
      INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES ($1, $2);
    `, [r3.rows[0].pk_id_reuniao, funcionarioId]);

    // Reunião 4: Solicitada por funcionário para Aceitar ao vivo (Hoje, 11:30, PENDENTE)
    const r4 = await client.query(`
      INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, tipo_reuniao, status_reuniao, solicitante_id, link_reuniao)
      VALUES ($1, '11:30:00', 'Solicitação: Feedback Semestral de Desempenho e Metas', 'Online', 'PENDENTE', $2, 'https://meet.google.com/fxm-njyg-ebm')
      RETURNING pk_id_reuniao;
    `, [todayStr, funcionarioId]);
    await client.query(`
      INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES ($1, $2);
    `, [r4.rows[0].pk_id_reuniao, funcionarioId]);

    console.log('✅ Cenário de tarefas e reuniões inserido com sucesso!');

    // 5. Geração do Arquivo de Backup Oficial .sql
    const backupDir = path.resolve(__dirname, '..', '..', 'BD', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, 'backup_COOPERA_empresa1_CENARIO_APRESENTACAO_TCC.sql');

    console.log(' Gerando arquivo de backup oficial para a banca...');
    try {
      let pgDumpCmd = 'pg_dump';
      const baseDir = 'C:\\Program Files\\PostgreSQL';
      if (fs.existsSync(baseDir)) {
        const versions = fs.readdirSync(baseDir).sort((a, b) => Number(b) - Number(a));
        for (const v of versions) {
          const candidate = path.join(baseDir, v, 'bin', 'pg_dump.exe');
          if (fs.existsSync(candidate)) {
            pgDumpCmd = candidate;
            break;
          }
        }
      }

      const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };
      execFileSync(
        pgDumpCmd,
        ['-h', DB_CONFIG.host, '-p', String(DB_CONFIG.port), '-U', DB_CONFIG.user, '--clean', '--if-exists', '-F', 'p', '-b', '-f', backupPath, DB_CONFIG.database],
        { env, stdio: 'pipe' },
      );

      const stats = fs.statSync(backupPath);
      const sizeKb = (stats.size / 1024).toFixed(1);
      console.log(`✅ Backup salvo com sucesso em: BD/backups/backup_COOPERA_empresa1_CENARIO_APRESENTACAO_TCC.sql (${sizeKb} KB)`);
    } catch (dumpErr) {
      console.warn('⚠️ Aviso no pg_dump (mas dados inseridos no banco com sucesso):', dumpErr.message);
    }

  } catch (err) {
    console.error('❌ Erro ao configurar cenário:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
