# QA — Importador de GPX, etapa Database (Task 2) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Diff:** `af5cc29` (`20261014120000_gps_activities`, `schema.prisma`, scripts de `BancoDeDadosTorv/`) · **Plano:** `docs/superpowers/plans/2026-10-14-gpx-import.md` · **Spec:** `docs/superpowers/specs/2026-10-14-gpx-import-design.md` · **Banco:** Postgres do Torv, só via Prisma (o MCP do Supabase da sessão aponta para outro projeto e não foi usado); conta QA criada e apagada pela Admin API do Auth. Furnace e Prisma client não foram reiniciados.

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 3 INFO) → pode seguir para a Task 3

## Step 1 — migrate e testes

| Item | Resultado |
|---|---|
| `npx prisma migrate status` | **PASS** — 11 migrations encontradas, "Database schema is up to date!" |
| `BackEndTorv: npm test` | **PASS** — 272/272, 0 fail (igual à base de 272) |
| Prisma client x banco | **PASS** — o client regenerado lê `activity_gps_data` (`elapsed_sec`, `elevation_gain_m`, `avg_hr`, `max_hr`, `avg_cadence`, `splits`, `route`) e `workout_routines.activity_type` sem erro; `route_json` não existe mais no modelo |

## Step 2 — Estrutura (catálogo do Postgres)

| Objeto | Esperado | Encontrado | |
|---|---|---|---|
| `workout_routines.activity_type` | `VARCHAR(10) NOT NULL DEFAULT 'STRENGTH'` | `character varying(10)`, `NOT NULL`, default `'STRENGTH'::character varying` | **PASS** |
| CHECK `workout_routines_activity_type_check` | `IN ('STRENGTH','RUN','WALK')` | idem, `convalidated = true` | **PASS** |
| CHECK `activities_activity_type_check` | `IN ('STRENGTH','RUN','WALK')` | idem, `convalidated = true` (coluna segue `VARCHAR(50)`) | **PASS** |
| `activity_gps_data` colunas | `activity_id uuid`, `elapsed_sec int NOT NULL`, `elevation_gain_m numeric(7,1)`, `avg_hr`/`max_hr`/`avg_cadence smallint`, `splits jsonb NOT NULL`, `route jsonb NOT NULL`; `route_json` removida | exatamente isso (nulos só em elevation/hr/cadence); sem `route_json` | **PASS** |
| CHECKs de `activity_gps_data` | `elapsed_sec > 0`; `elevation_gain_m IS NULL OR >= 0`; `avg_hr`/`max_hr` entre 20 e 250; `avg_cadence` entre 1 e 400 | `elapsed_sec_check`, `elevation_gain_m_check`, `hr_check`, `avg_cadence_check`, todos validados | **PASS** |
| Índice `activities_gps_user_start_key` | único, parcial `(user_id, start_time) WHERE activity_type <> 'STRENGTH'` | `indisunique = true`, predicado `((activity_type)::text <> 'STRENGTH'::text)` | **PASS** |
| Índice `activities_strength_user_start_key` (regressão) | segue único, `WHERE activity_type = 'STRENGTH'` | idem | **PASS** |
| FK `activity_gps_data_activity_id_fkey` | `ON DELETE CASCADE` | `FOREIGN KEY (activity_id) REFERENCES activities(id) ON UPDATE CASCADE ON DELETE CASCADE` | **PASS** |
| RLS e policy | RLS ligada e `torv_api_full_access` em `activity_gps_data` | `relrowsecurity = true`; policy `torv_api_full_access`, roles `{torv_api}`, `ALL`, `USING true WITH CHECK true`; o mesmo em `activities` e `workout_routines` | **PASS** |
| Grants de `activity_gps_data` | só o role da API | `torv_api`: SELECT, INSERT, UPDATE, DELETE; nenhum para `anon`/`authenticated` | **PASS** |

## Step 3 — Comportamento (uma transação por script, savepoint por tentativa, `ROLLBACK` no fim, conta QA)

A conta QA (`qa.db.*@torvtest.dev`) foi criada pela Admin API; o trigger `handle_new_user` criou a linha em `users`. As tentativas que falham rodam em `SAVEPOINT`/`ROLLBACK TO SAVEPOINT` para a transação seguir.

