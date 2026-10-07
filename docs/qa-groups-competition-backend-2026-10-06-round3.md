# QA — Grupos e competição — etapa BACKEND — ROUND 3 (2026-10-07)

**Veredito: PASS.** O R2-1 do round 2 está corrigido: nas 5 rajadas (12, 12, 12, 20 e 12 sem grupo) o resultado foi sempre **5×201 e o resto 400 "too many sessions on that day", zero 500**, `count(*)`=5 e ranking coerente; durante a rajada, `GET /groups` de outro usuário ficou em **0,18–0,32 s** (round 2: 0,9–3,6 s). A regressão do salvamento, da idempotência, do 6º treino, do PUT e do DELETE passou. 0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 3 INFO. Relatórios anteriores intactos.

Escopo: commit `556f09d` (fila por usuário em processo antes da transação, `workout.repository.js`). HEAD `556f09d`. O Furnace `:3000` foi reiniciado pelo Maestro com o código novo; não o parei nem subi outra instância. Conector Supabase **não usado**; SQL só via Prisma. Só a rajada foi paralela; os demais passos foram sequenciais. Hora: 2026-10-07 ~10:55 UTC; todos os treinos da rajada usam `duration_sec` 60 e `started_at` entre `agora−30min` e `agora−49min`, ou seja, **no mesmo dia UTC (07/10), dentro de 72 h e terminando no passado**.

## (a) `npm test` — **PASS**

**175 testes, 175 PASS**, 0 fail, 0 cancelled, 0 skipped (esperado 175).

## (f) Rajadas — **PASS**

Cada rajada usa um usuário novo, membro do grupo `QA R3 rajada` (tz −180, `joined_at` empurrado 3 dias para trás por SQL, para o recompute ser relevante), exceto a 5ª, sem grupo. Esperado: `201 = 5`, `400 = N−5` (todas com "too many sessions on that day"), **500 = 0**, `count(*)` = 5, ranking = 1 dia / 5 atividades.

| Rajada | Paralelos | 201 | 400 | **500** | `count(*)` no banco | Ranking (dias/atividades) | Latência das 400 (mín / mediana / máx) | Latência das 201 (mín–máx) | Resultado |
|---|---|---|---|---|---|---|---|---|---|
| 1 (grupo) | 12 | 5 | 7 | **0** | 5 | 1 / 5 | 8,1 / 9,8 / 11,5 s | 3,3–7,5 s | PASS |
| 2 (grupo) | 12 | 5 | 7 | **0** | 5 | 1 / 5 | 7,2 / 9,2 / 11,0 s | 1,9–6,5 s | PASS |
| 3 (grupo) | 12 | 5 | 7 | **0** | 5 | 1 / 5 | 7,8 / 9,8 / 11,8 s | 2,6–7,2 s | PASS |
| 4 (grupo) | **20** | 5 | 15 | **0** | 5 | 1 / 5 | 7,7 / 12,5 / 17,5 s | 2,5–7,2 s | PASS |
| 5 (**sem grupo**) | 12 | 5 | 7 | **0** | 5 | — | 8,3 / 10,3 / 12,4 s | 2,8–7,6 s | PASS |

