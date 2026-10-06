# Grupos e competição — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Neste projeto a execução é pelos recruits do Maestri (`maestri ask`), um por vez, não por subagentes internos** (ver Global Constraints).

**Goal:** grupos com foto de capa, convite/pedido/link de entrada e um ranking de constância (dias com treino) por período, mais editar e excluir treinos já salvos.

**Architecture:**
- **Database:** 1 migration altera `groups`, cria `group_invitations` e índices; `group_rankings` fica e passa a ser a tabela materializada do ranking.
- **Backend:** dois plugins Fastify novos (`groups.routes.js`, `groupInvitations.routes.js`, ambos em `/groups`), `groups.repository.js` + `groupInvitations.repository.js`, libs puras (`groupRules.js`, `imageUpload.js`). O ranking é **recalculado** (idempotente) por `recomputeRanking`, chamado dentro das transações que criam/apagam atividades.
- **Frontend:** aba Grupos + 5 telas empilhadas (`GroupDetail`, `GroupEditor`, `GroupManage`, `JoinGroup`, `WorkoutEdit`), serviço `groupsApi`, utilitários puros testáveis (`groupPeriod`, `groupLink`, `setEdit`) e deep link `torv://join/<código>`.

**Tech Stack:**
- **Backend:** Node 24, Fastify 5 + TypeBox (Ajv com `coerceTypes`), Prisma 6.4.1 em Postgres/Supabase, `@fastify/multipart`, `@fastify/rate-limit`, testes com `node:test` (`npm test` em `BackEndTorv`).
- **Frontend:** React Native 0.86, Expo 57, react-native-web 0.21, `expo-image-picker` (já instalado), `expo-linking` (novo). Testes: `node --test` sobre `.mjs` que importam `.ts` (type stripping).

**Spec:** `docs/superpowers/specs/2026-10-06-groups-competition-design.md`

## Global Constraints

- Branch `feat/workout-module`. **Nada de push** (o usuário avisa quando).
- **Execução estritamente sequencial:** um recruit por vez, via `maestri ask`. Cada etapa só começa depois do teste da etapa anterior verde. Nunca Backend e Frontend em paralelo.
- **Commit só dos arquivos da própria tarefa, com pathspec explícito** (`git commit -m "..." -- <arquivos>`). Nunca entram em commit: `FrontEndTorv/src/screens/Login/index.tsx`, `FrontEndTorv/tsconfig.json`, `revisar*.md`, `FrontEndTorv/.env`, `CLAUDE.md`.
- **Atribuição** em todo commit: linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Recurso de outro usuário, grupo invisível ou papel insuficiente:** responde **404**, nunca 403.
- **Nullable num corpo de request:** `Type.Unsafe({ type: ['string','null'], ... })`, nunca `Type.Union` (bug do Ajv `coerceTypes`).
- **UUID em params e corpo:** o `Uuid` de `workout.schemas.js` (com `pattern` estrito; o `format: 'uuid'` do Ajv aceita `urn:uuid:`).
- **Pontuação:** 1 ponto por **dia local** do grupo com atividade, só com `start_time >= joined_at` e dia entre `starts_at` e `ends_at` (inclusive; `ends_at` nulo = sem fim). Dia local = `(start_time AT TIME ZONE 'UTC') + tz_offset_min`.
- **Data do treino fixa:** o `PUT` de sessão nunca altera `started_at`.
- **Grupo encerrado** (`ends_at` anterior ao dia local do grupo) não aceita novos membros: convite, pedido, aceite e link respondem 409.
- **O front chama só a nossa API**: sem cliente Supabase, sem segredo em `EXPO_PUBLIC_*`. URLs de capa e de foto vêm absolutas do backend.
- **Backend roda no Furnace** (porta 3000) e **só o Maestro** o para ou reinicia. Nunca suba outra instância. Depois das tarefas de backend, o Maestro reinicia o Furnace.
- **Frontend:** antes de qualquer código, ler a doc versionada do Expo (`FrontEndTorv/AGENTS.md`: https://docs.expo.dev/versions/v56.0.0/). Telas novas passam por `/frontend-design`. Textos em pt-BR, alvos de toque de 44 px, layout que caiba em 320 px, confirmações no `ConfirmModal` (nunca `Alert.alert`, que não funciona no Expo web).
- **Usabilidade:** no Expo web, pelo portal de navegador do Maestri. O token nunca sai do navegador.
- **Relatórios** em `docs/`, um arquivo novo por rodada (`qa-groups-competition-<estagio>-2026-10-06[-roundN].md`, `security-groups-competition-2026-10-06[-roundN].md`), nunca sobrescrevendo.

## Review Focus

1. **Treino perto da meia-noite:** treino às 22h no Brasil (já é o dia seguinte em UTC) conta no dia **local** do grupo (`tz_offset_min`), e dois treinos no mesmo dia local valem 1 ponto. Coberto em `groupToday` (Task 2), no teste do SQL (Task 3) e no cenário ao vivo (Task 7).
2. **Apagar treino:** apagar um de dois treinos do mesmo dia **mantém** o ponto; apagar o único o tira. Coberto no teste de rota do `DELETE` (Task 6) e no cenário ao vivo (Task 7).
3. **Grupo encerrado ou ainda não iniciado:** entrar por link, aceitar convite ou pedir entrada num grupo encerrado dá 409; antes de `starts_at` o ranking fica zerado e o grupo aparece como "Começa em N dias". Coberto em `isEnded` (Task 2), nos testes de convite (Task 5) e em `groupStatus` (Task 8).
4. **Código e link inválidos:** código digitado em minúsculas, com espaços, com letras proibidas (`0 O 1 I L`), link revogado ou regenerado, URL `torv://` malformada, link aberto deslogado. Coberto em `normalizeToken`/`isValidToken` (Task 2), nos testes de `join` (Task 5) e em `joinTokenFromUrl` (Task 8).
5. **Upload da capa:** arquivo que não é imagem, assinatura falsa, maior que 5 MB, usuário que não é o dono, troca de capa (a antiga some do disco). Coberto em `readImage` (Task 2) e nos testes de rota (Task 4).

## Arquivos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Database | `BackEndTorv/prisma/migrations/20261006120000_groups/migration.sql` | **Cria.** DDL, CHECKs, índices, RLS |
| Database | `BackEndTorv/prisma/schema.prisma` | Modelos `groups`, `group_invitations`, relações, índices |
| Database | `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`, `Regras BD.sql` | Sync do DDL e dos CHECKs |
| Backend | `src/lib/imageUpload.js` | **Cria.** Validação de imagem + gravar/apagar/URL (extraído do perfil) |
| Backend | `src/lib/groupRules.js` | **Cria.** Regras puras: dia local, encerrado, datas, token, `rankRows`, `FAILURES` |
| Backend | `src/controller/profile.controller.js` | Passa a usar `imageUpload` |
| Backend | `src/routes/workout.schemas.js` | Exporta `Uuid`/`UUID_PATTERN`; `SessionEditBody`; `id` na série do `SessionDetail` |
| Backend | `src/repository/groups.repository.js` | **Cria.** Grupos, membros, ranking, `recomputeRanking`/`recomputeGroup` |
| Backend | `src/repository/groupInvitations.repository.js` | **Cria.** Convites, pedidos, link |
| Backend | `src/controller/groups.controller.js`, `groupInvitations.controller.js` | **Cria.** |
| Backend | `src/routes/groups.schemas.js`, `groups.routes.js`, `groupInvitations.routes.js` | **Cria.** |
| Backend | `server.js` | Registra os 2 plugins em `/groups` |
| Backend | `src/repository/workout.repository.js`, `controller/workout.controller.js`, `routes/workout.routes.js` | `PUT`/`DELETE` de sessão; `recomputeRanking` no `createSession` |
| Backend | `src/**/*.test.js` | Testes (ver cada task) |
| Frontend | `package.json`, `package-lock.json`, `app.json` | `expo-linking`, `scheme: "torv"` |
| Frontend | `src/services/groups.ts`, `services/workouts.ts` | `groupsApi`; `updateSession`/`deleteSession` |
| Frontend | `src/utils/groupPeriod.ts`, `groupLink.ts`, `setEdit.ts` (+ `.test.mjs`) | Lógica pura |
| Frontend | `src/utils/pendingJoin.ts` | Token de convite recebido com o app deslogado |
| Frontend | `src/components/GroupCover`, `GroupCard` | Capa e card |
| Frontend | `src/screens/Groups`, `GroupDetail`, `GroupEditor`, `GroupManage`, `JoinGroup`, `WorkoutEdit` | Telas (`index.tsx` + `styles.ts`) |
| Frontend | `src/routes/types.ts`, `routes/index.tsx`, `routes/PrivateRoutes/index.tsx` | Aba, rotas, deep link |
| Frontend | `src/screens/WorkoutSummary/index.tsx` | Botões Editar e Excluir |

## Contrato da API (fonte única para backend e frontend)

Datas `YYYY-MM-DD`. `cover_url` e `photo_url` absolutos ou `null`. Erros: `{ "error": string }`.

| Rota | Corpo / query | Resposta |
|---|---|---|
| `POST /groups` | `{ name, visibility, starts_at, ends_at?: string\|null, tz_offset_min }` | 201 `GroupDetail` |
| `GET /groups` | | 200 `{ groups: GroupListItem[] }` |
| `GET /groups/discover?q=&cursor=` | `cursor` = deslocamento inteiro (padrão 0), 20 por página | 200 `{ groups: DiscoverItem[], next_cursor: number\|null }` |
| `GET /groups/:id` | | 200 `GroupDetail` (404 se privado e não membro) |
| `PATCH /groups/:id` | qualquer subconjunto não vazio de `name, visibility, starts_at, ends_at` | 200 `GroupDetail` |
| `DELETE /groups/:id` | | 204 |
| `POST /groups/:id/cover` | multipart, campo `photo` | 200 `{ cover_url }` |
| `GET /groups/:id/ranking` | | 200 `{ ranking: RankingRow[] }` (só membro) |
| `DELETE /groups/:id/members/:userId` | | 204 |
| `POST /groups/:id/invitations` | `{ username }` | 201 `{ id }` |
| `POST /groups/:id/requests` | | 201 `{ id }` |
| `GET /groups/:id/requests` | (dono) | 200 `{ requests: PendingItem[], invites: PendingItem[] }` |
| `GET /groups/invitations/received` | | 200 `{ invitations: ReceivedInvitation[] }` |
| `POST /groups/invitations/:id/accept` e `/decline` | | 200 `{ group_id, status }` |
| `DELETE /groups/invitations/:id` | | 204 |
| `POST /groups/:id/invite-link` | | 200 `{ token }`; `DELETE` → 204 |
| `GET /groups/join/:token` | | 200 `JoinPreview` |
| `POST /groups/join/:token` | | 200 `{ group_id }` |
| `PUT /workouts/sessions/:id` | `{ duration_sec, sets: [{ id, duration_sec, weight_kg? }] }` | 200 `{ activity_id }` |
| `DELETE /workouts/sessions/:id` | | 204 |

```text
GroupDetail      = { id, name, visibility, cover_url, starts_at, ends_at|null, tz_offset_min, member_count,
                     is_owner, is_member, invite_token|null (só o dono), my_invitation: {id, kind}|null }
GroupListItem    = { id, name, visibility, cover_url, starts_at, ends_at|null, tz_offset_min, member_count,
                     is_owner, my_rank, my_points }
DiscoverItem     = { id, name, cover_url, starts_at, ends_at|null, tz_offset_min, member_count }
RankingRow       = { position, user_id, name, username, photo_url|null, total_points, activities_count, is_me }
PendingItem      = { id, user_id, name, username, photo_url|null, created_at }
ReceivedInvitation = { id, group: {id, name, cover_url}, invited_by: {name, username}, created_at }
JoinPreview      = { group: {id, name, cover_url, starts_at, ends_at|null, tz_offset_min, member_count},
                     is_member, ended }
```

`GET /workouts/sessions/:id` passa a devolver `id` em cada série.

---

### Task 1: Database — migration e schema

**Recruit:** Torv Database · **Files:**
- Create: `BackEndTorv/prisma/migrations/20261006120000_groups/migration.sql`
- Modify: `BackEndTorv/prisma/schema.prisma` (models `users`, `groups`, `group_members`, `group_rankings`, `activities`; novo `group_invitations`)
- Modify: `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`, `BancoDeDadosTorv/Regras BD.sql`

**Interfaces:**
- Produces: tabelas/colunas usadas por todas as tasks de backend: `groups.owner_id/visibility/cover_url/starts_at/ends_at/tz_offset_min/invite_token/created_at`, `group_invitations(id, group_id, user_id, kind, status, created_by, created_at, resolved_at)`, índice único parcial em convites pendentes.

- [ ] **Step 1: Conferir que `groups` está vazia (a migration adiciona colunas `NOT NULL`)**

Com a ferramenta `execute_sql` do Supabase (projeto do torv): `SELECT (SELECT count(*) FROM groups) AS g, (SELECT count(*) FROM group_members) AS m, (SELECT count(*) FROM group_rankings) AS r;`
Esperado: `0, 0, 0`. **Se qualquer valor for maior que 0, pare e avise o Maestro** (não apague nada).

- [ ] **Step 2: Criar a migration**

`BackEndTorv/prisma/migrations/20261006120000_groups/migration.sql`:

```sql
-- Grupos e competição. `groups`, `group_members` e `group_rankings` existiam sem uso (vazias).
-- group_rankings fica: é o ranking materializado, recalculado pelo backend (recomputeRanking).

ALTER TABLE "groups"
  ADD COLUMN "owner_id" UUID NOT NULL,
  ADD COLUMN "visibility" VARCHAR(10) NOT NULL,
  ADD COLUMN "cover_url" VARCHAR(500),
  ADD COLUMN "starts_at" DATE NOT NULL,
  ADD COLUMN "ends_at" DATE,
  ADD COLUMN "tz_offset_min" INTEGER NOT NULL,
  ADD COLUMN "invite_token" VARCHAR(12),
  ADD COLUMN "created_at" TIMESTAMPTZ DEFAULT now(),
  DROP COLUMN "period_type",
  ADD CONSTRAINT "groups_visibility_check" CHECK ("visibility" IN ('PUBLIC', 'PRIVATE')),
  ADD CONSTRAINT "groups_period_check" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at"),
  ADD CONSTRAINT "groups_tz_offset_min_check" CHECK ("tz_offset_min" BETWEEN -840 AND 840),
  ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "groups_invite_token_key" ON "groups"("invite_token");
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");
CREATE INDEX "group_rankings_order_idx" ON "group_rankings"("group_id", "total_points" DESC, "activities_count" DESC);
-- recomputeRanking varre as atividades do usuário por start_time (qualquer tipo).
CREATE INDEX IF NOT EXISTS "activities_user_id_start_time_idx" ON "activities"("user_id", "start_time");

CREATE TABLE "group_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "group_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "group_invitations_kind_check" CHECK ("kind" IN ('INVITE', 'REQUEST')),
    CONSTRAINT "group_invitations_status_check" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELED'))
);
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "group_invitations_user_id_status_idx" ON "group_invitations"("user_id", "status");
-- No máximo 1 convite/pedido pendente por (grupo, usuário).
CREATE UNIQUE INDEX "group_invitations_pending_key" ON "group_invitations"("group_id", "user_id") WHERE "status" = 'PENDING';

-- RLS: mesmo padrão de 20260925180000_lock_down_public_schema (tabela nova = ENABLE + policy do torv_api).
ALTER TABLE "group_invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY torv_api_full_access ON "group_invitations" TO torv_api USING (true) WITH CHECK (true);
```

- [ ] **Step 3: Atualizar `schema.prisma`**

Em `model users`, junto das outras relações, adicionar:

```prisma
  owned_groups              groups[]            @relation("group_owner")
  group_invitations         group_invitations[] @relation("invitee")
  group_invitations_created group_invitations[] @relation("inviter")
```

Substituir `model groups`, `model group_members` e `model group_rankings` por:

```prisma
model groups {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String    @db.VarChar(100)
  owner_id      String    @db.Uuid
  // 'PUBLIC' | 'PRIVATE' (CHECK só no SQL da migration)
  visibility    String    @db.VarChar(10)
  cover_url     String?   @db.VarChar(500)
  starts_at     DateTime  @db.Date
  // NULL = sem data de término: a competição segue para sempre
  ends_at       DateTime? @db.Date
  // fuso do grupo (offset do admin na criação); define o "dia local" da pontuação
  tz_offset_min Int
  invite_token  String?   @unique @db.VarChar(12)
  created_at    DateTime? @default(now()) @db.Timestamptz

  owner             users               @relation("group_owner", fields: [owner_id], references: [id], onDelete: Cascade)
  group_members     group_members[]
  group_rankings    group_rankings[]
  group_invitations group_invitations[]

  @@index([owner_id])
}

model group_members {
  group_id   String    @db.Uuid
  user_id    String    @db.Uuid
  joined_at  DateTime? @default(now()) @db.Timestamptz

  group      groups    @relation(fields: [group_id], references: [id], onDelete: Cascade)
  user       users     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([group_id, user_id])
  @@index([user_id])
}

// Ranking materializado: total_points = dias locais com atividade; activities_count = atividades na mesma janela.
// Recalculado (nunca incrementado) por groups.repository.recomputeRanking.
model group_rankings {
  group_id         String @db.Uuid
  user_id          String @db.Uuid
  total_points     Int?   @default(0)
  activities_count Int?   @default(0)

  group            groups @relation(fields: [group_id], references: [id], onDelete: Cascade)
  user             users  @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@id([group_id, user_id])
  @@index([group_id, total_points(sort: Desc), activities_count(sort: Desc)], map: "group_rankings_order_idx")
}

model group_invitations {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  group_id    String    @db.Uuid
  user_id     String    @db.Uuid
  // 'INVITE' (admin convida) | 'REQUEST' (usuário pede para entrar)
  kind        String    @db.VarChar(10)
  // 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED'
  status      String    @default("PENDING") @db.VarChar(10)
  created_by  String    @db.Uuid
  created_at  DateTime? @default(now()) @db.Timestamptz
  resolved_at DateTime? @db.Timestamptz

  group       groups    @relation(fields: [group_id], references: [id], onDelete: Cascade)
  user        users     @relation("invitee", fields: [user_id], references: [id], onDelete: Cascade)
  creator     users     @relation("inviter", fields: [created_by], references: [id], onDelete: Cascade)

  @@index([user_id, status])
  // + índice único parcial (group_id, user_id) WHERE status = 'PENDING', só no SQL da migration
}
```

Em `model activities`, antes do comentário do índice parcial, adicionar `@@index([user_id, start_time])`.

- [ ] **Step 4: Validar, aplicar e gerar o client**

Run (em `BackEndTorv`): `npx prisma validate` → `The schema at prisma\schema.prisma is valid`.
Run: `npx prisma migrate deploy` → aplica `20261006120000_groups`. Run: `npx prisma generate`.
Se o `generate` falhar com `EPERM`/arquivo em uso, o Furnace está segurando o client: **avise o Maestro** (só ele para o Furnace); não suba outra instância.

- [ ] **Step 5: Conferir no banco**

`list_tables` (verbose) ou `execute_sql`: `groups` tem as colunas novas e não tem `period_type`; `group_invitations` existe com RLS; `SELECT indexname FROM pg_indexes WHERE tablename IN ('groups','group_invitations','group_rankings','group_members','activities') ORDER BY 1;` lista `groups_invite_token_key`, `group_invitations_pending_key`, `group_rankings_order_idx`, `activities_user_id_start_time_idx`.

- [ ] **Step 6: Sync dos scripts SQL**

Em `BancoDeDadosTorv/SQL BANCO DE DADOS.sql` e `Regras BD.sql`, refletir o DDL novo (mesmo formato dos blocos existentes de `groups`/`group_*`) e os 4 CHECKs (`groups_visibility_check`, `groups_period_check`, `groups_tz_offset_min_check`, `group_invitations_*_check`).

- [ ] **Step 7: Commit**

```bash
git add BackEndTorv/prisma/migrations/20261006120000_groups BackEndTorv/prisma/schema.prisma "BancoDeDadosTorv/SQL BANCO DE DADOS.sql" "BancoDeDadosTorv/Regras BD.sql"
git commit -m "feat(db): groups, invitations and materialized ranking schema" -- BackEndTorv/prisma/migrations/20261006120000_groups BackEndTorv/prisma/schema.prisma "BancoDeDadosTorv/SQL BANCO DE DADOS.sql" "BancoDeDadosTorv/Regras BD.sql"
```
(O corpo do commit termina com a linha `Co-Authored-By` das Global Constraints.)

**Teste da etapa (Torv Review and Tests):** relatório `docs/qa-groups-competition-database-2026-10-06.md` — migration aplicada, schema do Prisma bate com o banco, CHECKs recusam `visibility='X'` e `ends_at < starts_at`, o índice parcial recusa um 2º convite pendente do mesmo par e aceita depois de `CANCELED`, `DELETE` de um grupo leva membros, rankings e convites (cascade), `anon` não lê as tabelas novas. Dados de teste criados são apagados no fim.

---

### Task 2: Backend — libs `imageUpload` e `groupRules`

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/lib/imageUpload.js`, `BackEndTorv/src/lib/groupRules.js`
- Create: `BackEndTorv/src/lib/tests/imageUpload.test.js`, `BackEndTorv/src/lib/tests/groupRules.test.js`
- Modify: `BackEndTorv/src/controller/profile.controller.js` (usa `imageUpload`)
- Modify: `BackEndTorv/src/routes/workout.schemas.js` (exporta `Uuid`, `UUID_PATTERN`)

**Interfaces:**
- Produces (`imageUpload`): `ALLOWED_IMAGE_TYPES`, `hasValidImageSignature(buffer, mimetype): boolean`, `readImage(request, { maxBytes? }): Promise<{ buffer, ext } | { error: string, status: number }>`, `saveImage(fileName, buffer): Promise<void>`, `deleteImage(fileName): Promise<void>` (ignora nulo e arquivo ausente), `publicUrl(request, fileName): string | null`.
- Produces (`groupRules`): `TOKEN_ALPHABET`, `generateInviteToken(): string` (8 caracteres), `normalizeToken(raw): string`, `isValidToken(token): boolean`, `groupToday(tzOffsetMin, now = Date.now()): 'YYYY-MM-DD'`, `dateOnly(date | null): string | null`, `toDbDate('YYYY-MM-DD'): Date`, `isEnded({ ends_at: Date | null, tz_offset_min }, now?): boolean`, `checkGroupDates({ starts_at, ends_at }): string | null`, `rankRows(rows): rows + position`, `FAILURES`.

- [ ] **Step 1: Escrever os testes de `groupRules`** (falham: módulo não existe)

`BackEndTorv/src/lib/tests/groupRules.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TOKEN_ALPHABET, generateInviteToken, normalizeToken, isValidToken,
  groupToday, dateOnly, toDbDate, isEnded, checkGroupDates, rankRows,
} = require('../groupRules');

test('generateInviteToken: 8 caracteres do alfabeto sem 0 O 1 I L', () => {
  for (let i = 0; i < 200; i++) {
    const t = generateInviteToken();
    assert.equal(t.length, 8);
    assert.ok(isValidToken(t), t);
  }
  for (const bad of ['0', 'O', '1', 'I', 'L']) assert.ok(!TOKEN_ALPHABET.includes(bad), bad);
});

test('normalizeToken: tira espaços e põe em maiúsculas; isValidToken recusa tamanho e letras proibidas', () => {
  assert.equal(normalizeToken('  ab3dk7mn '), 'AB3DK7MN');
  assert.ok(isValidToken('AB3DK7MN'));
  assert.ok(!isValidToken('AB3DK7M'));      // curto
  assert.ok(!isValidToken('AB3DK7MNP'));    // longo
  assert.ok(!isValidToken('AB3DK7M0'));     // zero
  assert.ok(!isValidToken('AB3DK7MI'));     // I
  assert.ok(!isValidToken('ab3dk7mn'));     // minúsculas só depois de normalizar
});

test('groupToday: usa o fuso do grupo (22h no Brasil já é o dia seguinte em UTC)', () => {
  const now = Date.parse('2026-10-07T01:30:00Z'); // 22:30 de 06/10 em UTC-3
  assert.equal(groupToday(-180, now), '2026-10-06');
  assert.equal(groupToday(0, now), '2026-10-07');
  assert.equal(groupToday(180, Date.parse('2026-10-06T22:30:00Z')), '2026-10-07'); // UTC+3
});

test('dateOnly / toDbDate: ida e volta, nulo passa', () => {
  assert.equal(dateOnly(toDbDate('2026-10-06')), '2026-10-06');
  assert.equal(dateOnly(null), null);
});

test('isEnded: sem fim nunca encerra; encerra só depois do dia final no fuso do grupo', () => {
  const now = Date.parse('2026-10-07T01:30:00Z');
  assert.equal(isEnded({ ends_at: null, tz_offset_min: 0 }, now), false);
  assert.equal(isEnded({ ends_at: toDbDate('2026-10-06'), tz_offset_min: -180 }, now), false); // ainda 06/10 no grupo
  assert.equal(isEnded({ ends_at: toDbDate('2026-10-06'), tz_offset_min: 0 }, now), true);
  assert.equal(isEnded({ ends_at: toDbDate('2026-10-07'), tz_offset_min: 0 }, now), false);
});

test('checkGroupDates: datas reais e fim >= início', () => {
  assert.equal(checkGroupDates({ starts_at: '2026-10-06', ends_at: null }), null);
  assert.equal(checkGroupDates({ starts_at: '2026-10-06', ends_at: '2026-10-06' }), null);
  assert.match(checkGroupDates({ starts_at: '2026-10-06', ends_at: '2026-10-05' }), /ends_at/);
  assert.match(checkGroupDates({ starts_at: '2026-02-31', ends_at: null }), /starts_at/);
  assert.match(checkGroupDates({ starts_at: '2026-10-06', ends_at: '2026-13-01' }), /ends_at/);
});

test('rankRows: pontos, depois atividades, depois quem entrou primeiro; posições sequenciais', () => {
  const rows = [
    { user_id: 'c', joined_at: new Date('2026-10-03'), total_points: 3, activities_count: 4 },
    { user_id: 'a', joined_at: new Date('2026-10-02'), total_points: 5, activities_count: 5 },
    { user_id: 'b', joined_at: new Date('2026-10-01'), total_points: 3, activities_count: 4 },
    { user_id: 'd', joined_at: new Date('2026-10-04'), total_points: 3, activities_count: 6 },
  ];
  const ranked = rankRows(rows);
  assert.deepEqual(ranked.map((r) => [r.user_id, r.position]), [['a', 1], ['d', 2], ['b', 3], ['c', 4]]);
  assert.equal(rows[0].position, undefined, 'não muta a entrada');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `BackEndTorv`): `node --test src/lib/tests/groupRules.test.js` → FAIL `Cannot find module '../groupRules'`.

- [ ] **Step 3: Implementar `groupRules.js`**

`BackEndTorv/src/lib/groupRules.js`:

```js
const { randomInt } = require('node:crypto');

// Sem I, L, O, 0, 1 (confundem na digitação). 31 símbolos ^ 8 = ~8,5e11 combinações.
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TOKEN_LENGTH = 8;
const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`);

const generateInviteToken = () =>
  Array.from({ length: TOKEN_LENGTH }, () => TOKEN_ALPHABET[randomInt(TOKEN_ALPHABET.length)]).join('');
const normalizeToken = (raw) => String(raw).trim().toUpperCase();
const isValidToken = (token) => TOKEN_RE.test(token);

// Dia local do grupo (YYYY-MM-DD) num instante. Mesma conta do SQL de recomputeRanking.
const groupToday = (tzOffsetMin, now = Date.now()) => new Date(now + tzOffsetMin * 60000).toISOString().slice(0, 10);

// Colunas @db.Date chegam do Prisma como Date em 00:00 UTC.
const dateOnly = (d) => (d ? d.toISOString().slice(0, 10) : null);
const toDbDate = (s) => new Date(`${s}T00:00:00Z`);

const isEnded = (group, now = Date.now()) =>
  group.ends_at != null && groupToday(group.tz_offset_min, now) > dateOnly(group.ends_at);

