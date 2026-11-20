const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function seedTasks() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  try {
    await client.connect();
    console.log('Conectado ao banco para seed de tarefas.');

    // Limpa tarefas existentes para o teste
    await client.query('DELETE FROM TAREFAS');

    // 1 = concluida, 2 = em andamento, 3 = pendente, 4 = cancelada
    // prioridade: 1 (urgente), 2 (normal)
    const tasks = [
      { validade: '2026-12-31', tipo: 'Desenvolvimento', prioridade: 1, status: 1 }, // Concluida
      { validade: '2026-12-31', tipo: 'Design', prioridade: 2, status: 1 }, // Concluida
      { validade: '2026-11-30', tipo: 'Testes', prioridade: 1, status: 3 }, // Pendente
      { validade: '2026-10-15', tipo: 'Documentação', prioridade: 2, status: 3 }, // Pendente
      { validade: '2026-09-20', tipo: 'Reunião', prioridade: 2, status: 2 }, // Em andamento
    ];

    for (const t of tasks) {
      await client.query(
        'INSERT INTO TAREFAS (validade_tarefa, tipo_tarefa, prioridade_tarefa, status_tarefa) VALUES ($1, $2, $3, $4)',
        [t.validade, t.tipo, t.prioridade, t.status]
      );
    }

    console.log('Seed de tarefas concluído com sucesso!');
  } catch (err) {
    console.error('Erro no seed de tarefas:', err);
  } finally {
    await client.end();
  }
}

seedTasks();
