-- =============================================================================
-- PRESET OFICIAL DE APRESENTAÇÃO (BANCA TCC) - COOPERA
-- Compatível com Supabase SQL Editor e PostgreSQL local
-- Usa datas dinâmicas (CURRENT_DATE) para funcionar em qualquer dia!
--
-- CREDENCIAIS DE DEMONSTRAÇÃO (Senha padrão para todos: Teste@123):
--   • Visão Empresa / Admin : 99888777000100  (ou admin@empresateste.com)
--   • Colaborador Principal : 12345678900     (funcionario@teste.com)
--   • Mariana Costa (RH)    : 31000000101     (mariana.rh@coopera.com)
--   • Lucas Almeida (Dev)   : 31000000102     (lucas.dev@coopera.com)
--   • Beatriz Souza (Mkt)   : 31000000103     (beatriz.mkt@coopera.com)
--   • Rafael Mendes (Vendas): 31000000104     (rafael.vendas@coopera.com)
-- =============================================================================

BEGIN;

-- 1. GARANTE EMPRESA, ROLES, SETORES E CONFIGURAÇÃO DE PONTOS ATIVA
INSERT INTO role (nome) VALUES
  ('Administrador Master'),
  ('Administrador'),
  ('Funcionário')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO empresa (cnpj, nome, email, tipo_empresa, latitude, longitude)
VALUES ('99888777000100', 'Empresa Teste', 'admin@empresateste.com', 'Tecnologia e Gestão', -23.5505200, -46.6333080)
ON CONFLICT (cnpj) DO NOTHING;