const validDate = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

function checkGroupDates({ starts_at, ends_at }) {
  if (!validDate(starts_at)) return 'starts_at must be a valid date';
  if (ends_at != null) {
    if (!validDate(ends_at)) return 'ends_at must be a valid date';
    if (ends_at < starts_at) return 'ends_at must be on or after starts_at';
  }
  return null;
}

// Pontos, depois atividades, depois quem entrou primeiro (user_id só para a ordem ser estável). Posições sem empate.
const rankRows = (rows) =>
  [...rows]
    .sort((a, b) =>
      (b.total_points - a.total_points)
      || (b.activities_count - a.activities_count)
      || (new Date(a.joined_at) - new Date(b.joined_at))
      || a.user_id.localeCompare(b.user_id))
    .map((r, i) => ({ ...r, position: i + 1 }));

// Código de falha do repository → [status HTTP, mensagem].
const FAILURES = {
  not_found: [404, 'Not found'],
  ended: [409, 'Group has ended'],
  already_member: [409, 'Already a member'],
  duplicate: [409, 'Already pending'],
  not_pending: [409, 'Invitation is not pending'],
  owner_cannot_leave: [409, 'Owner cannot leave the group; delete it instead'],
};

module.exports = {
  TOKEN_ALPHABET, generateInviteToken, normalizeToken, isValidToken,
  groupToday, dateOnly, toDbDate, isEnded, checkGroupDates, rankRows, FAILURES,
};
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/lib/tests/groupRules.test.js` → todos PASS.

- [ ] **Step 5: Testes de `imageUpload`**

`BackEndTorv/src/lib/tests/imageUpload.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hasValidImageSignature, readImage, publicUrl, deleteImage } = require('../imageUpload');

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP')]);

test('hasValidImageSignature: bate o tipo declarado com os bytes', () => {
  assert.ok(hasValidImageSignature(JPEG, 'image/jpeg'));
  assert.ok(hasValidImageSignature(PNG, 'image/png'));
  assert.ok(hasValidImageSignature(WEBP, 'image/webp'));
  assert.ok(!hasValidImageSignature(PNG, 'image/jpeg'));
  assert.ok(!hasValidImageSignature(Buffer.from('<?php'), 'image/png'));
  assert.ok(!hasValidImageSignature(JPEG, 'image/gif'));
});

const fakeRequest = (data) => ({ file: async () => data });
const upload = (mimetype, buffer) => ({ mimetype, toBuffer: async () => buffer, file: { truncated: false } });

test('readImage: sem arquivo, tipo proibido e assinatura falsa → 400', async () => {
  assert.deepEqual(await readImage(fakeRequest(undefined)), { error: 'No image file provided', status: 400 });
  assert.equal((await readImage(fakeRequest(upload('application/pdf', JPEG)))).status, 400);
  assert.equal((await readImage(fakeRequest(upload('image/png', JPEG)))).status, 400);
});

test('readImage: imagem válida devolve buffer e extensão', async () => {
  const out = await readImage(fakeRequest(upload('image/png', PNG)));
  assert.equal(out.ext, '.png');
  assert.equal(out.buffer, PNG);
});

test('readImage: arquivo maior que o limite (truncado ou erro do multipart) → 413', async () => {
  const truncated = { mimetype: 'image/png', toBuffer: async () => PNG, file: { truncated: true } };
  assert.equal((await readImage(fakeRequest(truncated), { maxBytes: 10 })).status, 413);
  const throwing = { mimetype: 'image/png', file: {}, toBuffer: async () => { const e = new Error('big'); e.code = 'FST_REQ_FILE_TOO_LARGE'; throw e; } };
  assert.equal((await readImage(fakeRequest(throwing), { maxBytes: 10 })).status, 413);
});

test('readImage: repassa maxBytes ao multipart', async () => {
  let seen;
  await readImage({ file: async (opts) => { seen = opts; return undefined; } }, { maxBytes: 123 });
  assert.deepEqual(seen, { limits: { fileSize: 123 } });
});

test('publicUrl: monta a URL absoluta ou null', () => {
  const req = { protocol: 'http', headers: { host: 'localhost:3000' } };
  assert.equal(publicUrl(req, 'a.jpg'), 'http://localhost:3000/uploads/a.jpg');
  assert.equal(publicUrl(req, null), null);
});

test('deleteImage: ignora nulo e arquivo ausente, e não sai da pasta de uploads', async () => {
  await deleteImage(null);
  await deleteImage('nao-existe-xyz.jpg');
  const outside = path.join(os.tmpdir(), 'torv-outside.txt');
  fs.writeFileSync(outside, 'x');
  await deleteImage(`../../../../${outside}`); // basename() descarta o caminho
  assert.ok(fs.existsSync(outside));
  fs.rmSync(outside);
});
```

- [ ] **Step 6: Implementar `imageUpload.js` e rodar**

`BackEndTorv/src/lib/imageUpload.js` (a validação é a mesma que estava em `profile.controller.js`):

```js
const fs = require('fs');
const path = require('path');

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Fotos de perfil e capas de grupo. Ponto único de troca quando o storage migrar.
const UPLOAD_DIR = path.join(__dirname, '../../profilePhotos');

function hasValidImageSignature(buffer, mimetype) {
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimetype === 'image/webp') {
    return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

// Lê o campo de arquivo da request e valida tipo + assinatura. Erros do próprio multipart (não é multipart etc.) sobem.
async function readImage(request, { maxBytes } = {}) {
  const data = await request.file(maxBytes ? { limits: { fileSize: maxBytes } } : undefined);
  if (!data) return { error: 'No image file provided', status: 400 };

  const ext = ALLOWED_IMAGE_TYPES[data.mimetype];
  if (!ext) return { error: 'File must be a JPEG, PNG, or WebP image', status: 400 };

  let buffer;
  try {
    buffer = await data.toBuffer();
  } catch (err) {
    if (err.code === 'FST_REQ_FILE_TOO_LARGE') return { error: 'Image is too large', status: 413 };
    throw err;
  }
  if (data.file?.truncated) return { error: 'Image is too large', status: 413 };
  if (!hasValidImageSignature(buffer, data.mimetype)) {
    return { error: 'File content does not match a JPEG, PNG, or WebP image', status: 400 };
  }
  return { buffer, ext };
}

async function saveImage(fileName, buffer) {
  await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
}

// basename(): o nome vem do banco, mas nunca deixa sair da pasta de uploads.
async function deleteImage(fileName) {
  if (!fileName) return;
  await fs.promises.rm(path.join(UPLOAD_DIR, path.basename(fileName)), { force: true });
}

const publicUrl = (request, fileName) =>
  (fileName ? `${request.protocol}://${request.headers.host}/uploads/${fileName}` : null);

module.exports = { ALLOWED_IMAGE_TYPES, hasValidImageSignature, readImage, saveImage, deleteImage, publicUrl };
```

Run: `node --test src/lib/tests/imageUpload.test.js` → PASS.

- [ ] **Step 7: Perfil passa a usar a lib**

Em `profile.controller.js`: remover `ALLOWED_IMAGE_TYPES`, `hasValidImageSignature` e os `require` de `path`/`fs` **se** não forem mais usados no arquivo; importar `const { readImage, saveImage } = require('../lib/imageUpload');`. Em `uploadPhoto`, trocar o trecho de `request.file()` até o `writeFile` por:

```js
      const image = await readImage(request);
      if (image.error) return reply.status(image.status).send({ error: image.error });

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const fileName = `profile-${userId}-${uniqueSuffix}${image.ext}`;
      await saveImage(fileName, image.buffer);
```

O resto (`updatePhotoUrl`, resposta com `photo_url`) fica igual. Em `workout.schemas.js`, acrescentar `Uuid, UUID_PATTERN` ao `module.exports`.

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test` → tudo PASS (os testes de perfil existentes continuam verdes).

- [ ] **Step 9: Commit**

```bash
git add BackEndTorv/src/lib/imageUpload.js BackEndTorv/src/lib/groupRules.js BackEndTorv/src/lib/tests/imageUpload.test.js BackEndTorv/src/lib/tests/groupRules.test.js BackEndTorv/src/controller/profile.controller.js BackEndTorv/src/routes/workout.schemas.js
git commit -m "feat(groups): imageUpload and groupRules libs; profile uses shared upload" -- BackEndTorv/src/lib/imageUpload.js BackEndTorv/src/lib/groupRules.js BackEndTorv/src/lib/tests/imageUpload.test.js BackEndTorv/src/lib/tests/groupRules.test.js BackEndTorv/src/controller/profile.controller.js BackEndTorv/src/routes/workout.schemas.js
```


---

### Task 3: Backend — `groups.repository.js` (grupos, membros, ranking)

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/repository/groups.repository.js`
- Test: `BackEndTorv/src/repository/tests/groups.repository.test.js`

**Interfaces:**
- Consumes: `rankRows` de `groupRules` (Task 2); client Prisma regenerado (Task 1).
- Produces (singleton `new GroupsRepository()`), todos recebem ids já validados como UUID:
  - `recomputeRanking(db, userId): Promise<number>` e `recomputeGroup(db, groupId): Promise<number>` — `db` é o client ou uma `tx`.
  - `addMember(db, groupId, userId): Promise<void>` (insere `group_members` + linha de ranking zerada).
  - `createGroup(ownerId, { name, visibility, starts_at: Date, ends_at: Date|null, tz_offset_min }): Promise<string>` (id).
  - `getForViewer(userId, id): Promise<{ group, member_count, is_member, my_invitation } | null>` — `null` se não existe **ou** se é `PRIVATE` e o usuário não é membro. `group` traz `invite_token` e `owner_id`.
  - `getOwned(userId, id): Promise<group | null>` (campos de `GROUP_FIELDS`, inclui `cover_url`).
  - `updateGroup(id, data, { recompute }): Promise<void>`; `deleteGroup(userId, id): Promise<{ cover_url } | null>`; `setCover(id, fileName): Promise<string | null>` (capa anterior).
  - `listMine(userId): Promise<Array<GROUP_FIELDS & { member_count, my_rank, my_points }>>`.
  - `discover(userId, q, offset, limit): Promise<{ rows, hasMore }>`.
  - `getRanking(userId, groupId): Promise<Array<{ position, user_id, joined_at, name, username, photo_url, total_points, activities_count }> | null>` (`null` se não é membro).
  - `removeMember(actorId, groupId, targetId): Promise<'ok' | 'not_found' | 'owner_cannot_leave'>`.

- [ ] **Step 1: Escrever os testes** (falham: módulo não existe)

`BackEndTorv/src/repository/tests/groups.repository.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';
const GROUP = '22222222-2222-4222-8222-222222222222';

// Prisma falso (o client real é um Proxy que o mock.method não alcança). `state` é recriado a cada teste.
let state;
const fresh = (over = {}) => ({ calls: [], executeRaw: [], queryRaw: [], members: [], rankings: [], group: null, ...over });
const rec = (name, ret) => async (args) => { state.calls.push([name, args]); return typeof ret === 'function' ? ret(args) : ret; };
const fakePrisma = {
  $executeRaw: async (q) => { state.executeRaw.push(q); return 1; },
  $queryRaw: async (strings, ...values) => { state.queryRaw.push({ sql: strings.join('?').replace(/\s+/g, ' '), values }); return state.queryRows ?? []; },
  $transaction: async (fn) => fn(fakePrisma),
  groups: {
    create: rec('groups.create', () => ({ id: GROUP })),
    findUnique: rec('groups.findUnique', () => state.group),
    findFirst: rec('groups.findFirst', () => state.group),
  },
  group_members: {
    create: rec('members.create', {}),
    findUnique: rec('members.findUnique', () => state.membership ?? null),
    findMany: rec('members.findMany', () => state.members),
    deleteMany: rec('members.deleteMany', () => ({ count: state.deleted ?? 1 })),
  },
  group_rankings: {
    create: rec('rankings.create', {}),
    findMany: rec('rankings.findMany', () => state.rankings),
    deleteMany: rec('rankings.deleteMany', { count: 1 }),
  },
  group_invitations: {
    findFirst: rec('invitations.findFirst', () => state.invitation ?? null),
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../groups.repository');

const sql = (q) => q.sql.replace(/\s+/g, ' ');

test('recomputeRanking: um UPSERT só, preso ao usuário, com dia local do fuso do grupo e janela por joined_at', async () => {
  state = fresh();
  await repo.recomputeRanking(fakePrisma, USER);
  assert.equal(state.executeRaw.length, 1);
  const [q] = state.executeRaw;
  assert.match(sql(q), /INSERT INTO group_rankings/);
  assert.match(sql(q), /make_interval\(mins => g\.tz_offset_min\)/);
  assert.match(sql(q), /a\.start_time >= gm\.joined_at/);
  assert.match(sql(q), /d\.local_day >= g\.starts_at AND \(g\.ends_at IS NULL OR d\.local_day <= g\.ends_at\)/);
  assert.match(sql(q), /COUNT\(DISTINCT d\.local_day\)/);
  assert.match(sql(q), /WHERE gm\.user_id = \?::uuid/);
  assert.match(sql(q), /ON CONFLICT \(group_id, user_id\) DO UPDATE/);
  assert.deepEqual(q.values, [USER]);
});

test('recomputeGroup: mesmo UPSERT, preso ao grupo', async () => {
  state = fresh();
  await repo.recomputeGroup(fakePrisma, GROUP);
  const [q] = state.executeRaw;
  assert.match(sql(q), /WHERE gm\.group_id = \?::uuid/);
  assert.deepEqual(q.values, [GROUP]);
});

test('createGroup: grupo, dono como membro e linha de ranking zerada', async () => {
  state = fresh();
  const id = await repo.createGroup(USER, { name: 'Time', visibility: 'PUBLIC', starts_at: new Date('2026-10-06'), ends_at: null, tz_offset_min: -180 });
  assert.equal(id, GROUP);
  assert.deepEqual(state.calls.map(([n]) => n), ['groups.create', 'members.create', 'rankings.create']);
  assert.equal(state.calls[0][1].data.owner_id, USER);
  assert.deepEqual(state.calls[1][1].data, { group_id: GROUP, user_id: USER });
  assert.deepEqual(state.calls[2][1].data, { group_id: GROUP, user_id: USER, total_points: 0, activities_count: 0 });
});

test('getForViewer: privado e não membro → null; público e não membro → vê, sem ser membro', async () => {
  state = fresh({ group: { id: GROUP, visibility: 'PRIVATE', owner_id: OTHER, _count: { group_members: 3 } }, membership: null });
  assert.equal(await repo.getForViewer(USER, GROUP), null);
  state = fresh({ group: { id: GROUP, visibility: 'PUBLIC', owner_id: OTHER, _count: { group_members: 3 } }, membership: null });
  const out = await repo.getForViewer(USER, GROUP);
  assert.equal(out.member_count, 3);
  assert.equal(out.is_member, false);
});

const member = (user_id, joined_at, rank) => ({
  user_id,
  joined_at: new Date(joined_at),
  user: { user_profiles: { name: user_id, username: user_id, photo_url: null }, group_rankings: rank ? [rank] : [] },
});

test('getRanking: só membro; quem não tem linha de ranking entra com zero; ordem por pontos', async () => {
  state = fresh({ membership: null });
  assert.equal(await repo.getRanking(USER, GROUP), null);

  state = fresh({
    membership: { user_id: USER },
    members: [
      member(USER, '2026-10-01', { total_points: 2, activities_count: 2 }),
      member(OTHER, '2026-10-02', { total_points: 5, activities_count: 6 }),
      member('c', '2026-10-03', null),
    ],
  });
  const out = await repo.getRanking(USER, GROUP);
  assert.deepEqual(out.map((r) => [r.user_id, r.position, r.total_points]), [[OTHER, 1, 5], [USER, 2, 2], ['c', 3, 0]]);
});

test('listMine: posição e pontos do usuário em cada grupo', async () => {
  state = fresh({
    rankings: [
      { group_id: GROUP, user_id: USER, total_points: 1, activities_count: 1 },
      { group_id: GROUP, user_id: OTHER, total_points: 4, activities_count: 4 },
    ],
  });
  const original = fakePrisma.group_members.findMany;
  fakePrisma.group_members.findMany = async (args) => {
    if (args.where.user_id) {
      return [{ group: { id: GROUP, name: 'Time', visibility: 'PUBLIC', cover_url: null, starts_at: new Date('2026-10-01'), ends_at: null, tz_offset_min: 0, owner_id: OTHER, _count: { group_members: 2 } } }];
    }
    return [{ group_id: GROUP, user_id: USER, joined_at: new Date('2026-10-01') }, { group_id: GROUP, user_id: OTHER, joined_at: new Date('2026-10-01') }];
  };
  try {
    const [g] = await repo.listMine(USER);
    assert.equal(g.member_count, 2);
    assert.equal(g.my_rank, 2);
    assert.equal(g.my_points, 1);
    assert.equal(g._count, undefined);
  } finally {
    fakePrisma.group_members.findMany = original;
  }
});

test('removeMember: sair, dono não sai, só o dono remove os outros', async () => {
  const owner = { owner_id: OTHER };
  state = fresh({ group: owner });
  assert.equal(await repo.removeMember(OTHER, GROUP, OTHER), 'owner_cannot_leave');
  state = fresh({ group: owner });
  assert.equal(await repo.removeMember(USER, GROUP, USER), 'ok');
  assert.deepEqual(state.calls.map(([n]) => n).slice(-2), ['members.deleteMany', 'rankings.deleteMany']);
  state = fresh({ group: owner });
  assert.equal(await repo.removeMember(USER, GROUP, 'c'), 'not_found'); // membro comum não remove outro
  state = fresh({ group: owner, deleted: 0 });
  assert.equal(await repo.removeMember(OTHER, GROUP, 'c'), 'not_found'); // alvo não é membro
  state = fresh({ group: null });
  assert.equal(await repo.removeMember(USER, GROUP, USER), 'not_found');
});

test('discover: escapa % e _ do termo, exclui meus grupos e pagina com limite + 1', async () => {
  state = fresh({ queryRows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
  const out = await repo.discover(USER, '50%_a', 0, 2);
  assert.equal(out.rows.length, 2);
  assert.equal(out.hasMore, true);
  const [q] = state.queryRaw;
  assert.match(q.sql, /g\.visibility = 'PUBLIC'/);
  assert.match(q.sql, /ILIKE \? ESCAPE/);
  assert.match(q.sql, /NOT EXISTS \(SELECT 1 FROM group_members m2/);
  assert.equal(q.values[0], '%50\\%\\_a%');
  assert.ok(q.values.includes(USER));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run (em `BackEndTorv`): `node --test src/repository/tests/groups.repository.test.js` → FAIL `Cannot find module '../groups.repository'`.

- [ ] **Step 3: Implementar**

`BackEndTorv/src/repository/groups.repository.js`:

```js
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const { rankRows } = require('../lib/groupRules');

const TX = { timeout: 15000 };
const GROUP_FIELDS = {
  id: true, name: true, visibility: true, cover_url: true,
  starts_at: true, ends_at: true, tz_offset_min: true, owner_id: true,
};
const PROFILE = { select: { name: true, username: true, photo_url: true } };
const keyOf = (groupId, userId) => `${groupId}:${userId}`;
const memberKey = (groupId, userId) => ({ group_id_user_id: { group_id: groupId, user_id: userId } });

// Pontos = dias locais DISTINTOS com atividade na janela do membro (joined_at até o fim do grupo);
// atividades = quantas atividades caem na mesma janela. Recalcula a linha inteira: idempotente, se corrige sozinha.
// Dia local = (start_time em UTC) + tz_offset_min do grupo, igual a groupRules.groupToday.
// Qualquer código que crie, apague ou mude a data de uma atividade TEM que chamar recomputeRanking na mesma transação.
const upsertRanking = (db, where) => db.$executeRaw(Prisma.sql`
  INSERT INTO group_rankings (group_id, user_id, total_points, activities_count)
  SELECT gm.group_id, gm.user_id, COUNT(DISTINCT d.local_day)::int, COUNT(d.local_day)::int
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  LEFT JOIN LATERAL (
    SELECT ((a.start_time AT TIME ZONE 'UTC') + make_interval(mins => g.tz_offset_min))::date AS local_day
    FROM activities a
    WHERE a.user_id = gm.user_id AND a.start_time >= gm.joined_at
  ) d ON d.local_day >= g.starts_at AND (g.ends_at IS NULL OR d.local_day <= g.ends_at)
  WHERE ${where}
  GROUP BY gm.group_id, gm.user_id
  ON CONFLICT (group_id, user_id) DO UPDATE
    SET total_points = EXCLUDED.total_points, activities_count = EXCLUDED.activities_count`);

class GroupsRepository {
  recomputeRanking(db, userId) {
    return upsertRanking(db, Prisma.sql`gm.user_id = ${userId}::uuid`);
  }

  recomputeGroup(db, groupId) {
    return upsertRanking(db, Prisma.sql`gm.group_id = ${groupId}::uuid`);
  }

  // Membro novo entra com a linha de ranking zerada (joined_at = agora: treinos de antes não contam).
  async addMember(db, groupId, userId) {
    await db.group_members.create({ data: { group_id: groupId, user_id: userId } });
    await db.group_rankings.create({ data: { group_id: groupId, user_id: userId, total_points: 0, activities_count: 0 } });
  }

  async createGroup(ownerId, data) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.groups.create({ data: { ...data, owner_id: ownerId }, select: { id: true } });
      await this.addMember(tx, group.id, ownerId);
      return group.id;
    }, TX);
  }

  // null = não existe, ou é PRIVATE e o usuário não é membro (o chamador responde 404 nos dois casos).
  async getForViewer(userId, id) {
    const [group, membership, invitation] = await Promise.all([
      prisma.groups.findUnique({
        where: { id },
        select: { ...GROUP_FIELDS, invite_token: true, _count: { select: { group_members: true } } },
      }),
      prisma.group_members.findUnique({ where: memberKey(id, userId), select: { user_id: true } }),
      prisma.group_invitations.findFirst({
        where: { group_id: id, user_id: userId, status: 'PENDING' },
        select: { id: true, kind: true },
      }),
    ]);
    if (!group || (group.visibility === 'PRIVATE' && !membership)) return null;
    return { group, member_count: group._count.group_members, is_member: !!membership, my_invitation: invitation };
  }

  getOwned(userId, id) {
    return prisma.groups.findFirst({ where: { id, owner_id: userId }, select: GROUP_FIELDS });
  }

  async updateGroup(id, data, { recompute }) {
    await prisma.$transaction(async (tx) => {
      await tx.groups.update({ where: { id }, data });
      if (recompute) await this.recomputeGroup(tx, id);
    }, TX);
  }

  async deleteGroup(userId, id) {
    const group = await prisma.groups.findFirst({ where: { id, owner_id: userId }, select: { cover_url: true } });
    if (!group) return null;
    await prisma.groups.delete({ where: { id } });
    return { cover_url: group.cover_url };
  }

  // Devolve a capa anterior, para o chamador apagar o arquivo.
  async setCover(id, fileName) {
    const previous = await prisma.groups.findUnique({ where: { id }, select: { cover_url: true } });
    await prisma.groups.update({ where: { id }, data: { cover_url: fileName } });
    return previous?.cover_url ?? null;
  }

  // ponytail: rank calculado em JS sobre as linhas de todos os grupos do usuário (até ~100 membros por grupo);
  // com grupos enormes, mover para SQL com window function.
  async listMine(userId) {
    const memberships = await prisma.group_members.findMany({
      where: { user_id: userId },
      orderBy: { joined_at: 'desc' },
      select: { group: { select: { ...GROUP_FIELDS, _count: { select: { group_members: true } } } } },
    });
    const groups = memberships.map((m) => m.group);
    if (groups.length === 0) return [];
    const ids = groups.map((g) => g.id);
    const [members, rankings] = await Promise.all([
      prisma.group_members.findMany({ where: { group_id: { in: ids } }, select: { group_id: true, user_id: true, joined_at: true } }),
      prisma.group_rankings.findMany({ where: { group_id: { in: ids } }, select: { group_id: true, user_id: true, total_points: true, activities_count: true } }),
    ]);
    const scored = new Map(rankings.map((r) => [keyOf(r.group_id, r.user_id), r]));
    return groups.map(({ _count, ...g }) => {
      const rows = members.filter((m) => m.group_id === g.id).map((m) => ({
        user_id: m.user_id,
        joined_at: m.joined_at,
        total_points: scored.get(keyOf(g.id, m.user_id))?.total_points ?? 0,
        activities_count: scored.get(keyOf(g.id, m.user_id))?.activities_count ?? 0,
      }));
      const me = rankRows(rows).find((r) => r.user_id === userId);
      return { ...g, member_count: _count.group_members, my_rank: me?.position ?? rows.length, my_points: me?.total_points ?? 0 };
    });
  }

  // Públicos, ainda não encerrados (no fuso do próprio grupo) e dos quais o usuário não é membro.
  async discover(userId, q, offset, limit) {
    const like = q ? `%${q.replace(/[\\%_]/g, '\\$&')}%` : '%';
    const rows = await prisma.$queryRaw`
      SELECT g.id, g.name, g.cover_url, g.starts_at, g.ends_at, g.tz_offset_min,
             (SELECT COUNT(*)::int FROM group_members m WHERE m.group_id = g.id) AS member_count
      FROM groups g
      WHERE g.visibility = 'PUBLIC'
        AND g.name ILIKE ${like} ESCAPE '\\'
        AND (g.ends_at IS NULL OR g.ends_at >= ((now() AT TIME ZONE 'UTC') + make_interval(mins => g.tz_offset_min))::date)
        AND NOT EXISTS (SELECT 1 FROM group_members m2 WHERE m2.group_id = g.id AND m2.user_id = ${userId}::uuid)
      ORDER BY member_count DESC, g.created_at DESC, g.id
      LIMIT ${limit + 1} OFFSET ${offset}`;
    return { rows: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  // Só membro vê o ranking. Membro sem linha em group_rankings entra com zero.
  async getRanking(userId, groupId) {
    const me = await prisma.group_members.findUnique({ where: memberKey(groupId, userId), select: { user_id: true } });
    if (!me) return null;
    const members = await prisma.group_members.findMany({
      where: { group_id: groupId },
      select: {
        user_id: true,
        joined_at: true,
        user: { select: { user_profiles: PROFILE, group_rankings: { where: { group_id: groupId }, select: { total_points: true, activities_count: true } } } },
      },
    });
    return rankRows(members.map((m) => ({
      user_id: m.user_id,
      joined_at: m.joined_at,
      name: m.user.user_profiles?.name ?? '',
      username: m.user.user_profiles?.username ?? '',
      photo_url: m.user.user_profiles?.photo_url ?? null,
      total_points: m.user.group_rankings[0]?.total_points ?? 0,
      activities_count: m.user.group_rankings[0]?.activities_count ?? 0,
    })));
  }

  // O próprio usuário sai; só o dono remove outro; o dono não sai (apaga o grupo).
  async removeMember(actorId, groupId, targetId) {
    const group = await prisma.groups.findUnique({ where: { id: groupId }, select: { owner_id: true } });
    if (!group) return 'not_found';
    if (actorId === targetId) {
      if (group.owner_id === actorId) return 'owner_cannot_leave';
    } else if (group.owner_id !== actorId) {
      return 'not_found';
    }
    const removed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.group_members.deleteMany({ where: { group_id: groupId, user_id: targetId } });
      if (count) await tx.group_rankings.deleteMany({ where: { group_id: groupId, user_id: targetId } });
      return count;
    }, TX);
    return removed ? 'ok' : 'not_found';
  }
}

module.exports = new GroupsRepository();
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/repository/tests/groups.repository.test.js` → PASS. Depois `npm test` → tudo verde.

- [ ] **Step 5: Commit**

```bash
git add BackEndTorv/src/repository/groups.repository.js BackEndTorv/src/repository/tests/groups.repository.test.js
git commit -m "feat(groups): groups repository with materialized ranking recompute" -- BackEndTorv/src/repository/groups.repository.js BackEndTorv/src/repository/tests/groups.repository.test.js
```

---

### Task 4: Backend — controller, schemas e rotas de grupos

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/routes/groups.schemas.js`, `BackEndTorv/src/controller/groups.controller.js`, `BackEndTorv/src/routes/groups.routes.js`
- Modify: `BackEndTorv/server.js` (registro)
- Test: `BackEndTorv/src/routes/groups.routes.test.js`

**Interfaces:**
- Consumes: `groups.repository` (Task 3), `groupRules` e `imageUpload` (Task 2), `errors`/`IdParams`/`Uuid` de `workout.schemas.js`.
- Produces: rotas `POST /groups`, `GET /groups`, `GET /groups/discover`, `GET /groups/:id`, `PATCH /groups/:id`, `DELETE /groups/:id`, `POST /groups/:id/cover`, `GET /groups/:id/ranking`, `DELETE /groups/:id/members/:userId` conforme o **Contrato da API**.
- Produces (módulos): `groups.schemas.js` exporta `GroupBody, GroupPatchBody, GroupDetail, GroupListItem, DiscoverQuery, DiscoverResponse, RankingResponse, MemberParams, Nullable, DateStr` (a Task 5 acrescenta os de convites); `groups.controller.js` exporta os handlers e `fail(reply, code)` + `NOT_FOUND` (reusados pela Task 5).

- [ ] **Step 1: Escrever os testes de rota** (falham: módulo não existe)

`BackEndTorv/src/routes/groups.routes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

// O middleware real valida JWT contra o JWKS do Supabase. Aqui todo request é do USER.
const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const groupsRepository = require('../repository/groups.repository');
const images = require('../lib/imageUpload');

const GID = '22222222-2222-4222-8222-222222222222';
const OTHER = '44444444-4444-4444-8444-444444444444';
const dbDate = (s) => new Date(`${s}T00:00:00Z`);
const baseGroup = (over = {}) => ({
  id: GID, name: 'Time', visibility: 'PUBLIC', cover_url: null, starts_at: dbDate('2026-10-01'), ends_at: null,
  tz_offset_min: -180, owner_id: USER, invite_token: 'AB3DK7MN', ...over,
});
const viewer = (over = {}) => ({ group: baseGroup(over.group), member_count: 3, is_member: true, my_invitation: null, ...over.rest });
const validBody = { name: '  Time  ', visibility: 'PUBLIC', starts_at: '2026-10-01', ends_at: null, tz_offset_min: -180 };

async function build(t) {
  const app = Fastify();
  app.register(require('@fastify/multipart'));
  app.register(require('./groups.routes'), { prefix: '/groups' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const call = (app, method, url, payload) => app.inject({ method, url, payload });

function multipart(filename, contentType, buffer) {
  const boundary = '----torvtest';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { payload: Buffer.concat([head, buffer, tail]), headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
}
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);

test('POST /groups: cria com nome aparado e datas como Date, devolve 201 com o detalhe do dono', async (t) => {
  const create = t.mock.method(groupsRepository, 'createGroup', async () => GID);
  t.mock.method(groupsRepository, 'getForViewer', async () => viewer());
  const app = await build(t);
  const res = await call(app, 'POST', '/groups', validBody);
  assert.equal(res.statusCode, 201);
  const [owner, data] = create.mock.calls[0].arguments;
  assert.equal(owner, USER);
  assert.equal(data.name, 'Time');
  assert.equal(data.starts_at.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(data.ends_at, null);
  const body = res.json();
  assert.equal(body.is_owner, true);
  assert.equal(body.invite_token, 'AB3DK7MN');
  assert.equal(body.starts_at, '2026-10-01');
  assert.equal(body.ends_at, null);
});

test('POST /groups: valida corpo (nome em branco, fim antes do início, data impossível, fuso fora da faixa, visibilidade)', async (t) => {
  const create = t.mock.method(groupsRepository, 'createGroup', async () => GID);
  const app = await build(t);
  for (const bad of [
    { ...validBody, name: '   ' },
    { ...validBody, ends_at: '2026-09-30' },
    { ...validBody, starts_at: '2026-02-31' },
    { ...validBody, tz_offset_min: 900 },
    { ...validBody, visibility: 'SECRET' },
    { ...validBody, name: '' },
  ]) {
    assert.equal((await call(app, 'POST', '/groups', bad)).statusCode, 400, JSON.stringify(bad));
  }
  assert.equal(create.mock.callCount(), 0);
});

test('GET /groups/:id: privado e não membro → 404; não dono não vê o invite_token', async (t) => {
  const get = t.mock.method(groupsRepository, 'getForViewer', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/${GID}`)).statusCode, 404);
  get.mock.mockImplementation(async () => viewer({ group: { owner_id: OTHER }, rest: { is_member: false } }));
  const res = await call(app, 'GET', `/groups/${GID}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().is_owner, false);
  assert.equal(res.json().invite_token, null);
});

test('GET /groups/:id: id que não é UUID (inclusive urn:uuid:) → 400', async (t) => {
  const app = await build(t);
  assert.equal((await call(app, 'GET', '/groups/abc')).statusCode, 400);
  assert.equal((await call(app, 'GET', `/groups/urn:uuid:${GID}`)).statusCode, 400);
});

test('PATCH /groups/:id: não dono → 404 sem tocar no banco; só nome → sem recalcular; mudar período → recalcula', async (t) => {
  const owned = t.mock.method(groupsRepository, 'getOwned', async () => null);
  const update = t.mock.method(groupsRepository, 'updateGroup', async () => {});
  t.mock.method(groupsRepository, 'getForViewer', async () => viewer());
  const app = await build(t);
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { name: 'Novo' })).statusCode, 404);
  assert.equal(update.mock.callCount(), 0);

  owned.mock.mockImplementation(async () => baseGroup());
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { name: ' Novo ' })).statusCode, 200);
  assert.deepEqual(update.mock.calls[0].arguments, [GID, { name: 'Novo' }, { recompute: false }]);

  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { ends_at: '2026-12-31' })).statusCode, 200);
  assert.equal(update.mock.calls[1].arguments[2].recompute, true);
  assert.equal(update.mock.calls[1].arguments[1].ends_at.toISOString(), '2026-12-31T00:00:00.000Z');

  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { ends_at: null })).statusCode, 200);
  assert.equal(update.mock.calls[2].arguments[1].ends_at, null); // volta a ser sem fim
});

