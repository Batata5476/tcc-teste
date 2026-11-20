const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function seedHumor() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    console.log('Conectado ao banco para seed de humor.');

    // Limpa registros de humor existentes para o teste
    await client.query('DELETE FROM HUMOR_FUNC');

    // humor_func: 1 (Muito ruim) a 5 (Muito bom)
    const humores = [
      { humor: 5, data: '2026-05-10 08:00:00', funcId: 1 },
      { humor: 4, data: '2026-05-10 09:00:00', funcId: 2 },
      { humor: 5, data: '2026-05-09 10:00:00', funcId: 1 },
      { humor: 3, data: '2026-05-09 11:00:00', funcId: 2 },
      { humor: 4, data: '2026-05-08 12:00:00', funcId: 1 },
    ];

    for (const h of humores) {
      await client.query(
        'INSERT INTO HUMOR_FUNC (humor_func, dth_humor, fk_id_func) VALUES ($1, $2, $3)',
        [h.humor, h.data, h.funcId]
      );
    }

    console.log('Seed de humor concluído com sucesso!');
  } catch (err) {
    console.error('Erro no seed de humor:', err);
  } finally {
    await client.end();
  }
}

seedHumor();