Comparação com o round 2 (mesma rajada de 12): 5/3/**4×500**, 0/10/**2×500** e 5/2/**5×500** — agora **0×500 em 5 de 5**. Todas as respostas 400 trazem a mensagem esperada. **Consulta de consistência do plano (Task 7, Step 4): 0 linhas** (6 membros), executada depois de todas as rajadas e da regressão.

## (f2) Efeito no pool — **PASS**

Durante a **rajada 1** (12 paralelos do usuário U1), `GET /groups` de **outro usuário** (R), disparado nos instantes 0, 1,5, 3 e 5 s:

| Instante | 0 s | 1,5 s | 3 s | 5 s |
|---|---|---|---|---|
| Latência (round 3) | **318 ms** | **208 ms** | **279 ms** | **177 ms** |
| Latência (round 2) | 3.609 ms | 2.414 ms | 1.474 ms | 857 ms |
| Status | 200 | 200 | 200 | 200 |

Linha de base do mesmo usuário R, sem rajada (4 chamadas sequenciais): 281, 141, 141 e 142 ms. Ou seja, durante a rajada as respostas de outro usuário ficaram **na faixa normal (0,18–0,32 s)**, dentro do esperado (0,3–0,6 s), e nada de 3–4 s.

## (b)/(g) Regressão — **PASS**

Usuário G, membro do grupo, `joined_at` 3 dias para trás, tudo sequencial:

| Item | Resultado | Evidência |
|---|---|---|
| POST válido único → 201, com séries no banco | PASS | 201; `activities`=1, `workout_sets`=1 |
| Idempotência: mesmo `started_at` → 200 e o mesmo id | PASS | 200, id igual ao do 1º |
| Treinos 2 a 5 do dia (sequenciais) → 201 | PASS | 201,201,201,201 |
| **6º treino sequencial do dia → 400** | PASS | 400 `too many sessions on that day` |
| Ranking com 5 treinos no dia | PASS | 1 dia / 5 atividades |
| `PUT /workouts/sessions/:id` | PASS | 200; `GET` reflete (duração 120, carga 25); ranking segue 1/5 |
| `DELETE` de 1 de 5 treinos do dia (ponto mantido) | PASS | 204; ranking **1/4** |
| Sobra 1 treino no dia (apagados os outros 3) | PASS | ranking **1/1** |
| `DELETE` do único treino do dia (tira o ponto) | PASS | 204; ranking **0/0** |
| Salvar de novo depois de apagar (a fila não ficou presa) | PASS | 201; ranking volta a **1/1** |

## Achados

| ID | Sev | Achado |
|---|---|---|
| R3-1 | LOW | **Respostas da rajada demoram muito.** Como a fila é por usuário e cada salvamento é uma transação de ~1,2–1,5 s, as requisições de uma rajada ficam esperando: as 400 levam 7–12 s (até **17,5 s** com 20 paralelos) e as 201 até 7,5 s. Só afeta quem dispara a rajada (o resultado é correto e os outros usuários não sentem), mas as excedentes só ganham o 400 depois de ocupar a fila inteira. Um cliente com timeout curto (< 10–15 s) veria erro de rede nessa rajada. Aceitável para abuso; se importar, rejeitar logo as excedentes (checar o teto antes de entrar na fila) ou um rate limit por usuário. Não exige retrabalho para fechar a etapa. |
| I1 | INFO | A fila é em memória do processo (nota `ponytail:` no código): com mais de uma instância do backend o advisory lock ainda garante o teto, mas a rajada volta a segurar conexões; hoje há uma só instância (Furnace). Não testável aqui. |
| I2 | INFO | Os tempos de salvamento (~1,2–1,5 s por treino) vêm da latência do banco remoto (pooler do Supabase); não mudaram com a fila. |
| I3 | INFO | Nenhum 500 apareceu em nenhuma chamada desta rodada e o pooler do banco não teve queda durante o teste. |

## Limpeza (verificada por SQL via Prisma)

Apagados: 1 grupo e as 8 contas QA (`auth.users` → `users`, treinos, séries, rotinas e perfis por cascade). Não houve arquivo de capa ou foto. Antes → depois: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `activities 408→408`, `workout_routines 173→173`, `exercises 73→73`, `group_members 0`, `group_rankings 0`; nenhuma linha restante com `user_id/owner_id/created_by/follower_id/followed_id` das contas QA; `profilePhotos` idêntico (8 arquivos). Arquivos temporários com tokens apagados.

## Conclusão

R2-1 corrigido e verificado: sob rajada de 12 e de 20 requisições paralelas o resultado é determinístico (5×201 e o restante 400, zero 500), o banco fica com exatamente 5 treinos, o ranking permanece coerente (consistência = 0 linhas) e outros usuários não são afetados (≈0,2–0,3 s). O salvamento, a idempotência, o 6º treino, o PUT e o DELETE seguem corretos. **Backend verde nesta rodada; sem retrabalho.** Próximo: Security sobre o diff do `556f09d`.