test('PATCH /groups/:id: o fim novo é conferido contra o início que já existe', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => baseGroup()); // starts_at 2026-10-01
  const update = t.mock.method(groupsRepository, 'updateGroup', async () => {});
  const app = await build(t);
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, { ends_at: '2026-09-30' })).statusCode, 400);
  assert.equal((await call(app, 'PATCH', `/groups/${GID}`, {})).statusCode, 400); // corpo vazio
  assert.equal(update.mock.callCount(), 0);
});

test('DELETE /groups/:id: dono → 204 e apaga a capa; não dono → 404', async (t) => {
  const del = t.mock.method(groupsRepository, 'deleteGroup', async () => null);
  const removed = t.mock.method(images, 'deleteImage', async () => {});
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}`)).statusCode, 404);
  del.mock.mockImplementation(async () => ({ cover_url: 'group-x.png' }));
  assert.equal((await call(app, 'DELETE', `/groups/${GID}`)).statusCode, 204);
  assert.deepEqual(removed.mock.calls[0].arguments, ['group-x.png']);
});

test('POST /groups/:id/cover: não dono → 404 antes de ler o arquivo', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => null);
  const read = t.mock.method(images, 'readImage', async () => ({ buffer: PNG, ext: '.png' }));
  const app = await build(t);
  const { payload, headers } = multipart('c.png', 'image/png', PNG);
  assert.equal((await app.inject({ method: 'POST', url: `/groups/${GID}/cover`, payload, headers })).statusCode, 404);
  assert.equal(read.mock.callCount(), 0);
});

test('POST /groups/:id/cover: grava com nome do servidor, troca a capa e apaga a antiga', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => baseGroup());
  const save = t.mock.method(images, 'saveImage', async () => {});
  const removed = t.mock.method(images, 'deleteImage', async () => {});
  const setCover = t.mock.method(groupsRepository, 'setCover', async () => 'group-old.png');
  const app = await build(t);
  const { payload, headers } = multipart('../../evil.png', 'image/png', PNG);
  const res = await app.inject({ method: 'POST', url: `/groups/${GID}/cover`, payload, headers });
  assert.equal(res.statusCode, 200);
  const [fileName] = save.mock.calls[0].arguments;
  assert.match(fileName, new RegExp(`^group-${GID}-\\d+-\\d+\\.png$`));
  assert.doesNotMatch(fileName, /evil/);
  assert.deepEqual(setCover.mock.calls[0].arguments, [GID, fileName]);
  assert.deepEqual(removed.mock.calls[0].arguments, ['group-old.png']);
  assert.match(res.json().cover_url, new RegExp(`/uploads/${fileName}$`));
});

test('POST /groups/:id/cover: não é imagem, assinatura falsa e arquivo grande são recusados sem gravar', async (t) => {
  t.mock.method(groupsRepository, 'getOwned', async () => baseGroup());
  const save = t.mock.method(images, 'saveImage', async () => {});
  const app = await build(t);
  const go = (filename, type, buf) => {
    const m = multipart(filename, type, buf);
    return app.inject({ method: 'POST', url: `/groups/${GID}/cover`, payload: m.payload, headers: m.headers });
  };
  assert.equal((await go('a.pdf', 'application/pdf', PNG)).statusCode, 400);
  assert.equal((await go('a.png', 'image/png', Buffer.from('<?php echo 1;'))).statusCode, 400);
  assert.equal(save.mock.callCount(), 0);
  // limite: o controller pede 5 MB ao multipart
  const read = t.mock.method(images, 'readImage', async () => ({ error: 'Image is too large', status: 413 }));
  assert.equal((await go('b.png', 'image/png', PNG)).statusCode, 413);
  assert.deepEqual(read.mock.calls[0].arguments[1], { maxBytes: 5 * 1024 * 1024 });
});

test('GET /groups/:id/ranking: não membro → 404; membro → linhas com posição e "sou eu"', async (t) => {
  const rank = t.mock.method(groupsRepository, 'getRanking', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/${GID}/ranking`)).statusCode, 404);
  rank.mock.mockImplementation(async () => [
    { position: 1, user_id: OTHER, joined_at: new Date(), name: 'Ana', username: 'ana', photo_url: 'ana.jpg', total_points: 5, activities_count: 6 },
    { position: 2, user_id: USER, joined_at: new Date(), name: 'Eu', username: 'eu', photo_url: null, total_points: 2, activities_count: 2 },
  ]);
  const res = await call(app, 'GET', `/groups/${GID}/ranking`);
  assert.equal(res.statusCode, 200);
  const { ranking } = res.json();
  assert.deepEqual(ranking.map((r) => [r.position, r.is_me]), [[1, false], [2, true]]);
  assert.match(ranking[0].photo_url, /\/uploads\/ana\.jpg$/);
  assert.equal(ranking[1].photo_url, null);
  assert.equal(ranking[0].joined_at, undefined);
});

test('GET /groups: lista meus grupos com posição e pontos', async (t) => {
  t.mock.method(groupsRepository, 'listMine', async () => [{ ...baseGroup(), member_count: 4, my_rank: 2, my_points: 7 }]);
  const app = await build(t);
  const res = await call(app, 'GET', '/groups');
  assert.equal(res.statusCode, 200);
  const [g] = res.json().groups;
  assert.deepEqual([g.id, g.member_count, g.my_rank, g.my_points, g.is_owner, g.starts_at], [GID, 4, 2, 7, true, '2026-10-01']);
  assert.equal(g.invite_token, undefined);
});

test('GET /groups/discover: repassa q e cursor, calcula next_cursor', async (t) => {
  const discover = t.mock.method(groupsRepository, 'discover', async () => ({
    rows: [{ id: GID, name: 'Time', cover_url: null, starts_at: dbDate('2026-10-01'), ends_at: null, tz_offset_min: 0, member_count: 3 }],
    hasMore: true,
  }));
  const app = await build(t);
  const res = await call(app, 'GET', '/groups/discover?q=tim&cursor=20');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(discover.mock.calls[0].arguments, [USER, 'tim', 20, 20]);
  assert.equal(res.json().next_cursor, 40);
  assert.equal((await call(app, 'GET', '/groups/discover?cursor=-1')).statusCode, 400);
});

test('DELETE /groups/:id/members/:userId: repassa o resultado como HTTP', async (t) => {
  const remove = t.mock.method(groupsRepository, 'removeMember', async () => 'ok');
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/members/${OTHER}`)).statusCode, 204);
  assert.deepEqual(remove.mock.calls[0].arguments, [USER, GID, OTHER]);
  remove.mock.mockImplementation(async () => 'owner_cannot_leave');
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/members/${USER}`)).statusCode, 409);
  remove.mock.mockImplementation(async () => 'not_found');
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/members/${OTHER}`)).statusCode, 404);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/routes/groups.routes.test.js` → FAIL `Cannot find module './groups.routes'`.

- [ ] **Step 3: Schemas**

`BackEndTorv/src/routes/groups.schemas.js`:

```js
const { Type } = require('@sinclair/typebox');
const { Uuid } = require('./workout.schemas');

const DATE_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const DateStr = Type.String({ pattern: DATE_PATTERN });
// Nullable num corpo: type array, não Union (com coerceTypes o Ajv coage o null no 1º ramo do anyOf).
const NullableDateBody = Type.Unsafe({ type: ['string', 'null'], pattern: DATE_PATTERN });
const Visibility = Type.Union([Type.Literal('PUBLIC'), Type.Literal('PRIVATE')]);
const Name = Type.String({ minLength: 1, maxLength: 100 });
// Respostas: Union é seguro (só serializa).
const Nullable = (schema) => Type.Union([schema, Type.Null()]);

const GroupBody = Type.Object({
  name: Name,
  visibility: Visibility,
  starts_at: DateStr,
  ends_at: Type.Optional(NullableDateBody),
  tz_offset_min: Type.Integer({ minimum: -840, maximum: 840 }),
});

const GroupPatchBody = Type.Object({
  name: Type.Optional(Name),
  visibility: Type.Optional(Visibility),
  starts_at: Type.Optional(DateStr),
  ends_at: Type.Optional(NullableDateBody),
}, { minProperties: 1 });

const Period = {
  starts_at: Type.String(),
  ends_at: Nullable(Type.String()),
  tz_offset_min: Type.Integer(),
};

const GroupDetail = Type.Object({
  id: Type.String(),
  name: Type.String(),
  visibility: Type.String(),
  cover_url: Nullable(Type.String()),
  ...Period,
  member_count: Type.Integer(),
  is_owner: Type.Boolean(),
  is_member: Type.Boolean(),
  invite_token: Nullable(Type.String()),
  my_invitation: Nullable(Type.Object({ id: Type.String(), kind: Type.String() })),
});

const GroupListItem = Type.Object({
  id: Type.String(),
  name: Type.String(),
  visibility: Type.String(),
  cover_url: Nullable(Type.String()),
  ...Period,
  member_count: Type.Integer(),
  is_owner: Type.Boolean(),
  my_rank: Type.Integer(),
  my_points: Type.Integer(),
});

const DiscoverItem = Type.Object({
  id: Type.String(),
  name: Type.String(),
  cover_url: Nullable(Type.String()),
  ...Period,
  member_count: Type.Integer(),
});

const DiscoverQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 100 })),
  cursor: Type.Optional(Type.Integer({ minimum: 0 })),
});

const DiscoverResponse = Type.Object({ groups: Type.Array(DiscoverItem), next_cursor: Nullable(Type.Integer()) });

const RankingResponse = Type.Object({
  ranking: Type.Array(Type.Object({
    position: Type.Integer(),
    user_id: Type.String(),
    name: Type.String(),
    username: Type.String(),
    photo_url: Nullable(Type.String()),
    total_points: Type.Integer(),
    activities_count: Type.Integer(),
    is_me: Type.Boolean(),
  })),
});

const MemberParams = Type.Object({ id: Uuid, userId: Uuid });

module.exports = {
  GroupBody, GroupPatchBody, GroupDetail, GroupListItem, DiscoverQuery, DiscoverResponse, RankingResponse, MemberParams,
  Period, Nullable, DateStr,
};
```

- [ ] **Step 4: Controller**

`BackEndTorv/src/controller/groups.controller.js` (funções soltas, sem `this`: o Fastify chama o handler com outro `this`; o módulo de imagens é chamado por `images.x` para o teste conseguir mockar):

```js
const { randomInt } = require('node:crypto');
const groupsRepository = require('../repository/groups.repository');
const images = require('../lib/imageUpload');
const { dateOnly, toDbDate, checkGroupDates, FAILURES } = require('../lib/groupRules');

const NOT_FOUND = { error: 'Not found' };
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const PAGE = 20;

const fail = (reply, code) => {
  const [status, error] = FAILURES[code];
  return reply.status(status).send({ error });
};

const periodOf = (g) => ({ starts_at: dateOnly(g.starts_at), ends_at: dateOnly(g.ends_at), tz_offset_min: g.tz_offset_min });

function detail(request, { group, member_count, is_member, my_invitation }) {
  const isOwner = group.owner_id === request.user.userId;
  return {
    id: group.id,
    name: group.name,
    visibility: group.visibility,
    cover_url: images.publicUrl(request, group.cover_url),
    ...periodOf(group),
    member_count,
    is_owner: isOwner,
    is_member,
    invite_token: isOwner ? group.invite_token : null,
    my_invitation,
  };
}

async function create(request, reply) {
  const { userId } = request.user;
  const body = request.body;
  const name = body.name.trim();
  if (!name) return reply.status(400).send({ error: 'name must not be blank' });
  const dateError = checkGroupDates(body);
  if (dateError) return reply.status(400).send({ error: dateError });

  const id = await groupsRepository.createGroup(userId, {
    name,
    visibility: body.visibility,
    starts_at: toDbDate(body.starts_at),
    ends_at: body.ends_at ? toDbDate(body.ends_at) : null,
    tz_offset_min: body.tz_offset_min,
  });
  return reply.status(201).send(detail(request, await groupsRepository.getForViewer(userId, id)));
}

async function list(request, reply) {
  const groups = await groupsRepository.listMine(request.user.userId);
  return reply.send({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      visibility: g.visibility,
      cover_url: images.publicUrl(request, g.cover_url),
      ...periodOf(g),
      member_count: g.member_count,
      is_owner: g.owner_id === request.user.userId,
      my_rank: g.my_rank,
      my_points: g.my_points,
    })),
  });
}

async function discover(request, reply) {
  const { q, cursor = 0 } = request.query;
  const { rows, hasMore } = await groupsRepository.discover(request.user.userId, q?.trim() || '', cursor, PAGE);
  return reply.send({
    groups: rows.map((g) => ({
      id: g.id,
      name: g.name,
      cover_url: images.publicUrl(request, g.cover_url),
      ...periodOf(g),
      member_count: g.member_count,
    })),
    next_cursor: hasMore ? cursor + PAGE : null,
  });
}

async function get(request, reply) {
  const found = await groupsRepository.getForViewer(request.user.userId, request.params.id);
  if (!found) return reply.status(404).send(NOT_FOUND);
  return reply.send(detail(request, found));
}

async function update(request, reply) {
  const { userId } = request.user;
  const { id } = request.params;
  const body = request.body;
  const current = await groupsRepository.getOwned(userId, id);
  if (!current) return reply.status(404).send(NOT_FOUND);

  if (body.name !== undefined && !body.name.trim()) return reply.status(400).send({ error: 'name must not be blank' });
  const dateError = checkGroupDates({
    starts_at: body.starts_at ?? dateOnly(current.starts_at),
    ends_at: body.ends_at !== undefined ? body.ends_at : dateOnly(current.ends_at),
  });
  if (dateError) return reply.status(400).send({ error: dateError });

  const data = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.visibility !== undefined) data.visibility = body.visibility;
  if (body.starts_at !== undefined) data.starts_at = toDbDate(body.starts_at);
  if (body.ends_at !== undefined) data.ends_at = body.ends_at === null ? null : toDbDate(body.ends_at);
  // Mudou a janela de contagem → refaz o ranking do grupo todo (até ~100 membros).
  const periodChanged = 'starts_at' in data || 'ends_at' in data;
  if (Object.keys(data).length > 0) await groupsRepository.updateGroup(id, data, { recompute: periodChanged });
  return reply.send(detail(request, await groupsRepository.getForViewer(userId, id)));
}

async function remove(request, reply) {
  const deleted = await groupsRepository.deleteGroup(request.user.userId, request.params.id);
  if (!deleted) return reply.status(404).send(NOT_FOUND);
  await images.deleteImage(deleted.cover_url).catch((err) => request.log.warn(err));
  return reply.status(204).send();
}

async function uploadCover(request, reply) {
  const { userId } = request.user;
  const { id } = request.params;
  if (!(await groupsRepository.getOwned(userId, id))) return reply.status(404).send(NOT_FOUND);

  const image = await images.readImage(request, { maxBytes: COVER_MAX_BYTES });
  if (image.error) return reply.status(image.status).send({ error: image.error });

  // Nome do servidor: o nome do arquivo enviado nunca entra no caminho.
  const fileName = `group-${id}-${Date.now()}-${randomInt(1e9)}${image.ext}`;
  await images.saveImage(fileName, image.buffer);
  const previous = await groupsRepository.setCover(id, fileName);
  await images.deleteImage(previous).catch((err) => request.log.warn(err));
  return reply.send({ cover_url: images.publicUrl(request, fileName) });
}

async function ranking(request, reply) {
  const { userId } = request.user;
  const rows = await groupsRepository.getRanking(userId, request.params.id);
  if (!rows) return reply.status(404).send(NOT_FOUND);
  return reply.send({
    ranking: rows.map((r) => ({
      position: r.position,
      user_id: r.user_id,
      name: r.name,
      username: r.username,
      photo_url: images.publicUrl(request, r.photo_url),
      total_points: r.total_points,
      activities_count: r.activities_count,
      is_me: r.user_id === userId,
    })),
  });
}

async function removeMember(request, reply) {
  const { id, userId: target } = request.params;
  const result = await groupsRepository.removeMember(request.user.userId, id, target);
  return result === 'ok' ? reply.status(204).send() : fail(reply, result);
}

module.exports = { create, list, discover, get, update, remove, uploadCover, ranking, removeMember, fail, NOT_FOUND };
```

- [ ] **Step 5: Rotas e registro**

`BackEndTorv/src/routes/groups.routes.js`:

```js
const { Type } = require('@sinclair/typebox');
const groups = require('../controller/groups.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const S = require('./groups.schemas');

const tags = ['Groups'];
const security = [{ bearerAuth: [] }];

async function groupsRoutes(fastify) {
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/', {
    schema: { description: 'Cria um grupo; o criador é o dono e o primeiro membro', tags, security, body: S.GroupBody, response: { 201: S.GroupDetail, ...errors(400, 401, 403) } },
  }, groups.create);

  fastify.get('/', {
    schema: { description: 'Meus grupos, com minha posição e pontos', tags, security, response: { 200: Type.Object({ groups: Type.Array(S.GroupListItem) }), ...errors(401, 403) } },
  }, groups.list);

  fastify.get('/discover', {
    schema: { description: 'Busca grupos públicos ainda não encerrados dos quais não sou membro', tags, security, querystring: S.DiscoverQuery, response: { 200: S.DiscoverResponse, ...errors(400, 401, 403) } },
  }, groups.discover);

  fastify.get('/:id', {
    schema: { description: 'Detalhe do grupo. Privado e não membro → 404', tags, security, params: IdParams, response: { 200: S.GroupDetail, ...errors(400, 401, 403, 404) } },
  }, groups.get);

  fastify.patch('/:id', {
    schema: { description: 'Dono: nome, visibilidade e período. Mudar o período recalcula o ranking', tags, security, params: IdParams, body: S.GroupPatchBody, response: { 200: S.GroupDetail, ...errors(400, 401, 403, 404) } },
  }, groups.update);

  fastify.delete('/:id', {
    schema: { description: 'Dono: apaga o grupo e a capa', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, groups.remove);

  fastify.post('/:id/cover', {
    schema: {
      description: 'Dono: envia a capa (multipart/form-data, campo "photo", até 5 MB)',
      tags, security, params: IdParams,
      response: { 200: Type.Object({ cover_url: Type.String() }), ...errors(400, 401, 403, 404, 413) },
    },
  }, groups.uploadCover);

  fastify.get('/:id/ranking', {
    schema: { description: 'Ranking do grupo (só membro)', tags, security, params: IdParams, response: { 200: S.RankingResponse, ...errors(400, 401, 403, 404) } },
  }, groups.ranking);

  fastify.delete('/:id/members/:userId', {
    schema: { description: 'O dono remove um membro, ou o próprio usuário sai. O dono não sai', tags, security, params: S.MemberParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404, 409) } },
  }, groups.removeMember);
}

module.exports = groupsRoutes;
```

Em `server.js`, depois da linha do `activities.routes`: `fastify.register(require('./src/routes/groups.routes'), { prefix: '/groups' });`

- [ ] **Step 6: Rodar e ver passar**

Run: `node --test src/routes/groups.routes.test.js` → todos PASS. Depois `npm test` → tudo verde.

- [ ] **Step 7: Commit**

```bash
git add BackEndTorv/src/routes/groups.schemas.js BackEndTorv/src/controller/groups.controller.js BackEndTorv/src/routes/groups.routes.js BackEndTorv/src/routes/groups.routes.test.js BackEndTorv/server.js
git commit -m "feat(groups): groups routes (CRUD, cover, ranking, members)" -- BackEndTorv/src/routes/groups.schemas.js BackEndTorv/src/controller/groups.controller.js BackEndTorv/src/routes/groups.routes.js BackEndTorv/src/routes/groups.routes.test.js BackEndTorv/server.js
```

---

### Task 5: Backend — convites, pedidos e link de convite

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/repository/groupInvitations.repository.js`, `BackEndTorv/src/controller/groupInvitations.controller.js`, `BackEndTorv/src/routes/groupInvitations.routes.js`
- Modify: `BackEndTorv/src/routes/groups.schemas.js` (schemas de convites), `BackEndTorv/server.js` (registro)
- Test: `BackEndTorv/src/routes/groupInvitations.routes.test.js`

**Interfaces:**
- Consumes: `groupsRepository.addMember(db, groupId, userId)` (Task 3); `fail`/`NOT_FOUND` de `groups.controller` (Task 4); `generateInviteToken`, `normalizeToken`, `isValidToken`, `isEnded`, `dateOnly` (Task 2).
- Produces (singleton `groupInvitationsRepository`): métodos que devolvem `{ id }`/`{ group_id, status }`/dados **ou** `{ code }` com um código de `FAILURES`:
  - `inviteByUsername(ownerId, groupId, username)`, `createRequest(userId, groupId)` → `{ id } | { code }`.
  - `listPending(ownerId, groupId)` → rows `{ id, kind, created_at, user: { id, user_profiles } }` ou `null` se não é o dono.
  - `listReceived(userId)` → rows `{ id, created_at, group, creator }`.
  - `resolve(actorId, id, 'accept' | 'decline')` → `{ group_id, status } | { code }`.
  - `cancel(actorId, id)` → `boolean`.
  - `setInviteToken(ownerId, groupId, token | null)` → `boolean` (lança `P2002` em colisão do token).
  - `getJoinPreview(userId, token)` → `{ group, member_count, is_member } | null`; `joinByToken(userId, token)` → `{ group_id } | { code }`.
- Produces (rotas): as do **Contrato da API** de convites/pedidos/link, sob `/groups`.

- [ ] **Step 1: Escrever os testes de rota** (falham: módulo não existe)

`BackEndTorv/src/routes/groupInvitations.routes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');

const USER = '11111111-1111-4111-8111-111111111111';
const authPath = require.resolve('../middlewares/auth.middleware');
require.cache[authPath] = {
  id: authPath, filename: authPath, loaded: true,
  exports: async (request) => { request.user = { userId: USER }; },
};

const repo = require('../repository/groupInvitations.repository');
const { isValidToken } = require('../lib/groupRules');

const GID = '22222222-2222-4222-8222-222222222222';
const INV = '55555555-5555-4555-8555-555555555555';
const OTHER = '44444444-4444-4444-8444-444444444444';
const TOKEN = 'AB3DK7MN';
const dbDate = (s) => new Date(`${s}T00:00:00Z`);

