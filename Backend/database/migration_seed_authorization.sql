-- Permissões oficiais usadas pelos decorators de autorização.
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