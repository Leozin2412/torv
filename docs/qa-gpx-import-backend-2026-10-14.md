# QA — Importador de GPX, etapa Backend (Task 8) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Diff:** `b3defe6` (`gpsMetrics`), `f699882` (`gpsValidation`), `0350475` (rotinas RUN/WALK), `f5eab32` (repositório de GPS e teto por dia somando todos os tipos), `e78fd83` (`/activities/gps/*` e F1 do Security do perfil: `LocalDayQuery.date` só 2000–2099) · **Plano:** `docs/superpowers/plans/2026-10-14-gpx-import.md` · **Spec:** `docs/superpowers/specs/2026-10-14-gpx-import-design.md` · **Ambiente:** Furnace `:3000` (nodemon) já com o código novo; nenhum serviço reiniciado. Banco só via Prisma; contas QA por `/auth/register` + confirmação pela Admin API do Auth (o MCP do Supabase da sessão aponta para outro projeto). Pontos de teste: `src/lib/tests/fixtures/run-sample.json` (2.875 pontos, 2.882 s) com o início deslocado para terminar ~10 min antes de cada chamada; scripts e arquivos temporários só no scratchpad, fora do repositório.

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 3 INFO) → pode seguir para a Task 9

## Step 2 — Automatizados

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | **PASS** — 310/310, 0 fail, 0 cancelled, 0 skipped (272 antes → **+38**) |
| Referência da fixture (`computeMetrics`, 75 kg) | 8.670,74 m · 2.877 s em movimento · 2.882 s total · pace 332 · 9 parciais · elevação 38,3 m · FC 151/169 · cadência 175 · rota 104 pares |

## Step 3 — Contrato ao vivo

Contas: **A** (peso 75 kg, dona do grupo `QA GPS` com B), **B** (sem peso: a linha de `user_measurements` foi removida), **C** (fora), mais **D** (só para o teto do item 5; contas extras só para os retestes). O `joined_at` de A e B no grupo foi recuado 5 dias por SQL: sem isso a corrida, que começou antes de eles entrarem, não pontua pela regra `start_time >= joined_at` do ranking.

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | Rotinas | **PASS** | RUN só com nome → 201 `activity_type: "RUN"`, sem exercícios; WALK idem; RUN com exercícios → 400 `run and walk routines have no exercises`; STRENGTH sem exercícios → 400 `exercises must have at least 1 item`; `GET /workouts/routines` lista a RUN (`completed_recently: false`) e o `next_routine_id` aponta para uma STRENGTH; `PUT` trocando o tipo → 400 `activity_type cannot change`; `PUT` sem `activity_type` renomeia e mantém RUN |
| 2 | Prévia | **PASS** | A: 8.670,74 m, 2.877 s, pace 332, 9 parciais (`1.000 ×8` + 671 m), elevação 38,3, FC 151/169, cadência 175, rota 104 pares ≤ 500. Calorias de A = **726** = `round(((0,2·8670,74 + 0,9·38,3 + 3,5·2877/60) · 75/1000) · 5)`. B (sem peso): `calories: null`, resto igual. A prévia não grava nada (0 atividades de A e B) |
| 3 | Importação | **PASS** | 201 com detalhe (título = nome da rotina, `routine_id`, métricas, 726 kcal); `GET /activities/gps/:id` igual; `GET /activities?type=RUN` traz o item com `distance_m: 8670.74` e `type=STRENGTH` não o traz; **ranking de A 0 → 1**; `/activities/summary` → `calories_burned: 726`, `streak_days: 1`; **B** vendo A: `GET /users/<A>/profile` mostra o dia no calendário (`count: 1`, total 1, streak 1) e `GET /users/<A>/activities` traz o item com as chaves `id, activity_type, title, start_time, duration_sec, set_count, distance_m` — **sem** rota, FC, cadência, calorias nem parciais |
| 4 | Duplicado e paralelo | **PASS** | mesma importação → 409 `Activity already imported` com `activity_id` da primeira; duas importações paralelas do mesmo arquivo → `201,409` (o 409 traz o id do vencedor) e 1 linha no banco |
| 5 | Teto | **PASS** | D: 4 treinos de musculação + 1 GPS no mesmo dia UTC → 5 × 201; a 6ª de **qualquer tipo** (GPS e musculação) → 400 `too many sessions on that day`; banco com exatamente 5 no dia. Teste complementar (conta Q): 5 treinos no mesmo dia UTC → 201 ×5, 6º → 400; um treino e uma importação GPS no dia UTC **anterior** → 201 (o teto é por dia UTC); GPS como 6º do dia cheio → 400 |
| 6 | 400 e 413 | **PASS** | início há 73 h → `start_time must be within the last 72 hours`; início no futuro → `must not be in the future`; antes de 2026 → `must be on or after 2026-01-01`; termina no futuro → `activity must not end in the future`; 1º `t` ≠ 0 → `invalid point at index 0`; ordem trocada → `points must be in chronological order`; `lat` 91 e `lon` 181 → `invalid point at index 10`; 30.001 pontos → `body/points must NOT have more than 30000 items`; 1 ponto e ponto com 2 posições → 400 do schema; `activity_type` RIDE → 400; carro a 30 km/h → `speed not compatible with run or walk`; 30 s e < 100 m → `activity too short`; 25 h → `activity too long` (23 h → 200); corpo de 2,1 MB → **413** em `/preview` e em `POST /activities/gps`. As regras de janela, velocidade e curta também foram conferidas em `POST /activities/gps` (400 igual) |
| 7 | Acesso | **PASS** | atividade de A vista por C → 404 em `GET`, `PATCH` e `DELETE` (o título não mudou); B, do mesmo grupo, também → 404 no detalhe (só do dono); C importando numa rotina de A → 404; `routine_id` de rotina de musculação → 404; inexistente → 404; rotina RUN de A lida por C → 404; sem token → 401; `PATCH` renomeia com `trim` sem mudar data nem métricas; título em branco → 400 |
| 8 | Excluir | **PASS** | 204; ranking de A 1 → 0 (valor de antes da importação); linha de `activity_gps_data` some (cascade); de novo → 404 |
| 9 | Rate limit | **PASS** | 31 prévias em 5,5 s: as 30 primeiras 200 e a 31ª **429**; outras rotas seguem 200 |
| 10 | Musculação com rotina RUN | **PASS** | `POST /workouts/sessions` com `routine_id` de rotina RUN → 201, salvo como "Treino livre" com `routine_id` nulo (o `routine_id` de outro usuário segue igual) |
| 11 | Banco | **PASS** | `activity_gps_data`: rota de 104 pares `[lat, lon]` com até 5 casas e 9 parciais; colunas só `activity_id, elapsed_sec, elevation_gain_m, avg_hr, max_hr, avg_cadence, splits, route` (nenhuma série de pontos ou de FC); JSON guardado 2.939 bytes (linha de 1.787 bytes) para 2.875 pontos enviados; `activities`: RUN, 8670.74 m, 2.877 s, 726 kcal, `routine_id` da rotina |
| 12 | Tempo | **PASS** | prévia de **30.000 pontos** (1,67 MB, em linha): 379, 238 e 194 ms (e 193 ms em outra chamada); pior caso do Douglas-Peucker com percursos aperiódicos (1,33 MB): zigue-zague aleatório de 12–20 m por passo → 346, 212 e 289 ms, rota 475 pares; caminhada aleatória → 204, 198 e 226 ms, rota 443 pares (tempos medidos no cliente, no localhost, já com a rede) |
| F1 | `date` só 2000–2099 (Security do perfil) | **PASS** | `date=9999-12-31&tz_offset_min=-840` → **400** em `/users/:id/profile` e em `/activities/summary` (`querystring/date must match pattern "^20\d{2}-…"`); `1999-12-31` e `2100-01-01` → 400; `2099-12-31` e `2000-01-01` → 200 |