// Os dois plugins no mesmo prefixo, como no server.js: garante que /groups/invitations/* e /groups/join/*
// não caem em /groups/:id (que recusaria com 400 por não ser UUID).
async function build(t) {
  const app = Fastify();
  app.register(require('@fastify/multipart'));
  app.register(require('./groups.routes'), { prefix: '/groups' });
  app.register(require('./groupInvitations.routes'), { prefix: '/groups' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const call = (app, method, url, payload) => app.inject({ method, url, payload });
const profile = (name, username, photo_url = null) => ({ id: OTHER, user_profiles: { name, username, photo_url } });

test('rotas estáticas não caem em /groups/:id', async (t) => {
  t.mock.method(repo, 'listReceived', async () => []);
  t.mock.method(repo, 'getJoinPreview', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', '/groups/invitations/received')).statusCode, 200);
  assert.equal((await call(app, 'GET', `/groups/join/${TOKEN}`)).statusCode, 404); // 404 do preview, não 400 de UUID
});

test('POST /groups/:id/invitations: username aparado; códigos do repositório viram HTTP', async (t) => {
  const invite = t.mock.method(repo, 'inviteByUsername', async () => ({ id: INV }));
  const app = await build(t);
  const ok = await call(app, 'POST', `/groups/${GID}/invitations`, { username: '  ana ' });
  assert.equal(ok.statusCode, 201);
  assert.deepEqual(ok.json(), { id: INV });
  assert.deepEqual(invite.mock.calls[0].arguments, [USER, GID, 'ana']);
  for (const [code, status] of [['not_found', 404], ['already_member', 409], ['duplicate', 409], ['ended', 409]]) {
    invite.mock.mockImplementation(async () => ({ code }));
    assert.equal((await call(app, 'POST', `/groups/${GID}/invitations`, { username: 'ana' })).statusCode, status, code);
  }
  assert.equal((await call(app, 'POST', `/groups/${GID}/invitations`, { username: '   ' })).statusCode, 400);
  assert.equal((await call(app, 'POST', `/groups/${GID}/invitations`, {})).statusCode, 400);
});

test('POST /groups/:id/requests: grupo privado ou inexistente → 404; encerrado → 409', async (t) => {
  const req = t.mock.method(repo, 'createRequest', async () => ({ id: INV }));
  const app = await build(t);
  assert.equal((await call(app, 'POST', `/groups/${GID}/requests`)).statusCode, 201);
  assert.deepEqual(req.mock.calls[0].arguments, [USER, GID]);
  req.mock.mockImplementation(async () => ({ code: 'not_found' }));
  assert.equal((await call(app, 'POST', `/groups/${GID}/requests`)).statusCode, 404);
  req.mock.mockImplementation(async () => ({ code: 'ended' }));
  assert.equal((await call(app, 'POST', `/groups/${GID}/requests`)).statusCode, 409);
});

test('GET /groups/:id/requests: não dono → 404; dono recebe pedidos e convites separados', async (t) => {
  const pending = t.mock.method(repo, 'listPending', async () => null);
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/${GID}/requests`)).statusCode, 404);
  pending.mock.mockImplementation(async () => [
    { id: 'r1', kind: 'REQUEST', created_at: new Date('2026-10-05T10:00:00Z'), user: profile('Ana', 'ana', 'ana.jpg') },
    { id: 'i1', kind: 'INVITE', created_at: new Date('2026-10-05T11:00:00Z'), user: profile('Beto', 'beto') },
  ]);
  const res = await call(app, 'GET', `/groups/${GID}/requests`);
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.deepEqual(body.requests.map((r) => [r.id, r.username]), [['r1', 'ana']]);
  assert.deepEqual(body.invites.map((r) => [r.id, r.username]), [['i1', 'beto']]);
  assert.match(body.requests[0].photo_url, /\/uploads\/ana\.jpg$/);
  assert.equal(body.invites[0].photo_url, null);
});

test('GET /groups/invitations/received: convites pendentes com grupo e quem convidou', async (t) => {
  t.mock.method(repo, 'listReceived', async () => [{
    id: INV, created_at: new Date('2026-10-05T10:00:00Z'),
    group: { id: GID, name: 'Time', cover_url: 'group-a.png' },
    creator: { user_profiles: { name: 'Ana', username: 'ana', photo_url: null } },
  }]);
  const app = await build(t);
  const res = await call(app, 'GET', '/groups/invitations/received');
  const [inv] = res.json().invitations;
  assert.deepEqual([inv.id, inv.group.id, inv.group.name, inv.invited_by.username], [INV, GID, 'Time', 'ana']);
  assert.match(inv.group.cover_url, /\/uploads\/group-a\.png$/);
});

test('POST /groups/invitations/:id/accept e /decline: repassa a ação; terceiros e já resolvidos', async (t) => {
  const resolve = t.mock.method(repo, 'resolve', async (_u, _i, action) => ({ group_id: GID, status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' }));
  const app = await build(t);
  const a = await call(app, 'POST', `/groups/invitations/${INV}/accept`);
  assert.equal(a.statusCode, 200);
  assert.deepEqual(a.json(), { group_id: GID, status: 'ACCEPTED' });
  assert.deepEqual(resolve.mock.calls[0].arguments, [USER, INV, 'accept']);
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/decline`)).json().status, 'DECLINED');
  resolve.mock.mockImplementation(async () => ({ code: 'not_found' })); // não é o convidado nem o dono: 404, não 403
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/accept`)).statusCode, 404);
  resolve.mock.mockImplementation(async () => ({ code: 'not_pending' }));
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/accept`)).statusCode, 409);
  resolve.mock.mockImplementation(async () => ({ code: 'ended' }));
  assert.equal((await call(app, 'POST', `/groups/invitations/${INV}/accept`)).statusCode, 409);
});

test('DELETE /groups/invitations/:id: cancelar o que não é meu → 404', async (t) => {
  const cancel = t.mock.method(repo, 'cancel', async () => true);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/invitations/${INV}`)).statusCode, 204);
  cancel.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'DELETE', `/groups/invitations/${INV}`)).statusCode, 404);
});

test('POST /groups/:id/invite-link: gera token válido; repete se colidir; não dono → 404', async (t) => {
  let attempts = 0;
  const set = t.mock.method(repo, 'setInviteToken', async () => {
    attempts += 1;
    if (attempts === 1) { const e = new Error('unique'); e.code = 'P2002'; throw e; }
    return true;
  });
  const app = await build(t);
  const res = await call(app, 'POST', `/groups/${GID}/invite-link`);
  assert.equal(res.statusCode, 200);
  assert.ok(isValidToken(res.json().token));
  assert.equal(set.mock.callCount(), 2);
  assert.equal(set.mock.calls[1].arguments[2], res.json().token);
  set.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'POST', `/groups/${GID}/invite-link`)).statusCode, 404);
});

test('DELETE /groups/:id/invite-link: revoga (token nulo)', async (t) => {
  const set = t.mock.method(repo, 'setInviteToken', async () => true);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/invite-link`)).statusCode, 204);
  assert.deepEqual(set.mock.calls[0].arguments, [USER, GID, null]);
  set.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'DELETE', `/groups/${GID}/invite-link`)).statusCode, 404);
});

