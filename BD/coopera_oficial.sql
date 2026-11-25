-- =============================================================================
-- SCHEMA OFICIAL DO BANCO DE DADOS - TCC COOPERA
-- Compatível 100% com as Entidades TypeORM do Backend NestJS
-- =============================================================================

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

CREATE TABLE IF NOT EXISTS chat_arquivos (
    filename VARCHAR(160) PRIMARY KEY,
    mime_type VARCHAR(100) NOT NULL,
    original_name VARCHAR(255),
    conteudo BYTEA NOT NULL,
    criado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
