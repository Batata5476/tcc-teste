-- =============================================================================
-- SCRIPT DE INSTALAÇÃO COMPLETA - SUPABASE (TCC COOPERA)
-- Cole este script no SQL Editor do Supabase e clique em RUN
-- =============================================================================

-- 1. TABELAS BASE
CREATE TABLE IF NOT EXISTS empresa (
    id SERIAL PRIMARY KEY,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    tipo_empresa VARCHAR(50),
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7)
);

CREATE TABLE IF NOT EXISTS setor (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    nome VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS role (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS permissao (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT
);

CREATE TABLE IF NOT EXISTS role_permissao (
    role_id INT NOT NULL REFERENCES role(id) ON DELETE CASCADE,
    permissao_id INT NOT NULL REFERENCES permissao(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    empresa_id INT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    role_id INT REFERENCES role(id) ON DELETE SET NULL,
    setor_id INT REFERENCES setor(id) ON DELETE SET NULL,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    cpf NUMERIC(14,0) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50),
    status VARCHAR(20) DEFAULT 'PENDING',
    primeiro_acesso BOOLEAN DEFAULT TRUE,
    activation_code VARCHAR(50) UNIQUE,
    token VARCHAR(255),
    token_expiracao TIMESTAMPTZ,
    pontos_acumulados INT DEFAULT 0,
    foto_func TEXT,
    foto TEXT,
    telefone VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS usuario_permissao (
    usuario_id INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    permissao_id INT NOT NULL REFERENCES permissao(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, permissao_id)
);

CREATE TABLE IF NOT EXISTS tarefas (
    pk_id_tarefas SERIAL PRIMARY KEY,
    validade_tarefa DATE NOT NULL,
    tipo_tarefa VARCHAR(30) NOT NULL,
    prioridade_tarefa INT NOT NULL,
    status_tarefa INT NOT NULL
);

CREATE TABLE IF NOT EXISTS func_tarefa (
    pk_id_func_tarefa SERIAL PRIMARY KEY,
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    fk_cod_empresa INT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE,
    fk_id_tarefa INT NOT NULL REFERENCES tarefas(pk_id_tarefas) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reuniao (
    pk_id_reuniao SERIAL PRIMARY KEY,
    data_reuniao DATE NOT NULL,
    horario_reuniao TIME NOT NULL,
    assunto_reuniao VARCHAR(100) NOT NULL,
    link_reuniao TEXT,
    tipo_reuniao VARCHAR(30) NOT NULL,
    status_reuniao VARCHAR(20) NOT NULL DEFAULT 'AGENDADA',
    solicitante_id INT REFERENCES usuario(id) ON DELETE SET NULL,
    motivo_recusa TEXT
);

CREATE TABLE IF NOT EXISTS participantes_reu (
    pk_id_participantes_reu SERIAL PRIMARY KEY,
    fk_id_reuniao INT NOT NULL REFERENCES reuniao(pk_id_reuniao) ON DELETE CASCADE,
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS entrada_saida (
    pk_id_ponto SERIAL PRIMARY KEY,
    entrada TIME NOT NULL,
    saida TIME NOT NULL,
    data_ponto DATE NOT NULL,
    total_dia TIME NOT NULL,
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    latitude_registro NUMERIC(10,7),
    longitude_registro NUMERIC(10,7),
    latitude_saida NUMERIC(10,7),
    longitude_saida NUMERIC(10,7)
);

CREATE TABLE IF NOT EXISTS humor_func (
    pk_id_humor SERIAL PRIMARY KEY,
    humor_func INT NOT NULL,
    dth_humor TIMESTAMPTZ NOT NULL,
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS his_medico (
    pk_id_his_medico SERIAL PRIMARY KEY,
    atestado_func TEXT,
    ocorrencias VARCHAR(255),
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chats (
    pk_id_chat SERIAL PRIMARY KEY,
    tipo_chat VARCHAR(8) NOT NULL,
    fk_cod_empresa INT NOT NULL REFERENCES empresa(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS participantes_conversas (
    pk_id_participantes_conversa SERIAL PRIMARY KEY,
    fk_id_chat INT NOT NULL REFERENCES chats(pk_id_chat) ON DELETE CASCADE,
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mensagens (
    pk_id_mensagens SERIAL PRIMARY KEY,
    conteudo_mensagens VARCHAR(200) NOT NULL,
    data_envio TIMESTAMPTZ NOT NULL,
    fk_id_chat INT NOT NULL REFERENCES chats(pk_id_chat) ON DELETE CASCADE,
    fk_id_func INT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    fk_id_midia INT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuario(id) ON DELETE SET NULL,
    empresa_id INT REFERENCES empresa(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    entidade VARCHAR(50),
    entidade_id INT,
    ip VARCHAR(50),
    user_agent TEXT,
    data TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    detalhes TEXT
);

-- 2. PERMISSÕES E ROLES
INSERT INTO permissao (nome, descricao) VALUES
  ('users.read', 'Consultar usuários'),
  ('users.create', 'Cadastrar usuários'),
  ('users.update', 'Atualizar usuários'),
  ('users.delete', 'Remover usuários'),
  ('company.read', 'Consultar empresa'),
  ('company.update', 'Atualizar empresa'),
  ('company.delete', 'Remover empresa'),
  ('dashboard.company.read', 'Consultar dashboard da empresa'),
  ('dashboard.user.read', 'Consultar dashboard pessoal'),
  ('chat.read', 'Consultar chat'),
  ('chat.create', 'Enviar mensagens'),
  ('chat.delete', 'Remover mensagens'),
  ('meetings.read', 'Consultar reuniões'),
  ('meetings.create', 'Criar reuniões'),
  ('meetings.update', 'Atualizar reuniões'),
  ('meetings.delete', 'Remover reuniões'),
  ('occurrences.read', 'Consultar ocorrências'),
  ('occurrences.create', 'Criar ocorrências'),
  ('occurrences.update', 'Atualizar ocorrências'),
  ('occurrences.delete', 'Remover ocorrências'),
  ('tasks.read', 'Consultar tarefas'),
  ('tasks.create', 'Criar tarefas'),
  ('tasks.update', 'Atualizar tarefas'),
  ('tasks.delete', 'Remover tarefas'),
  ('wellbeing.read', 'Consultar bem-estar'),
  ('wellbeing.create', 'Registrar bem-estar'),
  ('work.read', 'Consultar jornada'),
  ('work.create', 'Registrar jornada'),
  ('work.update', 'Atualizar jornada'),
  ('work.delete', 'Remover jornada')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO role (nome) VALUES
  ('Administrador Master'),
  ('Administrador'),
  ('Funcionário')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO role_permissao (role_id, permissao_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permissao p
WHERE r.nome IN ('Administrador Master', 'Administrador')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissao (role_id, permissao_id)
SELECT r.id, p.id
FROM role r
CROSS JOIN permissao p
WHERE r.nome = 'Funcionário'
  AND p.nome IN (
    'users.read', 'users.update',
    'dashboard.user.read',
    'chat.read', 'chat.create', 'chat.delete',
    'meetings.read', 'meetings.create', 'meetings.update',
    'occurrences.read', 'occurrences.create', 'occurrences.update', 'occurrences.delete',
    'tasks.read', 'tasks.create', 'tasks.update',
    'wellbeing.read', 'wellbeing.create',
    'work.read', 'work.create', 'work.update', 'work.delete'
  )
ON CONFLICT DO NOTHING;

-- 3. EMPRESA E SETORES DE TESTE
INSERT INTO empresa (cnpj, nome, email, tipo_empresa, latitude, longitude)
VALUES
  ('99888777000100', 'Empresa Teste', 'admin@empresateste.com', 'Serviços', -23.5505200, -46.6333080),
  ('12345678000190', 'TechNova Soluções', 'contato@technova.com', 'Tecnologia', -23.5505200, -46.6333080)
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO setor (empresa_id, nome)
SELECT e.id, s.nome
FROM empresa e
CROSS JOIN (
  VALUES ('Geral'), ('Desenvolvimento'), ('Recursos Humanos'), ('Vendas'), ('Marketing')
) AS s(nome)
WHERE e.cnpj = '99888777000100'
  AND NOT EXISTS (
    SELECT 1 FROM setor st WHERE st.empresa_id = e.id AND st.nome = s.nome
  );

-- 4. USUÁRIOS DE TESTE (Senha: Teste@123)
INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados)
SELECT
  e.id,
  (SELECT id FROM role WHERE nome = 'Administrador Master' LIMIT 1),
  (SELECT id FROM setor WHERE empresa_id = e.id LIMIT 1),
  'Admin Empresa Teste',
  'admin@empresateste.com',
  10000000001,
  '$2b$10$yDsJtBW57nfV1JX3UbVNRugjfXBnbmViR2TIG1aFbgJ2XwUiZhSfW',
  'Administrador Master',
  'ACTIVE',
  FALSE,
  0
FROM empresa e
WHERE e.cnpj = '99888777000100'
ON CONFLICT DO NOTHING;

INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados)
SELECT
  e.id,
  (SELECT id FROM role WHERE nome = 'Funcionário' LIMIT 1),
  (SELECT id FROM setor WHERE empresa_id = e.id LIMIT 1),
  'Funcionario Teste',
  'funcionario@teste.com',
  12345678900,
  '$2b$10$yDsJtBW57nfV1JX3UbVNRugjfXBnbmViR2TIG1aFbgJ2XwUiZhSfW',
  'Analista',
  'ACTIVE',
  FALSE,
  100
FROM empresa e
WHERE e.cnpj = '99888777000100'
ON CONFLICT DO NOTHING;


CREATE TABLE IF NOT EXISTS chat_arquivos (
    filename VARCHAR(160) PRIMARY KEY,
    mime_type VARCHAR(100) NOT NULL,
    original_name VARCHAR(255),
    conteudo BYTEA NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS empresa_config_pontos (
    empresa_id INT PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
    pontos_ativos BOOLEAN NOT NULL DEFAULT TRUE,
    atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
