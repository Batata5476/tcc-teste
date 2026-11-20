const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client } = require('pg');
const bcrypt = require('bcrypt');

const DB_CONFIG = {
  user: process.env.DB_USERNAME || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_DATABASE || 'COOPERA',
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
};

async function run() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log('✅ Conectado ao banco COOPERA\n');

  try {
    // ──── 1. VERIFICAR / INSERIR EMPRESA ─────────────────────────────────────
    console.log('=== VERIFICANDO EMPRESA ===');
    const cnpj = '99888777000100';
    const empresaRes = await client.query(
      `SELECT * FROM empresa WHERE cnpj = $1`,
      [cnpj]
    );

    let empresaId;
    if (empresaRes.rows.length === 0) {
      console.log('⚠️  Empresa NÃO encontrada. Inserindo...');
      const insertEmpresa = await client.query(
        `INSERT INTO empresa (cnpj, nome, email, tipo_empresa)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [cnpj, 'Empresa Teste', 'empresa@teste.com', 'Tecnologia']
      );
      empresaId = insertEmpresa.rows[0].id;
      console.log(`✅ Empresa criada com ID ${empresaId}`);
    } else {
      empresaId = empresaRes.rows[0].id;
      console.log(`✅ Empresa encontrada: ID=${empresaId}, Nome="${empresaRes.rows[0].nome}"`);
    }

    // ──── 2. VERIFICAR / INSERIR ROLE (Administrador Master) ─────────────────
    console.log('\n=== VERIFICANDO ROLES ===');
    const roleRes = await client.query(
      `SELECT * FROM role WHERE nome = 'Administrador Master'`
    );
    let adminRoleId;
    if (roleRes.rows.length === 0) {
      console.log('⚠️  Role "Administrador Master" NÃO encontrada. Inserindo...');
      const insertRole = await client.query(
        `INSERT INTO role (nome) VALUES ('Administrador Master') RETURNING id`
      );
      adminRoleId = insertRole.rows[0].id;
      console.log(`✅ Role "Administrador Master" criada com ID ${adminRoleId}`);
    } else {
      adminRoleId = roleRes.rows[0].id;
      console.log(`✅ Role "Administrador Master" encontrada: ID=${adminRoleId}`);
    }

    // Role de Funcionário
    const roleFunc = await client.query(`SELECT * FROM role WHERE nome = 'Funcionário'`);
    let funcRoleId;
    if (roleFunc.rows.length === 0) {
      console.log('⚠️  Role "Funcionário" NÃO encontrada. Inserindo...');
      const insertRoleFunc = await client.query(
        `INSERT INTO role (nome) VALUES ('Funcionário') RETURNING id`
      );
      funcRoleId = insertRoleFunc.rows[0].id;
      console.log(`✅ Role "Funcionário" criada com ID ${funcRoleId}`);
    } else {
      funcRoleId = roleFunc.rows[0].id;
      console.log(`✅ Role "Funcionário" encontrada: ID=${funcRoleId}`);
    }

    // ──── 3. VERIFICAR / INSERIR SETOR ───────────────────────────────────────
    console.log('\n=== VERIFICANDO SETOR ===');
    const setorRes = await client.query(
      `SELECT * FROM setor WHERE empresa_id = $1 LIMIT 1`,
      [empresaId]
    );
    let setorId;
    if (setorRes.rows.length === 0) {
      console.log('⚠️  Nenhum Setor encontrado. Inserindo setor padrão...');
      const insertSetor = await client.query(
        `INSERT INTO setor (nome, empresa_id) VALUES ('Geral', $1) RETURNING id`,
        [empresaId]
      );
      setorId = insertSetor.rows[0].id;
      console.log(`✅ Setor "Geral" criado com ID ${setorId}`);
    } else {
      setorId = setorRes.rows[0].id;
      console.log(`✅ Setor encontrado: ID=${setorId}, Nome="${setorRes.rows[0].nome}"`);
    }

    // ──── 4. VERIFICAR / INSERIR USUÁRIO MASTER (login da empresa) ───────────
    console.log('\n=== VERIFICANDO USUÁRIO MASTER (login empresa CNPJ) ===');
    const masterRes = await client.query(
      `SELECT u.id, u.nome, u.email, u.status, u.primeiro_acesso, r.nome as role
       FROM usuario u
       LEFT JOIN role r ON u.role_id = r.id
       WHERE u.empresa_id = $1 AND r.nome = 'Administrador Master'`,
      [empresaId]
    );

    if (masterRes.rows.length === 0) {
      console.log('⚠️  Usuário Master NÃO encontrado. Criando...');
      const hashedPw = await bcrypt.hash('Teste@123', 10);
      const cpfMaster = String(10000000000 + empresaId);
      const insertMaster = await client.query(
        `INSERT INTO usuario (empresa_id, role_id, nome, email, cpf, senha, status, primeiro_acesso, cargo)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', false, 'Administrador Master') RETURNING id`,
        [empresaId, adminRoleId, `Admin Empresa Teste`, 'admin@empresateste.com', cpfMaster, hashedPw]
      );
      console.log(`✅ Usuário Master criado com ID ${insertMaster.rows[0].id}`);
      console.log(`   Login: CNPJ 99.888.777/0001-00 | Senha: Teste@123`);
    } else {
      console.log(`✅ Usuário Master encontrado: ID=${masterRes.rows[0].id}, "${masterRes.rows[0].nome}"`);
      const hashedPw = await bcrypt.hash('Teste@123', 10);
      await client.query(
        `UPDATE usuario SET status = 'ACTIVE', primeiro_acesso = false, senha = $1 WHERE id = $2`,
        [hashedPw, masterRes.rows[0].id]
      );
      console.log('   🔧 Senha redefinida com sucesso para: Teste@123');
    }

    // ──── 5. VERIFICAR / INSERIR FUNCIONÁRIO DE TESTE ────────────────────────
    console.log('\n=== VERIFICANDO FUNCIONÁRIO DE TESTE ===');
    const cpfFunc = '12345678900';
    const funcRes = await client.query(
      `SELECT u.id, u.nome, u.email, u.cpf, u.status, u.primeiro_acesso, r.nome as role
       FROM usuario u
       LEFT JOIN role r ON u.role_id = r.id
       WHERE u.cpf = $1`,
      [cpfFunc]
    );

    if (funcRes.rows.length === 0) {
      console.log('⚠️  Funcionário de teste NÃO encontrado. Criando...');
      const hashedPw = await bcrypt.hash('Teste@123', 10);
      const insertFunc = await client.query(
        `INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, status, primeiro_acesso, cargo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', false, 'Analista') RETURNING id`,
        [empresaId, funcRoleId, setorId, 'Funcionario Teste', 'funcionario@teste.com', cpfFunc, hashedPw]
      );
      console.log(`✅ Funcionário criado com ID ${insertFunc.rows[0].id}`);
      console.log(`   Login: CPF 123.456.789-00 | Senha: Teste@123`);
    } else {
      console.log(`✅ Funcionário encontrado: ID=${funcRes.rows[0].id}, "${funcRes.rows[0].nome}"`);
      const hashedPw = await bcrypt.hash('Teste@123', 10);
      await client.query(
        `UPDATE usuario SET status = 'ACTIVE', primeiro_acesso = false, senha = $1 WHERE id = $2`,
        [hashedPw, funcRes.rows[0].id]
      );
      console.log('   🔧 Senha redefinida com sucesso para: Teste@123');
    }

    // ──── 6. RESUMO FINAL ─────────────────────────────────────────────────────
    console.log('\n========================================');
    console.log('✅ BANCO VERIFICADO E PRONTO PARA TESTES');
    console.log('========================================');
    console.log('\n🏢 Login de EMPRESA (Admin):');
    console.log('   CNPJ: 99.888.777/0001-00');
    console.log('   Senha: Teste@123');
    console.log('\n👤 Login de FUNCIONÁRIO:');
    console.log('   CPF: 123.456.789-00');
    console.log('   Senha: Teste@123');
    console.log('\n⚠️  ATENÇÃO: A senha foi alterada para Teste@123 (com T maiúsculo, @ e 123)');
    console.log('   porque o sistema exige: maiúscula + minúscula + número + caractere especial');
    console.log('========================================\n');

  } catch (err) {
    console.error('\n❌ Erro:', err.message);
    console.error('   Detalhes:', err.detail || '');
    console.error('   Hint:', err.hint || '');
  } finally {
    await client.end();
  }
}

run();
