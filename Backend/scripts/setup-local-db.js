const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Client } = require('pg');

const requiredVariables = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_DATABASE',
];
const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  console.error(`Configure Backend/.env. Variáveis ausentes: ${missingVariables.join(', ')}`);
  process.exit(1);
}

const migrations = [
  'migration_seed_authorization.sql',
  'migration_add_work_geolocation.sql',
  'migration_add_meeting_fields.sql',
  'migration_add_meeting_link.sql',
  'migration_fix_occurrence_length.sql',
];

async function ensureDatabaseExists() {
  const adminClient = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const targetDb = process.env.DB_DATABASE;
    const existsRes = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE LOWER(datname) = LOWER($1)',
      [targetDb],
    );
    if (existsRes.rowCount === 0) {
      const safeDbName = targetDb.replace(/"/g, '""');
      await adminClient.query(`CREATE DATABASE "${safeDbName}"`);
      console.log(`Banco "${targetDb}" criado automaticamente.`);
    }
  } catch (err) {
    // Prossegue caso não consiga conectar ao banco padrão 'postgres'
  } finally {
    await adminClient.end().catch(() => undefined);
  }
}

async function setupDatabase() {
  await ensureDatabaseExists();

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    await client.query('BEGIN');

    // Verifica se o banco contém o schema legado incompatível (ex: setor com pk_id_setor sem coluna id)
    const legacySetorCheck = await client.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'setor'
        AND column_name = 'pk_id_setor'
    `);
    const officialUsuarioCheck = await client.query(`
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'usuario'
    `);

    if (legacySetorCheck.rowCount > 0 && officialUsuarioCheck.rowCount === 0) {
      console.log('Detectado schema legado (info_empresa / info_funcionario / pk_id_setor). Atualizando para o schema oficial...');
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    }

    const baseSchemaPath = path.join(__dirname, '..', '..', 'BD', 'coopera.sql');
    if (fs.existsSync(baseSchemaPath)) {
      const baseSql = fs.readFileSync(baseSchemaPath, 'utf8');
      await client.query(baseSql);
      console.log('Schema base verificado (BD/coopera.sql).');
    }

    for (const migration of migrations) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'database', migration), 'utf8');
      await client.query(sql);
      console.log(`Aplicada: ${migration}`);
    }

    await client.query('COMMIT');
    console.log('Banco local preparado.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const detail = error?.message || error?.code || String(error);
    console.error(`Falha ao preparar o banco: ${detail}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

setupDatabase();