CREATE TABLE IF NOT EXISTS empresa_config_pontos (
  empresa_id INT PRIMARY KEY REFERENCES empresa(id) ON DELETE CASCADE,
  pontos_ativos BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

DO $$
DECLARE
  v_emp_id INT;
  v_role_master INT;
  v_role_func INT;
  v_setor_geral INT;
  v_setor_rh INT;
  v_setor_dev INT;
  v_setor_mkt INT;
  v_setor_vendas INT;

  v_admin_id INT;
  v_func_id INT;
  v_mariana_id INT;
  v_lucas_id INT;
  v_beatriz_id INT;
  v_rafael_id INT;

  v_task_id INT;
  v_reu_id INT;
  v_chat_id INT;
  v_hash TEXT := '$2b$10$yDsJtBW57nfV1JX3UbVNRugjfXBnbmViR2TIG1aFbgJ2XwUiZhSfW'; -- Teste@123
BEGIN
  SELECT id INTO v_emp_id FROM empresa WHERE cnpj = '99888777000100' LIMIT 1;
  SELECT id INTO v_role_master FROM role WHERE nome = 'Administrador Master' LIMIT 1;
  SELECT id INTO v_role_func FROM role WHERE nome = 'Funcionário' LIMIT 1;

  INSERT INTO empresa_config_pontos (empresa_id, pontos_ativos, atualizado_em)
  VALUES (v_emp_id, TRUE, NOW())
  ON CONFLICT (empresa_id) DO UPDATE SET pontos_ativos = TRUE, atualizado_em = NOW();

  -- Setores
  INSERT INTO setor (empresa_id, nome)
  SELECT v_emp_id, s.nome
  FROM (VALUES ('Geral'), ('Recursos Humanos'), ('Desenvolvimento'), ('Marketing'), ('Vendas')) AS s(nome)
  WHERE NOT EXISTS (SELECT 1 FROM setor WHERE empresa_id = v_emp_id AND nome = s.nome);

  SELECT id INTO v_setor_geral FROM setor WHERE empresa_id = v_emp_id AND nome = 'Geral' LIMIT 1;
  SELECT id INTO v_setor_rh FROM setor WHERE empresa_id = v_emp_id AND nome = 'Recursos Humanos' LIMIT 1;
  SELECT id INTO v_setor_dev FROM setor WHERE empresa_id = v_emp_id AND nome = 'Desenvolvimento' LIMIT 1;
  SELECT id INTO v_setor_mkt FROM setor WHERE empresa_id = v_emp_id AND nome = 'Marketing' LIMIT 1;
  SELECT id INTO v_setor_vendas FROM setor WHERE empresa_id = v_emp_id AND nome = 'Vendas' LIMIT 1;

  -- 2. USUÁRIOS DE APRESENTAÇÃO
  INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone)
  VALUES (v_emp_id, v_role_master, v_setor_geral, 'Admin Empresa Teste', 'admin@empresateste.com', 10000000001, v_hash, 'Administrador Master', 'ACTIVE', FALSE, 400, '(11) 99800-1000')
  ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE', primeiro_acesso = FALSE, pontos_acumulados = 400;

  INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone)
  VALUES (v_emp_id, v_role_func, v_setor_dev, 'Funcionario Teste', 'funcionario@teste.com', 12345678900, v_hash, 'Analista de Sistemas', 'ACTIVE', FALSE, 300, '(11) 99800-1001')
  ON CONFLICT (email) DO UPDATE SET empresa_id = v_emp_id, setor_id = v_setor_dev, cargo = 'Analista de Sistemas', status = 'ACTIVE', primeiro_acesso = FALSE, pontos_acumulados = 300;

  INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone)
  VALUES (v_emp_id, v_role_func, v_setor_rh, 'Mariana Costa', 'mariana.rh@coopera.com', 31000000101, v_hash, 'Especialista de RH', 'ACTIVE', FALSE, 500, '(11) 99800-1002')
  ON CONFLICT (email) DO UPDATE SET empresa_id = v_emp_id, setor_id = v_setor_rh, status = 'ACTIVE', primeiro_acesso = FALSE, pontos_acumulados = 500;

  INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone)
  VALUES (v_emp_id, v_role_func, v_setor_dev, 'Lucas Almeida', 'lucas.dev@coopera.com', 31000000102, v_hash, 'Desenvolvedor Full-Stack', 'ACTIVE', FALSE, 400, '(11) 99800-1003')
  ON CONFLICT (email) DO UPDATE SET empresa_id = v_emp_id, setor_id = v_setor_dev, status = 'ACTIVE', primeiro_acesso = FALSE, pontos_acumulados = 400;

  INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone)
  VALUES (v_emp_id, v_role_func, v_setor_mkt, 'Beatriz Souza', 'beatriz.mkt@coopera.com', 31000000103, v_hash, 'Analista de Comunicação', 'ACTIVE', FALSE, 200, '(11) 99800-1004')
  ON CONFLICT (email) DO UPDATE SET empresa_id = v_emp_id, setor_id = v_setor_mkt, status = 'ACTIVE', primeiro_acesso = FALSE, pontos_acumulados = 200;

  INSERT INTO usuario (empresa_id, role_id, setor_id, nome, email, cpf, senha, cargo, status, primeiro_acesso, pontos_acumulados, telefone)
  VALUES (v_emp_id, v_role_func, v_setor_vendas, 'Rafael Mendes', 'rafael.vendas@coopera.com', 31000000104, v_hash, 'Consultor Comercial', 'ACTIVE', FALSE, 100, '(11) 99800-1005')
  ON CONFLICT (email) DO UPDATE SET empresa_id = v_emp_id, setor_id = v_setor_vendas, status = 'ACTIVE', primeiro_acesso = FALSE, pontos_acumulados = 100;

  SELECT id INTO v_admin_id FROM usuario WHERE email = 'admin@empresateste.com' LIMIT 1;
  SELECT id INTO v_func_id FROM usuario WHERE email = 'funcionario@teste.com' LIMIT 1;
  SELECT id INTO v_mariana_id FROM usuario WHERE email = 'mariana.rh@coopera.com' LIMIT 1;
  SELECT id INTO v_lucas_id FROM usuario WHERE email = 'lucas.dev@coopera.com' LIMIT 1;
  SELECT id INTO v_beatriz_id FROM usuario WHERE email = 'beatriz.mkt@coopera.com' LIMIT 1;
  SELECT id INTO v_rafael_id FROM usuario WHERE email = 'rafael.vendas@coopera.com' LIMIT 1;

  -- 3. LIMPA DADOS ANTERIORES DA EMPRESA PARA RE-APLICAR SEM DUPLICATAS
  DELETE FROM tarefas WHERE pk_id_tarefas IN (
    SELECT fk_id_tarefa FROM func_tarefa WHERE fk_cod_empresa = v_emp_id
  );
  DELETE FROM reuniao WHERE pk_id_reuniao IN (
    SELECT mp.fk_id_reuniao
    FROM participantes_reu mp
    JOIN usuario u ON u.id = mp.fk_id_func
    WHERE u.empresa_id = v_emp_id
  ) OR solicitante_id IN (SELECT id FROM usuario WHERE empresa_id = v_emp_id);
  DELETE FROM humor_func WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = v_emp_id);
  DELETE FROM entrada_saida WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = v_emp_id);
  DELETE FROM his_medico WHERE fk_id_func IN (SELECT id FROM usuario WHERE empresa_id = v_emp_id);
  DELETE FROM chats WHERE fk_cod_empresa = v_emp_id;

  -- 4. TAREFAS (Urgentes hoje, Outras hoje/amanhã, Pendentes atrasadas e Concluídas)
  -- [1] Hoje - Urgente - Pendente (Funcionario Teste)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Revisar metas da sprint', CURRENT_DATE, 1, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_func_id, v_emp_id, v_task_id);

  -- [2] Hoje - Urgente - Em andamento (Funcionario Teste)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Validar folha de ponto', CURRENT_DATE, 1, 2) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_func_id, v_emp_id, v_task_id);

  -- [3] Hoje - Urgente - Pendente (Mariana RH)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Fechar indicadores de RH', CURRENT_DATE, 1, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_mariana_id, v_emp_id, v_task_id);

  -- [4] Hoje - Outra - Pendente (Funcionario Teste)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Atualizar guia onboarding', CURRENT_DATE, 2, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_func_id, v_emp_id, v_task_id);

  -- [5] Hoje - Outra - Em andamento (Lucas Dev)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Preparar pauta semanal', CURRENT_DATE, 2, 2) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_lucas_id, v_emp_id, v_task_id);

  -- [6] Amanhã - Urgente - Pendente (Funcionario Teste)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Apresentar release v2.0', CURRENT_DATE + 1, 1, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_func_id, v_emp_id, v_task_id);

  -- [7] Amanhã - Outra - Pendente (Beatriz Mkt)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Revisar campanha interna', CURRENT_DATE + 1, 2, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_beatriz_id, v_emp_id, v_task_id);

  -- [8] Atrasada (-2 dias) - Urgente - Pendente (Funcionario Teste -> card Tarefas Pendentes)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Enviar relatório mensal', CURRENT_DATE - 2, 1, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_func_id, v_emp_id, v_task_id);

  -- [9] Atrasada (-1 dia) - Outra - Pendente (Rafael Vendas -> card Tarefas Pendentes)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Arquivar termos assinados', CURRENT_DATE - 1, 2, 3) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_rafael_id, v_emp_id, v_task_id);

  -- [10] Concluída (Funcionario Teste)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Configurar portal Coopera', CURRENT_DATE, 1, 1) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_func_id, v_emp_id, v_task_id);

  -- [11] Concluída (Lucas Dev)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Homologar Ponto-E mobile', CURRENT_DATE, 1, 1) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_lucas_id, v_emp_id, v_task_id);

  -- [12] Concluída (Mariana RH)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Treinamento boas-vindas', CURRENT_DATE - 1, 2, 1) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_mariana_id, v_emp_id, v_task_id);

  -- [13] Concluída (Beatriz Mkt)
  INSERT INTO tarefas (tipo_tarefa, validade_tarefa, prioridade_tarefa, status_tarefa)
  VALUES ('Comunicado trimestral', CURRENT_DATE - 1, 2, 1) RETURNING pk_id_tarefas INTO v_task_id;
  INSERT INTO func_tarefa (fk_id_func, fk_cod_empresa, fk_id_tarefa) VALUES (v_beatriz_id, v_emp_id, v_task_id);

  -- 5. REUNIÕES (PENDENTE, AGENDADA com link, CONCLUIDA e RECUSADA com risco vermelho)
  -- [R1] PENDENTE solicitada pelo Funcionario Teste (pronta para aceitar/recusar ao vivo)
  INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id)
  VALUES (CURRENT_DATE, '15:30:00', 'Alinhamento de metas da Sprint', 'https://meet.google.com/landing', 'empresarial', 'PENDENTE', v_func_id)
  RETURNING pk_id_reuniao INTO v_reu_id;
  INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES (v_reu_id, v_func_id), (v_reu_id, v_admin_id);

  -- [R2] PENDENTE solicitada por Mariana RH (segunda opção para demonstrar recusa ou aprovação ao vivo)
  INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id)
  VALUES (CURRENT_DATE + 1, '10:00:00', 'Feedback individual de clima 1:1', NULL, 'empresarial', 'PENDENTE', v_mariana_id)
  RETURNING pk_id_reuniao INTO v_reu_id;
  INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES (v_reu_id, v_mariana_id), (v_reu_id, v_admin_id);

  -- [R3] AGENDADA hoje (com botão Acessar link e pronta para concluir)
  INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id)
  VALUES (CURRENT_DATE, '16:30:00', 'Reunião Geral de Resultados', 'https://meet.google.com/landing', 'empresarial', 'AGENDADA', v_admin_id)
  RETURNING pk_id_reuniao INTO v_reu_id;
  INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func)
  VALUES (v_reu_id, v_func_id), (v_reu_id, v_mariana_id), (v_reu_id, v_lucas_id), (v_reu_id, v_beatriz_id);

  -- [R4] AGENDADA amanhã
  INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id)
  VALUES (CURRENT_DATE + 1, '09:30:00', 'Planejamento Semanal de Equipe', 'https://meet.google.com/landing', 'empresarial', 'AGENDADA', v_admin_id)
  RETURNING pk_id_reuniao INTO v_reu_id;
  INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES (v_reu_id, v_func_id), (v_reu_id, v_lucas_id);

  -- [R5] CONCLUIDA (aparece em Reuniões concluídas com check verde)
  INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id)
  VALUES (CURRENT_DATE - 1, '14:00:00', 'Kickoff de Implantação Coopera', 'https://meet.google.com/landing', 'empresarial', 'CONCLUIDA', v_admin_id)
  RETURNING pk_id_reuniao INTO v_reu_id;
  INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES (v_reu_id, v_func_id), (v_reu_id, v_mariana_id);

  -- [R6] RECUSADA (aparece em Reuniões concluídas com risco vermelho e aviso RECUSADA)
  INSERT INTO reuniao (data_reuniao, horario_reuniao, assunto_reuniao, link_reuniao, tipo_reuniao, status_reuniao, solicitante_id, motivo_recusa)
  VALUES (CURRENT_DATE, '11:00:00', 'Alteração emergencial de escala', NULL, 'empresarial', 'RECUSADA', v_lucas_id, 'Conflito com fechamento')
  RETURNING pk_id_reuniao INTO v_reu_id;
  INSERT INTO participantes_reu (fk_id_reuniao, fk_id_func) VALUES (v_reu_id, v_lucas_id), (v_reu_id, v_func_id);

  -- 6. HUMOR & BEM-ESTAR (Popula todas as 5 fatias do gráfico sem bloquear o Funcionario Teste hoje!)
  INSERT INTO humor_func (humor_func, dth_humor, fk_id_func) VALUES
    (5, NOW() - INTERVAL '2 hours', v_mariana_id),
    (5, NOW() - INTERVAL '3 hours', v_lucas_id),
    (4, NOW() - INTERVAL '2 hours', v_beatriz_id),
    (3, NOW() - INTERVAL '1 hour',  v_rafael_id),
    (5, NOW() - INTERVAL '1 day',   v_func_id),
    (4, NOW() - INTERVAL '1 day',   v_mariana_id),
    (4, NOW() - INTERVAL '1 day',   v_lucas_id),
    (3, NOW() - INTERVAL '1 day',   v_beatriz_id),
    (2, NOW() - INTERVAL '2 days',  v_rafael_id),
    (5, NOW() - INTERVAL '2 days',  v_func_id),
    (4, NOW() - INTERVAL '2 days',  v_mariana_id),
    (3, NOW() - INTERVAL '3 days',  v_lucas_id),
    (5, NOW() - INTERVAL '3 days',  v_beatriz_id),
    (1, NOW() - INTERVAL '4 days',  v_rafael_id);

  -- 7. REGISTROS DE PONTO (Histórico recente; deixa HOJE livre no Funcionario Teste para bater ponto ao vivo!)
  INSERT INTO entrada_saida (entrada, saida, data_ponto, total_dia, fk_id_func, latitude_registro, longitude_registro, latitude_saida, longitude_saida)
  VALUES
    ('08:00:00', '17:00:00', CURRENT_DATE - 1, '09:00:00', v_func_id, -23.5505200, -46.6333080, -23.5505200, -46.6333080),
    ('08:05:00', '17:10:00', CURRENT_DATE - 2, '09:05:00', v_func_id, -23.5505200, -46.6333080, -23.5505200, -46.6333080),
    ('08:00:00', '17:00:00', CURRENT_DATE - 1, '09:00:00', v_mariana_id, -23.5505200, -46.6333080, -23.5505200, -46.6333080),
    ('08:10:00', '08:10:00', CURRENT_DATE,     '00:00:00', v_mariana_id, -23.5505200, -46.6333080, NULL, NULL),
    ('08:00:00', '17:05:00', CURRENT_DATE - 1, '09:05:00', v_lucas_id, -23.5505200, -46.6333080, -23.5505200, -46.6333080);

  -- 8. HISTÓRICO MÉDICO, ATESTADOS E OCORRÊNCIAS
  INSERT INTO his_medico (atestado_func, ocorrencias, fk_id_func) VALUES
    ('ASO Periódico Anual - Apto', 'Exame periódico ocupacional concluído junto ao RH.', v_func_id),
    ('Declaração de Comparecimento (2h)', 'Consulta odontológica preventiva comunicada previamente.', v_mariana_id),
    (NULL, 'Atraso pontual (20 min) justificado por interdição na via.', v_lucas_id),
    ('Atestado Médico CRM-SP 142890 (1 dia)', 'Afastamento médico de 1 dia validado pela gestão.', v_rafael_id);

  -- 9. CONVERSAS E MENSAGENS DO CHAT CORPORATIVO
  -- Chat 1: Admin <-> Funcionario Teste
  INSERT INTO chats (tipo_chat, fk_cod_empresa) VALUES ('direct', v_emp_id) RETURNING pk_id_chat INTO v_chat_id;
  INSERT INTO participantes_conversas (fk_id_chat, fk_id_func) VALUES (v_chat_id, v_admin_id), (v_chat_id, v_func_id);
  INSERT INTO mensagens (conteudo_mensagens, data_envio, fk_id_chat, fk_id_func) VALUES
    ('Bom dia! As prioridades da sprint já estão disponíveis na Central.', NOW() - INTERVAL '45 minutes', v_chat_id, v_admin_id),
    ('Bom dia! Já iniciei a validação da folha de ponto e solicitei alinhamento às 15h30.', NOW() - INTERVAL '30 minutes', v_chat_id, v_func_id),
    ('Perfeito! Vou revisar a solicitação na aba de Reuniões.', NOW() - INTERVAL '15 minutes', v_chat_id, v_admin_id);

  -- Chat 2: Admin <-> Mariana Costa (RH)
  INSERT INTO chats (tipo_chat, fk_cod_empresa) VALUES ('direct', v_emp_id) RETURNING pk_id_chat INTO v_chat_id;
  INSERT INTO participantes_conversas (fk_id_chat, fk_id_func) VALUES (v_chat_id, v_admin_id), (v_chat_id, v_mariana_id);
  INSERT INTO mensagens (conteudo_mensagens, data_envio, fk_id_chat, fk_id_func) VALUES
    ('Olá! O índice de bem-estar da equipe subiu para 4.0 nesta semana.', NOW() - INTERVAL '2 hours', v_chat_id, v_mariana_id),
    ('Excelente resultado, Mariana! Vamos destacar esses dados na reunião geral.', NOW() - INTERVAL '1 hour', v_chat_id, v_admin_id);

  -- Chat 3: Funcionario Teste <-> Mariana Costa (RH)
  INSERT INTO chats (tipo_chat, fk_cod_empresa) VALUES ('direct', v_emp_id) RETURNING pk_id_chat INTO v_chat_id;
  INSERT INTO participantes_conversas (fk_id_chat, fk_id_func) VALUES (v_chat_id, v_func_id), (v_chat_id, v_mariana_id);
  INSERT INTO mensagens (conteudo_mensagens, data_envio, fk_id_chat, fk_id_func) VALUES
    ('Oi! Seu exame periódico (ASO) já consta como validado no histórico médico.', NOW() - INTERVAL '3 hours', v_chat_id, v_mariana_id),
    ('Muito obrigado pelo retorno rápido, Mariana!', NOW() - INTERVAL '2 hours', v_chat_id, v_func_id);

  -- Sincroniza sequences por segurança
  PERFORM setval(pg_get_serial_sequence('mensagens', 'pk_id_mensagens'), COALESCE((SELECT MAX(pk_id_mensagens) FROM mensagens), 1), true);
  PERFORM setval(pg_get_serial_sequence('tarefas', 'pk_id_tarefas'), COALESCE((SELECT MAX(pk_id_tarefas) FROM tarefas), 1), true);
  PERFORM setval(pg_get_serial_sequence('reuniao', 'pk_id_reuniao'), COALESCE((SELECT MAX(pk_id_reuniao) FROM reuniao), 1), true);
END $$;

COMMIT;
