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

async function setupDatabase() {
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

    for (const migration of migrations) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'database', migration), 'utf8');
      await client.query(sql);
      console.log(`Aplicada: ${migration}`);
    }

    await client.query('COMMIT');
    console.log('Banco local preparado.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(`Falha ao preparar o banco: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

setupDatabase();