# QA — Perfil de membro, etapa Backend (Task 4) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Diff:** `f2f33c4` (activityStats) + `c07f1df` (rotas `/users/:id/profile` e `/users/:id/activities`, `GET /activities/summary`, `GET /profile`) · **Plano:** `docs/superpowers/plans/2026-10-14-member-profile.md` · **Spec:** `docs/superpowers/specs/2026-10-14-member-profile-design.md`

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 3 INFO) → pode seguir para Security

Backend vivo: Furnace (nodemon) do Maestro, `localhost:3000`, `/health` 200, código novo (rotas no `/documentation/json`). Não subi nem reiniciei instância.

## Step 2 — Automatizados

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | **PASS** — 272 testes, 272 pass, 0 fail, 0 skipped (base 239 → **+33**: `activityStats`, `activityPage`, `activities.repository`, `users.repository`, `users.routes`, ajustes em `activities.routes` e `profile.routes`) |

## Step 3 — Contrato ao vivo (3 contas QA)

A = dona do grupo, B = membro (entrou pelo link de convite), C = fora de qualquer grupo com A. Data local usada: `2026-10-14`, `tz_offset_min=-180`.

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 3.1a | A → B | **PASS** | 200, `is_me:false` |
| 3.1b | A → A | **PASS** | 200, `is_me:true`; com o UUID em MAIÚSCULAS também 200, `is_me:true`, `user.id` normalizado em minúsculas |
| 3.1c | A → C | **PASS** | 404 `{"error":"Not found"}` |
| 3.1d | A → UUID aleatório | **PASS** | 404, corpo **idêntico** ao de C (comparado byte a byte) |
| 3.1e | C → B (C fora do grupo) | **PASS** | 404 `{"error":"Not found"}` |
| 3.1f | sem token | **PASS** | 401 |
| 3.2 | Lista branca | **PASS** | chaves do topo: `user,is_me,streak,month,total_activities,calendar`; `user`: `id,name,username,photo_url,fitness_level`. Nenhuma ocorrência de e-mail, peso, altura, idade, gênero, objetivo, nascimento nem do domínio do e-mail no corpo |
| 3.3 | Números vs SQL | **PASS** | ver tabela abaixo |
| 3.4 | Histórico | **PASS** | `limit=2` → 2 itens, `distance_m:null`, `next_before` preenchido; página 2 com `before=next_before` → 2 itens novos, sem repetir id; `limit=20` → 8 itens e `next_before:null`; C → 404; A → A (sem atividades) 200 com lista vazia |
| 3.5a | `date=2026-02-31` | **PASS** | 400 `querystring/date must be a valid calendar date` |
| 3.5b | `tz_offset_min=841` | **PASS** | 400 `must be <= 840` |
| 3.5c | `/users/abc/profile` (e `/activities`) | **PASS** | 400 `params/id must match pattern …` |
| 3.5d | `limit=51` (e `limit=0`) | **PASS** | 400 `<= 50` / `>= 1` |
| 3.5e | `before=ontem` | **PASS** | 400 `before must match format "date-time"` |
| 3.5f | sem `date` | **PASS** | 400 `required property 'date'` |
| 3.6 | Home | **PASS** | `GET /activities/summary` de B: `streak_days` 2 = `streak.current` 2. `TEST_OTHER` conta o dia (ver nota) e a linha foi apagada |
| 3.7 | `GET /profile` de A | **PASS** | 200; chaves: `id,email,photo_url,birth_date,weight_kg,height_cm,age,followers,following,welcome_pending,username,name,fitness_level,goal,gender` — nenhum de `streak`, `longest_streak`, `workouts_in_month`, `total_workouts` |

### 3.3 — Dados de B e comparação

B: 3 treinos reais pelo `POST /workouts/sessions` (2 hoje, 1 ontem; 201) + 5 `STRENGTH` antigas por SQL (03/09, 10/09, 25/09 do mês passado — as duas primeiras até o dia 14, a terceira depois —, 05/11/2025 = 11 meses, 05/09/2025 = 13 meses).

SQL de referência (`-180 min`): `2025-09-05:1 2025-11-05:1 2026-09-03:1 2026-09-10:1 2026-09-25:1 2026-10-13:1 2026-10-14:2`.

