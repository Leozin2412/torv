# QA — Carga por série, período e boas-vindas — etapa Backend — round 2 — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `d61fc7c` · **Motivo:** reteste do **LOW** de `docs/qa-loads-welcome-backend-2026-10-02.md` (round 1). Naquele relatório, `PATCH /workouts/routines/:id/weights` fazia 1 UPDATE por série e estourava o timeout de 15 s (100 séries → 500).

Só o que mudou foi retestado; sessões, período, boas-vindas e CORS estão no round 1.

## O fix (`d61fc7c`)

`BackEndTorv/src/repository/workout.repository.js`, `updateRoutineWeights`:
- **Dono da rotina:** um `findFirst` com `user_id` devolve `null` (→ 404) se a rotina não for do usuário.
- **Escrita:** um `UPDATE routine_exercise_sets … FROM routine_exercises, workout_routines, (VALUES …) AS v(position, exercise_id, set_number, weight_kg)`. O `WHERE` casa posição + exercício + nº da série, e põe **`wr.id` e `wr.user_id`** de novo, de modo que o dono também vale na própria escrita.
- **Retorno:** o número de linhas atualizadas.

## Ambiente

- **Backend:** o do Furnace (`http://127.0.0.1:3000`), já recarregado pelo nodemon. Não subi nem parei nada. `.env` intocado.
- **Contrato:** `fetch` num script descartável do scratchpad. Tokens e senhas não estão neste relatório.
- **Contas novas**, criadas por `POST /auth/register`: `qa.lw2.a.1790965927945@torvtest.dev` (A) e `qa.lw2.b.1790965927945@torvtest.dev` (B). Continuam no banco, porque não existe endpoint para apagar conta.

## Veredito: PASS (100% verde)

O LOW está corrigido: o PATCH de 200 séries leva cerca de 0,4 s (antes, 100 séries davam 500 depois de 15 s) e o comportamento do item 2 não mudou. O script rodou **43 checagens, 0 falhas**.

| Item | Resultado |
|---|---|
| (a) `npm test` | ✅ PASS (92/92) |
| (b) Item 2 inteiro ao vivo | ✅ PASS |
| (c) Tempo com rotina de 200 séries | ✅ PASS |

## (a) Testes

`cd BackEndTorv && npm test`: ✅ **92/92**, 0 falhas.

## (b) Item 2 refeito ao vivo

Rotina de A: exercício 1 (posição 1) com 2 séries (nulo e 50) e exercício 2 (posição 2) com 3 séries (todas nulas).

| Item | Resultado |
|---|---|
| PATCH na rotina própria com 4 itens: 62.5, `null`, 100 e 0 | ✅ 200 `{ "updated": 4 }`. O GET mostra `[62.5, null, 0, null, 100]`: o **`null`** apagou o 50 que existia, o **0** ficou como 0 (não `null`) e todos vêm como número |
| **Posição trocada**, **exercício trocado**, posição inexistente e exercício que não está na rotina | ✅ 200 `{ "updated": 0 }`, e a rotina **continua igual** |
| **Série inexistente** (`set_number` 3 e 10 no exercício 1, que tem 2 séries, e 4 no exercício 2, que tem 3) | ✅ `updated: 0`, nenhuma série criada nem alterada |
| Misto: 2 batem e 3 não (posição trocada, exercício trocado, série inexistente) | ✅ `updated: 2`. No GET só mudaram os 2 que batem (55.25 e 80) |
| **Rotina da OUTRA conta** (A → rotina de B) | ✅ 404 `Not found`, e a rotina de B **continua igual** |
| Sentido inverso (B → rotina de A) | ✅ 404, e a de A continua igual |
| Rotina inexistente | ✅ 404 |
| **Corpo inválido** → 400, 14 casos | ✅ `{}`, `sets: []`, `sets` que não é array, `weight_kg` -1, 1000 e `"abc"`, sem `weight_kg`, `position` 0 e 21, `set_number` 0 e 11, `exercise_id` que não é uuid, sem `exercise_id`, 201 itens |
| Nenhum corpo inválido alterou a rotina | ✅ |
| Extra: `id` da rota que não é uuid | ✅ 400 |
| Extra: sem token | ✅ 401 |
| Extra, precisão: 22.3, 999.99, 0.01 e 62.555 | ✅ 4 atualizadas; 22.3, 999.99 e 0.01 exatos; 62.555 vira **62.56**, igual ao comportamento do round 1. Não há erro de `float → numeric` no `::numeric` do VALUES |
| Extra, **rotina editada no meio do treino** (PUT inverteu a ordem dos exercícios) | ✅ a posição antiga (1, exercício 1) não bate e não muda nada; a nova (2, exercício 1) bate → `updated: 1`, e a série certa recebe a carga |

## (c) Tempo com rotina cheia (20 exercícios × 10 séries = 200)

Rotina criada pela API e conferida com 200 séries. Cada PATCH é de séries distintas que batem. Tempo medido da request inteira (uma medição por tamanho).

| Séries no PATCH | Resultado | Tempo agora | Round 1 |
|---|---|---|---|
| 10 | ✅ 200 `updated: 10` | **0,49 s** | 2,5 s |
| 50 | ✅ 200 `updated: 50` | **0,47 s** | 8,4 s |
| 100 | ✅ 200 `updated: 100` | **0,43 s** | **500** em 15,3 s |
| 200 | ✅ 200 `updated: 200` | **0,44 s** | não chegava (500) |
| 200, cada série com um valor diferente (1 em cada 7 é `null`) | ✅ 200 `updated: 200` | **0,42 s** | |

- **Resultado do GET:** depois de cada PATCH, o GET da rotina mostrou as primeiras N séries com a carga enviada e as demais ainda `null`. No teste de 200 com valores distintos, cada série ficou com o valor da sua posição.
- **Custo por série:** o tempo ficou **constante** (~0,4–0,5 s, ou seja, 2 idas ao banco, o `findFirst` e o UPDATE), em vez de crescer cerca de 0,2 s por série. Com isso, o timeout de 15 s da transação não é mais um risco.

## Observações

- **INFO (mudança de comportamento, sem impacto):** com a **mesma série repetida no corpo**, `updated` agora conta **linhas atualizadas** (1), e não itens que bateram (2, como no round 1).
  - **Qual valor fica:** o Postgres não garante qual dos itens duplicados vence. Neste teste ficou o último (2).
  - **Impacto:** o app envia cada série uma vez, então não há problema.
- **Dados de teste:** as contas `qa.lw2.{a,b}.1790965927945@torvtest.dev` continuam no banco, com as rotinas. Nenhum dado de outro usuário foi lido nem alterado.
