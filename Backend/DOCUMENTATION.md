# 🚀 ATCC — Documentação Técnica & Histórico de Desenvolvimento

Esta documentação detalha a evolução cronológica do projeto, as tecnologias aplicadas e os acessos para validação.

## 🛠️ Stack Tecnológica
- **Backend**: NestJS, TypeScript, TypeORM, PostgreSQL.
- **Frontend**: Expo (React Native), Expo Router.
- **Segurança**: JWT, Bcrypt, Passport.
- **Infraestrutura**: Variáveis de ambiente (.env), PGAdmin.

---

## 📅 Linha do Tempo e Evolução

### 🗓️ Abril / Maio (Início) - Base e Infraestrutura
- **Estruturação Modular**: Divisão do backend em módulos independentes (`Auth`, `Company`, `Users`).
- **Persistência Real**: Configuração do PostgreSQL e migração de dados em memória para banco de dados relacional.
- **Segurança**: Implementação de Hashing de senhas com **Bcrypt** e proteção de rotas com **JWT**.

### 🗓️ 05 de Maio de 2026 - Padronização e Refinamento
- **Fase 5 (Validações)**: Implementação de `ValidationPipe` global e normalização de dados (remoção de máscaras de CPF/CNPJ).
- **Fase 6 (Proteção de Dados)**: Configuração de `select: false` em campos sensíveis para evitar vazamento de senhas em consultas SQL.

### 🗓️ 10 de Maio de 2026 - Autenticação e Inteligência (Fase Atual)
- **Fase 7 (Persistência de Sessão)**: Implementação híbrida de armazenamento de token (`localStorage` para Web e `Expo SecureStore` para Mobile).
- **Fase 8 (Dashboard Estratégico)**: Desenvolvimento do sistema de agregação de dados em tempo real.

---

## 📸 Demonstração Visual (Histórico)

### 🔓 Fluxo de Acesso e Segurança
As telas abaixo representam o portal de entrada seguro do sistema.
- **Seleção Inicial**: Escolha de perfil (Empresa/Funcionário).
- **Cadastro**: Registro simplificado de novas empresas.
- **Login**: Autenticação protegida por JWT.

![Seleção de Perfil](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/initial_selection_screen_1778451701960.png)
![Cadastro](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/company_registration_screen_1778451710249.png)
![Login Empresa](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/company_login_screen_1778451674708.png)
![Login Funcionário](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/employee_login_screen_1778451678864.png)

### 📊 Evolução do Dashboard (Fase 8)
O Dashboard foi construído em três etapas incrementais de inteligência:

#### V1: Conexão Base
Primeira leitura real de contagem de funcionários.
![Dashboard V1](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/dashboard_verification_1778449834520.png)

#### V2: Métricas de Produtividade
Integração com a tabela de tarefas para análise de performance.
![Dashboard V2](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/dashboard_metrics_verification_1778450353666.png)

#### V3: Inteligência Corporativa Completa
Unificação de produtividade e bem-estar (Humor da equipe).
![Dashboard V3](file:///C:/Users/Amadeu_Turolla/.gemini/antigravity/brain/4fa928ed-130e-4370-a4ae-b707bfe805e2/dashboard_humor_metrics_1778451231078.png)

---

## 🧪 Acessos para Validação

Utilize as credenciais abaixo para testar o ambiente atual:

### 🏢 Empresa (Admin)
- **CNPJ**: `99.888.777/0001-00`
- **Senha**: `password123`

### 👤 Funcionário
- **CPF**: `123.456.789-00`
- **Senha**: `password123`

---

## 🚀 O que vem por aí
1. **App do Funcionário**: Visualização de tarefas e gamificação de pontos.
2. **Lançamento de Bem-estar**: Interface para feedback emocional diário.
3. **Análise de Dados**: Filtros avançados por período e setor para o administrador.

---
*Documentação atualizada em: 10 de Maio de 2026*
