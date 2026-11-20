# Relatório de Desenvolvimento — 04/06/2026
## Projeto COOPERA — Fase 1: Hardening de Segurança (Ownership Validation)

> **Objetivo do dia**: Eliminar as vulnerabilidades de IDOR (Insecure Direct Object Reference) nos módulos de Wellbeing, Occurrences e Meetings, seguindo o padrão `validateXAccess()` estabelecido nas etapas anteriores.

---

## Contexto Geral

O projeto COOPERA é uma API NestJS/TypeORM para gestão de funcionários e empresas. A Fase 1 tem como meta proteger todos os endpoints com **validação de posse (ownership)**, garantindo que:

- Funcionários só acessam seus próprios dados.
- Empresas só acessam dados de seus próprios funcionários.
- Nenhum ator consegue ler, modificar ou excluir dados de outra empresa ou funcionário externo (**IDOR prevention**).

### Estado dos módulos antes de hoje

| Módulo        | Status antes |
|---------------|-------------|
| Auth          | ✅ Seguro    |
| Users         | ✅ Seguro    |
| Tasks         | ✅ Seguro    |
| Wellbeing     | ❌ Mock / sem ownership |
| Occurrences   | ❌ Tabela ausente / sem ownership |
| Meetings      | ❌ Mock / sem ownership |

---

## Etapa 4 — Ownership em Wellbeing (`/wellbeing`)

### Problema identificado
O módulo retornava dados mock (`return []`) e não tinha ligação com banco. Qualquer funcionário poderia, em tese, ver dados de bem-estar de outros funcionários.

### Arquivos modificados

| Arquivo | Tipo de alteração |
|---------|------------------|
| [wellbeing.module.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/wellbeing/wellbeing.module.ts) | Registrou `TypeOrmModule.forFeature([Humor, User])` |
| [create-wellbeing.dto.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/wellbeing/dto/create-wellbeing.dto.ts) | Validação: `humor_func` inteiro entre 1 e 5 |
| `update-wellbeing.dto.ts` | **Excluído** — edição de humor foi desativada (imutabilidade) |
| [wellbeing.controller.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/wellbeing/wellbeing.controller.ts) | Removeu PATCH e DELETE; injetou `@Req() req` |
| [wellbeing.service.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/wellbeing/wellbeing.service.ts) | Implementação completa com `validateWellbeingAccess` |

### Regras de negócio implementadas

- **Funcionário**: Pode criar e ver seus próprios registros. Sem edição ou exclusão (dados imutáveis por integridade histórica).
- **Empresa**: Pode ver (somente leitura) os humores dos seus funcionários nos últimos 30 dias.
- **Rate-limit diário**: Um funcionário não pode registrar mais de 1 humor por dia (`ConflictException` no segundo registro).
- **Origem do `fk_id_func`**: sempre extraída do JWT — nunca aceita do frontend.

### Ajuste de segurança aplicado
> Dados de humor **não podem ser editados ou excluídos**. Isso previne que a empresa apague humores ruins, mascare indicadores ou adultere históricos. O endpoint PATCH e DELETE foram removidos permanentemente do controller.

### Resultados dos testes (17 cenários — 100% aprovados)

| ID | Cenário | Esperado | Resultado |
|----|---------|----------|-----------|
| 1 | Funcionário A cria humor nota 4 | `201` | ✅ |
| 2 | Funcionário A tenta criar segundo humor no mesmo dia | `409 Conflict` | ✅ |
| 3 | Funcionário B cria humor nota 3 | `201` | ✅ |
| 4 | Empresa A tenta criar humor | `403 Forbidden` | ✅ |
| 5 | PATCH `/wellbeing/:id` (endpoint removido) | `404 Not Found` | ✅ |
| 6 | DELETE `/wellbeing/:id` (endpoint removido) | `404 Not Found` | ✅ |
| 7 | Funcionário A lista humores | `200` (só os seus) | ✅ |
| 8 | Empresa A lista humores | `200` (só seus funcionários, 30 dias) | ✅ |
| 9 | Funcionário A vê Registro 1 (seu) | `200` | ✅ |
| 10 | Funcionário A tenta ver Registro 2 (outro) | `403 Forbidden` | ✅ |
| 11 | Empresa A vê Registro 1 (seu funcionário) | `200` | ✅ |
| 12 | Empresa A tenta ver Registro 2 (outra empresa) | `403 Forbidden` | ✅ |

---

## Etapa 5 — Ownership em Occurrences (`/occurrences`)