### Observação sobre meus próprios testes

A primeira rodada do item 12 usou um zigue-zague de ±3 m (abaixo da tolerância de 5 m) e depois um periódico de ±8 m; este caiu em aliasing com a redução uniforme da entrada (ver I2) e a caminhada aleatória com coordenadas de precisão total passou de 2 MiB (**413**, correto). Refiz com percursos aperiódicos e coordenadas com 6 casas; os números acima são dessa rodada.

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| L1 | LOW | Backend (`gps.controller.js`) | `POST /activities/gps` não confere se o `activity_type` do corpo combina com o tipo da rotina: um `WALK` importado numa rotina `RUN` deu **201** e gravou `activity_type: WALK` na atividade, ligada à rotina RUN. O app deve mandar o tipo da rotina, então é só inconsistência de dado, não falha de segurança. Sugestão: ignorar o `activity_type` do corpo e usar o da rotina (ou 400 `activity_type must match the routine`). |
| I1 | INFO | Frontend (próxima etapa) | O limite de corpo é de 2 MiB. 30.000 pontos com lat/lon de 6 casas e elevação de 1 casa ocupam ~1,3 MB (cabem); com `double` completo (~16 dígitos) passam de 2 MiB e viram 413. O `utils/gpx.ts` precisa arredondar (lat/lon 6 casas, ele 1 casa) ao montar os pontos. |
| I2 | INFO | Backend (`gpsMetrics.simplifyRoute`) | A redução de entrada para ≤ 2.000 pontos é por passo uniforme: num percurso **estritamente periódico** com período que divide o passo (zigue-zague par), os pontos amostrados caem todos do mesmo lado e a rota sai com 3 pares (reta) em vez da forma real. Não acontece com GPS real (aperiódico: rotas de 475 e 443 pares nos meus dois pior caso). Só registro. |
| I3 | INFO | Ambiente | Para o ranking pontuar, `start_time` precisa ser `>= joined_at` do membro: quem importa uma corrida de antes de entrar no grupo não soma ponto (regra existente do ranking, igual à musculação). O teste recuou o `joined_at` por SQL só nas contas QA. |

## Dados de teste e limpeza

Criados: 4 contas (A, B, C, D) no teste principal e 1 a 2 por reteste (P, Q, e contas descartáveis para os testes de 12b e de 25 h), 1 grupo (`QA GPS`), 6 rotinas no pico (as 3 do plano padrão gerado para A, mais RUN e WALK de A e RUN de D), 7 atividades no pico no teste principal e as dos retestes, todas pelo app e só nas contas QA (nada por SQL além do `joined_at` e da remoção do peso de B). Tudo apagado: grupo pelo app (204) e contas pela Admin API do Auth (cascade). Antes → depois (a cada script, e igual nos três): `users 87→87`, `auth.users 87→87`, `activities 417→417`, `groups 8→8`, `group_members 7→7`, `workout_routines 205→205`, `activity_gps_data 0→0` (pico no meio do teste principal: users 91, activities 424, groups 9, group_members 9, routines 211, gps 1). Sem resíduo: 0 linhas das contas QA em `users`, `activities`, `workout_routines`, `group_members`, `user_measurements`; 0 grupos `QA GPS`. Nenhum arquivo de teste dentro do repositório.
