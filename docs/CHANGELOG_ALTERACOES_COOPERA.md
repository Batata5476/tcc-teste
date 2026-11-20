# Documentação de Aplicação das Alterações: `alteracoes_coopera`

> **Data de Aplicação:** 26/07/2026  
> **Status:** Aplicado e Verificado com Sucesso ✅

---

## 📌 Resumo Executivo

A pasta `alteracoes_coopera` continha atualizações estratégicas para o ecossistema do Coopera (Backend NestJS e Frontend Expo/React Native). Todas as funcionalidades úteis foram analisadas, integradas ao projeto principal e os erros de sintaxe, tipagem, codificação e falta de carregamento de relacionamentos foram devidamente corrigidos.

---

## 🛠️ Alterações Aplicadas e Correções Efetuadas

### 1. Backend NestJS (`tcc/Backend`)

#### A. DTO de Criação de Tarefas (`create-task-payload.dto.ts`)
- **Arquivo Criado:** [create-task-payload.dto.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/tasks/dto/create-task-payload.dto.ts)
- **Descrição:** Implementação de DTO com validações `class-validator`:
  - `tipo_tarefa` (`string`)
  - `validade_tarefa` (`string`)
  - `prioridade_tarefa` (`number`)
  - `fk_id_func` (`number`, opcional)

#### B. Controller de Tarefas (`tasks.controller.ts`)
- **Arquivo Atualizado:** [tasks.controller.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/tasks/tasks.controller.ts)
- **Descrição:** Atualização do handler `@Post()` para utilizar `CreateTaskPayloadDto` no decorador `@Body()`, garantindo validação prévia dos payloads de requisição.

#### C. Serviço de Tarefas (`tasks.service.ts`)
- **Arquivo Atualizado:** [tasks.service.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/tasks/tasks.service.ts)
- **Novas Funcionalidades:**
  - **Autoatribuição de Tarefas por Funcionários:** Funcionários (`role != Administrador`) agora podem criar tarefas atribuídas automaticamente a eles mesmos (`data.fk_id_func = caller.sub`), mantendo o comportamento de administradores criarem e atribuírem tarefas a colaboradores da empresa.
- **Correção de Bugs Críticos:**
  - **Preservação de Relacionamentos:** Corrigido o método `findAllByEmployee` para manter `relations: ['tarefa']` no `funcTarefaRepository.find()`. (Na versão bruta da pasta de alterações, o relacionamento havia sido omitido, fazendo com que as tarefas retornassem vazias/nulas para o funcionário).
  - **Exceções de Erro:** Corrigidos 5 locais com erros de sintaxe e aspas em falta nas mensagens de exceção (`NotFoundException` e `ForbiddenException`), restaurando a interpolação com template strings (`${taskId}`, `${currentStatus}`, etc.).

---

### 2. Frontend Expo (`tcc/frontend`)

#### A. Dependências (`package.json`)
- **Arquivo Atualizado:** [package.json](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/frontend/package.json)
- **Descrição:** Adicionada a dependência `"expo-image-picker": "~16.0.6"` necessária para acesso à galeria e foto de perfil.

#### B. Tela Dashboard (`dashboard.tsx`)
- **Arquivo Atualizado:** [dashboard.tsx](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/frontend/app/dashboard.tsx)
- **Novas Funcionalidades:**
  - **Troca de Foto de Perfil:** Implementada a função `handlePickPhoto` utilizando `expo-image-picker`. Permite selecionar uma imagem da galeria, convertê-la em Data URI (Base64) e enviá-la para o backend via `PATCH /users/:id`.
  - **Visualização da Foto no Modal:** O modal "Minha Conta" passa a exibir a foto do usuário (`userPhoto` ou `userData.foto`).
  - **Criação de Tarefas por Colaboradores:** Ajuste no formulário de criação de tarefas do modal para aceitar envio tanto por administradores (que selecionam um funcionário) quanto por colaboradores (que atribuem a si mesmos).
- **Correção de Erros:**
  - Removidas importações duplicadas do serviço de autenticação (`getToken`).
  - Corrigidos todos os caracteres corrompidos em UTF-8 (Mojibake), garantindo acentuação adequada em toda a interface (ex: *Permissão*, *Título*, *Descrição*, *Concluída*, *Amanhã*).

---

## 🧪 Verificação de Qualidade

- **Compilação do Backend (NestJS):** Executado `npm run build` com sucesso (0 erros de TypeScript ou síntaxe).
- **Consistência do Frontend:** Código TypeScript validado e formatado.