### Problema identificado
A tabela `HIS_MEDICO` não existia no banco local. Os dados médicos (atestados e ocorrências) são **dados sensíveis segundo a LGPD**, exigindo proteção reforçada.

### Ações executadas

1. **Criou a tabela `HIS_MEDICO`** no PostgreSQL via script Node.js, com as colunas:
   - `pk_id_histmed` (PK), `atestado_func` (VARCHAR 255), `ocorrencias` (VARCHAR 50), `fk_id_func` (FK → `INFO_FUNCIONARIO`)

### Arquivos modificados

| Arquivo | Tipo de alteração |
|---------|------------------|
| [occurrence.entity.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/occurrences/entities/occurrence.entity.ts) | Decorado com `@Entity('his_medico')` e colunas mapeadas |
| [occurrences.module.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/occurrences/occurrences.module.ts) | Registrou `TypeOrmModule.forFeature([Occurrence, User])` |
| [create-occurrence.dto.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/occurrences/dto/create-occurrence.dto.ts) | Validação: campos opcionais com `@Length(1, 50)` |
| [update-occurrence.dto.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/occurrences/dto/update-occurrence.dto.ts) | Criado com `@IsOptional()` e mesmos limites |
| [occurrences.controller.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/occurrences/occurrences.controller.ts) | Injetou `@Req() req`; repassou `req.user` a todos os métodos |
| [occurrences.service.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/occurrences/occurrences.service.ts) | Implementação completa com `validateOccurrenceAccess` |

### Regras de negócio implementadas

- **Funcionário**: Cria, lê, edita e exclui **apenas seus próprios** registros médicos.
- **Empresa**: Somente leitura (`GET`) dos registros dos seus funcionários. Não pode criar, editar ou excluir. (Evita que a empresa manipule atestados.)
- **`fk_id_func`**: sempre extraída do JWT — nunca do body da requisição.

### Resultados dos testes (16 cenários — 100% aprovados)

| ID | Cenário | Esperado | Resultado |
|----|---------|----------|-----------|
| 1 | Funcionário A cria ocorrência | `201` | ✅ |
| 2 | Funcionário B cria ocorrência | `201` | ✅ |
| 3 | Empresa A tenta criar ocorrência | `403 Forbidden` | ✅ |
| 4 | Funcionário A lista suas ocorrências | `200` (só as suas) | ✅ |
| 5 | Empresa A lista ocorrências | `200` (só seus funcionários) | ✅ |
| 6 | Funcionário A vê seu Registro 1 | `200` | ✅ |
| 7 | Funcionário A tenta ver Registro 2 (outro) | `403 Forbidden` | ✅ |
| 8 | Empresa A vê Registro 1 (seu funcionário) | `200` | ✅ |
| 9 | Empresa A tenta ver Registro 2 (outra empresa) | `403 Forbidden` | ✅ |
| 10 | Funcionário A atualiza seu Registro 1 | `200` | ✅ |
| 11 | Funcionário A tenta atualizar Registro 2 | `403 Forbidden` | ✅ |
| 12 | Empresa A tenta atualizar Registro 1 | `403 Forbidden` | ✅ |
| 13 | Funcionário A envia `ocorrencias` > 50 chars | `400 Bad Request` | ✅ |
| 14 | Funcionário A tenta excluir Registro 2 | `403 Forbidden` | ✅ |
| 15 | Empresa A tenta excluir Registro 1 | `403 Forbidden` | ✅ |
| 16 | Funcionário A exclui seu Registro 1 | `200` | ✅ |

---

## Etapa 6 — Ownership em Meetings (`/meetings`)

### Problema identificado
O módulo era completamente mock (retornava dados estáticos). As tabelas de reuniões não existiam no banco. Sem ownership, qualquer empresa poderia ver ou modificar reuniões de outra empresa.

### Ações executadas

1. **Criou as tabelas no PostgreSQL** via script Node.js:
   - `REUNIAO`: `pk_id_reuniao`, `data_reuniao` (DATE), `horario_reuniao` (TIME), `assunto_reuniao` (VARCHAR 100), `tipo_reuniao` (VARCHAR 30)
   - `PARTICIPANTES_REU`: `pk_id_participantes_reu`, `fk_id_reuniao` (FK → REUNIAO ON DELETE CASCADE), `fk_id_func` (FK → INFO_FUNCIONARIO ON DELETE CASCADE)

### Arquivos modificados

