# Status do Projeto - TCC Coopera

> **Última atualização:** 26/07/2026 — Integração e correção do pacote `alteracoes_coopera` (Upload de fotos, DTOs de tarefas, criação de tarefas por colaboradores e correções de backend/frontend).

---

## ✅ Mudanças Aplicadas

### 0. Integração `alteracoes_coopera` (26/07/2026 ✅)
- **Backend (NestJS)**:
  - DTO `CreateTaskPayloadDto` criado com validações `class-validator`.
  - Permissão para criação de tarefas por colaboradores (`tasks.service.ts`).
  - Correção do carregamento de relacionamentos `relations: ['tarefa']` e interpolações em exceções de erro.
- **Frontend (Expo)**:
  - Adicionado `expo-image-picker` para upload de foto de perfil.
  - Atualizado modal da conta para trocar e exibir avatar do usuário via `PATCH /users/:id`.
  - Correção de codificação UTF-8 (Mojibake) e imports duplicados no `dashboard.tsx`.
- **Documentação**: Documentação completa disponível em [CHANGELOG_ALTERACOES_COOPERA.md](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/docs/CHANGELOG_ALTERACOES_COOPERA.md).

---

### 1. Sincronização e Estrutura (Sessão Anterior)
- **Git Sync**: Sincronização completa com o repositório remoto `yuuki-p/tcc.git`.
- **Correção de Pastas**: Resolvido o conflito entre o arquivo `Frontend` e a pasta `frontend` no Windows.

---

### 2. Frontend — Expo Web

#### 2.1 Correção de Build
- Criação do `babel.config.js` que estava ausente, resolvendo a tela branca no navegador.
- Instalação das dependências: `react-native-web`, `react-dom`, `@expo/metro-runtime`.

#### 2.2 Cadastro de Empresa (Funcional ✅)
- Implementado `useState` para todos os campos (Nome, CNPJ, Email, Tipo, Senha).
- Função `handleRegister` envia `POST http://192.168.0.103:3000/company`.
- Senhas com hash `bcrypt` antes de salvar no banco.

**Tela de Cadastro de Empresa:**
![Cadastro Empresa](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/registration_page_bottom_1778377145954.png)

#### 2.3 Cadastro de Funcionário (Funcional ✅)
- Formulário completo integrado ao endpoint `POST /users`.
- Campos: Nome, CPF, E-mail, ID do Setor, ID do Cargo, Código da Empresa.

**Tela de Login / Cadastro de Funcionário:**
![Login Funcionario](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/after_registration_click_1778377958446.png)

#### 2.4 Login de Empresa (Funcional ✅)
- Tela com CNPJ e Senha conectados ao `loginCompany()` do `services/auth.ts`.
- Ao logar, recebe o Token JWT e redireciona para o Dashboard.

#### 2.5 Login de Funcionário (Funcional ✅)
- Tela com CPF e Senha conectados ao `loginEmployee()`.
- Totalmente integrado e funcional com a rota real `POST /auth/user/login` do backend NestJS.

#### 2.6 Dashboard (Funcional ✅)
- Verifica se há token válido ao carregar.
- Faz chamada autenticada para `/company` e exibe "Sessão Autenticada ✅".
- Botão de Logout remove o token e redireciona para a tela inicial.

#### 2.7 Chat & Comunicação (Demonstrativo ✅)
- Criada a tela de chat interativa em `frontend/app/chat.tsx` seguindo o padrão visual do Coopera.
- Contém listagem de conversas e lista de contatos corporativos.
- Filtro local em tempo real no campo de busca.
- Conversa ativa totalmente interativa: permite digitar, enviar mensagens e receber auto-respostas dinâmicas simuladas após 1.5 segundos.
- Barra de navegação inferior integrada para alternância instantânea entre a central (dashboard) e chats.

**Dashboard Autenticado:**
![Dashboard](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/dashboard_full_view_1778447537272.png)