test('GET /groups/join/:token: normaliza (minúsculas, espaços); formato inválido → 404 sem consultar o banco', async (t) => {
  const preview = t.mock.method(repo, 'getJoinPreview', async () => ({
    group: { id: GID, name: 'Time', cover_url: null, starts_at: dbDate('2026-10-01'), ends_at: null, tz_offset_min: 0 },
    member_count: 3, is_member: false,
  }));
  const app = await build(t);
  const res = await call(app, 'GET', `/groups/join/${encodeURIComponent(' ab3dk7mn ')}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(preview.mock.calls[0].arguments, [USER, TOKEN]);
  assert.deepEqual(res.json(), {
    group: { id: GID, name: 'Time', cover_url: null, starts_at: '2026-10-01', ends_at: null, tz_offset_min: 0, member_count: 3 },
    is_member: false, ended: false,
  });
  const before = preview.mock.callCount();
  for (const bad of ['0O1IL234', 'ABC', 'AB3DK7MNP', '%00']) {
    assert.equal((await call(app, 'GET', `/groups/join/${bad}`)).statusCode, 404, bad);
  }
  assert.equal(preview.mock.callCount(), before);
});

test('GET /groups/join/:token: grupo encerrado vem com ended = true; link revogado → 404', async (t) => {
  const preview = t.mock.method(repo, 'getJoinPreview', async () => ({
    group: { id: GID, name: 'Time', cover_url: null, starts_at: dbDate('2020-01-01'), ends_at: dbDate('2020-02-01'), tz_offset_min: 0 },
    member_count: 3, is_member: false,
  }));
  const app = await build(t);
  assert.equal((await call(app, 'GET', `/groups/join/${TOKEN}`)).json().ended, true);
  preview.mock.mockImplementation(async () => null); // revogado ou regenerado: o token antigo não existe mais
  assert.equal((await call(app, 'GET', `/groups/join/${TOKEN}`)).statusCode, 404);
});

test('POST /groups/join/:token: entra; encerrado e já membro → 409; revogado ou formato inválido → 404', async (t) => {
  const join = t.mock.method(repo, 'joinByToken', async () => ({ group_id: GID }));
  const app = await build(t);
  const ok = await call(app, 'POST', `/groups/join/${TOKEN.toLowerCase()}`);
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.json(), { group_id: GID });
  assert.deepEqual(join.mock.calls[0].arguments, [USER, TOKEN]);
  for (const [code, status] of [['ended', 409], ['already_member', 409], ['not_found', 404]]) {
    join.mock.mockImplementation(async () => ({ code }));
    assert.equal((await call(app, 'POST', `/groups/join/${TOKEN}`)).statusCode, status, code);
  }
  const before = join.mock.callCount();
  assert.equal((await call(app, 'POST', '/groups/join/curto')).statusCode, 404);
  assert.equal(join.mock.callCount(), before);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test src/routes/groupInvitations.routes.test.js` → FAIL `Cannot find module '../repository/groupInvitations.repository'`.

- [ ] **Step 3: Schemas (acrescentar a `groups.schemas.js`)**

Antes do `module.exports`, adicionar e exportar `InviteBody, IdResponse, PendingResponse, ReceivedResponse, ResolveResponse, TokenParams, JoinPreview`:

```js
const InviteBody = Type.Object({ username: Type.String({ minLength: 1, maxLength: 100 }) });
const IdResponse = Type.Object({ id: Type.String() });

const PendingItem = Type.Object({
  id: Type.String(),
  user_id: Type.String(),
  name: Type.String(),
  username: Type.String(),
  photo_url: Nullable(Type.String()),
  created_at: Type.String(),
});
const PendingResponse = Type.Object({ requests: Type.Array(PendingItem), invites: Type.Array(PendingItem) });

const ReceivedResponse = Type.Object({
  invitations: Type.Array(Type.Object({
    id: Type.String(),
    group: Type.Object({ id: Type.String(), name: Type.String(), cover_url: Nullable(Type.String()) }),
    invited_by: Type.Object({ name: Type.String(), username: Type.String() }),
    created_at: Type.String(),
  })),
});

const ResolveResponse = Type.Object({ group_id: Type.String(), status: Type.String() });
const TokenParams = Type.Object({ token: Type.String({ minLength: 1, maxLength: 32 }) });

const JoinPreview = Type.Object({
  group: Type.Object({
    id: Type.String(),
    name: Type.String(),
    cover_url: Nullable(Type.String()),
    ...Period,
    member_count: Type.Integer(),
  }),
  is_member: Type.Boolean(),
  ended: Type.Boolean(),
});
```

- [ ] **Step 4: Repository**

`BackEndTorv/src/repository/groupInvitations.repository.js`:

```js
const prisma = require('../lib/prisma');
const groupsRepository = require('./groups.repository');
const { isEnded } = require('../lib/groupRules');

const TX = { timeout: 15000 };
const PROFILE = { select: { name: true, username: true, photo_url: true } };
const isUnique = (err) => err?.code === 'P2002';
const memberKey = (groupId, userId) => ({ group_id_user_id: { group_id: groupId, user_id: userId } });
const PREVIEW_FIELDS = { id: true, name: true, cover_url: true, starts_at: true, ends_at: true, tz_offset_min: true };

class GroupInvitationsRepository {
  async createPending(groupId, userId, kind, createdBy) {
    if (await prisma.group_members.findUnique({ where: memberKey(groupId, userId), select: { user_id: true } })) {
      return { code: 'already_member' };
    }
    try {
      const row = await prisma.group_invitations.create({
        data: { group_id: groupId, user_id: userId, kind, created_by: createdBy },
        select: { id: true },
      });
      return { id: row.id };
    } catch (err) {
      if (isUnique(err)) return { code: 'duplicate' }; // índice único parcial: 1 pendente por (grupo, usuário)
      throw err;
    }
  }

  // Dono convida por username exato (sem diferenciar maiúsculas). Usuário inexistente = grupo inexistente: 404 genérico.
  async inviteByUsername(ownerId, groupId, username) {
    const group = await prisma.groups.findFirst({ where: { id: groupId, owner_id: ownerId }, select: { ends_at: true, tz_offset_min: true } });
    if (!group) return { code: 'not_found' };
    if (isEnded(group)) return { code: 'ended' };
    const target = await prisma.user_profiles.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { user_id: true },
    });
    if (!target) return { code: 'not_found' };
    return this.createPending(groupId, target.user_id, 'INVITE', ownerId);
  }

  // Só grupo PUBLIC aceita pedido; privado responde como se não existisse.
  async createRequest(userId, groupId) {
    const group = await prisma.groups.findUnique({ where: { id: groupId }, select: { visibility: true, ends_at: true, tz_offset_min: true } });
    if (!group || group.visibility !== 'PUBLIC') return { code: 'not_found' };
    if (isEnded(group)) return { code: 'ended' };
    return this.createPending(groupId, userId, 'REQUEST', userId);
  }

  async listPending(ownerId, groupId) {
    if (!(await prisma.groups.findFirst({ where: { id: groupId, owner_id: ownerId }, select: { id: true } }))) return null;
    return prisma.group_invitations.findMany({
      where: { group_id: groupId, status: 'PENDING' },
      orderBy: { created_at: 'desc' },
      select: { id: true, kind: true, created_at: true, user: { select: { id: true, user_profiles: PROFILE } } },
    });
  }

  listReceived(userId) {
    return prisma.group_invitations.findMany({
      where: { user_id: userId, kind: 'INVITE', status: 'PENDING' },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        created_at: true,
        group: { select: { id: true, name: true, cover_url: true } },
        creator: { select: { user_profiles: PROFILE } },
      },
    });
  }

  // Quem decide: o convidado (INVITE) ou o dono do grupo (REQUEST). Qualquer outro: 404.
  async resolve(actorId, id, action) {
    try {
      return await prisma.$transaction(async (tx) => {
        const inv = await tx.group_invitations.findUnique({
          where: { id },
          select: { group_id: true, user_id: true, kind: true, status: true, group: { select: { owner_id: true, ends_at: true, tz_offset_min: true } } },
        });
        if (!inv) return { code: 'not_found' };
        const decider = inv.kind === 'INVITE' ? inv.user_id : inv.group.owner_id;
        if (actorId !== decider) return { code: 'not_found' };
        if (inv.status !== 'PENDING') return { code: 'not_pending' };

        const accept = action === 'accept';
        if (accept) {
          if (isEnded(inv.group)) return { code: 'ended' };
          const already = await tx.group_members.findUnique({ where: memberKey(inv.group_id, inv.user_id), select: { user_id: true } });
          if (!already) await groupsRepository.addMember(tx, inv.group_id, inv.user_id);
        }
        const status = accept ? 'ACCEPTED' : 'DECLINED';
        await tx.group_invitations.update({ where: { id }, data: { status, resolved_at: new Date() } });
        return { group_id: inv.group_id, status };
      }, TX);
    } catch (err) {
      if (isUnique(err)) return { code: 'already_member' }; // corrida: entrou por outro caminho no meio
      throw err;
    }
  }

  // Cancela o que EU criei e ainda está pendente (convite do dono, ou o meu próprio pedido).
  async cancel(actorId, id) {
    const { count } = await prisma.group_invitations.updateMany({
      where: { id, created_by: actorId, status: 'PENDING' },
      data: { status: 'CANCELED', resolved_at: new Date() },
    });
    return count > 0;
  }

  // token nulo revoga o link. Colisão de token lança P2002 (o controller gera outro).
  async setInviteToken(ownerId, groupId, token) {
    const { count } = await prisma.groups.updateMany({ where: { id: groupId, owner_id: ownerId }, data: { invite_token: token } });
    return count > 0;
  }

  async getJoinPreview(userId, token) {
    const group = await prisma.groups.findUnique({
      where: { invite_token: token },
      select: { ...PREVIEW_FIELDS, _count: { select: { group_members: true } } },
    });
    if (!group) return null;
    const member = await prisma.group_members.findUnique({ where: memberKey(group.id, userId), select: { user_id: true } });
    const { _count, ...rest } = group;
    return { group: rest, member_count: _count.group_members, is_member: !!member };
  }

  // O link equivale a um convite do dono: entra direto. Convite/pedido pendente do mesmo par é fechado junto.
  async joinByToken(userId, token) {
    try {
      return await prisma.$transaction(async (tx) => {
        const group = await tx.groups.findUnique({ where: { invite_token: token }, select: { id: true, ends_at: true, tz_offset_min: true } });
        if (!group) return { code: 'not_found' };
        if (isEnded(group)) return { code: 'ended' };
        if (await tx.group_members.findUnique({ where: memberKey(group.id, userId), select: { user_id: true } })) {
          return { code: 'already_member' };
        }
        await groupsRepository.addMember(tx, group.id, userId);
        await tx.group_invitations.updateMany({
          where: { group_id: group.id, user_id: userId, status: 'PENDING' },
          data: { status: 'ACCEPTED', resolved_at: new Date() },
        });
        return { group_id: group.id };
      }, TX);
    } catch (err) {
      if (isUnique(err)) return { code: 'already_member' };
      throw err;
    }
  }
}

module.exports = new GroupInvitationsRepository();
```

- [ ] **Step 5: Controller**

`BackEndTorv/src/controller/groupInvitations.controller.js`:

```js
const repo = require('../repository/groupInvitations.repository');
const images = require('../lib/imageUpload');
const { generateInviteToken, normalizeToken, isValidToken, isEnded, dateOnly } = require('../lib/groupRules');
const { fail, NOT_FOUND } = require('./groups.controller');

const profileOf = (request, userId, p) => ({
  user_id: userId,
  name: p?.name ?? '',
  username: p?.username ?? '',
  photo_url: images.publicUrl(request, p?.photo_url),
});

async function invite(request, reply) {
  const username = request.body.username.trim();
  if (!username) return reply.status(400).send({ error: 'username must not be blank' });
  const out = await repo.inviteByUsername(request.user.userId, request.params.id, username);
  return out.code ? fail(reply, out.code) : reply.status(201).send({ id: out.id });
}

async function requestJoin(request, reply) {
  const out = await repo.createRequest(request.user.userId, request.params.id);
  return out.code ? fail(reply, out.code) : reply.status(201).send({ id: out.id });
}

async function listPending(request, reply) {
  const rows = await repo.listPending(request.user.userId, request.params.id);
  if (!rows) return reply.status(404).send(NOT_FOUND);
  const item = (r) => ({ id: r.id, ...profileOf(request, r.user.id, r.user.user_profiles), created_at: r.created_at.toISOString() });
  return reply.send({
    requests: rows.filter((r) => r.kind === 'REQUEST').map(item),
    invites: rows.filter((r) => r.kind === 'INVITE').map(item),
  });
}

async function listReceived(request, reply) {
  const rows = await repo.listReceived(request.user.userId);
  return reply.send({
    invitations: rows.map((r) => ({
      id: r.id,
      group: { id: r.group.id, name: r.group.name, cover_url: images.publicUrl(request, r.group.cover_url) },
      invited_by: { name: r.creator.user_profiles?.name ?? '', username: r.creator.user_profiles?.username ?? '' },
      created_at: r.created_at.toISOString(),
    })),
  });
}

const resolver = (action) => async (request, reply) => {
  const out = await repo.resolve(request.user.userId, request.params.id, action);
  return out.code ? fail(reply, out.code) : reply.send(out);
};

async function cancel(request, reply) {
  return (await repo.cancel(request.user.userId, request.params.id))
    ? reply.status(204).send()
    : reply.status(404).send(NOT_FOUND);
}

// Colisão do token (UNIQUE) é improvável (31^8); repete algumas vezes antes de desistir.
async function createInviteLink(request, reply) {
  for (let i = 0; i < 5; i += 1) {
    const token = generateInviteToken();
    try {
      if (!(await repo.setInviteToken(request.user.userId, request.params.id, token))) {
        return reply.status(404).send(NOT_FOUND);
      }
      return reply.send({ token });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }
  }
  throw new Error('could not generate a unique invite token');
}

async function revokeInviteLink(request, reply) {
  return (await repo.setInviteToken(request.user.userId, request.params.id, null))
    ? reply.status(204).send()
    : reply.status(404).send(NOT_FOUND);
}

// Código inválido (formato) responde 404 sem consultar o banco: não ajuda a adivinhar.
async function joinPreview(request, reply) {
  const token = normalizeToken(request.params.token);
  if (!isValidToken(token)) return reply.status(404).send(NOT_FOUND);
  const found = await repo.getJoinPreview(request.user.userId, token);
  if (!found) return reply.status(404).send(NOT_FOUND);
  const { group } = found;
  return reply.send({
    group: {
      id: group.id,
      name: group.name,
      cover_url: images.publicUrl(request, group.cover_url),
      starts_at: dateOnly(group.starts_at),
      ends_at: dateOnly(group.ends_at),
      tz_offset_min: group.tz_offset_min,
      member_count: found.member_count,
    },
    is_member: found.is_member,
    ended: isEnded(group),
  });
}

async function join(request, reply) {
  const token = normalizeToken(request.params.token);
  if (!isValidToken(token)) return reply.status(404).send(NOT_FOUND);
  const out = await repo.joinByToken(request.user.userId, token);
  return out.code ? fail(reply, out.code) : reply.send({ group_id: out.group_id });
}

module.exports = {
  invite, requestJoin, listPending, listReceived, accept: resolver('accept'), decline: resolver('decline'),
  cancel, createInviteLink, revokeInviteLink, joinPreview, join,
};
```

- [ ] **Step 6: Rotas e registro**

`BackEndTorv/src/routes/groupInvitations.routes.js` (mesmo prefixo `/groups` do plugin de grupos; `rate-limit` só nas rotas de `join`, para frear tentativa de adivinhar código):

```js
const { Type } = require('@sinclair/typebox');
const c = require('../controller/groupInvitations.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const S = require('./groups.schemas');

const tags = ['Groups'];
const security = [{ bearerAuth: [] }];
const joinLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

async function groupInvitationsRoutes(fastify) {
  await fastify.register(require('@fastify/rate-limit'), { global: false });
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/:id/invitations', {
    schema: { description: 'Dono convida por username exato', tags, security, params: IdParams, body: S.InviteBody, response: { 201: S.IdResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.invite);

  fastify.post('/:id/requests', {
    schema: { description: 'Pede para entrar num grupo público', tags, security, params: IdParams, response: { 201: S.IdResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.requestJoin);

  fastify.get('/:id/requests', {
    schema: { description: 'Dono: pedidos de entrada e convites pendentes', tags, security, params: IdParams, response: { 200: S.PendingResponse, ...errors(400, 401, 403, 404) } },
  }, c.listPending);

  fastify.get('/invitations/received', {
    schema: { description: 'Convites de grupo que recebi e ainda estão pendentes', tags, security, response: { 200: S.ReceivedResponse, ...errors(401, 403) } },
  }, c.listReceived);

  fastify.post('/invitations/:id/accept', {
    schema: { description: 'O convidado aceita um convite, ou o dono aceita um pedido', tags, security, params: IdParams, response: { 200: S.ResolveResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.accept);

  fastify.post('/invitations/:id/decline', {
    schema: { description: 'O convidado recusa um convite, ou o dono recusa um pedido', tags, security, params: IdParams, response: { 200: S.ResolveResponse, ...errors(400, 401, 403, 404, 409) } },
  }, c.decline);

  fastify.delete('/invitations/:id', {
    schema: { description: 'Cancela o convite ou pedido que eu criei e ainda está pendente', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, c.cancel);

  fastify.post('/:id/invite-link', {
    schema: { description: 'Dono: gera (ou regenera, invalidando o anterior) o código de convite', tags, security, params: IdParams, response: { 200: Type.Object({ token: Type.String() }), ...errors(400, 401, 403, 404) } },
  }, c.createInviteLink);

  fastify.delete('/:id/invite-link', {
    schema: { description: 'Dono: revoga o link de convite', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, c.revokeInviteLink);

  fastify.get('/join/:token', {
    config: joinLimit,
    schema: { description: 'Prévia do grupo a partir do código de convite', tags, security, params: S.TokenParams, response: { 200: S.JoinPreview, ...errors(400, 401, 403, 404, 429) } },
  }, c.joinPreview);

  fastify.post('/join/:token', {
    config: joinLimit,
    schema: { description: 'Entra no grupo pelo código de convite', tags, security, params: S.TokenParams, response: { 200: Type.Object({ group_id: Type.String() }), ...errors(400, 401, 403, 404, 409, 429) } },
  }, c.join);
}

module.exports = groupInvitationsRoutes;
```

Em `server.js`, logo depois do registro de `groups.routes`: `fastify.register(require('./src/routes/groupInvitations.routes'), { prefix: '/groups' });`

- [ ] **Step 7: Rodar e ver passar**

Run: `node --test src/routes/groupInvitations.routes.test.js` → todos PASS. Depois `npm test` → tudo verde.

- [ ] **Step 8: Commit**

```bash
git add BackEndTorv/src/repository/groupInvitations.repository.js BackEndTorv/src/controller/groupInvitations.controller.js BackEndTorv/src/routes/groupInvitations.routes.js BackEndTorv/src/routes/groupInvitations.routes.test.js BackEndTorv/src/routes/groups.schemas.js BackEndTorv/server.js
git commit -m "feat(groups): invitations, join requests and invite link" -- BackEndTorv/src/repository/groupInvitations.repository.js BackEndTorv/src/controller/groupInvitations.controller.js BackEndTorv/src/routes/groupInvitations.routes.js BackEndTorv/src/routes/groupInvitations.routes.test.js BackEndTorv/src/routes/groups.schemas.js BackEndTorv/server.js
```

---

### Task 6: Backend — editar e excluir treino, e ranking no `createSession`

**Recruit:** Torv Backend · **Files:**
- Modify: `BackEndTorv/src/repository/workout.repository.js`, `BackEndTorv/src/controller/workout.controller.js`, `BackEndTorv/src/routes/workout.routes.js`, `BackEndTorv/src/routes/workout.schemas.js`
- Test: `BackEndTorv/src/repository/tests/workout.repository.test.js`, `BackEndTorv/src/routes/workout.routes.test.js`

**Interfaces:**
- Consumes: `groupsRepository.recomputeRanking(db, userId)` (Task 3).
- Produces:
  - `workoutRepository.updateSession(userId, id, { duration_sec, sets }): Promise<{ ok: true } | { notFound: true } | { badSet: true }>`
  - `workoutRepository.deleteSession(userId, id): Promise<boolean>`
  - `createSession` agora recalcula o ranking dentro da transação.
  - `GET /workouts/sessions/:id`: cada série ganha `id`.
  - `PUT /workouts/sessions/:id` e `DELETE /workouts/sessions/:id` (Contrato da API).

- [ ] **Step 1: Testes do repository** (falham)

Em `workout.repository.test.js`, trocar o bloco do Prisma falso do topo (do comentário `// Prisma falso` até o fim do `require.cache[prismaPath] = {...}`) por este, que inclui tudo o que as transações usam:

```js
// Prisma falso (o client real é um Proxy que o mock.method não alcança): registra as chamadas do teste em andamento.
let calls = null;
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const w = (name, ret) => async (args) => { calls.writes.push([name, args]); return typeof ret === 'function' ? ret(args) : ret; };
const fakePrisma = {
  workout_routines: { findFirst: async (args) => { calls.findFirst.push(args); return calls.routine; } },
  $executeRaw: async (query) => { calls.executeRaw.push(query); return calls.count; },
  $transaction: async (fn) => fn(fakePrisma),
  exercises: { findMany: async () => [] },
  activities: {
    create: w('activities.create', { id: ACTIVITY }),
    findFirst: async () => calls.activity,
    update: w('activities.update', {}),
    deleteMany: w('activities.deleteMany', () => ({ count: calls.deleted })),
  },
  workout_sets: {
    createMany: w('workout_sets.createMany', {}),
    deleteMany: w('workout_sets.deleteMany', {}),
    update: w('workout_sets.update', {}),
  },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };
```

(Os dois testes existentes de `updateRoutineWeights` continuam como estão: `calls` deles não precisa de `writes`.) Acrescentar ao fim do arquivo:

```js
const SET_A = '77777777-7777-4777-8777-777777777777';
const SET_B = '88888888-8888-4888-8888-888888888888';
const fresh = (over = {}) => ({ findFirst: [], executeRaw: [], writes: [], routine: null, count: 0, ...over });

test('createSession: grava atividade e séries e recalcula o ranking na MESMA transação', async () => {
  calls = fresh();
  const id = await workoutRepository.createSession(USER, {
    routine_id: null,
    started_at: new Date('2026-10-06T12:00:00Z'),
    duration_sec: 600,
    sets: [{ exercise_id: SUPINO, position: 1, set_number: 1, duration_sec: 30, rest_before_sec: null, weight_kg: 20 }],
  });
  assert.equal(id, ACTIVITY);
  assert.deepEqual(calls.writes.map(([n]) => n), ['activities.create', 'workout_sets.createMany']);
  assert.equal(calls.executeRaw.length, 1);
  assert.match(calls.executeRaw[0].sql, /INSERT INTO group_rankings/);
  assert.deepEqual(calls.executeRaw[0].values, [USER]);
});

test('deleteSession: só do dono e só STRENGTH; apagou → recalcula o ranking; não achou → não recalcula', async () => {
  calls = fresh({ deleted: 1 });
  assert.equal(await workoutRepository.deleteSession(USER, ACTIVITY), true);
  const [name, args] = calls.writes[0];
  assert.equal(name, 'activities.deleteMany');
  assert.deepEqual(args.where, { id: ACTIVITY, user_id: USER, activity_type: 'STRENGTH' });
  assert.equal(calls.executeRaw.length, 1);
  assert.deepEqual(calls.executeRaw[0].values, [USER]);

  calls = fresh({ deleted: 0 });
  assert.equal(await workoutRepository.deleteSession(USER, ACTIVITY), false);
  assert.equal(calls.executeRaw.length, 0);
});

test('updateSession: atividade de outro usuário → notFound, sem escrita', async () => {
  calls = fresh({ activity: null });
  assert.deepEqual(await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 600, sets: [{ id: SET_A, duration_sec: 30 }] }), { notFound: true });
  assert.equal(calls.writes.length, 0);
});

test('updateSession: id de série que não é da atividade → badSet, sem escrita', async () => {
  calls = fresh({ activity: { workout_sets: [{ id: SET_A }] } });
  const out = await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 600, sets: [{ id: SET_B, duration_sec: 30 }] });
  assert.deepEqual(out, { badSet: true });
  assert.equal(calls.writes.length, 0);
});

test('updateSession: atualiza as listadas, apaga as não listadas, nunca cria, e NÃO recalcula o ranking', async () => {
  calls = fresh({ activity: { workout_sets: [{ id: SET_A }, { id: SET_B }] } });
  const out = await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 900, sets: [{ id: SET_A, duration_sec: 45, weight_kg: 22.5 }] });
  assert.deepEqual(out, { ok: true });
  const byName = Object.fromEntries(calls.writes.map(([n, a]) => [n, a]));
  assert.deepEqual(byName['activities.update'], { where: { id: ACTIVITY }, data: { duration_sec: 900 } });
  assert.deepEqual(byName['workout_sets.deleteMany'].where, { activity_id: ACTIVITY, id: { notIn: [SET_A] } });
  assert.deepEqual(byName['workout_sets.update'], { where: { id: SET_A }, data: { duration_sec: 45, weight_kg: 22.5 } });
  assert.equal(calls.writes.some(([n]) => n === 'workout_sets.createMany'), false);
  assert.equal(calls.executeRaw.length, 0, 'a data não muda, então o ranking não muda');
});

test('updateSession: carga ausente grava null', async () => {
  calls = fresh({ activity: { workout_sets: [{ id: SET_A }] } });
  await workoutRepository.updateSession(USER, ACTIVITY, { duration_sec: 900, sets: [{ id: SET_A, duration_sec: 45 }] });
  assert.equal(calls.writes.find(([n]) => n === 'workout_sets.update')[1].data.weight_kg, null);
});
```

Run (em `BackEndTorv`): `node --test src/repository/tests/workout.repository.test.js` → os novos FALHAM (`updateSession`/`deleteSession` não existem; `createSession` sem recálculo).

- [ ] **Step 2: Implementar no repository**

Em `workout.repository.js`: no topo, `const groupsRepository = require('./groups.repository');`. Em `createSession`, depois do `tx.workout_sets.createMany(...)` e antes do `return activity.id;`:

```js
      // Ranking dos grupos do usuário, na mesma transação: ou grava treino e pontos, ou nenhum dos dois.
      await groupsRepository.recomputeRanking(tx, userId);
```

Em `getSession`, no `select` das `workout_sets`, acrescentar `id: true` (primeiro campo). Antes do `}` final da classe, acrescentar:

```js
  // Só duração e carga das séries; started_at, rotina, título, exercício e posição ficam como estão.
  // As séries não listadas são apagadas (é assim que se remove uma série); nunca cria série.
  // A data não muda, então o ranking não muda: sem recomputeRanking aqui.
  // ponytail: 1 UPDATE por série dentro da transação (até 200); trocar por UPDATE ... FROM (VALUES ...) se pesar.
  async updateSession(userId, id, { duration_sec, sets }) {
    return prisma.$transaction(async (tx) => {
      const activity = await tx.activities.findFirst({
        where: { id, user_id: userId, activity_type: 'STRENGTH' },
        select: { workout_sets: { select: { id: true } } },
      });
      if (!activity) return { notFound: true };
      const own = new Set(activity.workout_sets.map((s) => s.id));
      if (sets.some((s) => !own.has(s.id))) return { badSet: true };

      await tx.activities.update({ where: { id }, data: { duration_sec } });
      await tx.workout_sets.deleteMany({ where: { activity_id: id, id: { notIn: sets.map((s) => s.id) } } });
      for (const s of sets) {
        await tx.workout_sets.update({ where: { id: s.id }, data: { duration_sec: s.duration_sec, weight_kg: s.weight_kg ?? null } });
      }
      return { ok: true };
    }, TX);
  }

  // Apagar muda os pontos: o ranking é recalculado na mesma transação (dia com 2 treinos mantém o ponto).
  async deleteSession(userId, id) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.activities.deleteMany({ where: { id, user_id: userId, activity_type: 'STRENGTH' } });
      if (count === 0) return false;
      await groupsRepository.recomputeRanking(tx, userId);
      return true;
    }, TX);
  }
```

- [ ] **Step 3: Rodar e ver passar**

Run: `node --test src/repository/tests/workout.repository.test.js` → PASS.

- [ ] **Step 4: Testes de rota** (falham)

Em `workout.routes.test.js` (que já tem `build`, `call`, `USER`, `ID`, `workoutRepository`), acrescentar ao fim:

```js
const SET = '77777777-7777-4777-8777-777777777777';
const editBody = { duration_sec: 900, sets: [{ id: SET, duration_sec: 45, weight_kg: 22.5 }] };

test('PUT /sessions/:id: edita duração e séries; devolve o id', async (t) => {
  const update = t.mock.method(workoutRepository, 'updateSession', async () => ({ ok: true }));
  const app = await build(t);
  const res = await call(app, 'PUT', `/workouts/sessions/${ID}`, editBody);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { activity_id: ID });
  assert.deepEqual(update.mock.calls[0].arguments, [USER, ID, editBody]);
});

test('PUT /sessions/:id: de outro usuário → 404; série alheia → 400; id repetido → 400', async (t) => {
  const update = t.mock.method(workoutRepository, 'updateSession', async () => ({ notFound: true }));
  const app = await build(t);
  assert.equal((await call(app, 'PUT', `/workouts/sessions/${ID}`, editBody)).statusCode, 404);
  update.mock.mockImplementation(async () => ({ badSet: true }));
  assert.equal((await call(app, 'PUT', `/workouts/sessions/${ID}`, editBody)).statusCode, 400);
  const before = update.mock.callCount();
  const dup = { duration_sec: 900, sets: [{ id: SET, duration_sec: 1 }, { id: SET, duration_sec: 2 }] };
  assert.equal((await call(app, 'PUT', `/workouts/sessions/${ID}`, dup)).statusCode, 400);
  assert.equal(update.mock.callCount(), before);
});

test('PUT /sessions/:id: valida o corpo e não aceita mudar a data', async (t) => {
  const update = t.mock.method(workoutRepository, 'updateSession', async () => ({ ok: true }));
  const app = await build(t);
  for (const bad of [
    { duration_sec: 0, sets: editBody.sets },
    { duration_sec: 900, sets: [] },
    { duration_sec: 900, sets: [{ id: 'x', duration_sec: 1 }] },
    { duration_sec: 900, sets: [{ id: SET, duration_sec: 9999 }] },
    { duration_sec: 900, sets: [{ id: SET, duration_sec: 1, weight_kg: 1000 }] },
  ]) {
    assert.equal((await call(app, 'PUT', `/workouts/sessions/${ID}`, bad)).statusCode, 400, JSON.stringify(bad));
  }
  assert.equal(update.mock.callCount(), 0);
  // started_at no corpo é descartado (removeAdditional): o repository nunca o recebe.
  await call(app, 'PUT', `/workouts/sessions/${ID}`, { ...editBody, started_at: '2026-10-01T10:00:00Z' });
  assert.equal(update.mock.calls[0].arguments[2].started_at, undefined);
});

test('DELETE /sessions/:id: dono → 204; de outro usuário ou inexistente → 404', async (t) => {
  const del = t.mock.method(workoutRepository, 'deleteSession', async () => true);
  const app = await build(t);
  assert.equal((await call(app, 'DELETE', `/workouts/sessions/${ID}`)).statusCode, 204);
  assert.deepEqual(del.mock.calls[0].arguments, [USER, ID]);
  del.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'DELETE', `/workouts/sessions/${ID}`)).statusCode, 404);
});

test('GET /sessions/:id: cada série traz o id (a tela de edição precisa dele)', async (t) => {
  t.mock.method(workoutRepository, 'getSession', async () => ({
    id: ID, title: 'Treino', start_time: new Date('2026-10-06T12:00:00Z'), duration_sec: 600,
    workout_sets: [{ id: SET, exercise_name: 'Supino', position: 1, set_number: 1, duration_sec: 30, rest_before_sec: null, weight_kg: '20.00' }],
  }));
  const app = await build(t);
  const res = await call(app, 'GET', `/workouts/sessions/${ID}`);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().sets[0].id, SET);
});
```

Run: `node --test src/routes/workout.routes.test.js` → os novos FALHAM (`PUT`/`DELETE` 404 de rota).

- [ ] **Step 5: Implementar schemas, controller e rotas**

`workout.schemas.js`: no `SessionDetail`, no objeto da série, acrescentar `id: Type.String(),` como 1º campo. Depois do `SessionDetail`, acrescentar e exportar `SessionEditBody`:

```js
// Edição de um treino salvo: só duração e carga, por id de série. Sem started_at: a data é fixa (ela decide o ranking).
// additionalProperties: false + removeAdditional do Fastify: um started_at no corpo é descartado, nunca chega ao repository.
const SessionEditBody = Type.Object({
  duration_sec: Type.Integer({ minimum: 1, maximum: 21600 }),
  sets: Type.Array(Type.Object({
    id: Uuid,
    duration_sec: Type.Integer({ minimum: 0, maximum: 3600 }),
    weight_kg: Type.Optional(Weight),
  }, { additionalProperties: false }), { minItems: 1, maxItems: 200 }),
}, { additionalProperties: false });
```

`workout.controller.js`, na classe `WorkoutController`, depois de `getSession`:

```js
  async updateSession(request, reply) {
    const ids = request.body.sets.map((s) => s.id);
    if (new Set(ids).size !== ids.length) return reply.status(400).send({ error: 'duplicate set id' });
    const out = await workoutRepository.updateSession(request.user.userId, request.params.id, request.body);
    if (out.notFound) return reply.status(404).send(NOT_FOUND);
    if (out.badSet) return reply.status(400).send({ error: 'unknown set id' });
    return reply.send({ activity_id: request.params.id });
  }

  async deleteSession(request, reply) {
    const ok = await workoutRepository.deleteSession(request.user.userId, request.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }
```

`workout.routes.js`: importar `SessionEditBody` junto dos outros schemas e, depois do `GET /sessions/:id`:

```js
  fastify.put('/sessions/:id', {
    schema: {
      description: 'Edita duração e séries de um treino salvo (por id de série; as não listadas são apagadas). A data não muda',
      tags, security, params: IdParams, body: SessionEditBody,
      response: { 200: Type.Object({ activity_id: Type.String() }), ...errors(400, 401, 403, 404) },
    },
  }, workoutController.updateSession);

  fastify.delete('/sessions/:id', {
    schema: {
      description: 'Apaga um treino salvo e recalcula o ranking dos grupos do usuário',
      tags, security, params: IdParams,
      response: { 204: Type.Null(), ...errors(400, 401, 403, 404) },
    },
  }, workoutController.deleteSession);
```

- [ ] **Step 6: Rodar tudo**

Run: `npm test` → toda a suíte PASS (inclui os testes novos e os existentes de sessões).

- [ ] **Step 7: Commit**

```bash
git add BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/repository/tests/workout.repository.test.js BackEndTorv/src/routes/workout.routes.test.js
git commit -m "feat(workouts): edit and delete saved sessions; recompute group ranking on save/delete" -- BackEndTorv/src/repository/workout.repository.js BackEndTorv/src/controller/workout.controller.js BackEndTorv/src/routes/workout.routes.js BackEndTorv/src/routes/workout.schemas.js BackEndTorv/src/repository/tests/workout.repository.test.js BackEndTorv/src/routes/workout.routes.test.js
```

---

### Task 7: Teste da etapa de Backend (e reinício do Furnace)

**Recruit:** Torv Review and Tests (depois do Maestro reiniciar o Furnace) · **Files:**
- Create: `docs/qa-groups-competition-backend-2026-10-06.md`

- [ ] **Step 1 (Maestro): reiniciar o Furnace**

Só o Maestro para e sobe o backend no Furnace (porta 3000). Conferir `http://localhost:3000/documentation` com as rotas `Groups` e `PUT/DELETE /workouts/sessions/{id}`.

- [ ] **Step 2: Automatizados**

`npm test` em `BackEndTorv` → tudo PASS; anotar o total (antes: 92 do ciclo anterior mais os novos).

- [ ] **Step 3: Contrato ao vivo, com 2 contas de teste (A dono, B convidado)**

Usar `curl`/`fetch` contra `http://localhost:3000` com tokens de contas QA (registrar via `/auth/register` + `/auth/login`; o token fica só no ambiente do teste). Verificar e registrar no relatório, um por um:

1. **CRUD:** A cria grupo (`PUBLIC`, `starts_at` = hoje − 3 dias, `ends_at` nulo, `tz_offset_min` −180) → 201. `GET /groups` de A lista com `my_rank 1`. B abre `GET /groups/:id` do grupo público → 200 `is_member:false`; vira `PRIVATE` com `PATCH` → B recebe 404.
2. **Capa:** `POST /groups/:id/cover` por A com PNG válido → 200 e a URL abre a imagem; por B → 404; arquivo `.txt` com `image/png` → 400; arquivo > 5 MB → 413; trocar a capa → o arquivo antigo some de `BackEndTorv/profilePhotos/`.
3. **Convite por username:** A convida B → B vê em `GET /groups/invitations/received`; B aceita → membro; convite repetido → 409; A convida a si mesmo → 409; terceiro C tenta `accept` → 404.
4. **Pedido de entrada:** grupo `PRIVATE` → `POST /:id/requests` 404; `PUBLIC` → 201; A lista em `GET /:id/requests` e aceita; B vira membro.
5. **Link:** A gera o link → 8 caracteres; B abre `GET /groups/join/<minúsculas com espaços>` → prévia; `POST` → entra; A regenera → o código antigo dá 404; A revoga → 404; 21 chamadas seguidas a `/groups/join/*` em 1 minuto → 429.
6. **Encerrado:** `PATCH` `ends_at` = ontem → ranking congelado; `POST /join`, `/requests`, `/invitations` e `accept` → 409; o grupo some do `discover`.
7. **Sair e remover:** B sai (`DELETE /:id/members/<B>`) → 204 e some do ranking; dono tenta sair → 409; membro comum remove outro → 404.
8. **Excluir grupo:** A apaga → 204; `GET` → 404; a capa some do disco; membros e convites sumiram (SQL).

- [ ] **Step 4: Ranking ao vivo — valores esperados calculados à mão**

A API recusa `started_at` no futuro (e anterior a 2026-01-01), e só conta treino com `start_time >= joined_at`. Por isso os cenários usam horários **passados** e, quando preciso, empurram o `joined_at` do usuário **de teste** para trás por SQL (`UPDATE group_members SET joined_at = now() - interval '2 days' WHERE ...`), sempre só nos dados criados pelo teste. Depois de cada ação, conferir `GET /groups/:id/ranking` e a linha em `group_rankings`.

**Cenário A — janela por `joined_at`, 1 ponto por dia, apagar** (grupo `tz_offset_min = -180`, `starts_at` = hoje − 3 dias, `ends_at` nulo; B entra por link; evitar rodar a até 3 min da meia-noite local):

| Passo | Ação de B | `total_points` / `activities_count` esperados |
|---|---|---|
| 1 | entra no grupo | 0 / 0 |
| 2 | `POST /workouts/sessions` com `started_at` = agora − 1 h (antes do `joined_at`) | 0 / 0 |
| 3 | treino com `started_at` = agora | 1 / 1 |
| 4 | 2º treino com `started_at` = agora + 1 s (mesmo dia local) | 1 / 2 |
| 5 | apagar o **1º** treino | 1 / 1 (o dia ainda tem treino: o ponto fica) |
| 6 | apagar o 2º treino | 0 / 0 |
| 7 | treino de novo; `PATCH` `starts_at` = amanhã; depois `PATCH` `starts_at` de volta | 1 / 1 → 0 / 0 → 1 / 1 (mudar o período recalcula o grupo todo) |

**Cenário B — dia local do grupo, não o dia UTC.** Calcular `m` = minutos decorridos do dia UTC no instante (agora − 5 min); usar `tz_offset_min = -m` se `m <= 840`, senão `1440 - m` (a meia-noite local foi há 5 min). Grupo com esse fuso, `starts_at` = hoje − 3 dias; B entra e o `joined_at` vai para 2 dias atrás por SQL. Treinos de B: T1 com `started_at` = agora − 10 min (23:50 do dia local anterior) e T2 com `started_at` = agora − 2 min (00:03 do dia local seguinte).

| Grupo | Esperado de B |
|---|---|
| fuso calculado acima | 2 / 2 (dois dias locais) |
| outro grupo com `tz_offset_min = 0`, B também com `joined_at` antigo | 1 / 2 se T1 e T2 caem no mesmo dia UTC (conferir e anotar) |

Depois, a consulta de consistência deve devolver **0 linhas**:

```sql
WITH live AS (
  SELECT gm.group_id, gm.user_id, COUNT(DISTINCT d.local_day)::int AS pts, COUNT(d.local_day)::int AS acts
  FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  LEFT JOIN LATERAL (
    SELECT ((a.start_time AT TIME ZONE 'UTC') + make_interval(mins => g.tz_offset_min))::date AS local_day
    FROM activities a WHERE a.user_id = gm.user_id AND a.start_time >= gm.joined_at
  ) d ON d.local_day >= g.starts_at AND (g.ends_at IS NULL OR d.local_day <= g.ends_at)
  GROUP BY gm.group_id, gm.user_id)
SELECT l.*, r.total_points, r.activities_count
FROM live l LEFT JOIN group_rankings r USING (group_id, user_id)
WHERE r.total_points IS DISTINCT FROM l.pts OR r.activities_count IS DISTINCT FROM l.acts;
```

- [ ] **Step 5: Editar e excluir treino ao vivo**

`GET /workouts/sessions/:id` traz `id` por série; `PUT` com duração e cargas novas → 200 e o `GET` seguinte reflete; `PUT` omitindo uma série a apaga; `PUT` com `started_at` no corpo não muda a data; `PUT` com id de série de **outro** treino → 400; `PUT`/`DELETE` por outro usuário → 404; `DELETE` → 204 e `GET` 404; a Home (`/activities/summary`) e o `GET /activities` refletem.

- [ ] **Step 6: Relatório e limpeza**

Gravar `docs/qa-groups-competition-backend-2026-10-06.md` (resultado por item, PASS/FAIL, achados com severidade). Apagar as contas, grupos, treinos e arquivos de teste criados. **Se algum item falhar:** o relatório registra, o ciclo **não** avança, e o Maestro reabre só a task responsável (Task 3/4/5/6) numa nova rodada (`-round2`).

- [ ] **Step 7: Commit**

```bash
git add docs/qa-groups-competition-backend-2026-10-06.md
git commit -m "docs(qa): groups competition backend stage report" -- docs/qa-groups-competition-backend-2026-10-06.md
```

---

### Task 8: Frontend — serviços, utilitários puros e configuração do link

**Recruit:** Torv Frontend · **Files:**
- Modify: `FrontEndTorv/package.json`, `FrontEndTorv/package-lock.json` (via `npx expo install expo-linking`), `FrontEndTorv/app.json`
- Create: `FrontEndTorv/src/services/groups.ts`, `FrontEndTorv/src/utils/groupPeriod.ts`, `groupLink.ts`, `setEdit.ts`, `groupErrors.ts`, `pendingJoin.ts`, `sessionsVersion.ts`
- Create (testes): `FrontEndTorv/src/utils/groupPeriod.test.mjs`, `groupLink.test.mjs`, `setEdit.test.mjs`, `groupErrors.test.mjs`
- Modify: `FrontEndTorv/src/services/workouts.ts`

**Interfaces:**
- Produces (`groupPeriod`): `type GroupStatus = 'upcoming' | 'active' | 'ended'`; `interface GroupPeriod { starts_at: string; ends_at: string | null; tz_offset_min: number }`; `groupToday(tz, nowMs?)`, `groupStatus(p, nowMs?)`, `periodLabel(p, nowMs?)`, `formatDay('YYYY-MM-DD'): 'dd/mm/aaaa'`.
- Produces (`groupLink`): `TOKEN_LENGTH = 8`, `normalizeCode(raw)`, `isValidCode(code)`, `joinTokenFromUrl(url | null | undefined): string | null`.
- Produces (`setEdit`): `interface EditRow { id; label; durationText; weightText }`, `toEditRows(sets)`, `parseWeightInput(text): number | null | undefined`, `parseSeconds(text): number | undefined`, `toEditPayload(totalSec, rows): { ok: true; body } | { ok: false; error }`.
- Produces (`groupErrors`): `groupErrorText(status, serverMessage?, notFound?)`, `describeError(err, notFound?)`.
- Produces (`pendingJoin`): `setPendingJoin(code | null)`, `takePendingJoin(): string | null`. (`sessionsVersion`): `bumpSessionsVersion()`, `getSessionsVersion(): number`.
- Produces (`groupsApi`, em `services/groups.ts`) e os tipos do **Contrato da API**; `workoutsApi.updateSession(id, body)`, `workoutsApi.deleteSession(id)`; `SessionDetail.sets[].id`.

- [ ] **Step 1: Ler a doc do Expo e instalar**

Ler a doc versionada (`FrontEndTorv/AGENTS.md`), seção Linking. Em `FrontEndTorv`: `npx expo install expo-linking`. Em `app.json`, dentro de `"expo"`, acrescentar `"scheme": "torv",` (logo depois de `"slug"`).

- [ ] **Step 2: Testes dos utilitários** (falham: módulos não existem)

`FrontEndTorv/src/utils/groupPeriod.test.mjs`:

```js
// Roda com: node --test src/utils/groupPeriod.test.mjs (Node 24 remove os tipos do .ts sozinho).
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupToday, groupStatus, periodLabel, formatDay } from './groupPeriod.ts';

const at = (iso) => Date.parse(iso);

test('groupToday: o dia é o do fuso do grupo, não o do aparelho nem o UTC', () => {
  const now = at('2026-10-07T01:30:00Z'); // 22:30 de 06/10 em UTC-3
  assert.equal(groupToday(-180, now), '2026-10-06');
  assert.equal(groupToday(0, now), '2026-10-07');
});

test('groupStatus: antes do início, durante e depois do fim (inclusivo)', () => {
  const p = { starts_at: '2026-10-10', ends_at: '2026-10-20', tz_offset_min: 0 };
  assert.equal(groupStatus(p, at('2026-10-09T23:59:00Z')), 'upcoming');
  assert.equal(groupStatus(p, at('2026-10-10T00:00:00Z')), 'active');
  assert.equal(groupStatus(p, at('2026-10-20T23:59:00Z')), 'active');
  assert.equal(groupStatus(p, at('2026-10-21T00:00:00Z')), 'ended');
});

test('groupStatus: sem data de término nunca encerra', () => {
  const p = { starts_at: '2020-01-01', ends_at: null, tz_offset_min: -180 };
  assert.equal(groupStatus(p, at('2030-01-01T00:00:00Z')), 'active');
});

test('periodLabel: cada estado com singular e plural', () => {
  const day = (iso) => at(`${iso}T12:00:00Z`);
  const p = (s, e) => ({ starts_at: s, ends_at: e, tz_offset_min: 0 });
  assert.equal(periodLabel(p('2026-10-12', null), day('2026-10-10')), 'Começa em 2 dias');
  assert.equal(periodLabel(p('2026-10-11', null), day('2026-10-10')), 'Começa amanhã');
  assert.equal(periodLabel(p('2026-10-01', null), day('2026-10-10')), 'Sem data de término');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-13'), day('2026-10-10')), '3 dias restantes');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-11'), day('2026-10-10')), '1 dia restante');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-10'), day('2026-10-10')), 'Termina hoje');
  assert.equal(periodLabel(p('2026-10-01', '2026-10-09'), day('2026-10-10')), 'Encerrado em 09/10/2026');
});

test('formatDay', () => {
  assert.equal(formatDay('2026-01-05'), '05/01/2026');
});
```

`FrontEndTorv/src/utils/groupLink.test.mjs`:

```js
// Roda com: node --test src/utils/groupLink.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, isValidCode, joinTokenFromUrl } from './groupLink.ts';

test('normalizeCode: tira espaços e põe em maiúsculas', () => {
  assert.equal(normalizeCode(' ab3d k7mn\n'), 'AB3DK7MN');
});

test('isValidCode: 8 caracteres do alfabeto, sem 0 O 1 I L', () => {
  assert.ok(isValidCode('AB3DK7MN'));
  for (const bad of ['', 'AB3DK7M', 'AB3DK7MNP', 'AB3DK7M0', 'AB3DK7MO', 'AB3DK7M1', 'AB3DK7MI', 'AB3DK7ML', 'ab3dk7mn']) {
    assert.ok(!isValidCode(bad), bad);
  }
});

test('joinTokenFromUrl: esquema próprio, Expo Go, minúsculas, parâmetros e %20', () => {
  assert.equal(joinTokenFromUrl('torv://join/AB3DK7MN'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('torv://join/ab3dk7mn'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('exp://192.168.0.2:8081/--/join/AB3DK7MN'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('torv://join/AB3DK7MN?utm=x#y'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('torv://join/AB3D%20K7MN'), 'AB3DK7MN');
});

test('joinTokenFromUrl: URL malformada, sem código, código inválido ou outro caminho → null', () => {
  for (const bad of [null, undefined, '', 'torv://join/', 'torv://join', 'torv://join/0O1IL234', 'torv://join/ABC',
    'torv://home/AB3DK7MN', 'https://x.com/rejoin/AB3DK7MN', 'torv://join/%E0%A4%A']) {
    assert.equal(joinTokenFromUrl(bad), null, String(bad));
  }
});
```

`FrontEndTorv/src/utils/setEdit.test.mjs`:

```js
// Roda com: node --test src/utils/setEdit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeightInput, parseSeconds, toEditRows, toEditPayload } from './setEdit.ts';

test('parseWeightInput: vírgula ou ponto, vazio = sem carga, inválido = undefined, teto 999,99', () => {
  assert.equal(parseWeightInput('7,5'), 7.5);
  assert.equal(parseWeightInput('7.5'), 7.5);
  assert.equal(parseWeightInput(' 20 '), 20);
  assert.equal(parseWeightInput('7,'), 7);
  assert.equal(parseWeightInput(''), null);
  assert.equal(parseWeightInput('   '), null);
  assert.equal(parseWeightInput('1000'), 999.99);
  assert.equal(parseWeightInput('abc'), undefined);
  assert.equal(parseWeightInput('1.234'), undefined);
  assert.equal(parseWeightInput('-3'), undefined);
  assert.equal(parseWeightInput('1,2,3'), undefined);
});

test('parseSeconds: inteiro de 0 a 3600; o resto é inválido', () => {
  assert.equal(parseSeconds('45'), 45);
  assert.equal(parseSeconds(' 0 '), 0);
  assert.equal(parseSeconds('3601'), 3600);
  for (const bad of ['', 'x', '-1', '4.5', '4,5']) assert.equal(parseSeconds(bad), undefined, bad);
});

const sets = [
  { id: 'a', exercise_name: 'Supino', set_number: 1, duration_sec: 30, weight_kg: 20 },
  { id: 'b', exercise_name: 'Supino', set_number: 2, duration_sec: 32, weight_kg: null },
];

test('toEditRows: rótulo, tempo e carga em texto (vírgula decimal)', () => {
  const rows = toEditRows([{ ...sets[0], weight_kg: 22.5 }, sets[1]]);
  assert.deepEqual(rows, [
    { id: 'a', label: 'Supino · série 1', durationText: '30', weightText: '22,5' },
    { id: 'b', label: 'Supino · série 2', durationText: '32', weightText: '' },
  ]);
});

test('toEditPayload: monta o corpo do PUT; carga vazia vira null', () => {
  const out = toEditPayload(900, toEditRows(sets));
  assert.deepEqual(out, { ok: true, body: { duration_sec: 900, sets: [
    { id: 'a', duration_sec: 30, weight_kg: 20 },
    { id: 'b', duration_sec: 32, weight_kg: null },
  ] } });
});

test('toEditPayload: sem séries, tempo ou carga inválidos → erro com o nome da série', () => {
  assert.equal(toEditPayload(900, []).ok, false);
  const rows = toEditRows(sets);
  const badTime = toEditPayload(900, [{ ...rows[0], durationText: 'x' }, rows[1]]);
  assert.equal(badTime.ok, false);
  assert.match(badTime.error, /Supino · série 1/);
  const badWeight = toEditPayload(900, [rows[0], { ...rows[1], weightText: 'abc' }]);
  assert.match(badWeight.error, /Carga inválida.*série 2/);
});
```

`FrontEndTorv/src/utils/groupErrors.test.mjs`:

```js
// Roda com: node --test src/utils/groupErrors.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupErrorText } from './groupErrors.ts';

test('groupErrorText: mensagem do servidor tem prioridade; depois o status', () => {
  assert.equal(groupErrorText(409, 'Group has ended'), 'Este grupo já foi encerrado.');
  assert.equal(groupErrorText(409, 'Already a member'), 'Você já está neste grupo.');
  assert.equal(groupErrorText(409, 'Already pending'), 'Já existe um convite ou pedido pendente.');
  assert.equal(groupErrorText(404, 'Not found', 'Código inválido ou link desativado.'), 'Código inválido ou link desativado.');
  assert.equal(groupErrorText(404), 'Não encontrado.');
  assert.equal(groupErrorText(413), 'A imagem é grande demais (máximo de 5 MB).');
  assert.equal(groupErrorText(429), 'Muitas tentativas. Aguarde um minuto.');
  assert.equal(groupErrorText(500), 'Algo deu errado. Tente de novo.');
  assert.equal(groupErrorText(undefined), 'Sem conexão. Tente de novo.');
});
```

Run (em `FrontEndTorv`): `node --test src/utils/groupPeriod.test.mjs src/utils/groupLink.test.mjs src/utils/setEdit.test.mjs src/utils/groupErrors.test.mjs` → FAIL (módulos não existem).

- [ ] **Step 3: Implementar os utilitários**

`src/utils/groupPeriod.ts`:

```ts
export type GroupStatus = 'upcoming' | 'active' | 'ended';

export interface GroupPeriod {
  starts_at: string; // YYYY-MM-DD
  ends_at: string | null; // null = sem data de término
  tz_offset_min: number;
}

const DAY_MS = 86_400_000;

// Dia local do grupo (YYYY-MM-DD) num instante. Mesma conta do backend (groupRules.groupToday).
export const groupToday = (tzOffsetMin: number, nowMs: number = Date.now()): string =>
  new Date(nowMs + tzOffsetMin * 60_000).toISOString().slice(0, 10);

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

export const groupStatus = (p: GroupPeriod, nowMs: number = Date.now()): GroupStatus => {
  const today = groupToday(p.tz_offset_min, nowMs);
  if (today < p.starts_at) return 'upcoming';
  if (p.ends_at && today > p.ends_at) return 'ended';
  return 'active';
};

export const formatDay = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const periodLabel = (p: GroupPeriod, nowMs: number = Date.now()): string => {
  const today = groupToday(p.tz_offset_min, nowMs);
  switch (groupStatus(p, nowMs)) {
    case 'upcoming': {
      const n = daysBetween(today, p.starts_at);
      return n === 1 ? 'Começa amanhã' : `Começa em ${n} dias`;
    }
    case 'ended':
      return `Encerrado em ${formatDay(p.ends_at as string)}`;
    default: {
      if (!p.ends_at) return 'Sem data de término';
      const left = daysBetween(today, p.ends_at);
      if (left === 0) return 'Termina hoje';
      return left === 1 ? '1 dia restante' : `${left} dias restantes`;
    }
  }
};
```

`src/utils/groupLink.ts`:

```ts
// Mesmo alfabeto do backend (groupRules.TOKEN_ALPHABET): sem I, L, O, 0, 1.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TOKEN_LENGTH = 8;
const CODE_RE = new RegExp(`^[${ALPHABET}]{${TOKEN_LENGTH}}$`);

export const normalizeCode = (raw: string): string => raw.replace(/\s+/g, '').toUpperCase();
export const isValidCode = (code: string): boolean => CODE_RE.test(code);

// torv://join/ABCD2345, exp://192.168.0.2:8081/--/join/ABCD2345 (Expo Go) etc. Qualquer coisa fora disso → null.
export function joinTokenFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = /(?:^|\/)join\/([^/?#\s]+)/i.exec(url);
  if (!match) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  const code = normalizeCode(raw);
  return isValidCode(code) ? code : null;
}
```

`src/utils/setEdit.ts`:

```ts
// Edição de um treino salvo (tela WorkoutEdit). Sem imports: roda no teste de Node puro.
const MAX_WEIGHT_KG = 999.99;
const MAX_SET_SEC = 3600;

export interface EditRow {
  id: string;
  label: string;
  durationText: string; // segundos
  weightText: string; // "7,5"; vazio = sem carga
}

export interface SetDetail {
  id: string;
  exercise_name: string;
  set_number: number;
  duration_sec: number;
  weight_kg: number | null;
}

export const toEditRows = (sets: SetDetail[]): EditRow[] =>
  sets.map((s) => ({
    id: s.id,
    label: `${s.exercise_name} · série ${s.set_number}`,
    durationText: String(s.duration_sec),
    weightText: s.weight_kg === null ? '' : String(s.weight_kg).replace('.', ','),
  }));

// Texto da carga → número; vazio → null (sem carga); inválido → undefined. Passa de 999,99 → 999,99.
export function parseWeightInput(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  const m = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(t);
  if (!m) return undefined;
  const value = Number(`${m[1]}.${m[2] || '0'}`);
  return Math.min(value, MAX_WEIGHT_KG);
}

// Segundos inteiros de 0 a 3600 (acima disso fica em 3600); o resto é inválido.
export function parseSeconds(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return undefined;
  return Math.min(Number(t), MAX_SET_SEC);
}

export interface EditBody {
  duration_sec: number;
  sets: { id: string; duration_sec: number; weight_kg: number | null }[];
}
export type EditResult = { ok: true; body: EditBody } | { ok: false; error: string };

export function toEditPayload(totalSec: number, rows: EditRow[]): EditResult {
  if (rows.length === 0) {
    return { ok: false, error: 'O treino precisa ter ao menos uma série. Para remover tudo, exclua o treino.' };
  }
  const sets: EditBody['sets'] = [];
  for (const r of rows) {
    const duration = parseSeconds(r.durationText);
    if (duration === undefined) return { ok: false, error: `Tempo inválido em "${r.label}".` };
    const weight = parseWeightInput(r.weightText);
    if (weight === undefined) return { ok: false, error: `Carga inválida em "${r.label}".` };
    sets.push({ id: r.id, duration_sec: duration, weight_kg: weight });
  }
  return { ok: true, body: { duration_sec: totalSec, sets } };
}
```

`src/utils/groupErrors.ts`:

```ts
import axios from 'axios';

// Mensagens do backend (inglês, estáveis) → texto para a pessoa.
const BY_MESSAGE: Record<string, string> = {
  'Group has ended': 'Este grupo já foi encerrado.',
  'Already a member': 'Você já está neste grupo.',
  'Already pending': 'Já existe um convite ou pedido pendente.',
  'Invitation is not pending': 'Este convite já foi respondido.',
  'Owner cannot leave the group; delete it instead': 'O dono não pode sair. Exclua o grupo.',
};

export function groupErrorText(status: number | undefined, serverMessage?: string, notFound = 'Não encontrado.'): string {
  if (status === undefined) return 'Sem conexão. Tente de novo.';
  if (serverMessage && BY_MESSAGE[serverMessage]) return BY_MESSAGE[serverMessage];
  if (status === 404) return notFound;
  if (status === 413) return 'A imagem é grande demais (máximo de 5 MB).';
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto.';
  if (status === 400) return 'Confira os dados e tente de novo.';
  return 'Algo deu errado. Tente de novo.';
}

export const describeError = (err: unknown, notFound?: string): string =>
  axios.isAxiosError(err)
    ? groupErrorText(err.response?.status, err.response?.data?.error, notFound)
    : groupErrorText(500);
```

`src/utils/pendingJoin.ts`:

```ts
// Código de convite que chegou por link antes de o app poder abrir a tela (deslogado, ou navegação ainda não pronta).
let pending: string | null = null;

export const setPendingJoin = (code: string | null): void => {
  pending = code;
};

export const takePendingJoin = (): string | null => {
  const code = pending;
  pending = null;
  return code;
};
```

`src/utils/sessionsVersion.ts`:

```ts
// Sobe quando um treino salvo é editado ou apagado. Telas que mostram treinos comparam com a versão que viram
// e recarregam ao voltar ao foco (o histórico só traz o que é novo, e não notaria um treino apagado).
let version = 0;

export const bumpSessionsVersion = (): void => {
  version += 1;
};

export const getSessionsVersion = (): number => version;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test src/utils/groupPeriod.test.mjs src/utils/groupLink.test.mjs src/utils/setEdit.test.mjs src/utils/groupErrors.test.mjs` → todos PASS. Depois `node --test src/utils/*.test.mjs` → a suíte antiga continua verde.

- [ ] **Step 5: Serviço de grupos e treinos**

`src/services/groups.ts`:

```ts
import api from './api';
import type { GroupPeriod } from '../utils/groupPeriod';

// Contrato de /groups/* (spec docs/superpowers/specs/2026-10-06-groups-competition-design.md).
export type Visibility = 'PUBLIC' | 'PRIVATE';

export interface GroupListItem extends GroupPeriod {
  id: string;
  name: string;
  visibility: Visibility;
  cover_url: string | null;
  member_count: number;
  is_owner: boolean;
  my_rank: number;
  my_points: number;
}

export interface DiscoverItem extends GroupPeriod {
  id: string;
  name: string;
  cover_url: string | null;
  member_count: number;
}

export interface DiscoverPage {
  groups: DiscoverItem[];
  next_cursor: number | null;
}

export interface GroupDetailData extends GroupPeriod {
  id: string;
  name: string;
  visibility: Visibility;
  cover_url: string | null;
  member_count: number;
  is_owner: boolean;
  is_member: boolean;
  invite_token: string | null; // só o dono recebe
  my_invitation: { id: string; kind: 'INVITE' | 'REQUEST' } | null;
}

export interface GroupInput {
  name: string;
  visibility: Visibility;
  starts_at: string;
  ends_at: string | null;
  tz_offset_min: number;
}

export type GroupPatch = Partial<Omit<GroupInput, 'tz_offset_min'>>;

export interface RankingRow {
  position: number;
  user_id: string;
  name: string;
  username: string;
  photo_url: string | null;
  total_points: number; // dias com treino
  activities_count: number;
  is_me: boolean;
}

export interface PendingItem {
  id: string;
  user_id: string;
  name: string;
  username: string;
  photo_url: string | null;
  created_at: string;
}

export interface PendingLists {
  requests: PendingItem[];
  invites: PendingItem[];
}

export interface ReceivedInvitation {
  id: string;
  group: { id: string; name: string; cover_url: string | null };
  invited_by: { name: string; username: string };
  created_at: string;
}

export interface JoinPreview {
  group: GroupPeriod & { id: string; name: string; cover_url: string | null; member_count: number };
  is_member: boolean;
  ended: boolean;
}

// Mesmo envio da foto de perfil: no web o File vem do picker; no celular, { uri, name, type }.
export function coverForm(uri: string, webFile?: File): FormData {
  const form = new FormData();
  if (webFile) {
    form.append('photo', webFile, webFile.name);
  } else {
    form.append('photo', { uri, name: uri.split('/').pop() || 'cover.jpg', type: 'image/jpeg' } as any);
  }
  return form;
}

export const groupsApi = {
  list: () => api.get<{ groups: GroupListItem[] }>('/groups').then((r) => r.data.groups),
  discover: (q: string, cursor = 0) =>
    api.get<DiscoverPage>('/groups/discover', { params: { q: q || undefined, cursor } }).then((r) => r.data),
  get: (id: string) => api.get<GroupDetailData>(`/groups/${id}`).then((r) => r.data),
  create: (body: GroupInput) => api.post<GroupDetailData>('/groups', body).then((r) => r.data),
  update: (id: string, body: GroupPatch) => api.patch<GroupDetailData>(`/groups/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/groups/${id}`),
  uploadCover: (id: string, form: FormData) =>
    api.post<{ cover_url: string }>(`/groups/${id}/cover`, form).then((r) => r.data.cover_url),
  ranking: (id: string) => api.get<{ ranking: RankingRow[] }>(`/groups/${id}/ranking`).then((r) => r.data.ranking),
  removeMember: (id: string, userId: string) => api.delete(`/groups/${id}/members/${userId}`),
  invite: (id: string, username: string) => api.post<{ id: string }>(`/groups/${id}/invitations`, { username }).then((r) => r.data),
  requestJoin: (id: string) => api.post<{ id: string }>(`/groups/${id}/requests`).then((r) => r.data),
  pending: (id: string) => api.get<PendingLists>(`/groups/${id}/requests`).then((r) => r.data),
  received: () => api.get<{ invitations: ReceivedInvitation[] }>('/groups/invitations/received').then((r) => r.data.invitations),
  accept: (invitationId: string) =>
    api.post<{ group_id: string; status: string }>(`/groups/invitations/${invitationId}/accept`).then((r) => r.data),
  decline: (invitationId: string) =>
    api.post<{ group_id: string; status: string }>(`/groups/invitations/${invitationId}/decline`).then((r) => r.data),
  cancelInvitation: (invitationId: string) => api.delete(`/groups/invitations/${invitationId}`),
  createInviteLink: (id: string) => api.post<{ token: string }>(`/groups/${id}/invite-link`).then((r) => r.data.token),
  revokeInviteLink: (id: string) => api.delete(`/groups/${id}/invite-link`),
  joinPreview: (token: string) => api.get<JoinPreview>(`/groups/join/${token}`).then((r) => r.data),
  join: (token: string) => api.post<{ group_id: string }>(`/groups/join/${token}`).then((r) => r.data.group_id),
};
```

Em `src/services/workouts.ts`: no tipo `SessionDetail`, acrescentar `id: string;` como 1º campo de cada série; acrescentar o tipo e os dois métodos:

```ts
// PUT /workouts/sessions/:id: só duração e carga, por id de série. Séries não listadas são apagadas; a data não muda.
export interface SessionEdit {
  duration_sec: number;
  sets: { id: string; duration_sec: number; weight_kg: number | null }[];
}
```
e em `workoutsApi`:
```ts
  updateSession: (id: string, body: SessionEdit) => api.put<{ activity_id: string }>(`/workouts/sessions/${id}`, body).then((r) => r.data),
  deleteSession: (id: string) => api.delete(`/workouts/sessions/${id}`),
```

- [ ] **Step 6: Tipos**

Run (em `FrontEndTorv`): `npx tsc --noEmit` → sem erros novos (se `tsc` já tiver ruído de arquivos que não são desta tarefa, anotar e não mexer).

- [ ] **Step 7: Commit**

```bash
git add FrontEndTorv/package.json FrontEndTorv/package-lock.json FrontEndTorv/app.json FrontEndTorv/src/services/groups.ts FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/utils/groupPeriod.ts FrontEndTorv/src/utils/groupLink.ts FrontEndTorv/src/utils/setEdit.ts FrontEndTorv/src/utils/groupErrors.ts FrontEndTorv/src/utils/pendingJoin.ts FrontEndTorv/src/utils/sessionsVersion.ts FrontEndTorv/src/utils/groupPeriod.test.mjs FrontEndTorv/src/utils/groupLink.test.mjs FrontEndTorv/src/utils/setEdit.test.mjs FrontEndTorv/src/utils/groupErrors.test.mjs
git commit -m "feat(groups): front services, pure utils and expo-linking scheme" -- FrontEndTorv/package.json FrontEndTorv/package-lock.json FrontEndTorv/app.json FrontEndTorv/src/services/groups.ts FrontEndTorv/src/services/workouts.ts FrontEndTorv/src/utils/groupPeriod.ts FrontEndTorv/src/utils/groupLink.ts FrontEndTorv/src/utils/setEdit.ts FrontEndTorv/src/utils/groupErrors.ts FrontEndTorv/src/utils/pendingJoin.ts FrontEndTorv/src/utils/sessionsVersion.ts FrontEndTorv/src/utils/groupPeriod.test.mjs FrontEndTorv/src/utils/groupLink.test.mjs FrontEndTorv/src/utils/setEdit.test.mjs FrontEndTorv/src/utils/groupErrors.test.mjs
```

---

### Task 9: Frontend — navegação, deep link e componentes de capa e card

**Recruit:** Torv Frontend (com `/frontend-design`) · **Files:**
- Modify: `FrontEndTorv/src/routes/types.ts`, `FrontEndTorv/src/routes/index.tsx`, `FrontEndTorv/src/routes/PrivateRoutes/index.tsx`
- Create: `FrontEndTorv/src/components/GroupCover/index.tsx` + `styles.ts`, `FrontEndTorv/src/components/GroupCard/index.tsx` + `styles.ts`
- (As telas das próximas tasks já ficam registradas aqui como imports; criar cada tela vazia `export default function X() { return null; }` só até a task dela, ou registrar as rotas junto de cada task. O plano registra tudo na Task 9 com telas-esqueleto para o `tsc` passar.)

**Interfaces:**
- Consumes: `joinTokenFromUrl`, `setPendingJoin`/`takePendingJoin` (Task 8).
- Produces: `TabParamList.Groups`; `AppStackParamList.GroupDetail { groupId: string }`, `GroupEditor { groupId?: string }`, `GroupManage { groupId: string }`, `JoinGroup { token?: string }`, `WorkoutEdit { sessionId: string }`; `navigationRef`; componentes `GroupCover` e `GroupCard`.

- [ ] **Step 1: Tipos de rota** (`src/routes/types.ts`)

```ts
export type TabParamList = {
  Home: undefined;
  Workouts: undefined;
  MyDiet: undefined;
  Groups: undefined;
  Profile: undefined;
};

// Telas empilhadas sobre as abas (cobrem a tab bar).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  RoutineEditor: { routineId?: string };
  WorkoutSession: { routineId?: string; resume?: boolean };
  WorkoutSummary: { sessionId?: string }; // sem sessionId: treino recém-finalizado (rascunho)
  WorkoutEdit: { sessionId: string };
  GroupDetail: { groupId: string };
  GroupEditor: { groupId?: string }; // sem groupId: criar
  GroupManage: { groupId: string };
  JoinGroup: { token?: string }; // sem token: digitar o código
};
```

- [ ] **Step 2: `GroupCover`** (`src/components/GroupCover/index.tsx`)

```tsx
import React from 'react';
import { Image, View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { styles } from './styles';

interface Props {
  uri: string | null;
  name: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

// Capa do grupo; sem imagem, mostra a inicial do nome sobre um fundo da marca.
export const GroupCover: React.FC<Props> = ({ uri, name, height = 140, style }) =>
  uri ? (
    <Image
      source={{ uri }}
      style={[styles.image, { height }, style as any]}
      resizeMode="cover"
      accessibilityLabel={`Capa do grupo ${name}`}
    />
  ) : (
    <View style={[styles.placeholder, { height }, style]} accessibilityLabel={`Grupo ${name}, sem capa`}>
      <Text style={styles.initial}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
```
`styles.ts` (quem escreve usa `/frontend-design`): chaves `image` (largura 100%, `borderRadius`), `placeholder` (centraliza, `colors.brandTint` + borda), `initial` (Sora extraBold, `colors.brand`).

- [ ] **Step 3: `GroupCard`** (`src/components/GroupCard/index.tsx`)

```tsx
import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { GroupCover } from '../GroupCover';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface Props {
  name: string;
  coverUri: string | null;
  subtitle: string; // "12 membros · 3 dias restantes"
  meta?: string; // "#2 · 7 dias" (só nos meus grupos)
  onPress: () => void;
}

export const GroupCard: React.FC<Props> = ({ name, coverUri, subtitle, meta, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${name}. ${subtitle}${meta ? `. ${meta}` : ''}`}>
    <GroupCover uri={coverUri} name={name} height={64} style={styles.thumb} />
    <View style={styles.body}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
    </View>
    <ChevronRight color={colors.textSecondary} size={20} />
  </TouchableOpacity>
);
```
`styles.ts`: chaves `card` (linha, `minHeight: 80`, `colors.surface`, `radius.md`), `thumb` (64×64, `radius.sm`), `body` (`flex: 1`), `name`, `subtitle`, `meta` (`colors.brand`).

- [ ] **Step 4: Deep link em `src/routes/index.tsx`**

```tsx
import React, { useContext, useEffect } from 'react';
import * as Linking from 'expo-linking';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';

import { AuthContext } from '../contexts/AuthContext';
import { PublicRoutes } from './PublicRoutes';
import { PrivateRoutes } from './PrivateRoutes';
import { joinTokenFromUrl } from '../utils/groupLink';
import { setPendingJoin } from '../utils/pendingJoin';
import type { AppStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

export const Routes = () => {
  const { signed, user } = useContext(AuthContext);

  // Convite por link (torv://join/CODIGO). Logado e com a navegação pronta → abre JoinGroup; senão guarda,
  // e o componente Tabs abre quando montar (depois do login, ou na partida a frio).
  const handleUrl = (url: string | null) => {
    const code = joinTokenFromUrl(url);
    if (!code) return;
    if (signed && navigationRef.isReady()) navigationRef.navigate('JoinGroup', { token: code });
    else setPendingJoin(code);
  };

  useEffect(() => {
    Linking.getInitialURL().then(handleUrl).catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [signed]);

  return (
    <NavigationContainer ref={navigationRef}>
      {signed ? <PrivateRoutes user={user} /> : <PublicRoutes />}
    </NavigationContainer>
  );
};
```

- [ ] **Step 5: Aba e rotas em `PrivateRoutes/index.tsx`**

- Importar `Users` de `lucide-react-native`, `useNavigation` de `@react-navigation/native`, `takePendingJoin` de `../../utils/pendingJoin`, o tipo `AppNavigation` de `../types` e as 6 telas novas (`GroupsScreen`, `GroupDetailScreen`, `GroupEditorScreen`, `GroupManageScreen`, `JoinGroupScreen`, `WorkoutEditScreen`; cada uma criada como esqueleto `export default function Nome() { return null; }` em `src/screens/<Nome>/index.tsx`, para o `tsc` passar até a task dela).
- No `TabIcon`, trocar `minWidth: 64` por `minWidth: 56` (5 abas cabem em 320 px).
- No `Tabs`, abrir o convite guardado (partida a frio ou depois do login):

```tsx
const Tabs = ({ user }: { user: any }) => {
  const navigation = useNavigation<AppNavigation>();
  useEffect(() => {
    const code = takePendingJoin();
    if (code) navigation.navigate('JoinGroup', { token: code });
  }, []);

  return (
    <Tab.Navigator ...>  {/* o JSX atual do Navigator, sem mudança */}
```
- Entre `MyDiet` e `Profile`, a nova aba:

```tsx
    <Tab.Screen
      name="Groups"
      component={GroupsScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Users} label="Grupos" />,
      }}
    />
```
- Na pilha, depois de `WorkoutSummary`:

```tsx
    <Stack.Screen name="WorkoutEdit" component={WorkoutEditScreen} />
    <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
    <Stack.Screen name="GroupEditor" component={GroupEditorScreen} />
    <Stack.Screen name="GroupManage" component={GroupManageScreen} />
    <Stack.Screen name="JoinGroup" component={JoinGroupScreen} />
```
(O `Tabs` vira função com `return`; `import React, { useEffect }`.)

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit` → sem erros. Subir o app **não** é desta task (o Expo só sobe depois do ciclo, pelo Maestro).

- [ ] **Step 7: Commit**

```bash
git add FrontEndTorv/src/routes/types.ts FrontEndTorv/src/routes/index.tsx FrontEndTorv/src/routes/PrivateRoutes/index.tsx FrontEndTorv/src/components/GroupCover FrontEndTorv/src/components/GroupCard FrontEndTorv/src/screens/Groups FrontEndTorv/src/screens/GroupDetail FrontEndTorv/src/screens/GroupEditor FrontEndTorv/src/screens/GroupManage FrontEndTorv/src/screens/JoinGroup FrontEndTorv/src/screens/WorkoutEdit
git commit -m "feat(groups): groups tab, routes, deep link and cover/card components" -- FrontEndTorv/src/routes/types.ts FrontEndTorv/src/routes/index.tsx FrontEndTorv/src/routes/PrivateRoutes/index.tsx FrontEndTorv/src/components/GroupCover FrontEndTorv/src/components/GroupCard FrontEndTorv/src/screens/Groups FrontEndTorv/src/screens/GroupDetail FrontEndTorv/src/screens/GroupEditor FrontEndTorv/src/screens/GroupManage FrontEndTorv/src/screens/JoinGroup FrontEndTorv/src/screens/WorkoutEdit
```

---

### Task 10: Frontend — aba Grupos

**Recruit:** Torv Frontend (com `/frontend-design`) · **Files:**
- Modify: `FrontEndTorv/src/screens/Groups/index.tsx` (substitui o esqueleto)
- Create: `FrontEndTorv/src/screens/Groups/styles.ts`

**Interfaces:**
- Consumes: `groupsApi`, `GroupCard`, `GroupCover`, `groupStatus`/`periodLabel`, `describeError` (Tasks 8 e 9).
- Produces: a tela da aba; navega para `GroupDetail`, `GroupEditor` e `JoinGroup`.

- [ ] **Step 1: Implementar a tela**

`FrontEndTorv/src/screens/Groups/index.tsx` (a lógica é esta; o recruit monta o layout/estilo com `/frontend-design`, respeitando as chaves de `styles`):

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, KeyRound, Search, Users } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { GroupCard } from '../../components/GroupCard';
import { GroupCover } from '../../components/GroupCover';
import { groupsApi, type DiscoverItem, type GroupListItem, type ReceivedInvitation } from '../../services/groups';
import { periodLabel } from '../../utils/groupPeriod';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Segment = 'mine' | 'discover';
type Status = 'loading' | 'ready' | 'error';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Groups() {
  const navigation = useNavigation<AppNavigation>();
  const [segment, setSegment] = useState<Segment>('mine');

  const [mine, setMine] = useState<GroupListItem[]>([]);
  const [received, setReceived] = useState<ReceivedInvitation[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<DiscoverItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [discoverStatus, setDiscoverStatus] = useState<Status>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const searchId = useRef(0); // resposta de uma busca antiga chega depois → descarta

  const loadMine = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      // Falha em convites não derruba a lista de grupos.
      const [groups, invitations] = await Promise.all([groupsApi.list(), groupsApi.received().catch(() => [] as ReceivedInvitation[])]);
      setMine(groups);
      setReceived(invitations);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  // Volta de GroupDetail / GroupEditor / JoinGroup: lista e convites sempre frescos.
  useFocusEffect(useCallback(() => { loadMine(); }, []));

  const search = async (q: string, cursor = 0) => {
    const id = ++searchId.current;
    if (cursor === 0) setDiscoverStatus('loading');
    else setLoadingMore(true);
    try {
      const page = await groupsApi.discover(q.trim(), cursor);
      if (id !== searchId.current) return;
      setFound((prev) => (cursor === 0 ? page.groups : [...prev, ...page.groups]));
      setNextCursor(page.next_cursor);
      setDiscoverStatus('ready');
    } catch {
      if (id !== searchId.current) return;
      if (cursor === 0) setDiscoverStatus('error');
    } finally {
      if (id === searchId.current) setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (segment === 'discover') search(query);
  }, [segment]);

  const answer = async (invitation: ReceivedInvitation, accept: boolean) => {
    setBusyInvitation(invitation.id);
    setInviteError(null);
    try {
      if (accept) {
        await groupsApi.accept(invitation.id);
        navigation.navigate('GroupDetail', { groupId: invitation.group.id });
      } else {
        await groupsApi.decline(invitation.id);
      }
      await loadMine();
    } catch (error) {
      setInviteError(describeError(error));
    } finally {
      setBusyInvitation(null);
    }
  };

  const segmentButton = (key: Segment, label: string) => (
    <TouchableOpacity
      key={key}
      style={[styles.segment, segment === key && styles.segmentActive]}
      onPress={() => setSegment(key)}
      accessibilityRole="button"
      accessibilityState={{ selected: segment === key }}
      aria-selected={segment === key} // react-native-web ignora accessibilityState
    >
      <Text style={[styles.segmentText, segment === key && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (segment === 'mine' ? loadMine(true) : search(query))} tintColor={colors.brand} />}
      >
        <Text style={styles.title}>Grupos</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => navigation.navigate('GroupEditor', {})} accessibilityRole="button" accessibilityLabel="Criar grupo">
            <Plus color={colors.brand} size={20} />
            <Text style={styles.actionText}>Criar grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => navigation.navigate('JoinGroup', {})} accessibilityRole="button" accessibilityLabel="Entrar com código">
            <KeyRound color={colors.brand} size={20} />
            <Text style={styles.actionText}>Entrar com código</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segments}>
          {segmentButton('mine', 'Meus grupos')}
          {segmentButton('discover', 'Descobrir')}
        </View>

        {segment === 'mine' && (
          <>
            {received.length > 0 && (
              <View style={styles.invites}>
                <Text style={styles.sectionTitle}>Convites recebidos</Text>
                {received.map((inv) => (
                  <View key={inv.id} style={styles.invite}>
                    <GroupCover uri={inv.group.cover_url} name={inv.group.name} height={48} style={styles.inviteThumb} />
                    <View style={styles.inviteBody}>
                      <Text style={styles.inviteName} numberOfLines={1}>{inv.group.name}</Text>
                      <Text style={styles.inviteFrom} numberOfLines={1}>Convite de @{inv.invited_by.username}</Text>
                    </View>
                    <Button title="Aceitar" style={styles.inviteButton} loading={busyInvitation === inv.id} onPress={() => answer(inv, true)} />
                    <Button title="Recusar" outline style={styles.inviteButton} disabled={busyInvitation === inv.id} onPress={() => answer(inv, false)} />
                  </View>
                ))}
                {inviteError && <Text style={styles.error}>{inviteError}</Text>}
              </View>
            )}

            {status === 'loading' && <ActivityIndicator color={colors.brand} style={styles.loading} />}
            {status === 'error' && (
              <View style={styles.centered}>
                <Text style={styles.muted}>Não foi possível carregar seus grupos.</Text>
                <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); loadMine(); }} />
              </View>
            )}
            {status === 'ready' && mine.length === 0 && (
              <View style={styles.centered}>
                <Users color={colors.textSecondary} size={40} />
                <Text style={styles.muted}>Você ainda não está em nenhum grupo. Crie um, entre com um código ou procure em Descobrir.</Text>
              </View>
            )}
            {status === 'ready' && mine.map((g) => (
              <GroupCard
                key={g.id}
                name={g.name}
                coverUri={g.cover_url}
                subtitle={`${plural(g.member_count, 'membro', 'membros')} · ${periodLabel(g)}`}
                meta={`#${g.my_rank} · ${plural(g.my_points, 'dia', 'dias')}`}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
              />
            ))}
          </>
        )}

        {segment === 'discover' && (
          <>
            <View style={styles.searchBox}>
              <Search color={colors.textSecondary} size={18} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => search(query)}
                placeholder="Buscar grupo pelo nome"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
                maxLength={100}
                accessibilityLabel="Buscar grupo pelo nome"
              />
            </View>
            {discoverStatus === 'loading' && <ActivityIndicator color={colors.brand} style={styles.loading} />}
            {discoverStatus === 'error' && (
              <View style={styles.centered}>
                <Text style={styles.muted}>Não foi possível buscar.</Text>
                <Button title="Tentar de novo" outline onPress={() => search(query)} />
              </View>
            )}
            {discoverStatus === 'ready' && found.length === 0 && (
              <Text style={styles.muted}>Nenhum grupo público encontrado.</Text>
            )}
            {discoverStatus === 'ready' && found.map((g) => (
              <GroupCard
                key={g.id}
                name={g.name}
                coverUri={g.cover_url}
                subtitle={`${plural(g.member_count, 'membro', 'membros')} · ${periodLabel(g)}`}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
              />
            ))}
            {discoverStatus === 'ready' && nextCursor !== null && (
              <Button title="Carregar mais" outline loading={loadingMore} onPress={() => search(query, nextCursor)} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

`styles.ts` (chaves usadas): `container, scroll` (com `paddingBottom` grande: a tab bar flutuante cobre ~110 px), `title, actions, action, actionText, segments, segment, segmentActive, segmentText, segmentTextActive, invites, sectionTitle, invite, inviteThumb, inviteBody, inviteName, inviteFrom, inviteButton, error, loading, centered, muted, searchBox, searchInput`. Alvos de toque de 44 px; cabe em 320 px (os botões Aceitar/Recusar podem ir em linha abaixo do nome em telas estreitas).

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/screens/Groups
git commit -m "feat(groups): groups tab with my groups, invitations and discover" -- FrontEndTorv/src/screens/Groups
```

---

### Task 11: Frontend — tela GroupDetail

**Recruit:** Torv Frontend (com `/frontend-design`) · **Files:**
- Modify: `FrontEndTorv/src/screens/GroupDetail/index.tsx`
- Create: `FrontEndTorv/src/screens/GroupDetail/styles.ts`

**Interfaces:**
- Consumes: `groupsApi.get/ranking/requestJoin/accept/decline/removeMember`, `GroupCover`, `ConfirmModal`, `AuthContext.user.id`, `groupStatus`/`periodLabel`/`formatDay`, `describeError`.
- Produces: tela `GroupDetail { groupId }`; leva a `GroupEditor { groupId }` e `GroupManage { groupId }`.

- [ ] **Step 1: Implementar a tela**

`FrontEndTorv/src/screens/GroupDetail/index.tsx`:

```tsx
import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { GroupCover } from '../../components/GroupCover';
import { AuthContext } from '../../contexts/AuthContext';
import { groupsApi, type GroupDetailData, type RankingRow } from '../../services/groups';
import { groupStatus, periodLabel, formatDay } from '../../utils/groupPeriod';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Status = 'loading' | 'ready' | 'missing' | 'error';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function GroupDetail() {
  const navigation = useNavigation<AppNavigation>();
  const { groupId } = useRoute<RouteProp<AppStackParamList, 'GroupDetail'>>().params;
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const detail = await groupsApi.get(groupId);
      setGroup(detail);
      setRanking(detail.is_member ? await groupsApi.ranking(groupId) : []);
      setStatus('ready');
    } catch (error) {
      setStatus(axios.isAxiosError(error) && error.response?.status === 404 ? 'missing' : 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Volta de GroupEditor / GroupManage: tudo fresco (nome, capa, período, membros, ranking).
  useFocusEffect(useCallback(() => { load(); }, [groupId]));

  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await run();
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const requestJoin = () => act(async () => {
    await groupsApi.requestJoin(groupId);
    setMessage('Pedido enviado. O dono do grupo vai analisar.');
    await load();
  });

  const answerInvitation = (accept: boolean) => act(async () => {
    const id = group?.my_invitation?.id;
    if (!id) return;
    if (accept) await groupsApi.accept(id);
    else await groupsApi.decline(id);
    await load();
  });

  const leave = () => act(async () => {
    if (!user?.id) return;
    await groupsApi.removeMember(groupId, user.id);
    setConfirmLeave(false);
    navigation.goBack();
  });

  const back = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={26} />
      </TouchableOpacity>
    </View>
  );

  if (status === 'loading') {
    return <SafeAreaView style={styles.container}>{back}<ActivityIndicator color={colors.brand} style={styles.loading} /></SafeAreaView>;
  }
  if (status === 'missing' || status === 'error' || !group) {
    return (
      <SafeAreaView style={styles.container}>
        {back}
        <View style={styles.centered}>
          <Text style={styles.muted}>{status === 'missing' ? 'Grupo não encontrado.' : 'Não foi possível carregar o grupo.'}</Text>
          {status === 'error' && <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); load(); }} />}
        </View>
      </SafeAreaView>
    );
  }

  const state = groupStatus(group);
  const invitedByAdmin = group.my_invitation?.kind === 'INVITE';
  const requested = group.my_invitation?.kind === 'REQUEST';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />}>
        <View>
          <GroupCover uri={group.cover_url} name={group.name} height={180} style={styles.cover} />
          <TouchableOpacity style={styles.backOnCover} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
            <ArrowLeft color={colors.text} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.meta}>
            {group.visibility === 'PUBLIC' ? 'Público' : 'Privado'} · {plural(group.member_count, 'membro', 'membros')}
          </Text>
          <Text style={[styles.period, state === 'ended' && styles.periodEnded]}>
            {formatDay(group.starts_at)} {group.ends_at ? `→ ${formatDay(group.ends_at)}` : '→ sem data de término'} · {periodLabel(group)}
          </Text>
        </View>

        {group.is_owner && (
          <View style={styles.ownerActions}>
            <Button title="Editar" outline style={styles.ownerButton} onPress={() => navigation.navigate('GroupEditor', { groupId })} />
            <Button title="Gerenciar" outline style={styles.ownerButton} onPress={() => navigation.navigate('GroupManage', { groupId })} />
          </View>
        )}

        {!group.is_member && state !== 'ended' && (
          <Card style={styles.joinCard}>
            {invitedByAdmin ? (
              <>
                <Text style={styles.joinText}>Você foi convidado para este grupo.</Text>
                <Button title="Aceitar convite" loading={busy} onPress={() => answerInvitation(true)} />
                <Button title="Recusar" outline disabled={busy} onPress={() => answerInvitation(false)} />
              </>
            ) : requested ? (
              <Text style={styles.joinText}>Pedido enviado. Aguardando o dono do grupo.</Text>
            ) : (
              <>
                <Text style={styles.joinText}>Entre no grupo para ver o ranking e competir.</Text>
                <Button title="Pedir para entrar" loading={busy} onPress={requestJoin} />
              </>
            )}
          </Card>
        )}
        {!group.is_member && state === 'ended' && <Text style={styles.muted}>Este grupo já foi encerrado e não aceita novos membros.</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        {group.is_member && (
          <View style={styles.rankingBox}>
            <Text style={styles.sectionTitle}>Ranking</Text>
            {state === 'upcoming' && <Text style={styles.muted}>A competição ainda não começou: todo mundo está com zero.</Text>}
            {ranking.map((r) => (
              <View key={r.user_id} style={[styles.row, r.is_me && styles.rowMe, r.position <= 3 && styles.rowTop]} accessibilityLabel={`${r.position}º, ${r.name}, ${plural(r.total_points, 'dia', 'dias')}${r.is_me ? ', você' : ''}`}>
                <Text style={[styles.position, r.position <= 3 && styles.positionTop]}>{r.position}</Text>
                {r.photo_url ? (
                  <Image source={{ uri: r.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarEmpty}><Text style={styles.avatarInitial}>{r.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{r.is_me ? `${r.name} (você)` : r.name}</Text>
                  <Text style={styles.rowUser} numberOfLines={1}>@{r.username}</Text>
                </View>
                <View style={styles.points}>
                  <Text style={styles.pointsValue}>{r.total_points}</Text>
                  <Text style={styles.pointsLabel}>{r.total_points === 1 ? 'dia' : 'dias'}</Text>
                </View>
              </View>
            ))}
            {!group.is_owner && <Button title="Sair do grupo" danger outline onPress={() => setConfirmLeave(true)} />}
          </View>
        )}
        {!group.is_member && <Text style={styles.muted}>Entre no grupo para ver o ranking.</Text>}
      </ScrollView>

      <ConfirmModal
        visible={confirmLeave}
        title="Sair do grupo?"
        message="Se voltar depois, a contagem começa do zero."
        confirmLabel="Sair"
        danger
        loading={busy}
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </SafeAreaView>
  );
}
```
`styles.ts` (chaves usadas): `container, loading, centered, muted, header, back, scroll, cover, backOnCover` (botão redondo sobre a capa, 44 px), `info, name, meta, period, periodEnded, ownerActions, ownerButton, joinCard, joinText, message, rankingBox, sectionTitle, row, rowMe` (destaque da minha linha), `rowTop, position, positionTop` (top 3 em destaque), `avatar, avatarEmpty, avatarInitial, rowBody, rowName, rowUser, points, pointsValue, pointsLabel`. Não depender só de cor para o top 3 e para "você" (texto "(você)" e peso da fonte).

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/screens/GroupDetail
git commit -m "feat(groups): group detail with ranking, join request and leave" -- FrontEndTorv/src/screens/GroupDetail
```

---

### Task 12: Frontend — tela GroupEditor (criar e editar)

**Recruit:** Torv Frontend (com `/frontend-design`) · **Files:**
- Modify: `FrontEndTorv/src/screens/GroupEditor/index.tsx`
- Create: `FrontEndTorv/src/screens/GroupEditor/styles.ts`

**Interfaces:**
- Consumes: `groupsApi.create/update/get/uploadCover`, `coverForm`, `DatePickerModal`, `Input`, `GroupCover`, `describeError`, `toISODate`.
- Produces: tela `GroupEditor { groupId? }`. Criar → `replace('GroupDetail')`; editar → `goBack()`.

- [ ] **Step 1: Ler como o Perfil escolhe a foto**

Abrir `FrontEndTorv/src/screens/Profile/index.tsx` (`handlePickImage`, ~linha 94): a permissão (`requestMediaLibraryPermissionsAsync`) e o tratamento no web (`result.assets[0].file`). **Copiar o mesmo tratamento de permissão**, mas com a mensagem de erro na própria tela (`setError`), nunca `Alert.alert`. Capa em 16:9: `aspect: [16, 9]`, `quality: 0.7`.

- [ ] **Step 2: Implementar a tela**

`FrontEndTorv/src/screens/GroupEditor/index.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { GroupCover } from '../../components/GroupCover';
import { DatePickerModal } from '../../components/DatePickerModal';
import { groupsApi, coverForm, type Visibility } from '../../services/groups';
import { describeError } from '../../utils/groupErrors';
import { formatDay } from '../../utils/groupPeriod';
import { toISODate } from '../../utils/date';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Picking = null | 'start' | 'end';
interface PickedCover { uri: string; webFile?: File }

// O seletor de ano termina no ano do maxDate: 5 anos à frente cobre qualquer competição razoável.
const farFuture = () => toISODate(new Date(new Date().getFullYear() + 5, 11, 31));

export default function GroupEditor() {
  const navigation = useNavigation<AppNavigation>();
  const editingId = useRoute<RouteProp<AppStackParamList, 'GroupEditor'>>().params?.groupId;

  const [loading, setLoading] = useState(!!editingId);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [startsAt, setStartsAt] = useState(toISODate(new Date()));
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ starts_at: string; ends_at: string | null } | null>(null); // para só mandar o período se mudou
  const [remoteCover, setRemoteCover] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedCover | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Criou o grupo mas a capa falhou: tentar de novo só reenvia a capa, não cria outro grupo.
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const g = await groupsApi.get(editingId);
        setName(g.name);
        setVisibility(g.visibility);
        setStartsAt(g.starts_at);
        setEndsAt(g.ends_at);
        setRemoteCover(g.cover_url);
        setCurrent({ starts_at: g.starts_at, ends_at: g.ends_at });
      } catch (err) {
        setError(describeError(err, 'Grupo não encontrado.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [editingId]);

  const pickCover = async () => {
    setError(null);
    try {
      // (copiar de Profile/handlePickImage o pedido de permissão; negada → setError('Precisamos de acesso à galeria para escolher a capa.'))
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
      if (!result.canceled && result.assets?.length) {
        setPicked({ uri: result.assets[0].uri, webFile: result.assets[0].file });
      }
    } catch {
      setError('Não foi possível abrir a galeria.');
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Dê um nome ao grupo.');
    if (endsAt && endsAt < startsAt) return setError('O fim não pode ser antes do início.');
    setSaving(true);
    setError(null);
    let id = editingId ?? createdId;
    try {
      if (id) {
        const periodChanged = !current || current.starts_at !== startsAt || current.ends_at !== endsAt;
        await groupsApi.update(id, { name: trimmed, visibility, ...(periodChanged && { starts_at: startsAt, ends_at: endsAt }) });
      } else {
        const created = await groupsApi.create({ name: trimmed, visibility, starts_at: startsAt, ends_at: endsAt, tz_offset_min: -new Date().getTimezoneOffset() });
        id = created.id;
        setCreatedId(id);
      }
      if (picked) await groupsApi.uploadCover(id, coverForm(picked.uri, picked.webFile));
      if (editingId) navigation.goBack();
      else navigation.replace('GroupDetail', { groupId: id });
    } catch (err) {
      setError(id && picked ? `${editingId ? 'Alterações salvas' : 'Grupo criado'}, mas a capa não foi enviada. ${describeError(err)}` : describeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={styles.loading} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <Text style={styles.title}>{editingId ? 'Editar grupo' : 'Novo grupo'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={pickCover} accessibilityRole="button" accessibilityLabel="Escolher capa do grupo">
          <GroupCover uri={picked?.uri ?? remoteCover} name={name || 'Grupo'} height={160} />
          <View style={styles.coverBadge}><Camera color={colors.text} size={18} /><Text style={styles.coverBadgeText}>{picked || remoteCover ? 'Trocar capa' : 'Adicionar capa'}</Text></View>
        </TouchableOpacity>

        <Input label="Nome do grupo" value={name} onChangeText={setName} maxLength={100} placeholder="Ex.: Galera da academia" />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>Grupo público</Text>
            <Text style={styles.hint}>{visibility === 'PUBLIC' ? 'Aparece na busca e aceita pedidos de entrada.' : 'Só entra por convite ou código.'}</Text>
          </View>
          <Switch value={visibility === 'PUBLIC'} onValueChange={(v) => setVisibility(v ? 'PUBLIC' : 'PRIVATE')} trackColor={{ true: colors.brand }} accessibilityLabel="Grupo público" />
        </View>

        <Text style={styles.label}>Período da competição</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setPicking('start')} accessibilityRole="button" accessibilityLabel={`Início: ${formatDay(startsAt)}`}>
          <Text style={styles.dateLabel}>Início</Text>
          <Text style={styles.dateValue}>{formatDay(startsAt)}</Text>
        </TouchableOpacity>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Sem data de término</Text>
          <Switch value={endsAt === null} onValueChange={(v) => setEndsAt(v ? null : (endsAt ?? startsAt))} trackColor={{ true: colors.brand }} accessibilityLabel="Sem data de término" />
        </View>
        {endsAt !== null && (
          <TouchableOpacity style={styles.dateButton} onPress={() => setPicking('end')} accessibilityRole="button" accessibilityLabel={`Fim: ${formatDay(endsAt)}`}>
            <Text style={styles.dateLabel}>Fim</Text>
            <Text style={styles.dateValue}>{formatDay(endsAt)}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.hint}>Conta 1 ponto por dia em que o membro treinou, a partir do dia em que entrou no grupo.</Text>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button title={editingId ? 'Salvar' : 'Criar grupo'} loading={saving} onPress={save} />
      </ScrollView>

      <DatePickerModal
        visible={picking === 'start'}
        title="Início da competição"
        value={startsAt}
        maxDate={farFuture()}
        onConfirm={(d) => { setStartsAt(d); if (endsAt && endsAt < d) setEndsAt(d); setPicking(null); }}
        onClose={() => setPicking(null)}
      />
      <DatePickerModal
        visible={picking === 'end'}
        title="Fim da competição"
        value={endsAt ?? startsAt}
        minDate={startsAt}
        maxDate={farFuture()}
        onConfirm={(d) => { setEndsAt(d); setPicking(null); }}
        onClose={() => setPicking(null)}
      />
    </SafeAreaView>
  );
}
```

`styles.ts` (chaves usadas): `container, loading, header, back, title, scroll, coverBadge, coverBadgeText, switchRow, switchText, label, hint, dateButton, dateLabel, dateValue, error`. Alvos de 44 px (`dateButton` com `minHeight: 52`).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 4: Commit**

```bash
git add FrontEndTorv/src/screens/GroupEditor
git commit -m "feat(groups): group editor (create/edit, cover, period)" -- FrontEndTorv/src/screens/GroupEditor
```

---

### Task 13: Frontend — GroupManage e JoinGroup

**Recruit:** Torv Frontend (com `/frontend-design`) · **Files:**
- Modify: `FrontEndTorv/src/screens/GroupManage/index.tsx`, `FrontEndTorv/src/screens/JoinGroup/index.tsx`
- Create: `FrontEndTorv/src/screens/GroupManage/styles.ts`, `FrontEndTorv/src/screens/JoinGroup/styles.ts`

**Interfaces:**
- Consumes: `groupsApi.*`, `ConfirmModal`, `Input`, `GroupCover`, `normalizeCode`/`isValidCode`/`TOKEN_LENGTH`, `describeError`, `periodLabel`, `expo-linking` (`Linking.createURL`), `Share` do React Native.
- Produces: telas `GroupManage { groupId }` e `JoinGroup { token? }`.

- [ ] **Step 1: `GroupManage`**

`FrontEndTorv/src/screens/GroupManage/index.tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { ArrowLeft, Check, X, Trash2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { ConfirmModal } from '../../components/ConfirmModal';
import { groupsApi, type GroupDetailData, type PendingLists, type RankingRow } from '../../services/groups';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Confirm = null | { kind: 'remove'; row: RankingRow } | { kind: 'regenerate' } | { kind: 'revoke' } | { kind: 'delete' };

export default function GroupManage() {
  const navigation = useNavigation<AppNavigation>();
  const { groupId } = useRoute<RouteProp<AppStackParamList, 'GroupManage'>>().params;
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [pending, setPending] = useState<PendingLists>({ requests: [], invites: [] });
  const [members, setMembers] = useState<RankingRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // chave da ação em andamento
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = async () => {
    try {
      const [detail, lists, ranking] = await Promise.all([groupsApi.get(groupId), groupsApi.pending(groupId), groupsApi.ranking(groupId)]);
      if (!detail.is_owner) return navigation.goBack(); // só o dono gerencia
      setGroup(detail);
      setPending(lists);
      setMembers(ranking);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };
  useFocusEffect(useCallback(() => { load(); }, [groupId]));

  const run = async (key: string, action: () => Promise<void>, okText?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      if (okText) setMessage({ text: okText, error: false });
    } catch (error) {
      setMessage({ text: describeError(error, 'Usuário não encontrado.'), error: true });
    } finally {
      setBusy(null);
    }
  };

  const invite = () => run('invite', async () => {
    const value = username.trim().replace(/^@/, '');
    if (!value) throw new Error('empty');
    await groupsApi.invite(groupId, value);
    setUsername('');
    await load();
  }, 'Convite enviado.');

  const resolve = (id: string, accept: boolean) => run(`res-${id}`, async () => {
    if (accept) await groupsApi.accept(id);
    else await groupsApi.decline(id);
    await load();
  });

  const cancelInvite = (id: string) => run(`can-${id}`, async () => { await groupsApi.cancelInvitation(id); await load(); });

  const createLink = (okText: string) => run('link', async () => {
    await groupsApi.createInviteLink(groupId);
    await load();
  }, okText);

  const share = () => run('share', async () => {
    if (!group?.invite_token) return;
    const url = Linking.createURL(`join/${group.invite_token}`);
    await Share.share({ message: `Entre no meu grupo "${group.name}" no TORV.\nCódigo: ${group.invite_token}\nLink: ${url}` });
  });

  const doConfirm = () => run('confirm', async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'remove') { await groupsApi.removeMember(groupId, c.row.user_id); await load(); }
    if (c.kind === 'regenerate') { await groupsApi.createInviteLink(groupId); await load(); setMessage({ text: 'Novo código gerado. O anterior parou de funcionar.', error: false }); }
    if (c.kind === 'revoke') { await groupsApi.revokeInviteLink(groupId); await load(); setMessage({ text: 'Link desativado.', error: false }); }
    if (c.kind === 'delete') { await groupsApi.remove(groupId); navigation.popTo('Tabs', { screen: 'Groups' }); }
  });

  const confirmCopy = {
    remove: (c: Extract<Confirm, { kind: 'remove' }>) => ({ title: `Remover ${c.row.name}?`, message: 'A pessoa sai do grupo e perde a contagem de dias.', label: 'Remover' }),
    regenerate: () => ({ title: 'Gerar novo código?', message: 'O código e o link atuais deixam de funcionar.', label: 'Gerar novo' }),
    revoke: () => ({ title: 'Desativar o link?', message: 'Ninguém mais entra por código ou link até você gerar um novo.', label: 'Desativar' }),
    delete: () => ({ title: 'Excluir o grupo?', message: 'O grupo, o ranking e a capa são apagados para todos. Isso não pode ser desfeito.', label: 'Excluir' }),
  };
  const copy = confirm ? (confirmCopy[confirm.kind] as (c: any) => { title: string; message: string; label: string })(confirm) : null;

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={26} />
      </TouchableOpacity>
      <Text style={styles.title}>Gerenciar grupo</Text>
    </View>
  );

  if (status !== 'ready' || !group) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        {status === 'loading' ? <ActivityIndicator color={colors.brand} style={styles.loading} /> : (
          <View style={styles.centered}>
            <Text style={styles.muted}>Não foi possível carregar.</Text>
            <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); load(); }} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const personRow = (p: { id: string; name: string; username: string }, actions: React.ReactNode) => (
    <View key={p.id} style={styles.personRow}>
      <View style={styles.personBody}>
        <Text style={styles.personName} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.personUser} numberOfLines={1}>@{p.username}</Text>
      </View>
      {actions}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {message && <Text style={message.error ? styles.error : styles.ok}>{message.text}</Text>}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Convidar por username</Text>
          <Input value={username} onChangeText={setUsername} placeholder="@username" autoCapitalize="none" autoCorrect={false} maxLength={100} accessibilityLabel="Username de quem convidar" />
          <Button title="Convidar" loading={busy === 'invite'} disabled={!username.trim()} onPress={invite} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Código e link de convite</Text>
          {group.invite_token ? (
            <>
              <Text style={styles.code} selectable accessibilityLabel={`Código ${group.invite_token.split('').join(' ')}`}>{group.invite_token}</Text>
              <Button title="Compartilhar" loading={busy === 'share'} onPress={share} />
              <Button title="Gerar novo código" outline onPress={() => setConfirm({ kind: 'regenerate' })} />
              <Button title="Desativar link" outline danger onPress={() => setConfirm({ kind: 'revoke' })} />
            </>
          ) : (
            <>
              <Text style={styles.muted}>Nenhum link ativo. Gere um código para convidar quem estiver fora do app.</Text>
              <Button title="Gerar código" loading={busy === 'link'} onPress={() => createLink('Código gerado.')} />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Pedidos de entrada ({pending.requests.length})</Text>
          {pending.requests.length === 0 && <Text style={styles.muted}>Nenhum pedido pendente.</Text>}
          {pending.requests.map((r) => personRow(r, (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => resolve(r.id, true)} disabled={busy === `res-${r.id}`} accessibilityRole="button" accessibilityLabel={`Aceitar ${r.name}`}><Check color={colors.brand} size={22} /></TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => resolve(r.id, false)} disabled={busy === `res-${r.id}`} accessibilityRole="button" accessibilityLabel={`Recusar ${r.name}`}><X color={colors.error} size={22} /></TouchableOpacity>
            </View>
          )))}
          {pending.invites.length > 0 && <Text style={styles.subTitle}>Convites enviados</Text>}
          {pending.invites.map((r) => personRow(r, (
            <TouchableOpacity style={styles.iconButton} onPress={() => cancelInvite(r.id)} disabled={busy === `can-${r.id}`} accessibilityRole="button" accessibilityLabel={`Cancelar convite de ${r.name}`}><X color={colors.textSecondary} size={22} /></TouchableOpacity>
          )))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Membros ({members.length})</Text>
          {members.map((m) => personRow({ id: m.user_id, name: m.name, username: m.username }, (
            m.is_me ? <Text style={styles.you}>você</Text> : (
              <TouchableOpacity style={styles.iconButton} onPress={() => setConfirm({ kind: 'remove', row: m })} accessibilityRole="button" accessibilityLabel={`Remover ${m.name}`}><Trash2 color={colors.error} size={20} /></TouchableOpacity>
            )
          )))}
        </Card>

        <Button title="Excluir grupo" danger outline onPress={() => setConfirm({ kind: 'delete' })} />
      </ScrollView>

      <ConfirmModal
        visible={!!copy}
        title={copy?.title ?? ''}
        message={copy?.message ?? ''}
        confirmLabel={copy?.label ?? ''}
        danger={confirm?.kind !== 'regenerate'}
        loading={busy === 'confirm'}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}
```

`styles.ts` (chaves usadas): `container, loading, centered, muted, header, back, title, scroll, card, sectionTitle, subTitle, code` (código grande, monoespaçado/espaçado, `fontVariant: ['tabular-nums']`, legível), `personRow, personBody, personName, personUser, rowActions, iconButton` (44×44), `you, error, ok`.

Nota de design: o código tem 8 caracteres de um alfabeto sem ambiguidade; mostrar com espaçamento entre letras (`letterSpacing`) e `selectable`. No web o `Share.share` pode não existir: se lançar erro, `run` mostra a mensagem de erro e o código continua visível na tela para copiar.

- [ ] **Step 2: `JoinGroup`**

`FrontEndTorv/src/screens/JoinGroup/index.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { GroupCover } from '../../components/GroupCover';
import { groupsApi, type JoinPreview } from '../../services/groups';
import { normalizeCode, isValidCode, TOKEN_LENGTH } from '../../utils/groupLink';
import { describeError } from '../../utils/groupErrors';
import { periodLabel } from '../../utils/groupPeriod';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const NOT_FOUND = 'Código inválido ou link desativado.';

export default function JoinGroup() {
  const navigation = useNavigation<AppNavigation>();
  const initial = useRoute<RouteProp<AppStackParamList, 'JoinGroup'>>().params?.token ?? '';
  const [code, setCode] = useState(initial);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [looking, setLooking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (raw: string) => {
    const normalized = normalizeCode(raw);
    setPreview(null);
    if (!isValidCode(normalized)) return setError(`Código inválido. São ${TOKEN_LENGTH} caracteres, sem 0, O, 1, I e L.`);
    setLooking(true);
    setError(null);
    try {
      setPreview(await groupsApi.joinPreview(normalized));
    } catch (err) {
      setError(describeError(err, NOT_FOUND));
    } finally {
      setLooking(false);
    }
  };

  // Veio por link (torv://join/CODIGO): já mostra a prévia.
  useEffect(() => { if (initial) lookup(initial); }, [initial]);

  const join = async () => {
    if (!preview) return;
    if (preview.is_member) return navigation.replace('GroupDetail', { groupId: preview.group.id });
    setJoining(true);
    setError(null);
    try {
      const groupId = await groupsApi.join(normalizeCode(code));
      navigation.replace('GroupDetail', { groupId });
    } catch (err) {
      setError(describeError(err, NOT_FOUND));
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <Text style={styles.title}>Entrar com código</Text>
      </View>

      <View style={styles.body}>
        <Input
          label="Código do convite"
          value={code}
          onChangeText={(t) => { setCode(t); setPreview(null); setError(null); }}
          onSubmitEditing={() => lookup(code)}
          placeholder="Ex.: AB3DK7MN"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          returnKeyType="search"
        />
        <Button title="Buscar grupo" outline loading={looking} disabled={!code.trim()} onPress={() => lookup(code)} />

        {looking && <ActivityIndicator color={colors.brand} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {preview && (
          <View style={styles.preview}>
            <GroupCover uri={preview.group.cover_url} name={preview.group.name} height={140} />
            <Text style={styles.name}>{preview.group.name}</Text>
            <Text style={styles.meta}>
              {preview.group.member_count} {preview.group.member_count === 1 ? 'membro' : 'membros'} · {periodLabel(preview.group)}
            </Text>
            {preview.ended ? (
              <Text style={styles.error}>Este grupo já foi encerrado e não aceita novos membros.</Text>
            ) : (
              <Button title={preview.is_member ? 'Abrir grupo' : 'Entrar no grupo'} loading={joining} onPress={join} />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
```

`styles.ts` (chaves usadas): `container, header, back, title, body, error, preview, name, meta`.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` → sem erros.

- [ ] **Step 4: Commit**

```bash
git add FrontEndTorv/src/screens/GroupManage FrontEndTorv/src/screens/JoinGroup
git commit -m "feat(groups): group management and join-by-code screens" -- FrontEndTorv/src/screens/GroupManage FrontEndTorv/src/screens/JoinGroup
```

---

### Task 14: Frontend — editar e excluir treino (WorkoutSummary e WorkoutEdit)

**Recruit:** Torv Frontend (com `/frontend-design`) · **Files:**
- Modify: `FrontEndTorv/src/screens/WorkoutSummary/index.tsx`, `FrontEndTorv/src/screens/WorkoutSummary/styles.ts`, `FrontEndTorv/src/screens/Workouts/History.tsx`
- Modify: `FrontEndTorv/src/screens/WorkoutEdit/index.tsx` (substitui o esqueleto); Create: `FrontEndTorv/src/screens/WorkoutEdit/styles.ts`

**Interfaces:**
- Consumes: `workoutsApi.getSession/updateSession/deleteSession`, `toEditRows/toEditPayload/EditRow` (Task 8), `bumpSessionsVersion/getSessionsVersion`, `ConfirmModal`, `describeError`.
- Produces: botões **Editar** e **Excluir** no resumo de treino salvo (`sessionId`); tela `WorkoutEdit { sessionId }`.

- [ ] **Step 1: `WorkoutSummary` — Editar e Excluir (só no modo histórico)**

Em `WorkoutSummary/index.tsx`:
- Imports novos: `useRef` e `useCallback` do `react`; `useFocusEffect` de `@react-navigation/native`; `ConfirmModal`; `bumpSessionsVersion`, `getSessionsVersion` de `../../utils/sessionsVersion`; `describeError` de `../../utils/groupErrors`.
- Estado novo: `const [reloadTick, setReloadTick] = useState(0); const [confirmDelete, setConfirmDelete] = useState(false); const [deleting, setDeleting] = useState(false); const [deleteError, setDeleteError] = useState<string | null>(null); const seenVersion = useRef(getSessionsVersion());`
- Recarregar ao voltar da edição: acrescentar `reloadTick` às dependências do `useEffect` que carrega (`[sessionId, userId, reloadTick]`) e, logo antes dele:

```tsx
  // Volta de WorkoutEdit: o resumo mostra o treino já editado.
  useFocusEffect(useCallback(() => {
    if (sessionId && seenVersion.current !== getSessionsVersion()) {
      seenVersion.current = getSessionsVersion();
      setReloadTick((t) => t + 1);
    }
  }, [sessionId]));
```
- Excluir:

```tsx
  const deleteSession = async () => {
    if (!sessionId) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await workoutsApi.deleteSession(sessionId);
      bumpSessionsVersion();
      setConfirmDelete(false);
      navigation.goBack();
    } catch (error) {
      setConfirmDelete(false);
      setDeleteError(describeError(error, 'Treino não encontrado.'));
    } finally {
      setDeleting(false);
    }
  };
```
- Onde hoje está `{(status === 'saved' || status === 'history') && (<Button title="Concluir" .../>)}`, acrescentar, **só quando `status === 'history'`**, depois do botão:

```tsx
        {status === 'history' && (
          <>
            {deleteError && <Text style={styles.error}>{deleteError}</Text>}
            <Button title="Editar treino" outline onPress={() => navigation.navigate('WorkoutEdit', { sessionId: sessionId as string })} />
            <Button title="Excluir treino" outline danger onPress={() => setConfirmDelete(true)} />
          </>
        )}
```
- Antes de fechar o `SafeAreaView` principal, o modal:

```tsx
      <ConfirmModal
        visible={confirmDelete}
        title="Excluir este treino?"
        message="O treino sai do histórico e os dias dele deixam de contar nos seus grupos. Isso não pode ser desfeito."
        confirmLabel="Excluir"
        danger
        loading={deleting}
        onConfirm={deleteSession}
        onCancel={() => setConfirmDelete(false)}
      />
```
O treino recém-finalizado (sem `sessionId`) **não** mostra esses botões.

- [ ] **Step 2: `History` — recarregar quando um treino foi editado ou apagado**

Em `Workouts/History.tsx`: importar `getSessionsVersion` e criar `const seenVersion = useRef(getSessionsVersion());`. No `useFocusEffect`, antes do `if (loadedKey...)`:

```tsx
    if (seenVersion.current !== getSessionsVersion()) {
      // Treino editado ou apagado: o refreshTop só traz o que é novo, então recarrega do zero.
      seenVersion.current = getSessionsVersion();
      loadFirst(type, period);
      return;
    }
```

- [ ] **Step 3: `WorkoutEdit`**

`FrontEndTorv/src/screens/WorkoutEdit/index.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft, Trash2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { workoutsApi, type SessionDetail } from '../../services/workouts';
import { toEditRows, toEditPayload, type EditRow } from '../../utils/setEdit';
import { bumpSessionsVersion } from '../../utils/sessionsVersion';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

export default function WorkoutEdit() {
  const navigation = useNavigation<AppNavigation>();
  const { sessionId } = useRoute<RouteProp<AppStackParamList, 'WorkoutEdit'>>().params;
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await workoutsApi.getSession(sessionId);
        setDetail(d);
        setRows(toEditRows(d.sets));
        setStatus('ready');
      } catch (err) {
        setStatus(axios.isAxiosError(err) && err.response?.status === 404 ? 'missing' : 'error');
      }
    })();
  }, [sessionId]);

  const change = (id: string, patch: Partial<EditRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!detail) return;
    const result = toEditPayload(detail.duration_sec, rows);
    if (!result.ok) return setError(result.error);
    setSaving(true);
    setError(null);
    try {
      await workoutsApi.updateSession(sessionId, result.body);
      bumpSessionsVersion();
      navigation.goBack();
    } catch (err) {
      setError(describeError(err, 'Treino não encontrado.'));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.error} size={26} />
      </TouchableOpacity>
      <Text style={styles.title}>Editar treino</Text>
    </View>
  );

  if (status !== 'ready' || !detail) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        {status === 'loading' ? <ActivityIndicator color={colors.brand} style={styles.loading} /> : (
          <View style={styles.centered}>
            <Text style={styles.muted}>{status === 'missing' ? 'Treino não encontrado.' : 'Não foi possível carregar o treino.'}</Text>
            <Button title="Voltar" outline onPress={() => navigation.goBack()} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.name}>{detail.title}</Text>
        <Text style={styles.note}>A data do treino não pode ser alterada. Para tirar uma série, use a lixeira.</Text>

        {rows.map((r) => (
          <Card key={r.id} style={styles.setCard}>
            <View style={styles.setHeader}>
              <Text style={styles.setLabel} numberOfLines={2}>{r.label}</Text>
              <TouchableOpacity style={styles.remove} onPress={() => setRows((prev) => prev.filter((x) => x.id !== r.id))} accessibilityRole="button" accessibilityLabel={`Remover ${r.label}`}>
                <Trash2 color={colors.error} size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tempo (s)</Text>
                <TextInput style={styles.input} value={r.durationText} onChangeText={(t) => change(r.id, { durationText: t })} keyboardType="number-pad" maxLength={4} accessibilityLabel={`Tempo em segundos, ${r.label}`} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Carga (kg)</Text>
                <TextInput style={styles.input} value={r.weightText} onChangeText={(t) => change(r.id, { weightText: t })} keyboardType="decimal-pad" maxLength={7} placeholder="Sem carga" placeholderTextColor={colors.textSecondary} accessibilityLabel={`Carga em quilos, ${r.label}`} />
              </View>
            </View>
          </Card>
        ))}

        {error && <Text style={styles.error}>{error}</Text>}
        <Button title="Salvar alterações" loading={saving} onPress={save} />
        <Button title="Cancelar" outline disabled={saving} onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}
