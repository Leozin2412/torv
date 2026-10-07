# QA — Grupos e competição — etapa DATABASE (2026-10-06)

**Veredito: PASS** (todos os 9 itens). 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW, 2 INFO.

Escopo: commit `67b53dc` (migrations `20261006120000_groups` e `20261006120100_drop_group_points_trigger`), bloco "Teste da etapa" da Task 1 de `docs/superpowers/plans/2026-10-06-groups-competition.md`.

## Método

- Acesso só via Prisma (`BackEndTorv`, `DIRECT_URL` do `.env`, role `postgres`). Conector Supabase do ambiente **não usado** (aponta para outro projeto).
- Verificações de estrutura: consultas somente-leitura (`_prisma_migrations`, `information_schema`, `pg_indexes`, `pg_policies`, `pg_constraint`, `pg_trigger`).
- Verificações de comportamento: uma única `prisma.$transaction` interativa; cada rejeição esperada dentro de `SAVEPOINT` + `ROLLBACK TO`; o callback termina lançando erro, então o `ROLLBACK` final desfaz tudo (usuários de teste via `auth.users` + trigger `on_auth_user_created`, grupos, convites, membros, rankings, atividades).
- **Resíduo após a execução:** `groups=0`, `group_invitations=0`, `users/auth.users qa-*=0`, `activities de teste=0`. Nenhum dado deixado.

## Resultado por item

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | Migrations aplicadas + checksum | **PASS** | Ambas em `_prisma_migrations`, `finished_at` preenchido, `rolled_back_at` NULL, `applied_steps_count=1`. sha256 do arquivo = `checksum` do banco: `b13107e5…23bc` (groups), `77e2fd86…4e22` (drop trigger). `prisma migrate status` → "Database schema is up to date!" (10 migrations). |
| 2 | Colunas / índices / RLS / policy | **PASS** | `groups`: owner_id, visibility, cover_url, starts_at, ends_at (NULL ok), tz_offset_min, invite_token VARCHAR(12), created_at; `period_type` removida. `group_invitations` com todas as colunas/defaults (`status` default `PENDING`). Índices: `groups_invite_token_key` (unique), `groups_owner_id_idx`, `group_members_user_id_idx`, `group_rankings_order_idx (group_id, total_points DESC, activities_count DESC)`, `group_invitations_user_id_status_idx`, `group_invitations_pending_key` (unique parcial `WHERE status='PENDING'`), `activities_user_id_start_time_idx`. RLS ligado (`relrowsecurity=true`) nas 4 tabelas de grupo; policy `torv_api_full_access` (ALL, role `torv_api`, `true/true`) em cada uma. FKs todas `ON DELETE CASCADE`. |
| 3 | CHECKs | **PASS** | `visibility='X'` → `groups_visibility_check`; `ends_at < starts_at` → `groups_period_check`; `tz_offset_min=900` → `groups_tz_offset_min_check`; `kind='BAD'` → `group_invitations_kind_check`; `status='BAD'` → `group_invitations_status_check`. Bordas aceitas: `tz=±840`, `ends_at NULL`, `ends_at = starts_at`. |
| 4 | Índice único parcial de convite | **PASS** | 2º `PENDING` do mesmo (grupo, usuário) recusado (23505); após `UPDATE … status='CANCELED'` novo `PENDING` aceito; vários `DECLINED` do mesmo par aceitos. |
| 5 | Cascade | **PASS** | `DELETE groups` levou 1 membro, 1 ranking e 4 convites (pré 1/1/4 → pós 0/0/0). `DELETE users` (owner) levou o grupo + membros + rankings + convites; outro usuário preservado. |
| 6 | `invite_token` único | **PASS** | Dois `NULL` aceitos; dois tokens iguais recusados (23505); token de 13 chars recusado (`VarChar(12)`). |
| 7 | Trigger de pontos legado removido | **PASS** | `trg_add_points_to_group_ranking` e `trg_fn_add_points_to_group_ranking()` inexistentes. Inserir 2 `activities` (RUN + STRENGTH) para membro com linha em `group_rankings` deixou `total_points=0, activities_count=0`. Único trigger restante em `activities`: `trg_update_streak_on_activity` (esperado). |
| 8 | View `vw_group_leaderboard` | **PASS** | Consulta normalmente e retornou a linha do membro de teste (group_name, total_points, user_name). |
| 9 | `anon` / `authenticated` sem SELECT | **PASS** | `has_table_privilege(...,'SELECT')=false` para ambos nas 4 tabelas de grupo; `SET LOCAL ROLE anon|authenticated; SELECT … FROM group_invitations` → `permission denied`. Grants em `role_table_grants` só para `torv_api`. |

## Achados

| Sev | Achado |
|---|---|
| INFO | `prisma migrate diff --from-url … --to-schema-datamodel` não roda: `P4002` (FK cross-schema `public.users → auth.users`; `auth` não está em `schemas` do datasource). É pré-existente, não vem desta feature. A conferência "schema Prisma = banco" foi feita por `migrate status` (up to date) + inspeção direta de colunas/índices/constraints acima, que batem com `schema.prisma`. |
| INFO | CHECKs e o índice único parcial só existem no SQL da migration (Prisma não os modela; já comentado em `schema.prisma`). Quem rodar `prisma db push`/`migrate dev --create-only` a partir do schema pode tentar removê-los — manter o fluxo por `migrate deploy`. |

## Conclusão

Etapa DATABASE verde. Pode avançar para a etapa de Backend (Task 2+). Sem retrabalho de camada.
