# QA — Carga por série, período e boas-vindas — etapa Backend — round 3 — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `0a82553` · **Motivo:** reteste do **LOW** de `docs/security-loads-welcome-2026-10-02.md`. O `format: 'uuid'` do Ajv aceita o prefixo `urn:uuid:`, e o `::uuid` do SQL cru do `PATCH /workouts/routines/:id/weights` dava 500 com ele. Rounds anteriores: `docs/qa-loads-welcome-backend-2026-10-02.md` e `…-round2.md`.

Só o que mudou foi retestado.

## O fix (`0a82553`)

`BackEndTorv/src/routes/workout.schemas.js`:
- Nova constante `UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`.
- `Uuid` passa a ser `Type.String({ format: 'uuid', pattern: UUID_PATTERN })` e é usado nos `:id` da rota e nos `exercise_id` dos corpos.
- `routine_id` do `SessionBody` também ganhou o `pattern`.
- O `format` fica só pela documentação OpenAPI. A mudança vale para todas as rotas de `/workouts` (e só para elas).

## Ambiente

- **Backend:** o do Furnace (`http://127.0.0.1:3000`), já recarregado pelo nodemon. Não subi nem parei nada. Sem navegador. `.env` intocado.
- **Contrato:** `fetch` num script descartável do scratchpad. Tokens e senhas não estão neste relatório.
- **Contas novas**, criadas por `POST /auth/register`: `qa.lw3.a.1790980768721@torvtest.dev` (A) e `qa.lw3.b.1790980768721@torvtest.dev` (B). Continuam no banco, porque não existe endpoint para apagar conta.

## Veredito: PASS (100% verde)

O LOW está corrigido: todo `urn:uuid:` é recusado com 400 antes de chegar ao banco, o UUID em maiúsculas continua aceito e a regressão do módulo ficou igual. O script rodou **52 checagens, 0 falhas**.

| Item | Resultado |
|---|---|
| (a) `npm test` | ✅ PASS (92/92) |
| (b1) `urn:uuid:` → 400 | ✅ PASS |
| (b2) UUID em maiúsculas continua aceito | ✅ PASS |
| (b3) Regressão rápida | ✅ PASS |

## (a) Testes

`cd BackEndTorv && npm test`: ✅ **92/92**, 0 falhas.

## (b1) `urn:uuid:` recusado

O "antes 500" é o que o relatório de Security descreve; eu não refiz o teste na versão antiga.

| Item | Resultado |
|---|---|
| `PATCH /workouts/routines/urn:uuid:<id>/weights` | ✅ **400** `params/id must match pattern "^[0-9a-fA-F]{8}-…$"` |
| `PATCH` com `exercise_id: 'urn:uuid:<id>'` no corpo | ✅ **400** `body/sets/0/exercise_id must match pattern …` |
| A rotina não mudou depois dos dois | ✅ |
| `POST /workouts/sessions` com `routine_id: 'urn:uuid:…'` | ✅ **400** `body/routine_id must match pattern …` |
| `POST /workouts/sessions` com `exercise_id: 'urn:uuid:…'` num `sets[]` | ✅ **400** `body/sets/0/exercise_id must match pattern …` |
| Controle: a mesma sessão, com ids válidos e a mesma data | ✅ 201. Os 400 não deixaram nada gravado |
| Extra, mesmas rotas de `/workouts` com `urn:uuid:` | ✅ 400 em `GET`, `PUT` e `DELETE /routines/:id`, `PUT` e `DELETE /exercises/:id`, `GET /sessions/:id`, `POST /routines` (com `exercise_id` urn) e `PUT /routines/:id` (com `exercise_id` urn) |
| A rotina continua existindo e igual depois desses 400 (inclusive depois do `DELETE` e do `PUT`) | ✅ |
| Extra, outras formas fora do padrão no `:id` do PATCH | ✅ 400 para: **sem hífens**, **com chaves** `{…}`, **espaço no fim**, **curto** (31 caracteres) e **caractere não hex** (`g`) |

## (b2) Maiúsculas continuam aceitas

| Item | Resultado |
|---|---|
| `PATCH` com o `:id` da rota em MAIÚSCULAS | ✅ 200 `{ "updated": 1 }` |
| `PATCH` com `exercise_id` em MAIÚSCULAS | ✅ 200 `{ "updated": 1 }`. O id em maiúsculas bate com o exercício da rotina |
| `GET` da rotina depois dos dois | ✅ cargas 11 e 12 aplicadas |
| `GET /routines/<ID EM MAIÚSCULAS>` | ✅ 200 |
| `POST /sessions` com `routine_id` e `exercise_id` em MAIÚSCULAS | ✅ 201 |
| `GET /sessions/<ID EM MAIÚSCULAS>` | ✅ 200, com a carga 45 |
| Extra: id com maiúsculas e minúsculas misturadas | ✅ 200 `{ "updated": 1 }` |

## (b3) Regressão rápida (ids válidos)

| Item | Resultado |
|---|---|
| **PATCH weights** com 6 itens (4 batem, 2 não) | ✅ 200 `{ "updated": 4 }`, e o GET mostra `[62.5, null, 0, null, 100]` |
| PATCH na rotina da **outra conta** | ✅ 404, e a rotina dela fica igual |
| PATCH com `weight_kg` -1 / sem token | ✅ 400 / 401 |
| **POST de sessão** com cargas 62.5, 0, `null` e ausente | ✅ 201 |
| **GET da sessão** | ✅ `[62.5, 0, null, null]` |
| POST repetido com o mesmo `started_at` | ✅ 200 com o mesmo `activity_id` |
| POST com `weight_kg` 1000 | ✅ 400 |
| GET da sessão de A com o token de B | ✅ 404 |
| `GET /routines` | ✅ 200, com a rotina na lista |
| **`PUT /routines/:id`** válido | ✅ 200. O GET mostra o nome novo e a ordem dos exercícios invertida |
| `PUT` e `DELETE` na rotina da outra conta | ✅ 404, e a de B continua existindo |
| **`DELETE /routines/:id`** próprio | ✅ 204, e o GET depois dá 404 |
| **Exercícios**: `POST` → `GET` → `PUT` → `DELETE` próprios | ✅ 201 → aparece na lista com `is_custom: true` → 200 → 204 |
| `PUT` de exercício de outra conta | ✅ 404 |
| `DELETE` de exercício do catálogo | ✅ 404 |
| Extra: UUID válido que não existe | ✅ 404 (e não 400) |

## Observações

- **INFO:** a mensagem de erro mostra o `pattern` inteiro (`params/id must match pattern "^[0-9a-fA-F]{8}-…$"`). É o texto padrão do Ajv. Não vaza dado, mas é menos legível que o antigo `must match format "uuid"`.
- **Dados de teste:** as contas `qa.lw3.{a,b}.1790980768721@torvtest.dev` continuam no banco, com as rotinas e sessões que o script criou. Nenhum dado de outro usuário foi lido nem alterado.