```

`styles.ts` (chaves usadas): `container, loading, centered, muted, header, back, title, scroll, name, note, setCard, setHeader, setLabel, remove` (44×44), `fields, field, fieldLabel, input` (altura ≥ 44, fundo `colors.surfaceAlt`, Sora), `error`. Em `WorkoutSummary/styles.ts`, nenhum estilo novo é obrigatório (os botões reutilizam o espaçamento do `scroll`).

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → sem erros. `node --test src/utils/*.test.mjs` → tudo PASS.

- [ ] **Step 5: Commit**

```bash
git add FrontEndTorv/src/screens/WorkoutSummary/index.tsx FrontEndTorv/src/screens/Workouts/History.tsx FrontEndTorv/src/screens/WorkoutEdit
git commit -m "feat(workouts): edit and delete saved workouts from the summary" -- FrontEndTorv/src/screens/WorkoutSummary/index.tsx FrontEndTorv/src/screens/Workouts/History.tsx FrontEndTorv/src/screens/WorkoutEdit
```

---

### Task 15: Teste da etapa de Frontend (usabilidade no navegador)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-groups-competition-frontend-2026-10-06.md`

- [ ] **Step 1: Automatizados**

Em `FrontEndTorv`: `node --test src/utils/*.test.mjs` e `npx tsc --noEmit` → verdes; anotar os totais (antes: 32 testes do ciclo anterior mais os novos).

- [ ] **Step 2: Subir o Expo web (Maestro)**

O Maestro sobe o Expo web no terminal "Expo" (porta 8081) e o backend segue no Furnace. O portal "QA Home" aponta para `http://localhost:8081`. A usabilidade roda **no navegador, pelo portal do Maestri**; o token nunca sai do navegador.

- [ ] **Step 3: Fluxos reais (duas contas: A dono, B convidado), um por um, com captura**

1. **Aba:** a barra de baixo tem 5 abas e cabe em 320 px de largura (redimensionar a janela); "Grupos" fica ativa ao tocar.
2. **Criar:** Criar grupo com nome, capa (arquivo do disco), público, início hoje e fim em 7 dias → abre o `GroupDetail` com a capa, o período ("7 dias restantes"), o ranking com A em 1º. Repetir com o toggle **Sem data de término** → "Sem data de término". Nome vazio → mensagem na própria tela; fim antes do início impossível de escolher.
3. **Editar:** trocar nome, capa e fim → o detalhe reflete ao voltar; trocar o período muda o rótulo.
4. **Convite por username:** A convida B; B (outro navegador/perfil) vê o card **Convites recebidos** na aba Grupos, aceita e cai no `GroupDetail`; username inexistente → "Usuário não encontrado."; convidar quem já é membro → mensagem de "já está neste grupo".
5. **Pedido de entrada:** B busca o grupo em **Descobrir**, abre, **Pedir para entrar** → "Pedido enviado"; A vê o pedido em **Gerenciar** e aceita; B passa a ver o ranking. Grupo privado não aparece na busca.
6. **Código/link:** A gera o código, **Compartilhar** (no web o `Share` pode falhar: o código continua na tela). B abre **Entrar com código**, digita em minúsculas e com espaço → prévia → **Entrar**. Código errado → mensagem; A **Gerar novo código** → o antigo dá "Código inválido ou link desativado."; **Desativar link** idem. Abrir `/join/<codigo>` do deep link no navegador **não** quebra o app.
7. **Ranking vivo:** B grava um treino real (aba Treinos) → o ranking de B sobe para 1 dia; um 2º treino no mesmo dia não muda os dias; **apagar** um treino pelo resumo (Histórico → treino → **Excluir treino**) com outro no mesmo dia mantém o ponto; apagar o único o zera. O treino some do histórico **sem** puxar para atualizar; a Home atualiza streak e calorias.
8. **Editar treino:** Histórico → treino → **Editar treino**: mudar tempo e carga de uma série, remover outra, salvar → o resumo reflete; "Tempo" vazio ou "Carga" com texto → mensagem na tela e nada é salvo; não existe campo de data.
9. **Sair e remover:** B sai do grupo (modal de confirmação) e some do ranking; A remove um membro em **Gerenciar** (modal); o dono não vê "Sair do grupo".
10. **Excluir grupo:** A exclui em **Gerenciar** (modal) → volta para a aba Grupos sem o card.
11. **Estados:** grupo que começa no futuro mostra "Começa em N dias" e o aviso de ranking zerado; grupo encerrado (ajustar `ends_at` para ontem) mostra "Encerrado em dd/mm", sem botão de entrar, e some do Descobrir. Erros de rede (derrubar o backend por um instante, só se o Maestro autorizar) mostram "Tentar de novo".
12. **Acessibilidade e layout:** todos os botões e ícones com alvo ≥ 44 px, `accessibilityLabel` nos ícones, nada cortado em 320 px, teclado não cobre o campo ativo, nenhum `Alert.alert` (todas as confirmações são modais próprios).

- [ ] **Step 4: Relatório e limpeza**

Gravar `docs/qa-groups-competition-frontend-2026-10-06.md` com PASS/FAIL por fluxo, capturas e achados com severidade. Apagar os dados de teste. **Falha → o ciclo não avança**; o Maestro reabre só a task responsável (8 a 14) e a rodada seguinte vira `-round2`.

- [ ] **Step 5: Commit**

```bash
git add docs/qa-groups-competition-frontend-2026-10-06.md
git commit -m "docs(qa): groups competition frontend stage report" -- docs/qa-groups-competition-frontend-2026-10-06.md
```

---

### Task 16: Teste completo (HEAD, todas as camadas)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-groups-competition-full-2026-10-06.md`

- [ ] **Step 1: Estado final**

`git status` limpo para os arquivos da feature; `git log` com os commits das Tasks 1 a 15. Backend no Furnace atualizado e Expo web no ar.

- [ ] **Step 2: Rodada completa**

1. `npm test` (backend) e `node --test src/utils/*.test.mjs` + `npx tsc --noEmit` (frontend): totais antes e depois.
2. **Regressão:** módulo de treinos (rotinas, sessão, resumo, cargas, histórico com períodos), Home (streak, calorias, dieta), Perfil (foto de perfil: upload continua passando pela lib `imageUpload`), dieta, login, boas-vindas. Cada um com pelo menos um fluxo real no navegador.
3. **Contrato + usabilidade da feature** inteiros, repetindo os Steps 3 a 5 da Task 7 (contrato, ranking com os valores esperados, editar e excluir treino) e os 12 fluxos da Task 15, agora sobre o estado final.
4. **Consistência:** a consulta de consistência da Task 7 devolve 0 linhas depois de todo o teste.

- [ ] **Step 3: Relatório e commit**

Gravar `docs/qa-groups-competition-full-2026-10-06.md` e commitar só ele (`git add` + `git commit -- <arquivo>`, mensagem `docs(qa): groups competition full test report`). **Falha → volta ao passo 1 do ciclo** (nova rodada `-round2`, só na camada que falhou).

---

### Task 17: Security (só com os testes 100% verdes)

**Recruit:** Torv Security · **Files:**
- Create: `docs/security-groups-competition-2026-10-06.md`

- [ ] **Step 1: Revisar o diff inteiro pela lente do OWASP Top 10**

`git diff <commit anterior à Task 1>..HEAD` (backend, banco e frontend). Pontos obrigatórios:
- **A01 Controle de acesso:** toda rota filtra por `userId` do token; grupo privado para não membro → 404; `PATCH`/`DELETE`/`cover`/`invite-link`/`requests` só do dono; `accept`/`decline` só do convidado (INVITE) ou do dono (REQUEST); `PUT`/`DELETE` de sessão só do dono da atividade e `id` de série de outra atividade → 400; `removeMember` não deixa membro comum remover outro.
- **A02/A04 Falhas de projeto e criptografia:** código de convite de 8 caracteres (`crypto.randomInt`), rate limit em `/groups/join/*`, revogação e regeneração; o link equivale a um convite do dono (documentado).
- **A03 Injeção:** SQL cru só com `Prisma.sql`/template parametrizado (`recomputeRanking`, `discover`); `ILIKE` com `%` e `_` escapados; nenhum identificador vindo do cliente no SQL.
- **A05 Configuração:** a tabela nova tem RLS + policy do `torv_api`; `anon`/`authenticated` sem acesso; `profilePhotos/` fora do git.
- **A08 Integridade / upload:** tipo declarado + assinatura do arquivo, limite de 5 MB, nome gerado no servidor (o nome enviado nunca entra no caminho), `deleteImage` preso à pasta de uploads por `basename`; troca e exclusão apagam o arquivo antigo.
- **A09 Registro:** erros 5xx não vazam detalhe; nada sensível em log.
- **Frontend:** nenhum segredo, chamadas só à nossa API, `joinTokenFromUrl` aceita só o formato do código (sem navegar para destino arbitrário), nenhum `Alert.alert` com dado do servidor, sem `dangerouslySetInnerHTML`.
- **Trapaça no ranking:** data do treino imutável; contagem só com `start_time >= joined_at`; `started_at` no futuro e anterior a 2026-01-01 continuam recusados.

- [ ] **Step 2: Relatório e commit**

Gravar `docs/security-groups-competition-2026-10-06.md` (PASS/FAIL por item, achados com severidade e correção sugerida) e commitar só ele (`docs(security): groups competition OWASP review`). **Falha → volta ao passo 1 do ciclo, só nas camadas apontadas**; os testes rodam de novo só no que mudou (nova rodada `-round2`, e `-round2` do Security). A feature só termina com Testing e Security verdes na mesma rodada.

---

### Task 18: Fechamento — `revisar4.md`

**Quem:** Maestro (esta sessão) · **Files:**
- Create: `revisar4.md` (raiz do repositório; **não** entra em commit, como os outros `revisar*.md`)

- [ ] **Step 1: Escrever o `revisar4.md`** no mesmo formato do `revisar3.md`:

1. **Título e cabeçalho:** `# Revisar 4 — Grupos e competição`; branch `feat/workout-module` (sem push); links da spec e deste plano.
2. **Status:** tabela por etapa (Database, Backend, Frontend, Teste completo, Security) com o resultado de cada rodada e quais recruits rodaram (Sonnet [high]); contagem dos testes automatizados antes e depois; total de arquivos alterados por camada.
3. **O que mudou para o usuário:** aba Grupos; criar/editar grupo com capa, visibilidade e período (com ou sem término); convite por username, pedido de entrada, código e link `torv://`; ranking por dias de treino; editar e excluir treino salvo; regras de contagem em linguagem simples.
4. **Causas encontradas e decisões:** o que apareceu durante a execução (inclua as duas mudanças de spec feitas ao planejar: `PUT` identifica a série por `id` e a edição fica na tela `WorkoutEdit`; "Excluir grupo" fica em Gerenciar; `discover` pagina por deslocamento; o código tem 8 caracteres).
5. **Arquivos editados/criados**, por camada, em tabelas `Arquivo | O quê` (Database, Backend: libs/repositórios/controllers/rotas/testes, Frontend: serviços/utils/componentes/telas/rotas, Documentos: spec, plano, relatórios QA e Security).
6. **Pendências e riscos:** link `https` universal (fase 2: depende de domínio e backend públicos), `torv://` só em build de desenvolvimento (não no Expo Go), notificações, mais de um admin, cache do ranking (a query de recálculo está isolada para isso), qualquer LOW/INFO que ficou.
7. **Como testar no celular:** o Expo só sobe depois do ciclo completo e o Maestro avisa o IP.

- [ ] **Step 2: Atualizar a nota do canvas** (`maestri` skill) com o resultado final e o link do `revisar4.md`.

---

## Acompanhamento no canvas (Maestro, durante toda a execução)

Antes da Task 1, o Maestro cria uma nota (`maestri note write`) **"Feature- Groups Competition"** com: nome da feature, etapa atual (Edit / Test / Security), qual recruit está rodando, resultado da última rodada (PASS/FAIL e o relatório em `docs/`) e, em retrabalho, qual camada foi reaberta e por quê. A nota é atualizada a **cada** transição de etapa, não só no início e no fim.

## Self-review do plano

- **Cobertura da spec:** modelo de dados (Task 1); `recomputeRanking`/`recomputeGroup` e os 4 pontos de chamada (Tasks 3, 4, 5, 6); rotas de grupos (Task 4); convites, pedidos e link (Task 5); `PUT`/`DELETE` de treino (Task 6); `imageUpload` (Task 2); aba e telas (Tasks 9 a 14); link `torv://` e `scheme` (Tasks 8 e 9); testes (todas as tasks, Task 7, 15, 16); segurança (Task 17); fora do escopo respeitado.
- **Mudanças em relação à spec (registradas no `revisar4.md`):** `PUT` por `id` de série, edição em `WorkoutEdit`, "Excluir grupo" em Gerenciar, `cursor` do `discover` como deslocamento, token de 8 caracteres.
- **Sem placeholders:** cada passo de código traz o código; o único trecho que o recruit completa é o tratamento de permissão da galeria, copiado do `Profile` (Task 12, passo 1), e os `styles.ts`, que passam por `/frontend-design` com as chaves listadas.
- **Consistência de tipos:** `recomputeRanking(db, userId)`, `addMember(db, groupId, userId)`, `fail(reply, code)`, `FAILURES`, `groupToday`/`isEnded`, `joinTokenFromUrl`, `EditRow`/`toEditPayload`, `sessionsVersion` e `groupsApi.*` usam os mesmos nomes e assinaturas em todas as tasks que os consomem.
