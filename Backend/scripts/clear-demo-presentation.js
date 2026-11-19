/**
 * Script de Limpeza do Cenário de Apresentação
 * 
 * Limpa as tarefas e reuniões da Empresa (CNPJ 99888777000100 / ID 1),
 * deixando o Dashboard 100% limpo e vazio para iniciar do zero.
 */

const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Client } = require('pg');

if (!process.env.DB_PASSWORD) {
  console.error('Configure DB_PASSWORD em Backend/.env antes de executar o script de limpeza.');
  process.exit(1);
}

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || 'COOPERA',
};

async function run() {
  const client = new Client(DB_CONFIG);
  await client.connect();

  console.log(' Conectado ao banco de dados COOPERA.');

  try {
    const empRes = await client.query("SELECT id, nome, cnpj FROM empresa WHERE cnpj = '99888777000100' OR id = 1 LIMIT 1;");
    if (empRes.rows.length === 0) {
      throw new Error('Empresa de teste (ID 1) não encontrada.');
    }
    const empresaId = empRes.rows[0].id;

    console.log(` Limpando todas as tarefas e reuniões da Empresa #${empresaId} (${empRes.rows[0].nome})...`);

    // Remove relações e tarefas/reuniões
    await client.query("DELETE FROM func_tarefa WHERE fk_cod_empresa = $1;", [empresaId]);
    await client.query("DELETE FROM tarefas WHERE pk_id_tarefas NOT IN (SELECT fk_id_tarefa FROM func_tarefa);");
    await client.query("DELETE FROM participantes_reu WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = $1);", [empresaId]);
    await client.query("DELETE FROM reuniao WHERE solicitante_id IN (SELECT id FROM usuario WHERE empresa_id = $1) OR pk_id_reuniao NOT IN (SELECT fk_id_reuniao FROM participantes_reu);", [empresaId]);

    console.log('✅ Dashboard da empresa limpo com sucesso! Nenhuma tarefa ou reunião ativa.');
  } catch (err) {
    console.error('❌ Erro ao limpar tarefas/reuniões:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
