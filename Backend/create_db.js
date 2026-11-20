const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');

async function createDb() {
  const client = new Client({
    user: process.env.DB_USERNAME || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: 'postgres',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    await client.connect();
    await client.query('CREATE DATABASE "COOPERA"');
    console.log('Database COOPERA created successfully');
  } catch (err) {
    if (err.code === '42P04') {
      console.log('Database COOPERA already exists');
    } else {
      console.error('Error creating database:', err);
    }
  } finally {
    await client.end();
  }
}

createDb();
