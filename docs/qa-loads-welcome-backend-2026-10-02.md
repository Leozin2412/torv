# QA — Carga por série, período e boas-vindas — etapa Backend — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module` · **Escopo:** Task 4 do plano `docs/superpowers/plans/2026-10-02-loads-period-welcome.md` (spec `docs/superpowers/specs/2026-10-02-loads-period-welcome-design.md`).

Commits da etapa:
- `f218b97`: `weight_kg` nas sessões e `PATCH /workouts/routines/:id/weights`.
- `60f84ec`: `welcome_pending` e `POST /profile/welcome`.
- `8386f73`: `from` (inclusivo) em `GET /activities`.
- `fc5924f`: `PATCH` no CORS.

## Ambiente

- **Backend:** o que já roda no Furnace (`http://127.0.0.1:3000`), sem reinício e sem outra instância. `.env` intocado.
- **Contrato:** por `fetch` num script descartável do scratchpad (fora do repo), com o token só em variável do script. Tokens e senhas não estão neste relatório.
- **Contas novas**, criadas por `POST /auth/register`:
  - **Resultados deste relatório:** `qa.lw.a.1790965557752@torvtest.dev` ("A", dona das sessões e das rotinas) e `qa.lw.b.1790965557752@torvtest.dev` ("B", a outra conta).
  - **Tentativas anteriores:** `qa.lw.{A,B}.1790965455008` e `qa.lw.{A,B}.1790965471001`, descartadas por erro do meu script (abaixo). A senha é aleatória e não foi guardada, então elas não são reutilizáveis.
  - O provedor de auth grava o e-mail em minúsculas. Por isso o script final usa `a` e `b` minúsculos.
- **Leitura direta no banco:** só o `welcomed_at` das duas contas `qa.lw.*` que criei, para provar que o 2º `POST /profile/welcome` não muda o horário. Nenhum dado de outro usuário foi lido.

## Veredito: PASS (5/5 + `npm test`)

Há **1 achado extra LOW** (PATCH com muitas séries leva a 500 por timeout), que está fora dos 5 itens.

| # | Item | Resultado |
|---|---|---|
| 0 | `npm test` do backend | ✅ PASS (92/92) |
| 1 | Sessões com `weight_kg` | ✅ PASS |
| 2 | `PATCH /workouts/routines/:id/weights` | ✅ PASS |
| 3 | `GET /activities` com `from` e `before` | ✅ PASS |
| 4 | Boas-vindas | ✅ PASS |
| 5 | CORS com `PATCH` | ✅ PASS |
| extra | PATCH com 100+ séries | ⚠️ LOW (ver Achados) |

O script final rodou **70 checagens**: 69 verdes e 1 vermelha, que é a do achado.

## 0. Testes do backend

`cd BackEndTorv && npm test`: ✅ **92/92**, 0 falhas.

## 1. Sessões

| Item | Resultado |
|---|---|
| `POST /workouts/sessions` com `weight_kg` **62.5, 0, null e sem o campo** | ✅ 201 |
| `GET /workouts/sessions/:id` | ✅ `[62.5, 0, null, null]`, na ordem das séries, com 62.5 e 0 como **número** (não string) |
| `weight_kg` **-1** | ✅ 400 `body/sets/0/weight_kg must be >= 0` |
| `weight_kg` **1000** | ✅ 400 `body/sets/0/weight_kg must be <= 999.99` |
| Extra: `999.99` (limite) | ✅ aceito e devolvido como 999.99 |
| Extra: `62.555` | ✅ aceito e gravado como **62.56** (arredonda no `numeric(6,2)`) |
| Extra: `999.995` e `"abc"` | ✅ 400 nos dois |
| Extra: sem token | ✅ 401 |
| Extra: `GET` da sessão de A com o token de B | ✅ 404 |

## 2. PATCH das cargas

Rotina de teste da conta A: exercício 1 (posição 1) com 2 séries (nulo e 50) e exercício 2 (posição 2) com 3 séries (todas nulas).

| Item | Resultado |
|---|---|
| PATCH com 4 itens que batem (62.5, `null`, 100, 0) | ✅ 200 `{ "updated": 4 }`. O `GET /workouts/routines/:id` mostra `[62.5, null, 0, null, 100]`, ou seja, a série que tinha 50 passou a `null` e valores como número |
| Itens que **não batem**: posição trocada, exercício trocado, `set_number` inexistente, posição inexistente | ✅ 200 `{ "updated": 0 }`, e a rotina **continua igual** |
| Misto: 2 batem e 2 não | ✅ `updated: 2`. No GET só mudaram os 2 que batem (55.25 e 80) |
| Mesma série duas vezes no corpo | ✅ a última vence |
| **Rotina da OUTRA conta** (A → rotina de B) | ✅ 404 `{"error":"Not found"}`, e a rotina de B **continua igual** |
| Sentido inverso (B → rotina de A) | ✅ 404, e a de A continua igual |
| Rotina inexistente | ✅ 404 |
| **Corpo inválido** → 400, 14 casos | ✅ `{}`, `sets: []`, `sets` que não é array, `weight_kg` -1, 1000 e `"abc"`, **sem `weight_kg`**, `position` 0 e 21, `set_number` 0 e 11, `exercise_id` que não é uuid, sem `exercise_id`, 201 itens |
| Nenhum corpo inválido alterou a rotina | ✅ |
| Extra: `id` da rota que não é uuid | ✅ 400 |
| Extra: sem token | ✅ 401 |

## 3. Período

A conta A tem 6 treinos, em 21, 22, 23, 24, 25 e 26/09/2026 às 10:00Z.