#### 2.7 Camada de Serviços — `frontend/services/`
| Arquivo | Função |
|---|---|
| `auth.ts` | `loginCompany`, `loginEmployee`, `logout`, `getToken` |
| `api.ts` | `authenticatedFetch` — injeta `Authorization: Bearer <token>` automaticamente |

#### 2.8 Armazenamento de Token (Híbrido)
| Ambiente | Mecanismo |
|---|---|
| Web (Navegador) | `localStorage` |
| Mobile (Expo) | `expo-secure-store` (criptografado) |

#### 2.9 Configuração de Rede
- Todos os `fetch` foram migrados de `http://localhost:3000` para `http://192.168.0.103:3000`.
- Isso permite que dispositivos móveis na mesma rede Wi-Fi se comuniquem com o backend.

---

### 3. Backend — NestJS

#### 3.1 Configuração de Ambiente
- Criação do arquivo `.env` com credenciais do PostgreSQL.
- `CORS` habilitado no `main.ts`.

#### 3.2 Registro de Empresa Público
- Removida a obrigatoriedade de JWT no endpoint `POST /company`.
- Agora novos usuários podem se cadastrar sem token.

#### 3.3 Módulo de Usuários (Funcionários) — Real
- Entidade `User` mapeada para a tabela `info_funcionario` via TypeORM.
- Serviço substituído de um mock para operações reais com o banco.
- DTO atualizado para campos reais: `nome_func`, `cpf_func`, `email_func`, `fk_id_setor`, `fk_id_cargo`, `fk_cod_empresa`.

#### 3.4 Autenticação (JWT)
- `loginCompany` no `AuthService` busca empresa pelo CNPJ, compara senha com `bcrypt.compare`, e emite o JWT.
- `loginUser` no `AuthService` busca funcionário pelo CPF, compara senha com `bcrypt.compare`, e emite o JWT.
- `JwtStrategy` valida o token nas rotas protegidas.

---

### 4. Banco de Dados — PostgreSQL

- **Banco `COOPERA`** criado manualmente.
- **Tabelas criadas**: `INFO_EMPRESA`, `INFO_FUNCIONARIO`, `SETOR`, `CARGO`.
- **Dados de seed** inseridos via scripts auxiliares (`fix_tables.js`, `check_db.js`).
- **Registros confirmados no BD**:
  - Empresa: `Empresa Teste` (CNPJ: 99888777000100)
  - Funcionários: `Funcionario Teste`, `Funcionario Teste 2`

---

## 🚩 O que ainda falta fazer
 
- [x] **Dashboard Real** (Concluído)
- [x] **Mapeamento de Tarefas e Associação** (Concluído)
- [x] **Tela de Chat Demonstrativa** (Concluído)

- [x] **Tratamento de Erros de Duplicidade (HTTP 409 Conflict)** (Concluído ✅)

### 1. Tratamento de Erros
- ✅ O backend agora retorna **HTTP 409 (Conflict)** com mensagem amigável no cadastro caso o CNPJ, CPF ou E-mail já existam no banco.

### 2. Mapeamento de Entidades Restantes
| Tabela | Status |
|---|---|
| `TAREFAS` / `FUNC_TAREFA` | ✅ Concluído e Mapeado |
| `HUMOR_FUNC` | ✅ Mapeado (`Humor` mapeia humor_func) |
| `CHATS` / `MENSAGENS` / `MIDIA` | 🚧 Tela de chat pronta (front), persistência/tempo-real pendentes |
| `ENTRADA_SAIDA` / `CARGA_HORARIA` / `BANCO_HORAS` | ❌ Pendente |
| `REUNIAO` / `PARTICIPANTES_REU` | ❌ Pendente |

### 3. Validações de Formulário
- Máscaras para CNPJ e CPF.
- Validação de formato de e-mail em tempo real.
- Feedback visual durante o carregamento (loading spinner).
