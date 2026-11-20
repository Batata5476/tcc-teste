# Resumo da Integração — `yuuki-p/tcc` + `Batata5476/TCC-domain`

**Branch de integração (não definitivo):** `merge/tcc-domain-integracao`  
**Objetivo:** Unificar em uma única base funcional as melhorias de deploy/navegação/testes do repositório `Batata5476/TCC-domain` com todas as correções críticas P0/P1/P2, segurança multi-tenant, setores dinâmicos e scripts de demonstração do repositório `yuuki-p/tcc`, mantendo a `main` de ambos os repositórios intacta para revisão via Pull Request.

---

## 1. O que foi integrado dos dois repositórios

### De `Batata5476/TCC-domain` (`domain/main`)
- **Configuração de Deploy na Vercel:** `vercel.json`, `frontend/vercel.json` e `Backend/vercel.json`.
- **Atualização do Frontend para Expo SDK 58:** `expo ~58.0.26`, `react-native 0.88.1`, `expo-router ~58.0.32` e script `build` (`expo export --platform web`).
- **Blindagem de Navegação:** `_layout.tsx`, `dashboard.tsx` (bloqueio de retorno para tela de login via `BackHandler` e `popstate`), `cadastroEmpresa.tsx` (validação de senha forte e tratamento de erros em array), `inserirTokenEmpresa.tsx`, `ponto-e.tsx`, `perfilHeader.tsx`, `chat.tsx`, `bemEstar.tsx` e `perfilFunc.tsx` usando `router.replace("/dashboard")`.
- **Automação de Banco:** Criação automática do banco em `Backend/scripts/setup-local-db.js`, detecção/atualização de schema legado e verificação do schema base (`BD/coopera.sql`).
- **Suíte de Testes de Terminal & Unitários:** `tests/backend_test.mjs`, `tests/frontend_test.mjs`, `tests/run_all.mjs` e melhorias em `Backend/src/tasks/tasks.service.spec.ts`.
- **Segurança de Ponto Eletrônico:** Verificação de titularidade (`work.fk_id_func !== caller.sub`) em `Backend/src/work/work.service.ts` para impedir edição/exclusão de registros de terceiros.

### De `yuuki-p/tcc` (Correções P0/P1/P2 locais)
- **Autenticação Unificada e Segurança:** Login Admin Master por CNPJ ou e-mail, política de senha forte (`CreateCompanyDto`), proteção anti-brute-force (Throttler global 240 req/min + limites estritos em auth), proteção contra auto-desativação do Admin Master e validação estrita com `UpdateCompanyDto` e `CreateSetorDto`.
- **Gestão Dinâmica de Setores:** Endpoints `GET/POST /company/sectors` e interface de chips com criação rápida (`+ Criar`) em `frontend/app/cadastroFuncionario.tsx`.
- **Módulos Consolidados:** `link_reuniao TEXT`, `his_medico.ocorrencias VARCHAR(255)` (incluindo migration dedicada `migration_fix_occurrence_length.sql`), permissão `meetings.update` para colaboradores, filtros de KPIs/faltas em `gestaoFuncionarios.tsx`, cards modernos em `perfilFunc.tsx`, upload seguro de mídia com cabeçalhos CSP/`nosniff` e backup multi-tenant isolado via `execFileSync`.
- **Scripts de Demonstração:** `demo:load`, `demo:clear` e `GUIA_APRESENTACAO_TCC.md`.

---

## 2. Falhas Encontradas e Corrigidas na Integração

1. **Rotas duplicadas em `Backend/src/company/company.controller.ts`:** O auto-merge duplicou `@Get('sectors')` e `@Post('sectors')`. Consolidado em rotas únicas protegidas por `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` e DTO validado (`CreateSetorDto`).
2. **Hash `bcrypt` inválido em `BD/dadosdeteste.sql`:** O hash presente no `TCC-domain` não correspondia à senha `Teste@123`. Substituído por um hash `bcrypt` real verificado para `Teste@123` e ajustado para `ON CONFLICT DO NOTHING`.
3. **Compatibilidade Serverless em `Backend/src/main.ts`:** Adicionado export `default` com `ExpressAdapter` para funcionar no `@vercel/node` (`Backend/vercel.json`) quando `process.env.VERCEL` estiver definido, mantendo o `bootstrap()` tradicional fora da Vercel.
4. **Dependências não declaradas em `Backend/package.json`:** Declaradas explicitamente `"dotenv": "^16.6.1"` e `"express": "^4.22.1"` (com `Backend/package-lock.json` sincronizado) e adicionado `"engines": { "node": ">=20.0.0" }` na raiz e no Backend.
5. **Resolução unificada da URL da API (`frontend/services/config.ts`):** Compatível com HTTPS/produção (`EXPO_PUBLIC_API_URL`), web local (`http://<host>:3000`), produção na Vercel (`window.location.origin`), Expo Go (`hostUri`) e fallback `.env.local`.
6. **Diagnóstico de erros em `Backend/scripts/setup-local-db.js`:** Tratamento para `AggregateError` sem `message` e remoção de `ALTER TABLE` duplicado após `migration_fix_occurrence_length.sql`.

---

## 3. Verificações Executadas (Todas Aprovadas)

| Verificação | Comando | Resultado |
| :--- | :--- | :--- |
| **Build do Backend** | `npm run build:backend` | Aprovado (0 erros) |
| **Testes Unitários Backend (Jest)** | `npm run test:backend` | **5/5 suítes, 35/35 testes aprovados** (incluindo novo teste de titularidade em `work.service.spec.ts`) |
| **Testes Node (Backend + Frontend)** | `npm run test:node` | **4/4 testes aprovados** (`tests/run_all.mjs`) |
| **Typecheck do Frontend** | `npm --prefix frontend run typecheck` | Aprovado (0 erros) |
| **Export Web (Vercel / Expo)** | `npm run build` | **19 bundles web + 43 assets** exportados em `frontend/dist` |
| **Setup & Migrations do Banco** | `npm run db:setup` | Schema base + **5 migrations** aplicadas com sucesso |
| **Auditoria de Dependências** | `npm ls --depth=0` + scan de imports | 0 dependências ausentes em `Backend` e `frontend` |

---

## 4. Como testar esta ramificação localmente

```bash
git checkout merge/tcc-domain-integracao
npm run setup
npm run db:setup
npm run check
```
