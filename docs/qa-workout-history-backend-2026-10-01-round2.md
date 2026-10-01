# QA — Histórico de treinos — etapa backend — round 2 — 2026-10-01

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `e7312da` · **Motivo:** reteste do rework do **LOW #1** de `docs/security-workout-history-2026-10-01.md`. Antes do fix, um `before` aceito pelo `date-time` do schema, mas que o `Date` do JS não parseia, dava 500 em vez de 400. Round 1: `docs/qa-workout-history-backend-2026-10-01.md`.

- **Conta nova:** `qa.r2.1790893932048@torvtest.dev` (F / Iniciante / Perder Peso), criada pelo `POST /auth/register` a partir da página.
- **Ambiente:** backend no Furnace (`localhost:3000`), sem reinício e sem outra instância. Contrato por `fetch` dentro do portal "Torv Mobile #2", com o token só numa variável da página; a sessão do portal não foi tocada.

## Veredito: PASS (100% verde)

O LOW #1 está corrigido e o contrato da Task 2 continua igual.

## Revisão do fix (`e7312da`)

| Arquivo | Resultado |
|---|---|
| `BackEndTorv/src/controller/activities.controller.js:9-13` | ✅ **Validação:** `new Date(before)` é validado com `Number.isNaN(getTime())` antes do repository, e `400 { error: 'querystring/before must match format "date-time"' }` usa a mesma mensagem do Ajv. **O que não mudou:** `user_id` continua vindo do token; `type`/`limit` e o formato da resposta seguem iguais. É a menor mudança que resolve: um guarda no único ponto que converte o `before` |
| `BackEndTorv/src/routes/activities.routes.test.js:64-68` | ✅ Os 3 formatos entram na lista de 400 que **não chega ao repository** (`callCount 0`) |

## Automatizado

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 83/83 |

## Contrato ao vivo

| Item | Resultado |
|---|---|
| **Fix:** `before=2026-10-01T10:00:00-03` (fuso só com hora) | ✅ **400** `querystring/before must match format "date-time"` (antes: 500) |
| **Fix:** `before=2026-06-30T23:59:60Z` (segundo bissexto) | ✅ **400** (antes: 500) |
| **Fix:** `before=2026-10-01T02:59:60%2B03:00` (bissexto com offset `+`) | ✅ **400** (antes: 500) |
| Extra: `before=2016-12-31T23:59:60Z` (segundo bissexto que existiu de fato) | ✅ 400 |
| Os 3 formatos do fix, sem token | ✅ 401: a autenticação continua antes de tudo |
| `before` válido: `…T13:00:00Z`, `…T13:00:00.000Z`, `…T10:00:00-03:00`, `…T16:00:00%2B03:00` | ✅ 200 |
| `GET /activities` sem token | ✅ 401 |
| `type=RUN`, `type=strength`, `limit=0`, `limit=51`, `limit=abc`, `before=ontem`, `before=2026-10-01` | ✅ 7 × 400 |
| Paginação: 5 sessões em dias diferentes, `limit=2` | ✅ 2 + 2 + 1, com `next_before` não nulo → não nulo → **`null`**. Todas 200, ids sem repetição, em ordem decrescente e iguais aos dos POSTs |
| RF1: `limit=5` com exatamente 5 | ✅ A 1ª página traz `next_before` não nulo; a 2ª vem com 200 e `{ activities: [], next_before: null }` |

## Observações

- **Dados de teste:** a conta `qa.r2.1790893932048@torvtest.dev` continua no banco, com 5 sessões, porque não existe endpoint para apagar conta. Nenhum dado do usuário foi lido nem alterado.
