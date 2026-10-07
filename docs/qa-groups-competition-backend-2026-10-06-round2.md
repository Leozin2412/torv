# QA — Grupos e competição — etapa BACKEND — ROUND 2 (2026-10-07)

**Veredito: FAIL (item f) — reabrir o Backend (`workout.repository.js`, salvamento de treino).** O teto de 5 treinos por dia **se sustenta** sob rajada (sempre exatamente 5 linhas no banco), mas as requisições excedentes **não recebem 400**: parte vira **500** e, enquanto a rajada roda, as requisições de outros usuários ficam lentas. Todos os outros itens passaram. 0 CRITICAL / 0 HIGH / 1 MEDIUM / 0 LOW / 4 INFO. Relatórios anteriores (`…backend-2026-10-06.md`) intactos.

Escopo: correções do Security `40803bb` (janela de 72 h, fim no futuro, teto/dia), `adec806` (advisory lock por usuário), `4abda0e` + `330b1fa` (rate limit de convites). HEAD `5c2cc2d`. Furnace `:3000` reiniciado pelo Maestro com o código novo; não o parei. Conector Supabase **não usado**; SQL só via Prisma. Hora do teste: 2026-10-07 ~00:40 locais (03:40 UTC), longe da virada do dia local; todos os horários dos treinos caem no mesmo dia UTC (03:xx) ou no dia anterior, conforme o item.

## Resultado por item

| Item | Resultado | Evidência |
|---|---|---|
| (a) `npm test` | **PASS** | **172 testes, 172 PASS**, 0 fail, 0 cancelled, 0 skipped. |
| (b) O SQL do lock não quebra o salvamento | **PASS** | `POST /workouts/sessions` válido (2 séries) → **201** e `activities`=1, `workout_sets`=2 no banco. Também funcionou em todos os outros POSTs sequenciais abaixo. |
| (c) Janela de 72 h | **PASS** | `agora−71h` → 201; `agora−73h` → **400** `started_at must be within the last 72 hours`. |
| (d) Fim no futuro | **PASS** | `agora−1min` + `duration_sec 7200` → **400** `workout must not end in the future`; `agora−10min` + `600 s` (termina agora) → **201**. (Tolerância do código: 5 min.) |
| (e) Teto por dia UTC | **PASS** | Usuário A: 5 treinos no mesmo dia UTC → **5×201**; o 6º → **400** `too many sessions on that day`; repetir o `started_at` do 1º → **200 com o mesmo id** (idempotência vem antes do teto); treino de outro dia UTC (`agora−26h`) → **201**; SQL: exatamente 5 no dia UTC de hoje. |
| **(f) Rajada de 12 em paralelo** | **FAIL** | Ver abaixo. |
| (g) Fluxo real do app ainda salva | **PASS** | Pela interface (portal `QA Home`, uma aba, 320 px): Treinos → Iniciar Dia 1 → 1 série → Finalizar → "Treino concluído" → Concluir; o treino aparece no **Histórico** ("Hoje · Dia 1 — Corpo todo A · 00:42 · 0:14 · 1 série") e no banco (`start_time` 03:42Z, 1 série). |
| (h) Rate limit de convites | **PASS** | 30 chamadas passam (a 1ª foi o convite case-insensitive, 201; depois 29×404 de usernames inexistentes) e a **31ª → 429** `Rate limit exceeded, retry in 51 seconds`, em ~8 s; as seguintes na janela também 429. Logo depois: `GET /groups`, `GET /groups/:id`, `GET /groups/discover`, `GET /groups/invitations/received`, `GET /groups/:id/requests`, `POST /groups/:id/invite-link` e `GET /groups/:id/ranking` → todos **200**. |
| (i) Cenários A e B + extras do round 1 | **PASS** | Cenário A: 0/0 → 0/0 → 1/1 → 1/2 → 1/1 → 0/0 → 1/1 → 0/0 → 1/1 (API e `group_rankings` iguais em todos os passos). Cenário B (`m=216`, `tz_offset_min=-216`): **2/2**; `tz 0`, T1 e T2 no mesmo dia UTC: **1/2**. Consulta de consistência: **0 linhas** (também 0 no fim). Extra (c): convite com `QA_FD_V5RMW` acha `qa_fd_v5rmw` → 201. Extra (d): `createSession` repetido → 200, mesmo id, 1 linha, pontos não duplicam. |

## (f) Rajada — detalhe do FAIL

Esperado: 12 POSTs paralelos (`started_at` distintos, mesmo dia UTC, usuário novo) → **5×201 e 7×400**, `count(*)`=5.

