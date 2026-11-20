-- FASE 7: campo de senha (hash bcrypt) na tabela de funcionários.
-- Se já houver registros sem senha, defina valores antes ou use DEFAULT temporário antes do NOT NULL.
ALTER TABLE info_funcionario
ADD senha_func VARCHAR(255) NOT NULL;