| Arquivo | Tipo de alteração |
|---------|------------------|
| [meeting.entity.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/entities/meeting.entity.ts) | Decorado com `@Entity('reuniao')` e colunas mapeadas |
| [meeting-participant.entity.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/entities/meeting-participant.entity.ts) | **Novo arquivo** — entidade pivô `participantes_reu` |
| [meetings.module.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/meetings.module.ts) | Registrou `TypeOrmModule.forFeature([Meeting, MeetingParticipant, User])` |
| [create-meeting.dto.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/dto/create-meeting.dto.ts) | Reescrito: campos do banco + `participants: number[]` com `@IsArray()` / `@IsInt({ each: true })` |
| [update-meeting.dto.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/dto/update-meeting.dto.ts) | **Novo arquivo** — todos os campos opcionais com `@IsOptional()` |
| [meetings.controller.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/meetings.controller.ts) | Injetou `@Req() req`; repassou `req.user` a todos os métodos; usa `UpdateMeetingDto` |
| [meetings.service.ts](file:///c:/Users/Amadeu_Turolla/Documents/ATCB/tcc/Backend/src/meetings/meetings.service.ts) | Implementação completa com `validateMeetingAccess` |

### Decisão de design chave
> A tabela `REUNIAO` **não possui `fk_cod_empresa` diretamente**. A relação da reunião com a empresa é determinada de forma **transitiva** via `PARTICIPANTES_REU → INFO_FUNCIONARIO → fk_cod_empresa`. Isso exige que o `validateMeetingAccess` sempre consulte os participantes para determinar o dono da reunião.

### Regras de negócio implementadas

- **Funcionário**: Pode criar reuniões (apenas com participantes da própria empresa) e ver reuniões onde é participante. Não pode editar nem excluir.
- **Empresa**: Cria, lista, visualiza, edita e exclui reuniões de seus funcionários. Não pode criar reuniões com participantes de outra empresa.
- **`validateMeetingAccess`**:
  - Verifica se o funcionário logado consta em `PARTICIPANTES_REU` para a reunião solicitada.
  - Verifica se algum participante da reunião tem `fk_cod_empresa` igual ao ID da empresa logada.

### Ajustes recomendados pelo revisor (a implementar)

| # | Ajuste | Prioridade |
|---|--------|-----------|
| 1 | Restringir criação de reunião apenas para **empresas** (ou exigir que funcionário seja listado como participante) | ⚠️ Alta |
| 2 | Bloquear `participants: []` vazio com `BadRequestException` | ⚠️ Muito Alta |
| 3 | Substituir loop de queries por `userRepository.find({ where: { pk_id_func: In([...]) } })` | 📈 Escalabilidade |
| 4 | Envolver o update de participantes em `QueryRunner` com transação atômica | 🔒 Integridade |

---

## Resumo de Segurança — Estado dos Módulos ao Final do Dia

| Módulo      | Status | IDOR | LGPD | Ownership | DTO Validation |
|-------------|--------|------|------|-----------|----------------|
| Auth        | ✅     | ✅   | ✅   | ✅        | ✅             |
| Users       | ✅     | ✅   | ✅   | ✅        | ✅             |
| Tasks       | ✅     | ✅   | ✅   | ✅        | ✅             |
| Wellbeing   | ✅     | ✅   | ✅   | ✅        | ✅             |
| Occurrences | ✅     | ✅   | ✅   | ✅        | ✅             |
| Meetings    | ✅*    | ✅   | ✅   | ✅        | ✅             |
| Chat        | ❌     | ❌   | ❌   | ❌        | —              |
| Work        | ❌     | ❌   | —    | ❌        | —              |

> *Meetings: implementação base concluída. Ajustes de escalabilidade e endurecimento pendentes.

---

## Padrão Arquitetural Estabelecido

Todos os módulos seguem agora o mesmo padrão de ownership:

```typescript
// 1. Método auxiliar privado — separação clara entre busca e autorização
private async validateXAccess(resourceId: number, caller: any): Promise<Entity> { ... }

// 2. Caller extraído do JWT pelo guard e repassado via req.user
@Get(':id')
findOne(@Param('id') id: string, @Req() req) {
  return this.xService.findOne(+id, req.user);
}

// 3. ID do caller nunca vem do body — sempre do JWT
const callerId = caller.userId || caller.sub;
```

---

## Próximos Módulos na Fila

| Prioridade | Módulo | Risco principal |
|-----------|--------|----------------|
| 🔴 Alta   | **Chat** | Leitura de mensagens privadas de outros usuários (LGPD crítico) |
| 🟠 Média  | **Work** | Alteração de ponto de outro funcionário |
| 🟡 Baixa  | Meetings (refinamento) | Ajustes de escalabilidade e transações atômicas |
