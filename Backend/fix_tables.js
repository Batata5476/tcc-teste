const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

async function createMissingTables() {
  const client = new Client({
    user: process.env.DB_USERNAME || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'COOPERA',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    await client.connect();
    
    console.log('Creating SETOR table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS SETOR(
        pk_id_setor SERIAL PRIMARY KEY,
        nome_setor VARCHAR(30) NOT NULL
      );
    `);

    console.log('Creating CARGO table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS CARGO(
        pk_id_cargo SERIAL PRIMARY KEY,
        nome_cargo VARCHAR(30) NOT NULL	
      );
    `);

    console.log('Inserting seed data...');
    await client.query(`
      INSERT INTO SETOR (nome_setor) VALUES ('TI'), ('RH'), ('Financeiro') ON CONFLICT DO NOTHING;
      INSERT INTO CARGO (nome_cargo) VALUES ('Dev'), ('Manager'), ('Analyst') ON CONFLICT DO NOTHING;
    `);

    console.log('Tables created and seeded successfully');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

createMissingTables();
