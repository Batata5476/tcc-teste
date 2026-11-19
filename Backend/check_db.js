const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

async function checkDb() {
  const client = new Client({
    user: process.env.DB_USERNAME || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'COOPERA',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    await client.connect();
    const res = await client.query('SELECT pk_cod_empresa, nome_empresa, cnpj_empresa FROM info_empresa');
    console.log('Registered Companies:', JSON.stringify(res.rows, null, 2));
    
    const resFunc = await client.query('SELECT pk_id_func, nome_func FROM info_funcionario');
    console.log('Registered Employees:', JSON.stringify(resFunc.rows, null, 2));
  } catch (err) {
    console.error('Error checking database:', err);
  } finally {
    await client.end();
  }
}

checkDb();