| Item | Resultado |
|---|---|
| `from=22` + `before=25` | ✅ 24, 23, 22. O `from` é **inclusivo** (22 entra) e o `before` é **exclusivo** (25 fica de fora) |
| Só `from=23` | ✅ do 23 em diante, sem nada mais antigo |
| Só `before=23` (como antes) | ✅ 22 e 21 |
| **`from` > `before`** | ✅ 200 `{ "activities": [], "next_before": null }` |
| `from` == `before` | ✅ lista vazia |
| `from` no futuro | ✅ lista vazia |
| Paginação com `from`, `limit=2` | ✅ 25,24 → 23,22 → 21. O `next_before` aparece nas duas primeiras páginas e vira `null` na última |
| `from` + `before` + `type=STRENGTH` | ✅ 23, 22 |
| Mesmo instante com offset `-03:00` | ✅ 23, 22 |
| Conta B (sem treinos) com a mesma janela | ✅ vazio |
| **`from` inválido** → 400, 5 formas | ✅ `ontem`, só data `2026-09-22`, fuso só com hora `…T10:00:00-03`, segundo bissexto `…T23:59:60Z` e vazio. Todos devolvem `querystring/from must match format "date-time"` |
| Extra: `from` válido + `before` inválido | ✅ 400 com a mensagem do `before` |
| Extra: com `from`, sem token | ✅ 401 |

## 4. Boas-vindas

| Item | Resultado |
|---|---|
| Conta nova: `GET /profile` | ✅ `welcome_pending: true`, e `welcomed_at` é NULL no banco |
| `POST /profile/welcome` | ✅ 204 sem corpo |
| `GET /profile` depois | ✅ `welcome_pending: false`, e `welcomed_at` gravado |
| **2º POST** (1,5 s depois) | ✅ 204, continua `false`, e o `welcomed_at` é **idêntico** ao do 1º POST |
| Conta B | ✅ segue com `welcome_pending: true` |
| Extra: sem token | ✅ 401 |

## 5. CORS

`OPTIONS /workouts/routines/<id>/weights`, com `Origin: http://localhost:8081`, `Access-Control-Request-Method: PATCH` e `Access-Control-Request-Headers: authorization,content-type`:

| Item | Resultado |
|---|---|
| Resposta do preflight | ✅ **204** |
| `access-control-allow-methods` | ✅ `GET, POST, PUT, PATCH, DELETE` |
| `access-control-allow-origin` e `-headers` | ✅ `*` e `authorization,content-type` |
| `PATCH` de verdade com `Origin` | ✅ a resposta traz `access-control-allow-origin: *` |

## Achados

### LOW — PATCH com muitas séries estoura o timeout e devolve 500 (Backend)

- **Onde:**
  - `BackEndTorv/src/repository/workout.repository.js:157-176` (`updateRoutineWeights`): faz **1 `updateMany` por série** dentro de uma transação interativa com `TX = { timeout: 15000 }` (`:6`).
  - O limite do corpo é 200 itens (`BackEndTorv/src/routes/workout.schemas.js:112`), e uma rotina cheia (20 exercícios × 10 séries) tem 200 séries.
- **Teste:** rotina cheia criada pela API, com PATCH de N séries distintas que batem. Cada UPDATE levou cerca de **170–250 ms** neste ambiente, com o backend local falando com o Supabase em us-east-1.

| N séries | Resultado |
|---|---|
| 10 | 200 `updated: 10`, 2,5 s |
| 50 | 200 `updated: 50`, 8,4 s |
| 100 | **500** `An unexpected error occurred`, depois de 15,3 s |

- **Efeito do erro:** o ROLLBACK funcionou. Depois do 500, a rotina continuava com as mesmas 50 cargas do passo anterior e nada ficou pela metade. O app só mostraria uma falha.
- **Impacto:**
  - O uso normal manda poucas séries (só as cargas do treino), então fica abaixo de 10 s.
  - Com a latência de hoje, o teto fica em cerca de 90 séries: uma rotina grande já falha.
  - Em produção, com a API perto do banco, o limite sobe muito.
- **Saída:** a própria nota `ponytail:` do código já aponta o caminho, um único `UPDATE … FROM (VALUES …)`. Outra opção é baixar o `maxItems` do corpo para um valor que caiba no timeout.
- **Não bloqueia a etapa:** os 5 itens do plano passam.

## Observações

- **INFO (padrão do módulo, não é do diff):** o `authenticateToken` roda no `preHandler`, depois da validação do corpo. Um PATCH **sem token e com corpo inválido** devolve 400, e não 401; com corpo válido, devolve 401. Nenhum dado vaza.
- **INFO:** `weight_kg: true` num POST de sessão é aceito (201) e gravado como 1. É a coerção de tipos do Ajv, que já vale para os outros campos numéricos da API, e não uma regressão deste commit. O corpo do PATCH tem o mesmo comportamento.
- **Meu script, não é falha do backend:** nas duas primeiras execuções o script errou, e as refiz com contas novas.
  - **1ª execução:** li `id` em vez de `activity_id` na resposta do `POST /workouts/sessions`.
  - **2ª execução:** o caso `weight_kg: true` criou um treino em 29/09 que bagunçou a lista-base do item 3, e a busca do `welcomed_at` falhou porque o e-mail no banco está em minúsculas.
  - **Resultado final:** o caso `true` foi movido para o fim, o e-mail passou a ser comparado sem diferenciar maiúsculas, e a 3ª execução inteira é a que vale para as tabelas.
- **Dados de teste:** as 6 contas `qa.lw.*` continuam no banco, com as sessões e rotinas, porque não existe endpoint para apagar conta.