| Execução | 201 | 400 | 500 | `count(*)` em `activities` |
|---|---|---|---|---|
| Usuário C (novo, membro de grupo) — 1ª rajada de 12 | 5 | **3** | **4** | **5** |
| C de novo, já com 5 no dia (todas devem dar 400) | 0 | 10 | **2** | 5 |
| Usuário D (novo, sem grupo) — 12 | 5 | **2** | **5** | **5** |
| Rajadas menores em C (já com 5) | — | 5 de 5 e 8 de 8 → 400 | 0 | 5 |

- **O que está certo (a invariante):** em todas as execuções o banco terminou com **exatamente 5** treinos no dia; o ranking do grupo de C ficou coerente (**1 dia distinto, 5 atividades**) e a consulta de consistência deu **0 linhas**. O lock evitou que o teto fosse furado (sem o lock, a contagem seria ultrapassada).
- **O que falha:** com ≥ ~10 requisições paralelas, as que não conseguem entrar recebem **`500 {"error":"An unexpected error occurred"}`** em vez de 400 (~3 s depois de enviadas). Até 8 em paralelo, todas as excedentes receberam 400.
- **Efeito colateral medido:** durante a rajada de 12, `GET /groups` de **outro usuário** (A) levou **3,6 s**, 2,4 s, 1,5 s e 0,9 s (nos instantes 0, 1,5, 3 e 5 s), contra ~0,3 s normalmente; as 10 respostas 400 da rajada levaram de 1,6 a 4,2 s. Ou seja, um usuário autenticado consegue ocupar o pool compartilhado por alguns segundos.
- **Causa provável (inferida, sem acesso ao log do Furnace):** `connection_limit=5` no `DATABASE_URL`; cada `$transaction` interativa segura uma conexão enquanto espera o `pg_advisory_xact_lock` do mesmo usuário; com as 5 conexões presas no lock, as demais requisições estouram o `maxWait` padrão da transação (2 s) ao pedir conexão e viram 500. **Maestro: conferir no log do Furnace (por volta de 00:38–00:41 locais) se o erro é "Unable to start a transaction in the given time"** (P2028) ou outro.

## Achados

| ID | Sev | Achado | Reabrir |
|---|---|---|---|
| **R2-1** | **MEDIUM** | Rajada de ≥ ~10 POSTs paralelos de um mesmo usuário: o teto de 5/dia vale (banco sempre com 5), mas as excedentes dão **500** em vez de 400 e a rajada deixa lentas as requisições de outros usuários (pool compartilhado de 5 conexões presas no lock). Resultado de (f): 5/3/4, 0/10/2 e 5/2/5 (201/400/500). Sugestões para o dono do código (não aplicadas): fazer a verificação do teto antes de abrir a transação interativa, ou tomar o lock numa conexão de curta duração, ou limitar `POST /workouts/sessions` por usuário (rate limit) / aumentar `maxWait`; o que o Maestro preferir. | **Backend** (`workout.repository.js` `createSession`; opcionalmente `workout.routes.js`) |
| I1 | INFO | Os cenários antigos do round 1 usavam treinos de 3600 s com `started_at = agora`; com a regra nova de "fim no futuro" isso dá 400. No script de teste usei `duration_sec` de 60 s (ajuste do teste, não do código). Qualquer cliente que mande duração maior que 5 min para um treino recém-começado será recusado (é o desejado). |
| I2 | INFO | O rate limit de convites é por IP (documentado em `330b1fa`); a 30ª e a 31ª chamada contam junto com qualquer convite anterior da mesma janela de 1 min. |
| I3 | INFO | O app completa o treino pela interface sem mudar nada: `started_at` do app cai na janela de 72 h e termina em segundos, então a regra nova não afeta o fluxo normal (item g). |
| I4 | INFO | Nenhuma chamada cruzou a meia-noite local nem a UTC durante o teste (03:36–03:45 UTC), então os totais por dia UTC não foram afetados por virada de dia. |

## Limpeza (verificada por SQL via Prisma)

Apagados: 4 grupos e as 4 contas QA (`auth.users` → `users`, treinos, séries, rotinas e perfis por cascade). Não houve arquivo de capa/foto criado. Antes → depois: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `activities 408→408`, `workout_routines 173→173`, `exercises 73→73`, `group_members 0`, `group_rankings 0`; nenhuma linha restante com `user_id/owner_id/created_by/follower_id/followed_id` das contas QA; `profilePhotos` idêntico (8 arquivos). O portal ficou na tela de login, sem sessão; arquivos temporários com tokens apagados.

## Conclusão

As correções do Security funcionam no que prometem: janela de 72 h, fim no futuro, teto de 5/dia, idempotência, lock sem quebrar o salvamento e rate limit de convites; o ranking continua coerente (consistência = 0 linhas) e o app salva normalmente. O que não passou é o **comportamento sob rajada**: 500 em vez de 400 e impacto no pool. **Reabrir o Backend (R2-1)**; depois, rodar de novo só o item (f) e o Security.
