-- =============================================================================
-- DADOS DE TESTE OFICIAIS - TCC COOPERA
-- Compatível com BD/coopera.sql e Backend NestJS
-- Senha padrão dos usuários abaixo: Teste@123
-- =============================================================================

-- 1. Roles e Permissões base
INSERT INTO role (nome) VALUES
  ('Administrador Master'),
  ('Administrador'),
  ('Funcionário')
ON CONFLICT (nome) DO NOTHING;

-- 2. Empresas
INSERT INTO empresa (cnpj, nome, email, tipo_empresa, latitude, longitude)
VALUES
  ('99888777000100', 'Empresa Teste', 'admin@empresateste.com', 'Serviços', -23.5505200, -46.6333080),
  ('12345678000190', 'TechNova Soluções', 'contato@technova.com', 'Tecnologia', -23.5505200, -46.6333080)
ON CONFLICT (cnpj) DO NOTHING;

-- 3. Setores para a Empresa 1
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

-- 4. Usuários (Senha: Teste@123 -> hash bcrypt verificado)
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

-- Consultas de verificação
SELECT id, cnpj, nome, email, tipo_empresa FROM empresa;
SELECT id, empresa_id, nome FROM setor;
SELECT id, nome, email, cpf, cargo, status, primeiro_acesso, pontos_acumulados FROM usuario;
