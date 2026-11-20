const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

async function checkSectors() {
  const client = new Client({
    user: process.env.DB_USERNAME || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'COOPERA',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT * FROM setor');
    console.log('Sectors:', JSON.stringify(res.rows, null, 2));
    const resCargo = await client.query('SELECT * FROM cargo');
    console.log('Cargos:', JSON.stringify(resCargo.rows, null, 2));
  } catch (err) {
    console.error('Error checking sectors:', err);
  } finally {
    await client.end();
  }
}

checkSectors();