| Campo | API | Esperado (SQL / regra) | |
|---|---|---|---|
| `total_activities` | 8 | 8 | PASS |
| `streak` | current 2, longest 2 | 13 e 14/10 seguidos; demais dias isolados | PASS |
| `month` | active_days 2, activities 3, `active_days_delta` 0 | 2 dias / 3 atividades no mês; mês passado até o dia 14 = 2 dias (03 e 10) → 2−2 = 0; o dia 25/09 **não** entra | PASS |
| `calendar` janela | `2025-10-12` … `2026-10-14` (6 dias com atividade) | 53 semanas | PASS |
| `calendar.days` | 2025-11-05:1, 2026-09-03:1, 09-10:1, 09-25:1, 10-13:1, 10-14:2 | = SQL dentro da janela; o de 05/09/2025 (13 meses) fica fora | PASS |

### 3.6 — nota do cenário `TEST_OTHER`

O plano pede o `TEST_OTHER` "no dia de hoje, num dia sem treino", mas B já tem treino hoje. Fiz duas variantes, as duas apagadas ao final:
- **B, 12/10 (dia sem treino, colado ao streak):** streak de B 2 → **3** (perfil e Home iguais), `calendar` ganha `2026-10-12:1`, `total_activities` 8 → 9. Apagado: voltou a 2 / 8.
- **A, hoje (A não tem nenhuma atividade):** streak 0 → **1** (perfil e Home), `calendar` `[{2026-10-14, 1}]`, total 0 → 1. Apagado: voltou a 0 / 0.

O histórico (`/users/:id/activities`) não filtra por tipo (`listActivities` só filtra com `type` explícito).

## Step 4 — Meia-noite local (Review Focus 1)

Atividade `STRENGTH` de B em `2026-10-13T02:50:00Z` (= 23:50 BRT de anteontem, 12/10). Hoje = 14/10.

| `tz_offset_min` | Resultado | |
|---|---|---|
| `-180` | dia **2026-10-12** no `calendar.days` (`10-12:1, 10-13:1, 10-14:2`); streak 3/3; mês: 3 dias, 4 atividades, delta +1 | **PASS** |
| `0` | dia **2026-10-13** (`10-13:2, 10-14:2`); streak 2/2; mês: 2 dias, 4 atividades, delta 0 | **PASS** |

A mesma atividade cai em dias locais diferentes conforme o fuso de quem vê, e streak, mês e calendário seguem o mesmo dia. Linha apagada; B voltou a streak 2 / total 8.

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| I1 | INFO | Plano | Step 3.6 pede `TEST_OTHER` "hoje, num dia sem treino", impossível em B (tem treino hoje). Coberto com duas variantes (B no dia 12/10 e A hoje). Sugestão: ajustar o texto do plano na Task 8. |
| I2 | INFO | Ambiente QA | O role do Prisma (`DATABASE_URL`) não lê o schema `auth` (`permission denied for schema auth`), e o MCP do Supabase da sessão aponta para outro projeto (`Portal Tradsul`, ref `xaw…`), não o do Torv (ref `fig…`). Não usei o MCP. Confirmação de e-mail e remoção das contas foram feitas pela Admin API do Auth (`email_confirm:true`, `DELETE /admin/users/:id`) com a chave do `.env`, sem imprimir segredos. Os dados em tabelas `public` foram por SQL via Prisma só nas contas QA. |
| I3 | INFO | Backend | Mudança fora do escopo no working tree: `BackEndTorv/package-lock.json` e `docs/superpowers/specs/2026-10-14-gpx-import-design.md` aparecem modificados, mas não são deste commit nem meus. Não os incluí no commit do relatório. |

Cobertura equivalente: as rotas de `activities`/`profile` alteradas mantêm seus testes (ajustados junto com a regra: streak de qualquer tipo, campos removidos do `GET /profile`); as 2 rotas novas têm testes de rotas e repositório (+33 no total).

## Limpeza e contagens

Apagados: 1 grupo (`QA Perfil`), 3 contas QA (`auth.users` → `users`, perfis, atividades, séries, streak e membros por cascade) e as linhas `TEST_OTHER`/`QA meia-noite` (já removidas nos passos). Nenhuma foto nem capa criada. Arquivo temporário com tokens apagado.

| Tabela | Antes | Com dados QA | Depois |
|---|---|---|---|
| `users` | 87 | 90 | **87** |
| `auth.users` | 87 | 90 | **87** |
| `activities` | 417 | 425 | **417** |
| `groups` | 8 | 9 | **8** |
| `group_members` | 7 | 9 | **7** |

Sem resíduo: 0 linhas das três contas em `users`, `user_profiles`, `activities`, `group_members`, `user_streaks`; 0 grupos `QA Perfil`; 0 atividades `TEST_OTHER`.