| # | Caso | Resultado | Evidência |
|---|---|---|---|
| 1 | atividade `RIDE` | **PASS** | `23514` violates check constraint `activities_activity_type_check` |
| 1b | tipos antigos `Musculação`, `Corrida`, `YOGA` | **PASS** | os três rejeitados pelo mesmo CHECK |
| 2a | primeira `RUN` num instante | **PASS** | inseriu |
| 2b | segunda `RUN`, mesmo `user_id` e `start_time` | **PASS** | `23505`, índice `activities_gps_user_start_key` (nome capturado por `GET STACKED DIAGNOSTICS CONSTRAINT_NAME`; o Prisma devolve "N/A" na mensagem do `23505`) |
| 2c | `WALK` no mesmo instante da `RUN` | **PASS** | `23505`, `activities_gps_user_start_key` (o índice cobre RUN e WALK juntos) |
| 2d | `RUN` um segundo depois | **PASS** | inseriu |
| 3 | `STRENGTH` e `RUN` no mesmo instante | **PASS** | as duas coexistem |
| 3b | regressão: segunda `STRENGTH` no mesmo instante | **PASS** | `23505`, `activities_strength_user_start_key` |
| 3c | observação: duas `RUN` com `start_time` NULL | **PASS (observação)** | não colidem (NULLs são distintos no índice); o importador sempre grava `start_time` (ver I2) |
| 4 | `elapsed_sec = 0` | **PASS** | `23514` `activity_gps_data_elapsed_sec_check` |
| 4b | `elapsed_sec = -5` | **PASS** | mesmo CHECK |
| 5 | `avg_hr = 300` | **PASS** | `23514` `activity_gps_data_hr_check` |
| 5b | `max_hr = 19` | **PASS** | `activity_gps_data_hr_check` |
| 5c | `avg_cadence = 0` | **PASS** | `activity_gps_data_avg_cadence_check` |
| 5d | `avg_cadence = 401` | **PASS** | idem |
| 5e | `elevation_gain_m = -1` | **PASS** | `activity_gps_data_elevation_gain_m_check` |
| 5f / 5g | `splits` ausente / `route` ausente | **PASS** | `23502` NOT NULL |
| 5h | `activity_id` inexistente | **PASS** | `23503` `activity_gps_data_activity_id_fkey` |
| 5i | limites válidos: `elevation 0`, `hr 20` e `250`, `cadence 400`, `splits` e `route` em JSONB | **PASS** | inseriu com as métricas completas |
| 6 | apagar a atividade | **PASS** | linha de GPS antes 1, depois 0 (cascade) |
| 7a / 7b | rotina `WALK` / `RUN` | **PASS** | inseriram |
| 7c | rotina `RIDE` | **PASS** | `23514` `workout_routines_activity_type_check` |
| 7d | rotina sem `activity_type` | **PASS** | recebe o padrão `STRENGTH` |

**Total: 25 de 25 PASS.** A primeira execução marcou 2b, 2c e 3b como FAIL só porque meu teste procurava o nome do índice na mensagem do Prisma ("N/A" nos `23505`). O reteste com um bloco `DO` que relança o `CONSTRAINT_NAME` mostrou `activities_gps_user_start_key` em 2b e 2c e `activities_strength_user_start_key` em 3b; não era defeito do banco.

**ROLLBACK:** dentro da transação a conta tinha 4 atividades e 3 rotinas; depois do `ROLLBACK`, 0 atividades, 0 rotinas e 0 linhas em `activity_gps_data` (global). Conta QA apagada (200).

## Step 4 — Dados existentes intactos

| Item | Antes | Depois |
|---|---|---|
| `users` | 87 | 87 |
| `auth.users` | 87 | 87 |
| `activities` | 417 (todas `STRENGTH`) | 417 (todas `STRENGTH`) |
| `workout_routines` | 205 (todas `STRENGTH`) | 205 (todas `STRENGTH`) |
| `activity_gps_data` | 0 | 0 |
| `groups` / `group_members` | 8 / 7 | 8 / 7 |

Sem resíduo da conta QA (0 perfis `qadb*`, `qadb2*`).

## Scripts de `BancoDeDadosTorv/` (documentação, não rodam)

Conferidos contra o CHECK e o índice reais:

| Arquivo | Resultado |
|---|---|
| `Mock Dados.sql` | **consistente** — as duas atividades de exemplo usam `WALK` e `RUN` (e a de treino usa `STRENGTH`); as linhas Yoga/Ciclismo saíram; nenhum `(user_id, start_time)` repetido; o comentário diz que `activity_gps_data` não é semeada |
| `Testes Procedures e Triggers.sql` | **consistente** — o INSERT do trigger usa `STRENGTH`; nenhuma referência aos usuários ...04/...05 cujas linhas foram removidas do mock |
| `Regras BD.sql` | **consistente** — os 6 CHECKs novos são os mesmos do SQL aplicado (nomes e expressões) |
| `SQL BANCO DE DADOS.sql` | **consistente** — colunas e tipos de `workout_routines` e `activity_gps_data` iguais ao catálogo |
| `Gestao_e_Performance.sql` | **consistente** — `activities_gps_user_start_key` com o mesmo predicado; RLS/policy de `activity_gps_data` (linhas 95–96) intactas |
| Busca por tipos antigos (`'Musculação'`, `'Caminhada'`, `'Corrida'`, `'Yoga'`, `'Ciclismo'`) como valor de `activity_type` | nenhum restante |

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| I1 | INFO | Ambiente | `select … from _prisma_migrations` devolve 0 linhas para o role da API (a tabela tem RLS sem policy para ele); o estado da migration só se confirma por `prisma migrate status` ("up to date", 11 migrations), que usa a conexão direta. Sem impacto. |
| I2 | INFO | Banco | Duas `RUN`/`WALK` com `start_time` NULL não colidem no índice (comportamento padrão do Postgres para NULLs). Inofensivo enquanto o importador gravar sempre `start_time`; se a Task do backend permitir GPX sem horário, a dedupe não pegaria esse caso (decidir lá: rejeitar o arquivo sem `<time>` ou aceitar). |
| I3 | INFO | Ambiente | `prisma migrate diff --from-schema-datasource` não roda neste banco (`P4002`: `public.users` aponta para `auth.users`, que não está em `schemas`), então não deu para comparar o `schema.prisma` com o banco por esse comando. A conferência foi pelo catálogo e pelo client regenerado (sem divergência). Pré-existente, não é parte do diff. |

## Dados de teste e limpeza

1 conta QA no total para o Step 3 (mais 1 no reteste dos índices), 0 linhas persistidas (tudo em transação com `ROLLBACK`), contas apagadas pela Admin API. Antes → depois: `users 87→87`, `auth.users 87→87`, `activities 417→417`, `groups 8→8`, `group_members 7→7`, `workout_routines 205→205`, `activity_gps_data 0→0`.
