const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function seedDb() {
  const client = new Client({
    user: process.env.DB_USERNAME || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_DATABASE || 'COOPERA',
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
  });

  try {
    await client.connect();
    
    // Read the SQL files
    const cooperaSql = fs.readFileSync(path.join(__dirname, '..', 'BD', 'coopera_oficial.sql'), 'utf8');
    const dadosSql = fs.readFileSync(path.join(__dirname, '..', 'BD', 'dadosdeteste.sql'), 'utf8');

    console.log('Applying coopera_oficial.sql...');
    await client.query(cooperaSql);
    
    console.log('Applying dadosdeteste.sql...');
    await client.query(dadosSql);

    console.log('Database seeded successfully');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    await client.end();
  }
}

seedDb();
