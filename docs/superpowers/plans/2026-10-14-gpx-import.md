# Importador de GPX (Corrida e Caminhada) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Neste projeto a execução é pelos recruits do Maestri (`maestri ask`), um por vez, não por subagentes internos** (ver Global Constraints).

**Goal:** criar rotinas de Corrida e Caminhada e importar nelas o `.gpx` de cada treino, com métricas, parciais, calorias e traçado. A atividade passa a contar no ranking, no streak, no calendário e no perfil de membro.

**Architecture:**
- **Banco:** a rotina ganha `activity_type`; `activities` ganha o CHECK do tipo e um índice único parcial (deduplicação); `activity_gps_data` troca o `route_json` sem uso por colunas tipadas.
- **Backend:** libs puras `gpsMetrics` (cálculo) e `gpsValidation` (regras); `activityWrites` (fila, lock e teto por dia, agora somando todos os tipos, compartilhados com a musculação); `gps.repository`; plugin `gps.routes.js` em `/activities/gps`, com rate limit e `bodyLimit` de 2 MiB. O servidor **nunca lê XML**: o app extrai os pontos e manda JSON compacto.
- **Frontend:** parser `utils/gpx.ts` (sem dependência), leitura do arquivo por plataforma (`readPickedFile` / `.web`), telas `GpxImport` e `GpsActivity`, componentes `RouteTrace` (SVG) e `ActivityIcon`. O tipo da rotina entra no `RoutineEditor` e no card de Meus treinos.

**Tech Stack:**
- **Backend:** Node 24, Fastify 5 + TypeBox, Prisma 6.4.1, `@fastify/rate-limit`, `node:test` (base desta etapa = total do fim do perfil de membro, **272**).
- **Frontend:** Expo 57, React Native 0.86, react-native-web 0.21, `react-native-svg` (já instalado), `expo-document-picker` e `expo-file-system` (novos). Testes com `node --test src/utils/*.test.mjs` (base = total do fim do perfil de membro) e `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-10-14-gpx-import-design.md`. Depende do perfil de membro (`2026-10-14-member-profile-design.md`), já implementado na mesma branch.

## Global Constraints

- Branch `feat/perfil-terceiros-gpx`. **Nada de push.**
- **Execução estritamente sequencial:** um recruit por vez, via `maestri ask`. Uma etapa só começa com o teste da anterior verde.
- **Commits:**
  - só os arquivos da tarefa, com pathspec explícito;
  - nunca entram em commit `BackEndTorv/package-lock.json` (mudança antiga, fora da feature), `revisar*.md`, `.env` e o `.gpx` da raiz;
  - o `FrontEndTorv/package-lock.json` entra **só** na Task 9, junto com o `package.json`;
  - linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **404, nunca 403:** recurso de outro usuário, rotina que não é de GPS e atividade que não é de GPS respondem 404.
- **Nullable num corpo de request:** `Type.Unsafe({ type: ['number','null'] })`, nunca `Type.Union` (bug do Ajv `coerceTypes`).
- **UUID:** o `Uuid`/`IdParams` de `workout.schemas.js`.
- **Tipos:** `STRENGTH` (Musculação), `RUN` (Corrida) e `WALK` (Caminhada). Bike (`RIDE`) só aparece no parser, para recusar o arquivo.
- **Regras da importação:**
  - início nas últimas 72 h e a partir de 2026-01-01; fim até agora + 5 min;
  - teto de 5 atividades por dia UTC **somando todos os tipos**;
  - a mesma atividade de GPS (mesmo `start_time`) → 409 com `activity_id`.
- **Privacidade:**
  - o `.gpx` não sai do aparelho;
  - o servidor guarda só o resumo, as parciais e a rota simplificada (até 500 pontos, 5 casas);
  - rota, FC, cadência e calorias só para o dono.
- **Backend no Furnace** (porta 3000, nodemon): só o Maestro para ou reinicia. **Antes da Task 1, o Maestro para o Furnace**, porque o `prisma generate` no Windows falha com `EPERM` enquanto um Node usa o engine. Depois da Task 1, o Maestro sobe o Furnace de novo.
- **Frontend:**
  - ler a doc versionada do Expo (`FrontEndTorv/AGENTS.md`);
  - `/frontend-design` nas telas novas;
  - pt-BR, 44 px, 320 px;
  - confirmações no `ConfirmModal`;
  - nada de botão dentro de botão.
  - Utilitários testados não fazem import relativo em runtime (`import type` pode).
- **Usabilidade no Expo web** pelo portal **TorvWeb**. O seletor de arquivo do navegador não é automatizável: o QA injeta o arquivo (Task 13). O Maestro reinicia o Expo depois da Task 9 (dependências novas).
- **Relatórios** novos por rodada, nunca sobrescritos: `qa-gpx-import-<estagio>-2026-10-14[-roundN].md` e `security-gpx-import-2026-10-14[-roundN].md`.

## Review Focus

1. **Arquivo do Garmin com prefixo `ns3:`, vários segmentos ou pausa longa:** os pontos saem em ordem, a pausa (o relógio parado) não conta como movimento e o pace não é inflado. Coberto em `parseGpx` (Task 9: `ns3:`, segmentos fora de ordem) e em `movingSegments` (Task 3: `dt` 0 e GPS parado).
2. **Importar o mesmo arquivo duas vezes, inclusive em dois toques rápidos:** a 2ª dá 409 com o `activity_id`, e o app mostra "Ver atividade". Coberto no teste de rota (409 e corrida `P2002`, Task 7), no índice único (Task 2) e no fluxo 6 da Task 13.
3. **Arquivo antigo (mais de 72 h), de bike, que não é GPX ou rota planejada sem horários:** a mensagem é clara em pt-BR e nada é gravado. Coberto em `parseGpx` (Task 9), `checkWindow` (Task 4), `gpsErrorText` (Task 9) e no fluxo 7 da Task 13.
4. **Usuário sem peso cadastrado:** as calorias aparecem como "—", com a dica para cadastrar o peso, e a Home soma 0 dessa atividade. Coberto em `estimateCalories` (Task 3) e no fluxo 4 da Task 13.
5. **Arquivo enorme (ultra de 9 h, 30 mil pontos ou mais):** o app reduz, o servidor calcula em dezenas de ms, e mais de 2 MiB dá 413 (não 500). Coberto em `parseGpx` (redução, Task 9), `simplifyRoute` (zigue-zague longo, Task 3), no teste de `bodyLimit` (Task 7) e no Step 3 da Task 8.

## Arquivos

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| Fixtures | `BackEndTorv/src/lib/tests/fixtures/run-sample.json`, `FrontEndTorv/src/utils/fixtures/run-sample.gpx` | **Cria (Maestro).** Amostra anonimizada: coordenadas deslocadas e horários a partir de 2026-01-15T09:00Z |
| Database | `BackEndTorv/prisma/migrations/20261014120000_gps_activities/migration.sql` | **Cria.** Tipo da rotina, CHECK do tipo da atividade, índice de deduplicação, colunas de GPS |
| Database | `BackEndTorv/prisma/schema.prisma`; `BancoDeDadosTorv/*.sql` | Reflete a migration; sincroniza os scripts como nas features anteriores |
| Backend | `src/lib/gpsMetrics.js` | **Cria.** Distância, movimento, elevação, FC, cadência, parciais, calorias, rota |
| Backend | `src/lib/gpsValidation.js` | **Cria.** Pontos, janela de 72 h, plausibilidade |
| Backend | `src/lib/workoutValidation.js` | `checkRoutineBody` com o tipo; exporta as constantes da janela |
| Backend | `src/routes/workout.schemas.js`, `src/controller/workout.controller.js`, `src/repository/workout.repository.js` | Tipo da rotina; "Próximo" só musculação; sessão só vincula rotina de musculação; fila, lock e teto vêm de `activityWrites` |
| Backend | `src/repository/activityWrites.js` | **Cria.** `serializePerUser`, `lockAndCheckDailyCap` (todos os tipos) |
| Backend | `src/repository/gps.repository.js` | **Cria** |
| Backend | `src/routes/gps.schemas.js`, `src/routes/gps.routes.js`, `src/controller/gps.controller.js` | **Cria** |
| Backend | `src/routes/activities.schemas.js`, `server.js` | `ACTIVITY_TYPES` com `RUN`/`WALK`; registra `/activities/gps` |
| Frontend | `src/utils/gpx.ts`, `gpsFormat.ts`, `gpsErrors.ts`, `routeProjection.ts` (+ `.test.mjs`) | **Cria** |
| Frontend | `src/utils/readPickedFile.ts`, `readPickedFile.web.ts` | **Cria.** Lê o arquivo escolhido (celular / navegador) |
| Frontend | `src/services/gps.ts` | **Cria** |
| Frontend | `src/services/activities.ts`, `src/utils/activities.ts`, `src/services/workouts.ts`, `src/utils/routineForm.ts` (+ teste), `src/utils/activityMeta.ts` | Tipos novos e item de GPS |
| Frontend | `src/components/RouteTrace`, `src/components/ActivityIcon` | **Cria** |
| Frontend | `src/screens/GpxImport`, `src/screens/GpsActivity` | **Cria** |
| Frontend | `src/screens/RoutineEditor`, `Workouts`, `Workouts/History.tsx`, `Profile`, `MemberProfile`; `src/routes/types.ts`, `PrivateRoutes/index.tsx` | Integração |

## Contrato da API (fonte única para backend e frontend)

**Rotinas (`/workouts/routines`):**
- O corpo ganha `activity_type?: 'STRENGTH' | 'RUN' | 'WALK'` (padrão `STRENGTH`), e `exercises` passa a ser opcional (0 a 20).
- Musculação exige pelo menos 1 exercício (400 `exercises must have at least 1 item`).
- Corrida e caminhada não aceitam exercício (400 `run and walk routines have no exercises`).
- No `PUT`, mandar um tipo diferente do gravado → 400 `activity_type cannot change`.
- `RoutineSummary` e `RoutineDetail` ganham `activity_type`.
- `next_routine_id` e `completed_recently` só olham `STRENGTH`.

**`GET /activities?type=STRENGTH|RUN|WALK`:** o item já traz `distance_m`. Na atividade de GPS, `duration_sec` é o tempo **em movimento**.

**`POST /activities/gps/preview`** e **`POST /activities/gps`** (limite de corpo de 2 MiB; 30 por minuto por IP):

```json
{ "activity_type": "RUN", "start_time": "2026-10-14T11:08:03.000Z",
  "points": [[0, -10.5, -52.5, 413.3, 83, 55], [2, -10.499949, -52.499999, 413.0, 83, 55]] }
```

- O `POST /` acrescenta `routine_id` (rotina de GPS do usuário) e `title?` (até 100; vazio → nome da rotina).
- **Respostas:**
  - prévia → **200** `GpsMetrics`;
  - criação → **201** `GpsActivityDetail`, que é o `GpsMetrics` mais `id`, `title` e `routine_id`:

```json
{ "id": "...", "title": "Corrida na hora do almoço", "routine_id": "...", "activity_type": "RUN", "start_time": "...",
  "distance_m": 8670.74, "duration_sec": 2877, "elapsed_sec": 2882, "pace_sec_per_km": 332, "elevation_gain_m": 38.3,
  "avg_hr": 151, "max_hr": 169, "avg_cadence": 175, "calories": 726,
  "splits": [{ "km": 1, "distance_m": 1000, "duration_sec": 338 }], "route": [[-10.5, -52.5]] }
```

**`GET|PATCH|DELETE /activities/gps/:id`:** só o dono. O `PATCH` recebe `{ title }` (1 a 100) e devolve o detalhe; o `DELETE` responde 204 e recalcula o ranking.

**Erros (texto estável; o app traduz):**

| Código | Mensagem |
|---|---|
| 400 | `start_time must be on or after 2026-01-01` · `start_time must be within the last 72 hours` · `start_time must not be in the future` · `activity must not end in the future` · `points must be in chronological order` · `invalid point at index N` · `activity too short` · `activity too long` · `speed not compatible with run or walk` · `too many sessions on that day` |
| 404 | `Not found` |
| 409 | `Activity already imported`, com `activity_id` |
| 413 | corpo acima de 2 MiB |
| 429 | rate limit |

---

### Task 0 (Maestro): amostras anonimizadas

**Quem:** Maestro · **Files:**
- Create: `BackEndTorv/src/lib/tests/fixtures/run-sample.json`, `FrontEndTorv/src/utils/fixtures/run-sample.gpx`

- [ ] **Step 1:** gerar, a partir do `.gpx` do usuário (fora do git), a amostra com uma rota sintética (mesma distância de cada passo, direção gerada por função, sem relação com o percurso real) e os horários contados a partir de `2026-01-15T09:00:00Z`.
  - O JSON leva os 2.875 pontos `[t, lat, lon, ele, hr, cad]` e `start_time`.
  - O `.gpx` do front leva os 120 primeiros pontos, no layout do Strava (nome "Corrida na hora do almoço", `<type>running</type>`).
- [ ] **Step 2:** conferir que nenhuma coordenada original aparece nos dois arquivos e commitar só eles (`test: anonymized GPX fixtures (shifted coordinates and times)`).

---

### Task 1: Database — migration e schema

**Recruit:** Torv Database (com o Furnace **parado** pelo Maestro) · **Files:**
- Create: `BackEndTorv/prisma/migrations/20261014120000_gps_activities/migration.sql`
- Modify: `BackEndTorv/prisma/schema.prisma`, os scripts de `BancoDeDadosTorv/` (DDL e regras, como nas features anteriores)

- [ ] **Step 1: Pré-condições** (via Prisma, sem conector do Supabase):
  - `SELECT DISTINCT activity_type FROM activities` → só `STRENGTH`;
  - `SELECT COUNT(*) FROM activity_gps_data` → `0`.

  Se alguma falhar: **parar** e perguntar ao Maestro.

- [ ] **Step 2: Migration**:

```sql
-- Importador de GPX: tipo da rotina, tipos de atividade, deduplicação da importação e métricas de GPS.
-- Pré-condições conferidas antes de aplicar: activities só com STRENGTH e activity_gps_data vazia.

ALTER TABLE "workout_routines" ADD COLUMN "activity_type" VARCHAR(10) NOT NULL DEFAULT 'STRENGTH';
ALTER TABLE "workout_routines" ADD CONSTRAINT "workout_routines_activity_type_check"
  CHECK ("activity_type" IN ('STRENGTH', 'RUN', 'WALK'));

ALTER TABLE "activities" ADD CONSTRAINT "activities_activity_type_check"
  CHECK ("activity_type" IN ('STRENGTH', 'RUN', 'WALK'));

-- Uma atividade de GPS por usuário e instante de início: importar o mesmo arquivo de novo dá conflito (409 na API).
CREATE UNIQUE INDEX "activities_gps_user_start_key" ON "activities"("user_id", "start_time") WHERE "activity_type" <> 'STRENGTH';

-- route_json nunca foi usado (tabela vazia). A rota simplificada e as parciais vão em JSONB; o resto em colunas tipadas.
ALTER TABLE "activity_gps_data" DROP COLUMN "route_json";
ALTER TABLE "activity_gps_data"
  ADD COLUMN "elapsed_sec" INTEGER NOT NULL,
  ADD COLUMN "elevation_gain_m" DECIMAL(7,1),
  ADD COLUMN "avg_hr" SMALLINT,
  ADD COLUMN "max_hr" SMALLINT,
  ADD COLUMN "avg_cadence" SMALLINT,
  ADD COLUMN "splits" JSONB NOT NULL,
  ADD COLUMN "route" JSONB NOT NULL;
ALTER TABLE "activity_gps_data"
  ADD CONSTRAINT "activity_gps_data_elapsed_sec_check" CHECK ("elapsed_sec" > 0),
  ADD CONSTRAINT "activity_gps_data_elevation_gain_m_check" CHECK ("elevation_gain_m" IS NULL OR "elevation_gain_m" >= 0),
  ADD CONSTRAINT "activity_gps_data_hr_check"
    CHECK (("avg_hr" IS NULL OR "avg_hr" BETWEEN 20 AND 250) AND ("max_hr" IS NULL OR "max_hr" BETWEEN 20 AND 250)),
  ADD CONSTRAINT "activity_gps_data_avg_cadence_check" CHECK ("avg_cadence" IS NULL OR "avg_cadence" BETWEEN 1 AND 400);
```

- [ ] **Step 3: `schema.prisma`**

No `workout_routines`, depois de `position`:

```prisma
  // 'STRENGTH' | 'RUN' | 'WALK' (CHECK só no SQL da migration). Escolhido na criação, não muda. GPS = sem exercícios.
  activity_type     String              @default("STRENGTH") @db.VarChar(10)
```

No `activities`:
- o comentário da linha de `activity_type` passa a citar o CHECK (`STRENGTH`/`RUN`/`WALK`);
- o comentário dos índices passa a citar os dois únicos parciais: `(user_id, start_time)` com `STRENGTH` e com `<> 'STRENGTH'`.

O modelo `activity_gps_data` inteiro:

```prisma
// Métricas de uma atividade de GPS (RUN/WALK). Os pontos brutos não são guardados: só o resumo, as parciais e a rota
// simplificada (até 500 [lat, lon] com 5 casas). CHECKs só no SQL da migration.
model activity_gps_data {
  activity_id      String     @id @db.Uuid
  elapsed_sec      Int
  elevation_gain_m Decimal?   @db.Decimal(7, 1)
  avg_hr           Int?       @db.SmallInt
  max_hr           Int?       @db.SmallInt
  avg_cadence      Int?       @db.SmallInt
  splits           Json       @db.JsonB
  route            Json       @db.JsonB

  activity    activities @relation(fields: [activity_id], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: Aplicar e gerar**

Run, em `BackEndTorv`:
1. `npx prisma migrate deploy` → aplica `20261014120000_gps_activities`;
2. `npx prisma generate`;
3. `npx prisma migrate status` → "Database schema is up to date";
4. `npx prisma validate`;
5. `npm test` → tudo verde, porque nada no código usa as colunas novas ainda.

- [ ] **Step 5: Commit**

```bash
git add BackEndTorv/prisma/migrations/20261014120000_gps_activities/migration.sql BackEndTorv/prisma/schema.prisma "BancoDeDadosTorv/<scripts alterados>"
git commit -m "feat(db): routine and activity types, GPS dedupe index and typed GPS metrics" -- <mesmos arquivos>
```

---

### Task 2: Teste da etapa de Database

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-gpx-import-database-2026-10-14.md`

- [ ] **Step 1:** `npx prisma migrate status` em dia e `npm test` verde (total igual à base de 272).
- [ ] **Step 2: Estrutura.** Por SQL via Prisma, conferir:
  - colunas, tipos, padrão e CHECKs de `workout_routines.activity_type` e `activity_gps_data`;
  - o índice `activities_gps_user_start_key` (único e parcial);
  - que o RLS e a policy `torv_api_full_access` de `activity_gps_data` continuam.
- [ ] **Step 3: Comportamento**, numa transação com `ROLLBACK`, com uma conta QA:
  1. atividade `RIDE` → viola o CHECK;
  2. duas atividades `RUN` com o mesmo `user_id` e `start_time` → viola o índice;
  3. uma `STRENGTH` e uma `RUN` no mesmo instante → ok;
  4. `activity_gps_data` com `elapsed_sec = 0` → viola o CHECK;
  5. `avg_hr = 300` → viola o CHECK;
  6. apagar a atividade → a linha de GPS some (cascade);
  7. rotina `WALK` → ok; rotina `RIDE` → viola o CHECK.
- [ ] **Step 4:** as rotinas e atividades existentes ficaram intactas (contagem antes e depois; todas as rotinas com `STRENGTH`).
- [ ] **Step 5:** relatório e commit só dele (`docs(qa): GPX import database stage report`). **Falha → reabre a Task 1.**

---

### Task 3: Backend — `lib/gpsMetrics.js`

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/lib/gpsMetrics.js`
- Test: `BackEndTorv/src/lib/tests/gpsMetrics.test.js` (usa a fixture da Task 0)

**Interfaces:**
- Produces: `computeMetrics(points, { type: 'RUN'|'WALK', weightKg: number|null })`, que devolve:
  - `distance_m`, `duration_sec`, `elapsed_sec`, `pace_sec_per_km`;
  - `elevation_gain_m`, `avg_hr`, `max_hr`, `avg_cadence`, `calories`;
  - `splits: {km, distance_m, duration_sec}[]` e `route: [lat, lon][]`.

  Exporta também `haversine`, `movingSegments`, `elevationGain`, `heartRate`, `cadence`, `splits`, `thin`, `simplifyRoute` e `estimateCalories`.

- [ ] **Step 1: Teste que falha** — `BackEndTorv/src/lib/tests/gpsMetrics.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  haversine, movingSegments, elevationGain, heartRate, cadence, splits, thin, simplifyRoute, estimateCalories, computeMetrics,
} = require('../gpsMetrics');

// 1 grau de latitude em metros com o mesmo raio do código (R = 6.371.008,8 m).
const DEG_M = (6371008.8 * Math.PI) / 180;
// n pontos, um a cada `dt` s, andando `stepM` metros para o norte a cada ponto; `extra` = [ele, hr, cad].
const northLine = (n, stepM, dt, extra = []) =>
  Array.from({ length: n }, (_, i) => [i * dt, -15 + (i * stepM) / DEG_M, -47, ...extra]);

test('haversine: 1 grau de latitude e ponto parado', () => {
  assert.ok(Math.abs(haversine([0, 0, 0], [0, 1, 0]) - 111195.08) < 0.01);
  assert.equal(haversine([0, -15, -47], [5, -15, -47]), 0);
});

test('movingSegments: abaixo de 0,5 m/s é GPS parado; dt 0 é ignorado', () => {
  const pts = [[0, 0, 0], [10, 1 / DEG_M, 0], [10, 2 / DEG_M, 0], [12, 4 / DEG_M, 0]];
  const segs = movingSegments(pts);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].i, 3);
  assert.equal(segs[0].dt, 2);
  assert.ok(Math.abs(segs[0].d - 2) < 0.001);
});

test('elevationGain: histerese de 2 m corta ruído; menos de 2 altitudes → null', () => {
  const ele = (...vals) => vals.map((e, i) => [i, 0, 0, e]);
  assert.equal(elevationGain(ele(100, 101, 100, 101, 100)), 0);
  assert.equal(elevationGain(ele(100, 103, 102, 106)), 6);
  assert.equal(elevationGain(ele(100, 97, 100)), 3);
  assert.equal(elevationGain([[0, 0, 0], [1, 0, 0, null], [2, 0, 0, 100]]), null);
});

test('heartRate: média arredondada e máximo; sem FC → null', () => {
  assert.deepEqual(heartRate([[0, 0, 0, null, 150], [1, 0, 0, null, 151], [2, 0, 0, null, null]]), { avg_hr: 151, max_hr: 151 });
  assert.deepEqual(heartRate([[0, 0, 0], [1, 0, 0]]), { avg_hr: null, max_hr: null });
});

test('cadence: cad por perna × 2, só nos segmentos em movimento e com cad > 0', () => {
  const pts = northLine(4, 3, 1, [100, 150]).map((p, i) => [...p, [80, 0, 90, 85][i]]);
  assert.equal(cadence(pts, movingSegments(pts)), 175);
  const plain = northLine(3, 3, 1);
  assert.equal(cadence(plain, movingSegments(plain)), null);
});

test('splits: reta de 2,5 km a 4 m/s → 250 s por km e a sobra de 500 m', () => {
  const segs = movingSegments(northLine(126, 20, 5));
  assert.deepEqual(splits(segs), [
    { km: 1, distance_m: 1000, duration_sec: 250 },
    { km: 2, distance_m: 1000, duration_sec: 250 },
    { km: 3, distance_m: 500, duration_sec: 125 },
  ]);
});

test('splits: sobra menor que 50 m não vira parcial', () => {
  assert.deepEqual(splits(movingSegments(northLine(52, 20, 5))), [{ km: 1, distance_m: 1000, duration_sec: 250 }]);
});

test('thin: passo uniforme até o máximo, sempre com o primeiro e o último', () => {
  assert.deepEqual(thin([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4), [1, 4, 7, 10]);
  assert.deepEqual(thin([1, 2, 3], 5), [1, 2, 3]);
});

test('simplifyRoute: reta vira só as pontas, com 5 casas', () => {
  const route = simplifyRoute(northLine(200, 10, 3));
  assert.equal(route.length, 2);
  assert.deepEqual(route[0], [-15, -47]);
  assert.equal(route[1][1], -47);
});

test('simplifyRoute: zigue-zague longo fica com no máximo 500 pontos, mantém as pontas e é rápido (Review Focus 5)', () => {
  // 20.000 pontos; a cada 4 pontos o desvio de ~54 m alterna. Antes de entrar no Douglas-Peucker, a entrada cai para 2.000.
  const pts = Array.from({ length: 20000 }, (_, i) => [i, -15 + (i * 10) / DEG_M, -47 + (Math.floor(i / 4) % 2) * 0.0005]);
  const started = Date.now();
  const route = simplifyRoute(pts);
  assert.ok(Date.now() - started < 1000, 'uma passada só: dezenas de ms, nunca segundos');
  assert.ok(route.length <= 500, String(route.length));
  assert.deepEqual(route[0], [-15, -47]);
  const last = pts[pts.length - 1];
  assert.deepEqual(route[route.length - 1], [Math.round(last[1] * 1e5) / 1e5, Math.round(last[2] * 1e5) / 1e5]);
});

test('estimateCalories: ACSM por metro nos dois tipos; sem peso → null (Review Focus 4)', () => {
  assert.equal(estimateCalories('RUN', 10000, 100, 3600, 70), 805); // (2000 + 90 + 210) ml/kg × 70 kg / 1000 × 5
  assert.equal(estimateCalories('WALK', 5000, null, 3600, 70), 249); // (500 + 0 + 210) × 70 / 1000 × 5 = 248,5
  assert.equal(estimateCalories('RUN', 10000, 100, 3600, null), null);
});

test('computeMetrics: amostra anonimizada (corrida de 48 min a 1 Hz)', () => {
  const { points } = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-sample.json'), 'utf8'));
  const m = computeMetrics(points, { type: 'RUN', weightKg: 75 });
  assert.deepEqual({ ...m, route: m.route.length }, {
    distance_m: 8670.74,
    duration_sec: 2877,
    elapsed_sec: 2882,
    pace_sec_per_km: 332,
    elevation_gain_m: 38.3,
    avg_hr: 151,
    max_hr: 169,
    avg_cadence: 175,
    calories: 726,
    splits: [
      { km: 1, distance_m: 1000, duration_sec: 338 },
      { km: 2, distance_m: 1000, duration_sec: 318 },
      { km: 3, distance_m: 1000, duration_sec: 334 },
      { km: 4, distance_m: 1000, duration_sec: 323 },
      { km: 5, distance_m: 1000, duration_sec: 354 },
      { km: 6, distance_m: 1000, duration_sec: 360 },
      { km: 7, distance_m: 1000, duration_sec: 312 },
      { km: 8, distance_m: 1000, duration_sec: 321 },
      { km: 9, distance_m: 671, duration_sec: 217 },
    ],
    route: 104,
  });
  assert.deepEqual(m.route[0], [-10.5, -52.5]);
  assert.equal(m.splits.reduce((n, s) => n + s.duration_sec, 0), m.duration_sec);
  assert.equal(computeMetrics(points, { type: 'WALK', weightKg: 75 }).calories, 414);
  assert.equal(computeMetrics(points, { type: 'RUN' }).calories, null);
});
```

- [ ] **Step 2:** `node --test src/lib/tests/gpsMetrics.test.js` → FAIL (`Cannot find module '../gpsMetrics'`).

- [ ] **Step 3: Implementar** — `BackEndTorv/src/lib/gpsMetrics.js`

```js
// Métricas de uma atividade com GPS, calculadas no servidor a partir dos pontos que o app extraiu do .gpx.
// points: [[t, lat, lon, ele, hr, cad], ...] já validados (gpsValidation.checkPoints): t em segundos desde o início,
// nunca decrescente; ele/hr/cad podem ser null.

const R = 6371008.8; // raio médio da Terra (m)
const MOVING_MIN_SPEED = 0.5; // m/s: abaixo disso é o GPS parado oscilando, não movimento
const ELEVATION_STEP = 2; // m: histerese do ganho de elevação (corta o ruído do altímetro)
const SPLIT_M = 1000;
const MIN_LAST_SPLIT_M = 50;
const ROUTE_MAX_INPUT = 2000; // limita a entrada do Douglas-Peucker: O(n²) no pior caso = ~2 milhões de contas
const ROUTE_MAX_POINTS = 500;
const ROUTE_EPSILON_M = 5;
// Equações metabólicas da ACSM, por metro: O2 (ml/kg) = h·distância + v·subida + 3,5 ml/kg/min de repouso.
const ACSM = { RUN: { h: 0.2, v: 0.9 }, WALK: { h: 0.1, v: 1.8 } };

const rad = (deg) => (deg * Math.PI) / 180;
const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;

// Distância em metros entre dois pontos [t, lat, lon, ...].
function haversine(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[2] - a[2]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Pares de pontos consecutivos em movimento (>= 0,5 m/s). i = índice do ponto final do par.
function movingSegments(points) {
  const segs = [];
  for (let i = 1; i < points.length; i += 1) {
    const dt = points[i][0] - points[i - 1][0];
    if (dt <= 0) continue;
    const d = haversine(points[i - 1], points[i]);
    if (d / dt >= MOVING_MIN_SPEED) segs.push({ i, d, dt });
  }
  return segs;
}

// Soma das subidas com histerese de 2 m. Menos de 2 altitudes → null.
function elevationGain(points) {
  let anchor = null;
  let gain = 0;
  let seen = 0;
  for (const p of points) {
    const ele = p[3];
    if (ele == null) continue;
    seen += 1;
    if (anchor === null) {
      anchor = ele;
    } else if (ele - anchor >= ELEVATION_STEP) {
      gain += ele - anchor;
      anchor = ele;
    } else if (anchor - ele >= ELEVATION_STEP) {
      anchor = ele;
    }
  }
  return seen < 2 ? null : round(gain, 1);
}

function heartRate(points) {
  let sum = 0;
  let n = 0;
  let max = null;
  for (const p of points) {
    const hr = p[4];
    if (hr == null) continue;
    sum += hr;
    n += 1;
    if (max === null || hr > max) max = hr;
  }
  return n === 0 ? { avg_hr: null, max_hr: null } : { avg_hr: Math.round(sum / n), max_hr: max };
}

// O gpxtpx:cad é por perna: passos/min = 2×. Só nos pontos finais de segmentos em movimento, com cad > 0.
function cadence(points, segs) {
  let sum = 0;
  let n = 0;
  for (const { i } of segs) {
    const cad = points[i][5];
    if (cad == null || cad <= 0) continue;
    sum += cad;
    n += 1;
  }
  return n === 0 ? null : Math.round((2 * sum) / n);
}

// Parciais por km em movimento. A fronteira de cada km é interpolada dentro do segmento; a duração de cada parcial é a
// diferença entre fronteiras ACUMULADAS e arredondadas, então as parciais completas somam exatamente até a última fronteira.
function splits(segs) {
  const out = [];
  let dist = 0;
  let time = 0;
  let next = SPLIT_M;
  let prevBoundary = 0;
  for (const { d, dt } of segs) {
    while (dist + d >= next) {
      const boundary = Math.round(time + ((next - dist) / d) * dt);
      out.push({ km: out.length + 1, distance_m: SPLIT_M, duration_sec: boundary - prevBoundary });
      prevBoundary = boundary;
      next += SPLIT_M;
    }
    dist += d;
    time += dt;
  }
  const rest = dist - (next - SPLIT_M);
  if (rest >= MIN_LAST_SPLIT_M) {
    out.push({ km: out.length + 1, distance_m: Math.round(rest), duration_sec: Math.round(time) - prevBoundary });
  }
  return out;
}

// Douglas-Peucker iterativo sobre [x, y] em metros. Devolve os índices mantidos, em ordem.
function rdp(xy, eps) {
  const keep = new Uint8Array(xy.length);
  keep[0] = 1;
  keep[xy.length - 1] = 1;
  const stack = [[0, xy.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = xy[s];
    const [x2, y2] = xy[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i += 1) {
      const [x, y] = xy[i];
      const dist = len === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * (x - x1) - dx * (y - y1)) / len;
      if (dist > max) {
        max = dist;
        idx = i;
      }
    }
    if (idx !== -1 && max > eps) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < keep.length; i += 1) if (keep[i]) out.push(i);
  return out;
}

// Redução por passo uniforme a no máximo `max` itens, sempre com o primeiro e o último.
function thin(list, max) {
  if (list.length <= max) return list;
  const step = Math.ceil((list.length - 1) / (max - 1));
  const out = [];
  for (let i = 0; i < list.length - 1; i += step) out.push(list[i]);
  out.push(list[list.length - 1]);
  return out;
}

// Rota para o traçado: no máximo 500 pontos [lat, lon] com 5 casas (~1 m), mantendo início e fim.
// Uma passada só de Douglas-Peucker (5 m) sobre no máximo 2.000 pontos; se sobrar mais de 500, passo uniforme.
// (Repetir a passada aumentando a tolerância levava 2,3 s num zigue-zague de 20 mil pontos: vetor de DoS.)
function simplifyRoute(points) {
  const pts = thin(points, ROUTE_MAX_INPUT);
  const lat0 = rad(pts.reduce((n, p) => n + p[1], 0) / pts.length);
  const xy = pts.map((p) => [R * rad(p[2]) * Math.cos(lat0), R * rad(p[1])]);
  const kept = thin(rdp(xy, ROUTE_EPSILON_M), ROUTE_MAX_POINTS);
  return kept.map((i) => [round(pts[i][1], 5), round(pts[i][2], 5)]);
}

function estimateCalories(type, distanceM, gainM, movingSec, weightKg) {
  if (weightKg == null) return null;
  const { h, v } = ACSM[type];
  const o2 = h * distanceM + v * (gainM ?? 0) + 3.5 * (movingSec / 60);
  return Math.round(((o2 * weightKg) / 1000) * 5);
}

// type: 'RUN' | 'WALK'; weightKg: último peso do usuário ou null.
function computeMetrics(points, { type, weightKg = null }) {
  const segs = movingSegments(points);
  const distance = segs.reduce((n, s) => n + s.d, 0);
  const movingSec = Math.round(segs.reduce((n, s) => n + s.dt, 0));
  const gain = elevationGain(points);
  return {
    distance_m: round(distance, 2),
    duration_sec: movingSec,
    elapsed_sec: Math.round(points[points.length - 1][0] - points[0][0]),
    pace_sec_per_km: distance > 0 ? Math.round(movingSec / (distance / 1000)) : null,
    elevation_gain_m: gain,
    ...heartRate(points),
    avg_cadence: cadence(points, segs),
    calories: estimateCalories(type, distance, gain, movingSec, weightKg),
    splits: splits(segs),
    route: simplifyRoute(points),
  };
}

module.exports = {
  haversine, movingSegments, elevationGain, heartRate, cadence, splits, thin, simplifyRoute, estimateCalories, computeMetrics,
};
```

- [ ] **Step 4:** `node --test src/lib/tests/gpsMetrics.test.js` → PASS (12).
- [ ] **Step 5:** commit (`feat(gps): server-side GPS metrics (moving time, splits, ACSM calories, simplified route)`), com pathspec dos 2 arquivos.

---

### Task 4: Backend — `lib/gpsValidation.js`

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/lib/gpsValidation.js`, `BackEndTorv/src/lib/tests/gpsValidation.test.js`
- Modify: `BackEndTorv/src/lib/workoutValidation.js` (exporta `MIN_SESSION_START`, `FUTURE_TOLERANCE_MS`, `BACKDATE_WINDOW_MS`)

**Interfaces:**
- Produces:
  - `checkPoints(points) → { points } | { error }`, com os pontos normalizados em 6 posições;
  - `checkWindow(startMs, elapsedSec, now?) → string | null`;
  - `checkPlausible(metrics) → string | null`.

- [ ] **Step 1: Teste que falha** — `BackEndTorv/src/lib/tests/gpsValidation.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkPoints, checkWindow, checkPlausible } = require('../gpsValidation');

test('checkPoints: aceita de 3 a 6 campos, completa com null e zera FC/cadência fora da faixa', () => {
  assert.deepEqual(checkPoints([[0, -15, -47], [1, -15.0001, -47, 400, 300, -1], [1, -15.0002, -47, null, 150, 85]]), {
    points: [[0, -15, -47, null, null, null], [1, -15.0001, -47, 400, null, null], [1, -15.0002, -47, null, 150, 85]],
  });
});

test('checkPoints: 1º t precisa ser 0; t não pode diminuir', () => {
  assert.deepEqual(checkPoints([[1, -15, -47], [2, -15, -47]]), { error: 'invalid point at index 0' });
  assert.deepEqual(checkPoints([[0, -15, -47], [5, -15, -47], [4, -15, -47]]), { error: 'points must be in chronological order' });
});

test('checkPoints: coordenada, altitude e t fora da faixa apontam o índice', () => {
  const base = [0, -15, -47];
  for (const bad of [[1, 91, -47], [1, -15, -181], [1, -15, -47, 9001], [-1, -15, -47], [1, -15, -47, -501]]) {
    assert.deepEqual(checkPoints([base, bad]), { error: 'invalid point at index 1' }, JSON.stringify(bad));
  }
});

const NOW = Date.parse('2026-10-14T12:00:00Z');
const H = 3600 * 1000;

test('checkWindow: últimas 72 h, nada antes de 2026 e nada terminando no futuro (Review Focus 3)', () => {
  assert.equal(checkWindow(NOW - H, 1800, NOW), null);
  assert.equal(checkWindow(NOW - 72 * H, 1800, NOW), null); // exatamente 72 h ainda vale
  assert.equal(checkWindow(Date.parse('2025-12-31T23:59:59Z'), 60, Date.parse('2026-01-02T00:00:00Z')), 'start_time must be on or after 2026-01-01');
  assert.equal(checkWindow(NOW - 72 * H - 1, 1800, NOW), 'start_time must be within the last 72 hours');
  assert.equal(checkWindow(NOW + 6 * 60 * 1000, 60, NOW), 'start_time must not be in the future');
  assert.equal(checkWindow(NOW - 10 * 60 * 1000, 20 * 60, NOW), 'activity must not end in the future');
  assert.equal(checkWindow(NaN, 60, NOW), 'start_time must be on or after 2026-01-01');
});

test('checkPlausible: curta, longa e rápida demais; a amostra passa', () => {
  assert.equal(checkPlausible({ elapsed_sec: 59, distance_m: 500, duration_sec: 59 }), 'activity too short');
  assert.equal(checkPlausible({ elapsed_sec: 600, distance_m: 99.9, duration_sec: 600 }), 'activity too short');
  assert.equal(checkPlausible({ elapsed_sec: 86401, distance_m: 10000, duration_sec: 3600 }), 'activity too long');
  assert.equal(checkPlausible({ elapsed_sec: 600, distance_m: 5000, duration_sec: 600 }), 'speed not compatible with run or walk');
  assert.equal(checkPlausible({ elapsed_sec: 2882, distance_m: 8670.74, duration_sec: 2877 }), null);
});
```

- [ ] **Step 2:** `node --test src/lib/tests/gpsValidation.test.js` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

`BackEndTorv/src/lib/workoutValidation.js`: no `module.exports`, acrescentar `MIN_SESSION_START`, `FUTURE_TOLERANCE_MS` e `BACKDATE_WINDOW_MS`. As constantes não mudam.

`BackEndTorv/src/lib/gpsValidation.js`:

```js
// Regras dos pontos de GPS e da atividade que o TypeBox não expressa (o schema já garante um array de 2 a 30.000
// arrays de 3 a 6 números ou null). Cada função devolve a mensagem de erro (400) ou null.
const { MIN_SESSION_START, BACKDATE_WINDOW_MS, FUTURE_TOLERANCE_MS } = require('./workoutValidation');

const MAX_SPEED_MS = 25 / 3.6; // 25 km/h: acima disso não é corrida nem caminhada (bike, carro, arquivo errado)
const MIN_ELAPSED_SEC = 60;
const MAX_ELAPSED_SEC = 24 * 3600;
const MIN_DISTANCE_M = 100;

const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// Forma e faixas de cada ponto [t, lat, lon, ele?, hr?, cad?]. O 1º t é 0 e t nunca diminui. FC e cadência fora da faixa
// viram null (sensor ruim não derruba a importação). Devolve { points } normalizados (sempre 6 posições) ou { error }.
function checkPoints(points) {
  const out = new Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    const [t, lat, lon, ele = null, hr = null, cad = null] = points[i];
    const valid = inRange(t, 0, Number.MAX_SAFE_INTEGER) && (i > 0 || t === 0)
      && inRange(lat, -90, 90) && inRange(lon, -180, 180)
      && (ele === null || inRange(ele, -500, 9000))
      && (hr === null || typeof hr === 'number') && (cad === null || typeof cad === 'number');
    if (!valid) return { error: `invalid point at index ${i}` };
    if (i > 0 && t < out[i - 1][0]) return { error: 'points must be in chronological order' };
    out[i] = [t, lat, lon, ele, inRange(hr, 20, 250) ? hr : null, inRange(cad, 0, 255) ? cad : null];
  }
  return { points: out };
}

// Mesma janela da musculação (impede forjar dias no ranking): início nas últimas 72 h e a partir de 2026-01-01, fim até
// agora + 5 min. startMs em ms; elapsedSec = t do último ponto.
function checkWindow(startMs, elapsedSec, now = Date.now()) {
  if (!(startMs >= MIN_SESSION_START)) return 'start_time must be on or after 2026-01-01';
  if (startMs < now - BACKDATE_WINDOW_MS) return 'start_time must be within the last 72 hours';
  if (startMs > now + FUTURE_TOLERANCE_MS) return 'start_time must not be in the future';
  if (!(startMs + elapsedSec * 1000 <= now + FUTURE_TOLERANCE_MS)) return 'activity must not end in the future';
  return null;
}

// Sobre as métricas já calculadas (gpsMetrics.computeMetrics).
function checkPlausible({ elapsed_sec: elapsed, distance_m: distance, duration_sec: moving }) {
  if (elapsed < MIN_ELAPSED_SEC || distance < MIN_DISTANCE_M) return 'activity too short';
  if (elapsed > MAX_ELAPSED_SEC) return 'activity too long';
  if (distance / moving > MAX_SPEED_MS) return 'speed not compatible with run or walk';
  return null;
}

module.exports = { checkPoints, checkWindow, checkPlausible };
```

- [ ] **Step 4:** `npm test` → PASS (base + 12 + 5).
- [ ] **Step 5:** commit (`feat(gps): point, window and plausibility rules`) com os 3 arquivos.

---

### Task 5: Backend — tipo da rotina

**Recruit:** Torv Backend · **Files:**
- Modify:
  - `BackEndTorv/src/routes/workout.schemas.js`
  - `BackEndTorv/src/lib/workoutValidation.js`
  - `BackEndTorv/src/controller/workout.controller.js`
  - `BackEndTorv/src/repository/workout.repository.js`
- Test:
  - `BackEndTorv/src/lib/tests/workoutValidation.test.js`
  - `BackEndTorv/src/routes/tests/workout.routes.test.js`
  - `BackEndTorv/src/repository/tests/workout.repository.test.js`

**Interfaces:**
- Produces:
  - `checkRoutineBody(body, storedType = null)`;
  - `workoutRepository.getRoutineType(userId, id) → 'STRENGTH'|'RUN'|'WALK'|null`;
  - `createRoutine(userId, { name, activity_type, exercises })`;
  - `activity_type` nas respostas de rotina;
  - `ROUTINE_TYPES` em `workout.schemas.js`.

- [ ] **Step 1: Testes que falham**

`workoutValidation.test.js`, novo teste:

```js
test('checkRoutineBody: rotina de GPS sem exercícios, musculação com pelo menos 1, tipo não muda', () => {
  assert.equal(checkRoutineBody({ name: 'Corrida leve', activity_type: 'RUN' }), null);
  assert.equal(checkRoutineBody({ name: 'Caminhada', activity_type: 'WALK', exercises: [] }), null);
  assert.equal(checkRoutineBody({ name: 'Corrida', activity_type: 'RUN', exercises: [exercise()] }), 'run and walk routines have no exercises');
  assert.equal(checkRoutineBody({ name: 'Peito', exercises: [] }), 'exercises must have at least 1 item');
  assert.equal(checkRoutineBody({ name: 'Peito' }), 'exercises must have at least 1 item');
  assert.equal(checkRoutineBody({ name: 'Corrida', activity_type: 'WALK' }, 'RUN'), 'activity_type cannot change');
  assert.equal(checkRoutineBody({ name: 'Corrida 2' }, 'RUN'), null); // omitido no PUT: vale o gravado
  assert.equal(checkRoutineBody({ name: 'Peito', exercises: [exercise()] }, 'STRENGTH'), null);
});
```

`workout.routes.test.js`:
- o `routineRow` ganha `activity_type: 'STRENGTH'`.
- **Teste `GET /routines: gera plano na 1ª vez...`:**
  - as duas linhas do `listRoutines` ganham `activity_type: 'STRENGTH'`;
  - os dois itens esperados ganham `activity_type: 'STRENGTH'`, logo depois de `is_default`.
- **Teste `PUT /routines/:id: alheia → 404; própria → 200`:** troca inteiro pelo primeiro bloco abaixo.
- **Dois testes novos:** os dois blocos seguintes.

```js
test('PUT /routines/:id: alheia → 404; própria → 200 com o tipo gravado; trocar o tipo → 400', async (t) => {
  t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const type = t.mock.method(workoutRepository, 'getRoutineType', async () => null);
  const update = t.mock.method(workoutRepository, 'updateRoutine', async () => true);
  t.mock.method(workoutRepository, 'getRoutine', async () => routineRow);
  const app = await build(t);
  assert.equal((await call(app, 'PUT', `/workouts/routines/${ID}`, validRoutine)).statusCode, 404);
  assert.equal(update.mock.callCount(), 0);
  type.mock.mockImplementation(async () => 'STRENGTH');
  const res = await call(app, 'PUT', `/workouts/routines/${ID}`, validRoutine);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update.mock.calls[0].arguments.slice(0, 2), [USER, ID]);
  assert.equal(update.mock.calls[0].arguments[2].activity_type, 'STRENGTH');
  const change = await call(app, 'PUT', `/workouts/routines/${ID}`, { ...validRoutine, activity_type: 'RUN' });
  assert.equal(change.statusCode, 400);
  assert.deepEqual(change.json(), { error: 'activity_type cannot change' });
});

test('POST /routines: rotina de corrida só com nome; com exercícios → 400; tipo inválido → 400', async (t) => {
  const count = t.mock.method(workoutRepository, 'countVisibleExercises', async () => 1);
  const create = t.mock.method(workoutRepository, 'createRoutine', async () => ID);
  t.mock.method(workoutRepository, 'getRoutine', async () => ({ id: ID, name: 'Corrida leve', is_default: false, activity_type: 'RUN', routine_exercises: [] }));
  const app = await build(t);
  const res = await call(app, 'POST', '/workouts/routines', { name: ' Corrida leve ', activity_type: 'RUN' });
  assert.equal(res.statusCode, 201);
  assert.deepEqual(create.mock.calls[0].arguments[1], { name: 'Corrida leve', activity_type: 'RUN', exercises: [] });
  assert.deepEqual(res.json(), { id: ID, name: 'Corrida leve', is_default: false, activity_type: 'RUN', exercises: [] });
  assert.equal(count.mock.callCount(), 0);
  const bad = await call(app, 'POST', '/workouts/routines', { ...validRoutine, activity_type: 'RUN' });
  assert.equal(bad.statusCode, 400);
  assert.deepEqual(bad.json(), { error: 'run and walk routines have no exercises' });
  assert.equal((await call(app, 'POST', '/workouts/routines', { name: 'X', activity_type: 'RIDE' })).statusCode, 400);
});

test('GET /routines: rotina de corrida vem com o tipo e nunca é a "próxima" nem "concluída"', async (t) => {
  t.mock.method(workoutRepository, 'getPlanInputs', async () => inputs);
  t.mock.method(workoutRepository, 'listRoutines', async () => [
    { id: 'a', name: 'Dia 1', is_default: true, activity_type: 'STRENGTH', routine_exercises: [{ _count: { sets: 3 } }] },
    { id: 'r', name: 'Corrida', is_default: false, activity_type: 'RUN', routine_exercises: [] },
    { id: 'b', name: 'Dia 2', is_default: true, activity_type: 'STRENGTH', routine_exercises: [{ _count: { sets: 3 } }] },
  ]);
  t.mock.method(workoutRepository, 'lastRoutineId', async () => 'b');
  t.mock.method(workoutRepository, 'recentRoutineIds', async () => []);
  const res = await call(await build(t), 'GET', '/workouts/routines');
  assert.equal(res.json().next_routine_id, 'a'); // depois do Dia 2 volta ao Dia 1, pulando a corrida
  assert.deepEqual(res.json().routines[1], {
    id: 'r', name: 'Corrida', is_default: false, activity_type: 'RUN', exercise_count: 0, set_count: 0, completed_recently: false,
  });
});
```

`workout.repository.test.js`, novo teste (perto dos de `createSession`):

```js
test('createSession: só vincula rotina de musculação (rotina de GPS vira "Treino livre")', async () => {
  calls = fresh({ routine: null });
  await workoutRepository.createSession(USER, { ...session('2026-10-06T12:00:00Z'), routine_id: ROUTINE });
  assert.deepEqual(calls.findFirst[0].where, { id: ROUTINE, user_id: USER, activity_type: 'STRENGTH' });
  const [, args] = calls.writes.find(([n]) => n === 'activities.create');
  assert.equal(args.data.routine_id, null);
  assert.equal(args.data.title, 'Treino livre');
});
```

- [ ] **Step 2:** `npm test` → os testes novos e os ajustados falham.

- [ ] **Step 3: Implementar**

**`workout.schemas.js`:**

```js
// Rotina de musculação (com exercícios) ou de GPS (só nome; cada treino vem de um .gpx importado).
const ROUTINE_TYPES = ['STRENGTH', 'RUN', 'WALK'];
const RoutineType = Type.Union(ROUTINE_TYPES.map((t) => Type.Literal(t)));
```

- **`RoutineBody`:**
  - ganha `activity_type: Type.Optional(RoutineType)`, com o comentário `// Só na criação; no PUT, igual ao gravado ou omitido (checkRoutineBody).`;
  - `exercises` vira `Type.Optional(Type.Array(<o mesmo objeto>, { maxItems: 20 }))`, ou seja, sai o `minItems: 1`. Comentário: `// Musculação exige pelo menos 1 (checkRoutineBody); corrida e caminhada, nenhum.`.
- **`RoutineList.routines[]` e `RoutineDetail`:** ganham `activity_type: Type.String()`.
- **`module.exports`:** acrescenta `ROUTINE_TYPES`.

**`workoutValidation.js`:** o `checkRoutineBody` inteiro passa a ser:

```js
// storedType: tipo gravado da rotina (PUT) ou null (POST). O tipo é escolhido na criação e não muda.
function checkRoutineBody(body, storedType = null) {
  if (!body.name.trim()) return 'name must not be blank';
  if (storedType && body.activity_type && body.activity_type !== storedType) return 'activity_type cannot change';
  const type = storedType ?? body.activity_type ?? 'STRENGTH';
  const exercises = body.exercises ?? [];
  if (type !== 'STRENGTH') return exercises.length ? 'run and walk routines have no exercises' : null;
  if (exercises.length === 0) return 'exercises must have at least 1 item';
  const i = exercises.findIndex((e) => e.reps_min > e.reps_max);
  if (i !== -1) return `exercises[${i}]: reps_min must be <= reps_max`;
  return null;
}
```

**`workout.controller.js`:**
- `routineSummary` e `routineDetail` ganham `activity_type: r.activity_type`, logo depois de `is_default`.
- No `routinesPayload`:

```js
  const done = new Set(recent);
  // "Próximo" gira só entre as rotinas de musculação; corrida e caminhada ficam fora do rodízio.
  const strength = routines.filter((r) => r.activity_type === 'STRENGTH');
  return {
    routines: routines.map((r) => ({ ...routineSummary(r), completed_recently: done.has(r.id) })),
    next_routine_id: nextRoutineId(strength, last),
    plan_suggestion: planSuggestion(inputs),
  };
```

- `prepareRoutine` e `updateRoutine`:

```js
// Corpo já passou pelo schema; aqui entram as regras cruzadas e a visibilidade dos exercícios.
// storedType: tipo gravado (PUT) ou null (POST).
async function prepareRoutine(userId, body, storedType = null) {
  const error = checkRoutineBody(body, storedType);
  if (error) return { error };
  const exercises = body.exercises ?? [];
  const ids = [...new Set(exercises.map((e) => e.exercise_id))];
  if (ids.length && await workoutRepository.countVisibleExercises(userId, ids) !== ids.length) return { error: 'exercise not found' };
  return { data: { name: body.name.trim(), activity_type: storedType ?? body.activity_type ?? 'STRENGTH', exercises } };
}
```

```js
  async updateRoutine(request, reply) {
    const { userId } = request.user;
    const { id } = request.params;
    const storedType = await workoutRepository.getRoutineType(userId, id);
    if (!storedType) return reply.status(404).send(NOT_FOUND);
    const { error, data } = await prepareRoutine(userId, request.body, storedType);
    if (error) return reply.status(400).send({ error });
    if (!await workoutRepository.updateRoutine(userId, id, data)) return reply.status(404).send(NOT_FOUND);
    return reply.send(routineDetail(await workoutRepository.getRoutine(userId, id)));
  }
```

**`workout.repository.js`:**
- `listRoutines`: `activity_type: true` no `select`. `routineDetailSelect`: `activity_type: true`.
- Novo método:

```js
  // Tipo gravado da rotina do usuário (o PUT valida contra ele); null = não existe ou é de outro usuário.
  async getRoutineType(userId, id) {
    const row = await prisma.workout_routines.findFirst({ where: { id, user_id: userId }, select: { activity_type: true } });
    return row?.activity_type ?? null;
  }
```

- `createRoutine(userId, { name, activity_type, exercises })`:
  - grava `activity_type` no `create`;
  - só chama `insertExercises` se `exercises.length > 0`.
- `updateRoutine`: só chama `insertExercises` se `exercises.length > 0`.
- `createSession`: o `findFirst` da rotina passa a ser `where: { id: routine_id, user_id: userId, activity_type: 'STRENGTH' }`, e o comentário acima do método passa a citar "rotina de GPS".

- [ ] **Step 4:** `npm test` → tudo PASS.
- [ ] **Step 5:** commit (`feat(workouts): run and walk routine types`) com os 7 arquivos.

---

### Task 6: Backend — `activityWrites` (teto de todos os tipos) e `gps.repository`

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/repository/activityWrites.js`, `BackEndTorv/src/repository/gps.repository.js`, `BackEndTorv/src/repository/tests/gps.repository.test.js`
- Modify: `BackEndTorv/src/repository/workout.repository.js`, `BackEndTorv/src/repository/tests/workout.repository.test.js`

**Interfaces:**
- Produces:
  - `serializePerUser(userId, fn)` e `lockAndCheckDailyCap(tx, userId, startTime: Date)`, que lança `{ code: 'SESSION_DAY_LIMIT' }`;
  - `gpsRepository`:
    - `findGpsRoutine(userId, routineId)`;
    - `findByStart(userId, startTime) → id|null`;
    - `createGpsActivity(userId, { routineId, type, title, startTime, metrics }) → id`;
    - `getGpsActivity(userId, id)`;
    - `renameGps(userId, id, title) → boolean`;
    - `deleteGps(userId, id) → boolean`.

- [ ] **Step 1: Testes que falham**

`workout.repository.test.js`: o teste `createSession: conta os STRENGTH do usuario...` muda de título e de esperado. A contagem não filtra mais o tipo:

```js
test('createSession: conta as atividades de QUALQUER tipo do usuario no dia UTC do started_at, ANTES de criar, e a 5a passa', async () => {
  calls = fresh({ dayCount: 4 });
  assert.equal(await workoutRepository.createSession(USER, session('2026-10-06T12:00:00Z')), ACTIVITY);
  assert.equal(calls.counts.length, 1);
  assert.deepEqual(calls.counts[0].where, {
    user_id: USER,
    start_time: { gte: new Date('2026-10-06T00:00:00Z'), lt: new Date('2026-10-07T00:00:00Z') },
  });
  assert.deepEqual(calls.writes.map(([n]) => n), ['activities.create', 'workout_sets.createMany']);
  assert.equal(calls.executeRaw.length, 2, 'lock + ranking recalculado na mesma transacao');
  assert.match(calls.executeRaw[1].sql, /INSERT INTO group_rankings/);
});
```

`BackEndTorv/src/repository/tests/gps.repository.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

// Prisma falso: registra a ordem das chamadas (lock, contagem, inserts, recálculo) do teste em andamento.
let calls = null;
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const w = (name, ret) => async (args) => { calls.order.push(name); calls.writes.push([name, args]); return typeof ret === 'function' ? ret(args) : ret; };
const fakePrisma = {
  $executeRaw: async (query) => {
    calls.executeRaw.push(query);
    calls.order.push(/pg_advisory_xact_lock/.test(query.sql) ? 'lock' : /INSERT INTO group_rankings/.test(query.sql) ? 'recompute' : 'executeRaw');
    return 1;
  },
  $transaction: async (fn) => fn(fakePrisma),
  workout_routines: { findFirst: async (args) => { calls.reads.push(['routines.findFirst', args]); return calls.routine; } },
  activities: {
    count: async (args) => { calls.order.push('count'); calls.counts.push(args); return calls.dayCount; },
    create: w('activities.create', { id: ACTIVITY }),
    findFirst: async (args) => { calls.reads.push(['activities.findFirst', args]); return calls.activity; },
    updateMany: w('activities.updateMany', () => ({ count: calls.updated })),
    deleteMany: w('activities.deleteMany', () => ({ count: calls.deleted })),
  },
  activity_gps_data: { create: w('gps.create', {}) },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../gps.repository');

const fresh = (over = {}) => ({ order: [], writes: [], reads: [], executeRaw: [], counts: [], dayCount: 0, routine: null, activity: null, updated: 1, deleted: 1, ...over });
const metrics = {
  distance_m: 8670.74, duration_sec: 2877, elapsed_sec: 2882, pace_sec_per_km: 332, elevation_gain_m: 38.3,
  avg_hr: 151, max_hr: 169, avg_cadence: 175, calories: 726, splits: [{ km: 1, distance_m: 1000, duration_sec: 338 }], route: [[-10.5, -52.5]],
};
const input = { routineId: ROUTINE, type: 'RUN', title: 'Corrida', startTime: new Date('2026-10-06T12:00:00Z'), metrics };

test('findGpsRoutine: só rotina de GPS do próprio usuário', async () => {
  calls = fresh({ routine: { id: ROUTINE } });
  await repo.findGpsRoutine(USER, ROUTINE);
  assert.deepEqual(calls.reads[0][1].where, { id: ROUTINE, user_id: USER, activity_type: { in: ['RUN', 'WALK'] } });
});

test('findByStart: atividade de GPS do usuário no mesmo instante (nunca musculação)', async () => {
  calls = fresh({ activity: { id: ACTIVITY } });
  assert.equal(await repo.findByStart(USER, input.startTime), ACTIVITY);
  assert.deepEqual(calls.reads[0][1].where, { user_id: USER, start_time: input.startTime, activity_type: { not: 'STRENGTH' } });
  calls = fresh();
  assert.equal(await repo.findByStart(USER, input.startTime), null);
});

test('createGpsActivity: lock → teto (todos os tipos) → atividade → métricas → ranking, na mesma transação', async () => {
  calls = fresh({ dayCount: 4 });
  assert.equal(await repo.createGpsActivity(USER, input), ACTIVITY);
  assert.deepEqual(calls.order, ['lock', 'count', 'activities.create', 'gps.create', 'recompute']);
  assert.deepEqual(calls.counts[0].where, { user_id: USER, start_time: { gte: new Date('2026-10-06T00:00:00Z'), lt: new Date('2026-10-07T00:00:00Z') } });
  const [, act] = calls.writes.find(([n]) => n === 'activities.create');
  assert.deepEqual(act.data, {
    user_id: USER, activity_type: 'RUN', title: 'Corrida', start_time: input.startTime, routine_id: ROUTINE,
    duration_sec: 2877, distance_m: 8670.74, calories: 726,
  });
  const [, gps] = calls.writes.find(([n]) => n === 'gps.create');
  assert.deepEqual(gps.data, {
    activity_id: ACTIVITY, elapsed_sec: 2882, elevation_gain_m: 38.3, avg_hr: 151, max_hr: 169, avg_cadence: 175,
    splits: metrics.splits, route: metrics.route,
  });
});

test('createGpsActivity: 6a atividade do dia (de qualquer tipo) → SESSION_DAY_LIMIT, nada gravado nem recalculado', async () => {
  calls = fresh({ dayCount: 5 });
  await assert.rejects(repo.createGpsActivity(USER, input), { code: 'SESSION_DAY_LIMIT' });
  assert.deepEqual(calls.order, ['lock', 'count']);
});

test('getGpsActivity, renameGps e deleteGps: só do dono e só GPS; apagar recalcula o ranking', async () => {
  calls = fresh();
  await repo.getGpsActivity(USER, ACTIVITY);
  assert.deepEqual(calls.reads[0][1].where, { id: ACTIVITY, user_id: USER, activity_type: { in: ['RUN', 'WALK'] } });

  calls = fresh({ updated: 0 });
  assert.equal(await repo.renameGps(USER, ACTIVITY, 'Novo'), false);
  assert.deepEqual(calls.writes[0][1], { where: { id: ACTIVITY, user_id: USER, activity_type: { in: ['RUN', 'WALK'] } }, data: { title: 'Novo' } });

  calls = fresh({ deleted: 1 });
  assert.equal(await repo.deleteGps(USER, ACTIVITY), true);
  assert.deepEqual(calls.order, ['activities.deleteMany', 'recompute']);
  calls = fresh({ deleted: 0 });
  assert.equal(await repo.deleteGps(USER, ACTIVITY), false);
  assert.deepEqual(calls.order, ['activities.deleteMany']);
});
```

- [ ] **Step 2:** `npm test` → falham (módulo inexistente e a contagem ainda com `STRENGTH`).

- [ ] **Step 3: Implementar**

`BackEndTorv/src/repository/activityWrites.js`. O bloco do `serializePerUser`, com os comentários, sai **inteiro e sem mudança** de `workout.repository.js`:

```js
const { Prisma } = require('@prisma/client');

// Teto de atividades por dia UTC do início, somando TODOS os tipos (musculação e GPS). O ranking dos grupos desempata
// por activities_count, e cada POST cria uma atividade: sem teto, repetir POSTs no mesmo dia forjaria o desempate.
const MAX_ACTIVITIES_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// <bloco do serializePerUser movido de workout.repository.js, com os comentários>

// Dentro da transação: advisory lock do usuário (serializa os salvamentos até o commit; sem ele, POSTs paralelos contam
// o mesmo total antes de qualquer insert e furam o teto em READ COMMITTED; userId parametrizado) e o teto do dia,
// contado antes do insert. A mensagem é a mesma de antes, para os dois caminhos.
async function lockAndCheckDailyCap(tx, userId, startTime) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`);
  const dayStart = new Date(Math.floor(startTime.getTime() / DAY_MS) * DAY_MS);
  const sameDay = await tx.activities.count({
    where: { user_id: userId, start_time: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } },
  });
  if (sameDay >= MAX_ACTIVITIES_PER_DAY) {
    throw Object.assign(new Error('too many sessions on that day'), { code: 'SESSION_DAY_LIMIT' });
  }
}

module.exports = { MAX_ACTIVITIES_PER_DAY, serializePerUser, lockAndCheckDailyCap };
```

`workout.repository.js`:
- saem `MAX_SESSIONS_PER_DAY`, `DAY_MS` e o bloco do `serializePerUser`;
- entra `const { serializePerUser, lockAndCheckDailyCap } = require('./activityWrites');`;
- no `createSession`, as linhas do lock, do `dayStart`, do `count` e do `throw` viram:

```js
      // Fila do usuário + lock + teto do dia (todos os tipos). A idempotência por started_at exato vem antes, no controller.
      await lockAndCheckDailyCap(tx, userId, started_at);
```

`BackEndTorv/src/repository/gps.repository.js`:

```js
const prisma = require('../lib/prisma');
const groupsRepository = require('./groups.repository');
const { serializePerUser, lockAndCheckDailyCap } = require('./activityWrites');

const TX = { timeout: 15000 };
const GPS = { activity_type: { in: ['RUN', 'WALK'] } };
const DETAIL_SELECT = {
  id: true, activity_type: true, title: true, start_time: true, routine_id: true,
  distance_m: true, duration_sec: true, calories: true,
  activity_gps_data: {
    select: { elapsed_sec: true, elevation_gain_m: true, avg_hr: true, max_hr: true, avg_cadence: true, splits: true, route: true },
  },
};

class GpsRepository {
  // Rotina de corrida ou caminhada do usuário; null = não existe, é de outro usuário ou é de musculação.
  findGpsRoutine(userId, routineId) {
    return prisma.workout_routines.findFirst({
      where: { id: routineId, user_id: userId, ...GPS },
      select: { id: true, name: true, activity_type: true },
    });
  }

  // Deduplicação: a atividade de GPS do usuário que começa exatamente nesse instante (índice único parcial no banco).
  async findByStart(userId, startTime) {
    const row = await prisma.activities.findFirst({
      where: { user_id: userId, start_time: startTime, activity_type: { not: 'STRENGTH' } },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  // Mesma fila, lock e teto da musculação. Atividade, métricas e ranking na MESMA transação: ou grava tudo, ou nada.
  async createGpsActivity(userId, { routineId, type, title, startTime, metrics }) {
    return serializePerUser(userId, () => prisma.$transaction(async (tx) => {
      await lockAndCheckDailyCap(tx, userId, startTime);
      const activity = await tx.activities.create({
        data: {
          user_id: userId,
          activity_type: type,
          title,
          start_time: startTime,
          routine_id: routineId,
          duration_sec: metrics.duration_sec, // em movimento
          distance_m: metrics.distance_m,
          calories: metrics.calories,
        },
        select: { id: true },
      });
      await tx.activity_gps_data.create({
        data: {
          activity_id: activity.id,
          elapsed_sec: metrics.elapsed_sec,
          elevation_gain_m: metrics.elevation_gain_m,
          avg_hr: metrics.avg_hr,
          max_hr: metrics.max_hr,
          avg_cadence: metrics.avg_cadence,
          splits: metrics.splits,
          route: metrics.route,
        },
      });
      await groupsRepository.recomputeRanking(tx, userId);
      return activity.id;
    }, TX));
  }

  getGpsActivity(userId, id) {
    return prisma.activities.findFirst({ where: { id, user_id: userId, ...GPS }, select: DETAIL_SELECT });
  }

  // Renomear não muda a data: o ranking não muda.
  async renameGps(userId, id, title) {
    const { count } = await prisma.activities.updateMany({ where: { id, user_id: userId, ...GPS }, data: { title } });
    return count > 0;
  }

  // Apagar muda o ranking: recalcula na mesma transação. activity_gps_data sai junto (cascade).
  async deleteGps(userId, id) {
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.activities.deleteMany({ where: { id, user_id: userId, ...GPS } });
      if (count) await groupsRepository.recomputeRanking(tx, userId);
      return count > 0;
    }, TX);
  }
}

module.exports = new GpsRepository();
```

- [ ] **Step 4:** `npm test` → tudo PASS. A rajada de 12 (`createSession`) continua com 5 criados e 7 recusados.
- [ ] **Step 5:** commit (`feat(gps): GPS repository; daily cap counts every activity type`) com os 5 arquivos.

---

### Task 7: Backend — rotas `/activities/gps` e tipos de atividade

**Recruit:** Torv Backend · **Files:**
- Create:
  - `BackEndTorv/src/routes/gps.schemas.js`
  - `BackEndTorv/src/routes/gps.routes.js`
  - `BackEndTorv/src/controller/gps.controller.js`
  - `BackEndTorv/src/routes/tests/gps.routes.test.js`
- Modify:
  - `BackEndTorv/server.js`
  - `BackEndTorv/src/routes/activities.schemas.js` (`ACTIVITY_TYPES = ['STRENGTH', 'RUN', 'WALK']`)
  - `BackEndTorv/src/routes/tests/activities.routes.test.js` (na lista de 400, `type=RUN` vira `type=RIDE`; novo caso: `type=RUN` chega ao repositório)

- [ ] **Step 1: Testes que falham** — `BackEndTorv/src/routes/tests/gps.routes.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Fastify = require('fastify');

const USER = '11111111-1111-4111-8111-111111111111';
const ROUTINE = '22222222-2222-4222-8222-222222222222';
const ACTIVITY = '66666666-6666-4666-8666-666666666666';
const authPath = require.resolve('../../middlewares/auth.middleware');
require.cache[authPath] = { id: authPath, filename: authPath, loaded: true, exports: async (request) => { request.user = { userId: USER }; } };

const gpsRepository = require('../../repository/gps.repository');
const profileRepository = require('../../repository/profile.repository');

const { points } = JSON.parse(fs.readFileSync(path.join(__dirname, '../../lib/tests/fixtures/run-sample.json'), 'utf8'));
// Dentro da janela de 72 h: começou 2 h atrás e terminou ~1h12 atrás.
const recent = () => new Date(Date.now() - 2 * 3600 * 1000).toISOString();
const body = (over = {}) => ({ activity_type: 'RUN', start_time: recent(), points, ...over });

async function build(t) {
  const app = Fastify();
  app.register(require('../gps.routes'), { prefix: '/activities/gps' });
  t.after(() => app.close());
  await app.ready();
  return app;
}
const call = (app, method, url, payload) => app.inject({ method, url, payload });

function mocks(t, over = {}) {
  return {
    weight: t.mock.method(profileRepository, 'getLatestMeasurement', async () => over.weight === undefined ? { weight_kg: '75.00' } : over.weight),
    routine: t.mock.method(gpsRepository, 'findGpsRoutine', async () => over.routine === undefined ? { id: ROUTINE, name: 'Corrida leve', activity_type: 'RUN' } : over.routine),
    byStart: t.mock.method(gpsRepository, 'findByStart', async () => over.existing ?? null),
    create: t.mock.method(gpsRepository, 'createGpsActivity', over.create ?? (async () => ACTIVITY)),
  };
}

test('POST /preview: calcula as métricas da amostra e não grava nada', async (t) => {
  const m = mocks(t);
  const res = await call(await build(t), 'POST', '/activities/gps/preview', body());
  assert.equal(res.statusCode, 200);
  const out = res.json();
  assert.equal(out.activity_type, 'RUN');
  assert.equal(out.distance_m, 8670.74);
  assert.equal(out.duration_sec, 2877);
  assert.equal(out.pace_sec_per_km, 332);
  assert.equal(out.calories, 726);
  assert.equal(out.splits.length, 9);
  assert.ok(out.route.length <= 500);
  assert.equal(m.create.mock.callCount(), 0);
  assert.equal(m.weight.mock.calls[0].arguments[0], USER);
});

test('POST /preview: sem peso cadastrado → calorias null (Review Focus 4)', async (t) => {
  mocks(t, { weight: null });
  const res = await call(await build(t), 'POST', '/activities/gps/preview', body());
  assert.equal(res.json().calories, null);
});

test('POST /: 201 com o detalhe; título do GPX aparado; vazio vira o nome da rotina', async (t) => {
  const m = mocks(t);
  const app = await build(t);
  const res = await call(app, 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE, title: '  Longão  ' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().id, ACTIVITY);
  assert.equal(res.json().title, 'Longão');
  assert.equal(res.json().routine_id, ROUTINE);
  assert.deepEqual(m.routine.mock.calls[0].arguments, [USER, ROUTINE]);
  const [userId, data] = m.create.mock.calls[0].arguments;
  assert.equal(userId, USER);
  assert.equal(data.routineId, ROUTINE);
  assert.equal(data.type, 'RUN');
  assert.ok(data.startTime instanceof Date);
  assert.equal(data.metrics.distance_m, 8670.74);
  const blank = await call(app, 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE, title: '   ' });
  assert.equal(blank.json().title, 'Corrida leve');
});

test('POST /: rotina inexistente, de outro usuário ou de musculação → 404 sem gravar', async (t) => {
  const m = mocks(t, { routine: null });
  const res = await call(await build(t), 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
  assert.equal(res.statusCode, 404);
  assert.equal(m.create.mock.callCount(), 0);
});

test('POST /: mesmo início já importado → 409 com o activity_id; corrida no insert (P2002) também (Review Focus 2)', async (t) => {
  mocks(t, { existing: ACTIVITY });
  const app = await build(t);
  const dup = await call(app, 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
  assert.equal(dup.statusCode, 409);
  assert.deepEqual(dup.json(), { error: 'Activity already imported', activity_id: ACTIVITY });

  await t.test('P2002', async (st) => {
    let seen = 0;
    mocks(st, { create: async () => { throw Object.assign(new Error('unique'), { code: 'P2002' }); } });
    st.mock.method(gpsRepository, 'findByStart', async () => (seen++ === 0 ? null : ACTIVITY));
    const race = await call(await build(st), 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
    assert.equal(race.statusCode, 409);
    assert.deepEqual(race.json(), { error: 'Activity already imported', activity_id: ACTIVITY });
  });
});

test('POST /: teto do dia → 400 com a mensagem do repositório', async (t) => {
  mocks(t, { create: async () => { throw Object.assign(new Error('too many sessions on that day'), { code: 'SESSION_DAY_LIMIT' }); } });
  const res = await call(await build(t), 'POST', '/activities/gps', { ...body(), routine_id: ROUTINE });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.json(), { error: 'too many sessions on that day' });
});

test('POST /preview 400: janela, ordem, faixa, tipo, velocidade e quantidade de pontos', async (t) => {
  mocks(t);
  const app = await build(t);
  const old = new Date(Date.now() - 73 * 3600 * 1000).toISOString();
  const fast = Array.from({ length: 61 }, (_, i) => [i * 10, -15 + (i * 83.4) / 111195.08, -47]); // 30 km/h por 10 min
  const cases = [
    [{ start_time: old }, 'start_time must be within the last 72 hours'],
    [{ points: [[1, -15, -47], [2, -15, -47]] }, 'invalid point at index 0'],
    [{ points: [[0, -15, -47], [9, -15, -47], [3, -15, -47]] }, 'points must be in chronological order'],
    [{ points: [[0, -15, -47], [9, 91, -47]] }, 'invalid point at index 1'],
    [{ points: fast }, 'speed not compatible with run or walk'],
    [{ points: [[0, -15, -47], [30, -15.0001, -47]] }, 'activity too short'],
  ];
  for (const [over, error] of cases) {
    const res = await call(app, 'POST', '/activities/gps/preview', body(over));
    assert.equal(res.statusCode, 400, error);
    assert.deepEqual(res.json(), { error }, error);
  }
  for (const over of [{ activity_type: 'RIDE' }, { points: [[0, -15, -47]] }, { points: Array(30001).fill([0, -15, -47]) }, { start_time: 'ontem' }]) {
    assert.equal((await call(app, 'POST', '/activities/gps/preview', body(over))).statusCode, 400, JSON.stringify(over).slice(0, 60));
  }
});

test('POST /preview: corpo acima de 2 MiB → 413, nunca 500 (Review Focus 5)', async (t) => {
  mocks(t);
  const huge = Array.from({ length: 30000 }, (_, i) => [i, -15.123456789012345, -47.123456789012345, 1234.5678901234, 150.000001, 85.000001]);
  const res = await call(await build(t), 'POST', '/activities/gps/preview', body({ points: huge }));
  assert.equal(res.statusCode, 413);
});

test('GET, PATCH e DELETE /:id: só do dono (null do repositório → 404); PATCH devolve o detalhe', async (t) => {
  const row = {
    id: ACTIVITY, activity_type: 'RUN', title: 'Corrida', start_time: new Date('2026-10-14T10:00:00Z'), routine_id: ROUTINE,
    distance_m: '8670.74', duration_sec: 2877, calories: 726,
    activity_gps_data: { elapsed_sec: 2882, elevation_gain_m: '38.3', avg_hr: 151, max_hr: 169, avg_cadence: 175, splits: [{ km: 1, distance_m: 1000, duration_sec: 338 }], route: [[-10.5, -52.5]] },
  };
  const get = t.mock.method(gpsRepository, 'getGpsActivity', async () => row);
  const rename = t.mock.method(gpsRepository, 'renameGps', async () => true);
  const del = t.mock.method(gpsRepository, 'deleteGps', async () => true);
  const app = await build(t);
  const res = await call(app, 'GET', `/activities/gps/${ACTIVITY}`);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), {
    id: ACTIVITY, activity_type: 'RUN', title: 'Corrida', start_time: '2026-10-14T10:00:00.000Z', routine_id: ROUTINE,
    distance_m: 8670.74, duration_sec: 2877, elapsed_sec: 2882, pace_sec_per_km: 332, elevation_gain_m: 38.3,
    avg_hr: 151, max_hr: 169, avg_cadence: 175, calories: 726,
    splits: [{ km: 1, distance_m: 1000, duration_sec: 338 }], route: [[-10.5, -52.5]],
  });
  assert.deepEqual(get.mock.calls[0].arguments, [USER, ACTIVITY]);
  assert.equal((await call(app, 'PATCH', `/activities/gps/${ACTIVITY}`, { title: '  Novo  ' })).statusCode, 200);
  assert.deepEqual(rename.mock.calls[0].arguments, [USER, ACTIVITY, 'Novo']);
  assert.equal((await call(app, 'PATCH', `/activities/gps/${ACTIVITY}`, { title: '   ' })).statusCode, 400);
  assert.equal((await call(app, 'DELETE', `/activities/gps/${ACTIVITY}`)).statusCode, 204);
  assert.deepEqual(del.mock.calls[0].arguments, [USER, ACTIVITY]);

  get.mock.mockImplementation(async () => null);
  rename.mock.mockImplementation(async () => false);
  del.mock.mockImplementation(async () => false);
  assert.equal((await call(app, 'GET', `/activities/gps/${ACTIVITY}`)).statusCode, 404);
  assert.equal((await call(app, 'PATCH', `/activities/gps/${ACTIVITY}`, { title: 'X' })).statusCode, 404);
  assert.equal((await call(app, 'DELETE', `/activities/gps/${ACTIVITY}`)).statusCode, 404);
  assert.equal((await call(app, 'GET', '/activities/gps/nope')).statusCode, 400);
});

test('POST /preview: 31ª chamada no mesmo minuto → 429', async (t) => {
  mocks(t);
  const app = await build(t);
  const tiny = { activity_type: 'RUN', start_time: recent(), points: [[0, -15, -47]] }; // 400 rápido; conta para o limite igual
  let last;
  for (let i = 0; i < 31; i += 1) last = await call(app, 'POST', '/activities/gps/preview', tiny);
  assert.equal(last.statusCode, 429);
});
```

`BackEndTorv/src/routes/tests/activities.routes.test.js`:
- na lista do teste de 400, trocar `'type=RUN'` por `'type=RIDE'`;
- acrescentar:

```js
test('GET /activities: type=RUN e type=WALK chegam ao repository', async (t) => {
  const list = t.mock.method(activitiesRepository, 'listActivities', async () => []);
  const app = await build(t);
  for (const type of ['RUN', 'WALK']) assert.equal((await get(app, `/activities?type=${type}`)).statusCode, 200, type);
  assert.deepEqual(list.mock.calls.map((c) => c.arguments[1].type), ['RUN', 'WALK']);
});
```

- [ ] **Step 2:** `npm test` → os testes novos falham.

- [ ] **Step 3: Implementar**

`BackEndTorv/src/routes/gps.schemas.js`:

```js
const { Type } = require('@sinclair/typebox');
const { Uuid } = require('./workout.schemas');

const GpsType = Type.Union([Type.Literal('RUN'), Type.Literal('WALK')]);
// [t, lat, lon, ele?, hr?, cad?]: número ou null em cada posição. Faixas e ordem ficam em lib/gpsValidation (uma regra
// por posição em 30.000 pontos pesaria no Ajv). Nullable em corpo: type array, nunca Union (bug do coerceTypes).
const NumOrNull = Type.Unsafe({ type: ['number', 'null'] });
const Points = Type.Array(Type.Array(NumOrNull, { minItems: 3, maxItems: 6 }), { minItems: 2, maxItems: 30000 });

const PreviewBody = Type.Object({
  activity_type: GpsType,
  start_time: Type.String({ format: 'date-time' }),
  points: Points,
});

const CreateBody = Type.Object({
  routine_id: Uuid,
  activity_type: GpsType,
  title: Type.Optional(Type.String({ maxLength: 100 })),
  start_time: Type.String({ format: 'date-time' }),
  points: Points,
});

const TitleBody = Type.Object({ title: Type.String({ minLength: 1, maxLength: 100 }) });

const Nullable = (schema) => Type.Union([schema, Type.Null()]);
const MetricsFields = {
  activity_type: Type.String(),
  start_time: Type.String(),
  distance_m: Type.Number(),
  duration_sec: Type.Integer(),
  elapsed_sec: Type.Integer(),
  pace_sec_per_km: Nullable(Type.Integer()),
  elevation_gain_m: Nullable(Type.Number()),
  avg_hr: Nullable(Type.Integer()),
  max_hr: Nullable(Type.Integer()),
  avg_cadence: Nullable(Type.Integer()),
  calories: Nullable(Type.Integer()),
  splits: Type.Array(Type.Object({ km: Type.Integer(), distance_m: Type.Integer(), duration_sec: Type.Integer() })),
  route: Type.Array(Type.Array(Type.Number(), { minItems: 2, maxItems: 2 })),
};
const GpsMetrics = Type.Object(MetricsFields);
const GpsActivityDetail = Type.Object({ id: Type.String(), title: Type.String(), routine_id: Nullable(Type.String()), ...MetricsFields });
const Conflict = Type.Object({ error: Type.String(), activity_id: Type.Optional(Type.String()) });

module.exports = { PreviewBody, CreateBody, TitleBody, GpsMetrics, GpsActivityDetail, Conflict };
```

`BackEndTorv/src/controller/gps.controller.js`:

```js
const gpsRepository = require('../repository/gps.repository');
const profileRepository = require('../repository/profile.repository');
const { computeMetrics } = require('../lib/gpsMetrics');
const { checkPoints, checkWindow, checkPlausible } = require('../lib/gpsValidation');

const NOT_FOUND = { error: 'Not found' };
const DUPLICATE = 'Activity already imported';

// Pontos → métricas, com todas as regras que não dependem do banco. { error } ou { metrics, startTime }.
async function analyze(userId, body) {
  const startTime = new Date(body.start_time);
  // O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
  if (Number.isNaN(startTime.getTime())) return { error: 'body/start_time must match format "date-time"' };
  const checked = checkPoints(body.points);
  if (checked.error) return { error: checked.error };
  const elapsedSec = checked.points[checked.points.length - 1][0];
  const windowError = checkWindow(startTime.getTime(), elapsedSec);
  if (windowError) return { error: windowError };
  const measurement = await profileRepository.getLatestMeasurement(userId);
  const weightKg = measurement?.weight_kg == null ? null : Number(measurement.weight_kg);
  const metrics = computeMetrics(checked.points, { type: body.activity_type, weightKg });
  const implausible = checkPlausible(metrics);
  return implausible ? { error: implausible } : { metrics, startTime };
}

// Linha do banco → detalhe da API (mesmo formato da resposta da criação).
function detailFromRow(a) {
  const g = a.activity_gps_data;
  const distance = Number(a.distance_m);
  return {
    id: a.id,
    activity_type: a.activity_type,
    title: a.title ?? '',
    start_time: a.start_time.toISOString(),
    routine_id: a.routine_id,
    distance_m: distance,
    duration_sec: a.duration_sec,
    elapsed_sec: g.elapsed_sec,
    pace_sec_per_km: distance > 0 ? Math.round(a.duration_sec / (distance / 1000)) : null,
    elevation_gain_m: g.elevation_gain_m == null ? null : Number(g.elevation_gain_m),
    avg_hr: g.avg_hr,
    max_hr: g.max_hr,
    avg_cadence: g.avg_cadence,
    calories: a.calories,
    splits: g.splits,
    route: g.route,
  };
}

class GpsController {
  async preview(request, reply) {
    const { error, metrics, startTime } = await analyze(request.user.userId, request.body);
    if (error) return reply.status(400).send({ error });
    return reply.send({ activity_type: request.body.activity_type, start_time: startTime.toISOString(), ...metrics });
  }

  async create(request, reply) {
    const { userId } = request.user;
    const { routine_id: routineId, activity_type: type } = request.body;
    const routine = await gpsRepository.findGpsRoutine(userId, routineId);
    if (!routine) return reply.status(404).send(NOT_FOUND);
    const { error, metrics, startTime } = await analyze(userId, request.body);
    if (error) return reply.status(400).send({ error });
    const existing = await gpsRepository.findByStart(userId, startTime);
    if (existing) return reply.status(409).send({ error: DUPLICATE, activity_id: existing });
    const title = request.body.title?.trim() || routine.name;
    try {
      const id = await gpsRepository.createGpsActivity(userId, { routineId: routine.id, type, title, startTime, metrics });
      return reply.status(201).send({ id, title, routine_id: routine.id, activity_type: type, start_time: startTime.toISOString(), ...metrics });
    } catch (err) {
      // 400, não 409: o app trata como "não dá para salvar", igual à musculação.
      if (err.code === 'SESSION_DAY_LIMIT') return reply.status(400).send({ error: err.message });
      if (err.code !== 'P2002') throw err;
      // Corrida: outra request com o mesmo start_time gravou entre a checagem e o insert.
      const winner = await gpsRepository.findByStart(userId, startTime);
      return reply.status(409).send({ error: DUPLICATE, activity_id: winner ?? undefined });
    }
  }

  async get(request, reply) {
    const row = await gpsRepository.getGpsActivity(request.user.userId, request.params.id);
    return row ? reply.send(detailFromRow(row)) : reply.status(404).send(NOT_FOUND);
  }

  async rename(request, reply) {
    const { userId } = request.user;
    const { id } = request.params;
    const title = request.body.title.trim();
    if (!title) return reply.status(400).send({ error: 'title must not be blank' });
    if (!await gpsRepository.renameGps(userId, id, title)) return reply.status(404).send(NOT_FOUND);
    return reply.send(detailFromRow(await gpsRepository.getGpsActivity(userId, id)));
  }

  async remove(request, reply) {
    const ok = await gpsRepository.deleteGps(request.user.userId, request.params.id);
    return ok ? reply.status(204).send() : reply.status(404).send(NOT_FOUND);
  }
}

module.exports = new GpsController();
```

`BackEndTorv/src/routes/gps.routes.js`:

```js
const { Type } = require('@sinclair/typebox');
const gps = require('../controller/gps.controller');
const authenticateToken = require('../middlewares/auth.middleware');
const { errors, IdParams } = require('./workout.schemas');
const S = require('./gps.schemas');

const tags = ['Activities'];
const security = [{ bearerAuth: [] }];
// 30.000 pontos compactos ≈ 1,2 MB de JSON: o padrão do Fastify (1 MiB) não cabe. A Vercel aceita até 4,5 MB.
const BODY_LIMIT = 2 * 1024 * 1024;
// O cálculo é a parte cara: freia rajada. Por IP, como nos convites (o rate-limit roda antes da autenticação).
const computeLimit = { rateLimit: { max: 30, timeWindow: '1 minute' } };

async function gpsRoutes(fastify) {
  await fastify.register(require('@fastify/rate-limit'), { global: false });
  fastify.addHook('preHandler', authenticateToken);

  fastify.post('/preview', {
    bodyLimit: BODY_LIMIT,
    config: computeLimit,
    schema: {
      description: 'Calcula as métricas dos pontos de um .gpx (lido no app) sem gravar nada',
      tags, security, body: S.PreviewBody,
      response: { 200: S.GpsMetrics, ...errors(400, 401, 403, 413, 429) },
    },
  }, gps.preview);

  fastify.post('/', {
    bodyLimit: BODY_LIMIT,
    config: computeLimit,
    schema: {
      description: 'Importa uma corrida ou caminhada numa rotina de GPS. Mesmo início de outra importação → 409 com o activity_id',
      tags, security, body: S.CreateBody,
      response: { 201: S.GpsActivityDetail, 409: S.Conflict, ...errors(400, 401, 403, 404, 413, 429) },
    },
  }, gps.create);

  fastify.get('/:id', {
    schema: { description: 'Detalhe de uma atividade de GPS (só do dono)', tags, security, params: IdParams, response: { 200: S.GpsActivityDetail, ...errors(400, 401, 403, 404) } },
  }, gps.get);

  fastify.patch('/:id', {
    schema: { description: 'Renomeia (a data e as métricas não mudam)', tags, security, params: IdParams, body: S.TitleBody, response: { 200: S.GpsActivityDetail, ...errors(400, 401, 403, 404) } },
  }, gps.rename);

  fastify.delete('/:id', {
    schema: { description: 'Apaga e recalcula o ranking dos grupos', tags, security, params: IdParams, response: { 204: Type.Null(), ...errors(400, 401, 403, 404) } },
  }, gps.remove);
}

module.exports = gpsRoutes;
```

`BackEndTorv/server.js`, logo depois do registro de `/activities`:

```js
fastify.register(require('./src/routes/gps.routes'), { prefix: '/activities/gps' });
```

`BackEndTorv/src/routes/activities.schemas.js`: `const ACTIVITY_TYPES = ['STRENGTH', 'RUN', 'WALK'];`

- [ ] **Step 4:** `npm test` → tudo PASS. Anotar o total.
- [ ] **Step 5:** commit (`feat(gps): /activities/gps preview, import, detail, rename and delete`) com os 7 arquivos.

---

### Task 8: Teste da etapa de Backend (e reinício do Furnace)

**Recruit:** Torv Review and Tests (depois de o Maestro reiniciar o Furnace) · **Files:**
- Create: `docs/qa-gpx-import-backend-2026-10-14.md`

- [ ] **Step 1 (Maestro):** confirmar que o Furnace recarregou e que `/documentation/json` lista `/activities/gps/*`.
- [ ] **Step 2:** `npm test` → 0 falhas; anotar o total.
- [ ] **Step 3: Contrato ao vivo**

Contas QA: **A**, com peso cadastrado e dona de um grupo com **B**; **B**, sem peso; **C**, fora. O GPX de teste sai da fixture `run-sample.json`, com os horários deslocados para terminar ~10 min antes do teste. Os arquivos ficam numa pasta temporária, fora do repositório.

1. **Rotinas:**
   - A cria uma rotina `RUN` só com nome → 201 com `activity_type`;
   - com exercícios → 400;
   - o `GET /workouts/routines` mostra a rotina, e o `next_routine_id` a ignora;
   - um `PUT` trocando o tipo → 400.
2. **Prévia:** os números batem com a referência da spec (8.670,74 m, 2.877 s, pace 332, 9 parciais), e as calorias, com a fórmula e o peso de A. Para B, sem peso, as calorias vêm `null`.
3. **Importação:** 201. Depois disso:
   - o `GET /activities/gps/:id` traz o detalhe;
   - o `GET /activities?type=RUN` traz o item com `distance_m`;
   - o ranking do grupo de A ganha +1 dia (se A ainda não tinha treinado hoje);
   - o `/activities/summary` soma as calorias e conta o streak;
   - o `GET /users/<A>/profile`, chamado por B, mostra o dia no calendário, e o `GET /users/<A>/activities` traz o item **sem** rota nem FC.
4. **Duplicado:**
   - a mesma importação de novo → 409 com `activity_id`;
   - duas importações paralelas do mesmo arquivo → uma 201 e uma 409.
5. **Teto:** 4 treinos de musculação e 1 GPS no mesmo dia UTC → a 6ª atividade, de qualquer tipo, dá 400.
6. **400 e 413:**
   - início com 73 h;
   - início no futuro;
   - 1º `t` diferente de 0;
   - ordem trocada;
   - `lat` 91;
   - 30.001 pontos;
   - arquivo de carro (30 km/h);
   - atividade curta;
   - corpo de 2,1 MB → 413.
7. **Acesso:**
   - a atividade de A vista por C → 404 em `GET`, `PATCH` e `DELETE`;
   - rotina de outro usuário → 404;
   - `routine_id` de uma rotina de musculação → 404.
8. **Excluir:** 204; o ranking cai; a linha de `activity_gps_data` some.
9. **Rate limit:** 31 prévias em 1 minuto → 429.
10. **Musculação com `routine_id` de rotina RUN:** salva como "Treino livre", com `routine_id` nulo.
11. **Banco:**
    - a linha de `activity_gps_data` tem a rota com até 500 pares de 5 casas e as parciais;
    - nenhum ponto bruto nem série de FC fica guardado.
12. **Tempo:** a prévia de 30.000 pontos responde em menos de 1 s.

- [ ] **Step 4:** relatório, limpeza (contagem antes/depois) e commit só dele. **Falha → reabre a task responsável (3 a 7).**

---

### Task 9: Frontend — dependências, utilitários, serviços e tipos

**Recruit:** Torv Frontend · **Files:**
- Create:
  - `FrontEndTorv/src/utils/gpx.ts`, `gpx.test.mjs`
  - `gpsFormat.ts`, `gpsFormat.test.mjs`
  - `gpsErrors.ts`, `gpsErrors.test.mjs`
  - `routeProjection.ts`, `routeProjection.test.mjs`
  - `readPickedFile.ts`, `readPickedFile.web.ts`
  - `FrontEndTorv/src/services/gps.ts`
- Modify:
  - `FrontEndTorv/package.json`, `package-lock.json` (`npx expo install expo-document-picker expo-file-system`)
  - `src/services/activities.ts`, `src/utils/activities.ts`
  - `src/services/workouts.ts`
  - `src/utils/routineForm.ts`, `routineForm.test.mjs`
  - `src/utils/activityMeta.ts`

**Interfaces:**
- Produces:
  - `parseGpx(xml) → { name, type, startTime, points }`, que lança `GpxError` em pt-BR;
  - `GpsPoint`;
  - `formatDistance`, `formatPace`, `paceOf`, `splitRows`;
  - `gpsErrorText(status, message)`;
  - `projectRoute(route, w, h, margin)`;
  - `readPickedFile(asset) → Promise<string>`;
  - `gpsApi.{preview, create, get, rename, remove}` e os tipos `GpsMetrics`, `GpsActivityDetail` e `GpsType`;
  - `RoutineType` e `activity_type` nas rotinas;
  - `buildRoutineInput(name, items, type)`.

- [ ] **Step 0:** ler a doc do Expo (`AGENTS.md`). Em `FrontEndTorv`, rodar `npx expo install expo-document-picker expo-file-system`. No relatório, conferir que as versões batem com o SDK 57.

- [ ] **Step 1: Testes que falham** (os quatro arquivos)

`FrontEndTorv/src/utils/gpx.test.mjs`:

```js
// Roda com: node --test src/utils/gpx.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGpx, gpxTypeFrom, MAX_POINTS } from './gpx.ts';

const sample = readFileSync(new URL('./fixtures/run-sample.gpx', import.meta.url), 'utf8');
const gpx = (body, trkHeader = '') => `<?xml version="1.0"?><gpx version="1.1"><trk>${trkHeader}${body}</trk></gpx>`;
const pt = (lat, lon, time, inner = '') => `<trkpt lat="${lat}" lon="${lon}"><time>${time}</time>${inner}</trkpt>`;
const errorOf = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

test('parseGpx: amostra no formato do Strava (nome, tipo, início e pontos compactos)', () => {
  const out = parseGpx(sample);
  assert.equal(out.name, 'Corrida na hora do almoço');
  assert.equal(out.type, 'RUN');
  assert.equal(out.startTime, '2026-01-15T09:00:00.000Z');
  assert.equal(out.points.length, 120);
  assert.deepEqual(out.points[0], [0, -10.5, -52.5, 413.3, 83, 55]);
  assert.ok(out.points.every((p, i) => i === 0 || p[0] >= out.points[i - 1][0]));
});

test('parseGpx: extensão com prefixo do Garmin (ns3:) e sem extensão nenhuma (Review Focus 1)', () => {
  const garmin = parseGpx(gpx(`<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z', '<ele>10</ele><extensions><ns3:TrackPointExtension><ns3:hr>140</ns3:hr><ns3:cad>80</ns3:cad></ns3:TrackPointExtension></extensions>')}${pt(-15.001, -47, '2026-10-14T10:00:05Z')}</trkseg>`));
  assert.deepEqual(garmin.points, [[0, -15, -47, 10, 140, 80], [5, -15.001, -47, null, null, null]]);
  assert.equal(garmin.type, null);
  assert.equal(garmin.name, null);
});

test('parseGpx: vários segmentos e trilhas fora de ordem viram uma sequência por horário (Review Focus 1)', () => {
  const xml = `<gpx><trk><trkseg>${pt(-15.002, -47, '2026-10-14T10:00:10Z')}</trkseg><trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}</trkseg></trk><trk><trkseg>${pt(-15.001, -47, '2026-10-14T10:00:05.500Z')}</trkseg></trk></gpx>`;
  const out = parseGpx(xml);
  assert.deepEqual(out.points.map((p) => p[0]), [0, 5.5, 10]);
  assert.equal(out.startTime, '2026-10-14T10:00:00.000Z');
});

test('parseGpx: ponto sem horário ou com coordenada inválida é descartado', () => {
  const out = parseGpx(gpx(`<trkseg><trkpt lat="-15" lon="-47"/>${pt(-15, -47, '2026-10-14T10:00:00Z')}${pt(95, -47, '2026-10-14T10:00:01Z')}${pt(-15.001, -47, '2026-10-14T10:00:02Z')}</trkseg>`));
  assert.equal(out.points.length, 2);
});

test('parseGpx: erros em pt-BR (não é GPX, rota planejada, bike, pontos de menos) (Review Focus 3)', () => {
  assert.equal(errorOf(() => parseGpx('<html><body>oi</body></html>')), 'Este arquivo não é um GPX válido.');
  assert.equal(errorOf(() => parseGpx('<gpx><rte><rtept lat="-15" lon="-47"/></rte></gpx>')), 'O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade).');
  assert.equal(errorOf(() => parseGpx(gpx(`<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}</trkseg>`, '<type>cycling</type>'))), 'Bike chega em breve. Por enquanto, só corrida e caminhada.');
  assert.equal(errorOf(() => parseGpx(gpx(`<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}</trkseg>`))), 'O arquivo tem pontos de menos.');
});

test('parseGpx: entidades e CDATA no nome; nome cortado em 100 caracteres', () => {
  const body = `<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}${pt(-15.001, -47, '2026-10-14T10:00:05Z')}</trkseg>`;
  assert.equal(parseGpx(gpx(body, '<name>Corrida &amp; caf&#233; &#x1F3C3;</name>')).name, 'Corrida & café 🏃');
  assert.equal(parseGpx(gpx(body, '<name><![CDATA[Trilha <leve>]]></name>')).name, 'Trilha <leve>');
  assert.equal(parseGpx(gpx(body, `<name>${'a'.repeat(150)}</name>`)).name.length, 100);
});

test('parseGpx: acima de 30.000 pontos reduz por passo uniforme, mantendo o primeiro e o último (Review Focus 5)', () => {
  const n = MAX_POINTS + 1;
  const base = Date.parse('2026-10-14T10:00:00Z');
  const pts = Array.from({ length: n }, (_, i) => pt(-15 + i * 1e-5, -47, new Date(base + i * 1000).toISOString())).join('');
  const out = parseGpx(gpx(`<trkseg>${pts}</trkseg>`));
  assert.ok(out.points.length <= MAX_POINTS, String(out.points.length));
  assert.equal(out.points[0][0], 0);
  assert.equal(out.points[out.points.length - 1][0], n - 1);
});

test('gpxTypeFrom: nomes do Strava e do Garmin; número e desconhecido → null', () => {
  assert.deepEqual(['Running', ' hiking ', 'trail_running', 'Walking', 'Cycling', 'virtualride', '9', 'yoga', null].map(gpxTypeFrom),
    ['RUN', 'WALK', 'RUN', 'WALK', 'RIDE', 'RIDE', null, null, null]);
});
```

`FrontEndTorv/src/utils/gpsFormat.test.mjs`:

```js
// Roda com: node --test src/utils/gpsFormat.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDistance, formatPace, paceOf, splitRows } from './gpsFormat.ts';

test('formatDistance e formatPace em pt-BR', () => {
  assert.equal(formatDistance(8670.74), '8,67 km');
  assert.equal(formatDistance(450), '0,45 km');
  assert.equal(formatPace(332), '5:32 /km');
  assert.equal(formatPace(359.6), '6:00 /km');
});

test('paceOf: tempo em movimento por km; sem distância → null', () => {
  assert.equal(paceOf(2877, 8670.74), 332);
  assert.equal(paceOf(600, null), null);
  assert.equal(paceOf(600, 0), null);
});

test('splitRows: km cheio pelo número, sobra pela distância', () => {
  assert.deepEqual(splitRows([{ km: 1, distance_m: 1000, duration_sec: 338 }, { km: 9, distance_m: 671, duration_sec: 217 }]), [
    { label: '1', time: '5:38', pace: '5:38 /km' },
    { label: '0,67 km', time: '3:37', pace: '5:23 /km' },
  ]);
});
```

`FrontEndTorv/src/utils/gpsErrors.test.mjs`:

```js
// Roda com: node --test src/utils/gpsErrors.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { gpsErrorText } from './gpsErrors.ts';

test('gpsErrorText: mensagens conhecidas, ponto inválido e status (Review Focus 3)', () => {
  assert.equal(gpsErrorText(400, 'start_time must be within the last 72 hours'), 'Só dá para importar atividades das últimas 72 horas.');
  assert.equal(gpsErrorText(409, 'Activity already imported'), 'Você já importou esta atividade.');
  assert.equal(gpsErrorText(400, 'invalid point at index 7'), 'O arquivo tem pontos inválidos.');
  assert.equal(gpsErrorText(400, 'body/points must NOT have more than 30000 items'), 'Não foi possível processar o arquivo.');
  assert.equal(gpsErrorText(undefined), 'Sem conexão. Tente de novo.');
  assert.equal(gpsErrorText(413), 'Arquivo grande demais para enviar.');
  assert.equal(gpsErrorText(429), 'Muitas tentativas. Aguarde um minuto.');
  assert.equal(gpsErrorText(500), 'Algo deu errado. Tente de novo.');
});
```

`FrontEndTorv/src/utils/routeProjection.test.mjs`:

```js
// Roda com: node --test src/utils/routeProjection.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRoute } from './routeProjection.ts';

const rounded = (pts) => pts.map(([x, y]) => [Math.round(x), Math.round(y)]);

test('projectRoute: cabe com margem, mantém a proporção e põe o norte para cima', () => {
  // largura útil 180, altura útil 80; spanX = 0,002 e spanY = 0,001 → escala = min(90.000, 80.000) = 80.000
  assert.deepEqual(rounded(projectRoute([[0, 0], [0.001, 0], [0.001, 0.002]], 200, 100, 10)), [[20, 90], [20, 10], [180, 10]]);
});

test('projectRoute: linha norte-sul centralizada; ponto único no centro; vazio → vazio', () => {
  assert.deepEqual(rounded(projectRoute([[0, 0], [0.001, 0]], 200, 100, 10)), [[100, 90], [100, 10]]);
  assert.deepEqual(projectRoute([[-15, -47]], 200, 100), [[100, 50]]);
  assert.deepEqual(projectRoute([], 200, 100), []);
});
```

`FrontEndTorv/src/utils/routineForm.test.mjs`, novo teste:

```js
test('buildRoutineInput: rotina de corrida/caminhada vai só com nome e tipo, ignorando a lista', () => {
  assert.deepEqual(buildRoutineInput('  Corrida leve ', [], 'RUN'), { body: { name: 'Corrida leve', activity_type: 'RUN', exercises: [] } });
  assert.deepEqual(buildRoutineInput('', [], 'WALK'), { error: 'Dê um nome para a rotina.' });
  assert.deepEqual(buildRoutineInput('Peito', []), { error: 'Adicione pelo menos um exercício.' });
});
```

- [ ] **Step 2:** `node --test src/utils/*.test.mjs` → os novos falham.

- [ ] **Step 3: Implementar**

`FrontEndTorv/src/utils/gpx.ts`:

```ts
// Lê um .gpx no aparelho e devolve os pontos compactos que o servidor espera: [t, lat, lon, ele, hr, cad], com t em
// segundos desde o 1º ponto. O XML nunca vai para o servidor. Sem imports de runtime: testado direto no node.

export type GpxType = 'RUN' | 'WALK' | 'RIDE';
export type GpsPoint = [number, number, number, number | null, number | null, number | null];

export interface ParsedGpx {
  name: string | null; // <trk><name>, decodificado e cortado em 100 caracteres
  type: GpxType | null; // <trk><type>; null = sem tipo ou desconhecido (vale o tipo da rotina)
  startTime: string; // ISO do 1º ponto
  points: GpsPoint[];
}

export const MAX_POINTS = 30000;

export class GpxError extends Error {}

const TYPE_MAP: Record<string, GpxType> = {
  running: 'RUN', run: 'RUN', trail_running: 'RUN', treadmill_running: 'RUN',
  walking: 'WALK', walk: 'WALK', hiking: 'WALK', hike: 'WALK',
  cycling: 'RIDE', biking: 'RIDE', ride: 'RIDE', road_biking: 'RIDE', mountain_biking: 'RIDE',
  gravel_cycling: 'RIDE', e_biking: 'RIDE', virtualride: 'RIDE', indoor_cycling: 'RIDE',
};

export const gpxTypeFrom = (raw: string | null): GpxType | null => (raw ? TYPE_MAP[raw.trim().toLowerCase()] ?? null : null);

const codePoint = (n: number) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');

const decodeXml = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => codePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => codePoint(Number(dec)))
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

// Conteúdo da 1ª tag `name`, com ou sem prefixo de namespace (gpxtpx:, ns3:). Preguiçoso até o fechamento: o nome pode
// vir em CDATA com '<' dentro.
const tag = (body: string, name: string) => {
  const m = body.match(new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`));
  return m ? m[1].trim() : null;
};
const num = (s: string | null) => {
  if (s === null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const attr = (attrs: string, name: string) => num((attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`)) ?? [])[1] ?? null);

// Redução por passo uniforme a no máximo `max` itens, sempre com o primeiro e o último (mesma regra do servidor).
function thin<T>(list: T[], max: number): T[] {
  if (list.length <= max) return list;
  const step = Math.ceil((list.length - 1) / (max - 1));
  const out: T[] = [];
  for (let i = 0; i < list.length - 1; i += step) out.push(list[i]);
  out.push(list[list.length - 1]);
  return out;
}

export function parseGpx(xml: string): ParsedGpx {
  if (!/<gpx[\s>]/i.test(xml)) throw new GpxError('Este arquivo não é um GPX válido.');

  // Nome e tipo vêm do cabeçalho da 1ª trilha (antes do 1º <trkseg>), não dos pontos.
  const trk = xml.match(/<trk\b[^>]*>([\s\S]*?)(?:<trkseg\b|<\/trk>)/);
  const header = trk ? trk[1] : '';
  const rawName = tag(header, 'name');
  const type = gpxTypeFrom(tag(header, 'type'));
  if (type === 'RIDE') throw new GpxError('Bike chega em breve. Por enquanto, só corrida e caminhada.');

  const found: { ms: number; lat: number; lon: number; ele: number | null; hr: number | null; cad: number | null }[] = [];
  const re = /<trkpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/trkpt>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const body = m[2] ?? '';
    const ms = Date.parse(tag(body, 'time') ?? '');
    const lat = attr(m[1], 'lat');
    const lon = attr(m[1], 'lon');
    if (Number.isNaN(ms) || lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    found.push({ ms, lat, lon, ele: num(tag(body, 'ele')), hr: num(tag(body, 'hr')), cad: num(tag(body, 'cad')) });
  }
  if (found.length === 0) throw new GpxError('O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade).');
  if (found.length < 2) throw new GpxError('O arquivo tem pontos de menos.');

  found.sort((a, b) => a.ms - b.ms);
  const t0 = found[0].ms;
  const points = thin(found, MAX_POINTS).map((p): GpsPoint => [Math.round(p.ms - t0) / 1000, p.lat, p.lon, p.ele, p.hr, p.cad]);
  const name = rawName === null ? null : decodeXml(rawName).trim().slice(0, 100) || null;
  return { name, type, startTime: new Date(t0).toISOString(), points };
}
```

`FrontEndTorv/src/utils/gpsFormat.ts`:

```ts
// Métricas de GPS em texto pt-BR. Sem imports de runtime: testado direto no node.

const pad = (n: number) => String(n).padStart(2, '0');

// 8670.74 → "8,67 km"
export const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2).replace('.', ',')} km`;

// 332 → "5:32 /km"
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${pad(s % 60)} /km`;
}

// Pace médio (s/km) a partir de um item de atividade: duration_sec é o tempo em movimento. null sem distância.
export const paceOf = (durationSec: number, distanceM: number | null) =>
  distanceM && distanceM > 0 ? Math.round(durationSec / (distanceM / 1000)) : null;

// Parciais → linhas da tabela: "1" (km cheio) ou "0,67 km" (sobra), tempo "5:38" e pace "5:38 /km".
export function splitRows(splits: { km: number; distance_m: number; duration_sec: number }[]) {
  return splits.map((s) => ({
    label: s.distance_m === 1000 ? String(s.km) : formatDistance(s.distance_m),
    time: `${Math.floor(s.duration_sec / 60)}:${pad(s.duration_sec % 60)}`,
    pace: formatPace(s.duration_sec / (s.distance_m / 1000)),
  }));
}
```

`FrontEndTorv/src/utils/gpsErrors.ts`:

```ts
// Mensagens do backend do GPX (inglês, estáveis) → texto para a pessoa. Sem imports de runtime: testado direto no node.
// Na tela: axios.isAxiosError(e) ? gpsErrorText(e.response?.status, e.response?.data?.error) : gpsErrorText(500).

const FUTURE = 'A data do arquivo está no futuro. Confira o relógio do aparelho que gravou.';
const OLD = 'Só dá para importar atividades das últimas 72 horas.';

const BY_MESSAGE: Record<string, string> = {
  'start_time must be within the last 72 hours': OLD,
  'start_time must be on or after 2026-01-01': OLD,
  'start_time must not be in the future': FUTURE,
  'activity must not end in the future': FUTURE,
  'activity too short': 'Atividade curta demais para importar (mínimo de 1 minuto e 100 m).',
  'activity too long': 'Atividade longa demais (máximo de 24 horas).',
  'speed not compatible with run or walk': 'A velocidade não parece de corrida nem de caminhada.',
  'too many sessions on that day': 'Você já registrou 5 atividades nesse dia, o limite diário.',
  'Activity already imported': 'Você já importou esta atividade.',
  'points must be in chronological order': 'O arquivo tem horários fora de ordem.',
};

export function gpsErrorText(status: number | undefined, serverMessage?: string): string {
  if (status === undefined) return 'Sem conexão. Tente de novo.';
  if (serverMessage && BY_MESSAGE[serverMessage]) return BY_MESSAGE[serverMessage];
  if (serverMessage?.startsWith('invalid point at index')) return 'O arquivo tem pontos inválidos.';
  if (status === 404) return 'Rotina não encontrada. Volte e tente de novo.';
  if (status === 413) return 'Arquivo grande demais para enviar.';
  if (status === 429) return 'Muitas tentativas. Aguarde um minuto.';
  if (status === 400) return 'Não foi possível processar o arquivo.';
  return 'Algo deu errado. Tente de novo.';
}
```

`FrontEndTorv/src/utils/routeProjection.ts`:

```ts
// Projeta [lat, lon][] num retângulo width × height com margem, mantendo a proporção: equirretangular em torno da
// latitude média, norte para cima, centralizado. Devolve [x, y] de tela. Sem imports de runtime: testado no node.
export function projectRoute(route: [number, number][], width: number, height: number, margin = 8): [number, number][] {
  if (route.length === 0) return [];
  const lat0 = ((route.reduce((n, [lat]) => n + lat, 0) / route.length) * Math.PI) / 180;
  const xs = route.map(([, lon]) => lon * Math.cos(lat0));
  const ys = route.map(([lat]) => lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  const scale = Math.min(
    spanX > 0 ? (width - 2 * margin) / spanX : Infinity,
    spanY > 0 ? (height - 2 * margin) / spanY : Infinity,
  );
  if (!Number.isFinite(scale)) return route.map(() => [width / 2, height / 2]); // um ponto só (ou todos iguais)
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return route.map((_, i) => [offX + (xs[i] - minX) * scale, offY + (minY + spanY - ys[i]) * scale]);
}
```

`FrontEndTorv/src/utils/readPickedFile.ts` (celular) e `readPickedFile.web.ts` (navegador; o Metro escolhe pelo sufixo):

```ts
import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';

// Celular: o picker copia o arquivo para o cache (copyToCacheDirectory) e o expo-file-system lê de lá.
export const readPickedFile = (asset: DocumentPickerAsset): Promise<string> => new File(asset.uri).text();
```

```ts
import type { DocumentPickerAsset } from 'expo-document-picker';

// Web: o picker devolve o File do navegador; o expo-file-system não roda no web.
export async function readPickedFile(asset: DocumentPickerAsset): Promise<string> {
  if (asset.file) return asset.file.text();
  return (await fetch(asset.uri)).text();
}
```

`FrontEndTorv/src/services/gps.ts`:

```ts
import api from './api';
import type { GpsPoint } from '../utils/gpx';

// Contrato de /activities/gps (spec docs/superpowers/specs/2026-10-14-gpx-import-design.md).
export type GpsType = 'RUN' | 'WALK';

export interface GpsSplit {
  km: number;
  distance_m: number;
  duration_sec: number;
}

export interface GpsMetrics {
  activity_type: GpsType;
  start_time: string;
  distance_m: number;
  duration_sec: number; // em movimento
  elapsed_sec: number;
  pace_sec_per_km: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence: number | null; // passos/min
  calories: number | null; // null sem peso cadastrado
  splits: GpsSplit[];
  route: [number, number][];
}

export interface GpsActivityDetail extends GpsMetrics {
  id: string;
  title: string;
  routine_id: string | null;
}

export interface GpsUpload {
  activity_type: GpsType;
  start_time: string;
  points: GpsPoint[];
}

export const gpsApi = {
  preview: (body: GpsUpload) => api.post<GpsMetrics>('/activities/gps/preview', body).then((r) => r.data),
  create: (body: GpsUpload & { routine_id: string; title?: string }) =>
    api.post<GpsActivityDetail>('/activities/gps', body).then((r) => r.data),
  get: (id: string) => api.get<GpsActivityDetail>(`/activities/gps/${id}`).then((r) => r.data),
  rename: (id: string, title: string) => api.patch<GpsActivityDetail>(`/activities/gps/${id}`, { title }).then((r) => r.data),
  remove: (id: string) => api.delete(`/activities/gps/${id}`),
};
```

**Tipos e rótulos:**
- `services/activities.ts`: `ACTIVITY_TYPES = ['STRENGTH', 'RUN', 'WALK'] as const`.
- `utils/activities.ts`: `ACTIVITY_LABELS` ganha `RUN: 'Corrida'` e `WALK: 'Caminhada'`.

**`services/workouts.ts`:**
- `export type RoutineType = 'STRENGTH' | 'RUN' | 'WALK';`;
- `RoutineSummary` e `RoutineDetail` ganham `activity_type: RoutineType`;
- `RoutineInput` ganha `activity_type?: RoutineType`.

**`utils/routineForm.ts`:**
- `import type { ..., RoutineType } from '../services/workouts';`;
- `buildRoutineInput(name, items, type: RoutineType = 'STRENGTH')`: depois de validar o nome, `if (type !== 'STRENGTH') return { body: { name: trimmed, activity_type: type, exercises: [] } };`.
- O caminho da musculação não muda, e o corpo dele passa a levar `activity_type: 'STRENGTH'`. O teste antigo de "monta o corpo" ganha esse campo no esperado.

**`utils/activityMeta.ts`:**
- importa `formatDistance`, `formatPace` e `paceOf` de `./gpsFormat`;
- **com `distance_m`:** a linha fica `[data?, hora, distância, duração, pace]`, por exemplo "11:08 · 8,67 km · 47:57 · 5:32 /km";
- **sem `distance_m`:** continua `[data?, hora, duração, séries (só musculação)]`.

- [ ] **Step 4:** `node --test src/utils/*.test.mjs` e `npx tsc --noEmit` → verdes; anotar o total.
- [ ] **Step 5:** commit (`feat(front): GPX parser, GPS formatting/errors, route projection and API client`) com todos os arquivos da task, inclusive `FrontEndTorv/package.json` e `FrontEndTorv/package-lock.json`.

---

### Task 10: Frontend — `RouteTrace`, `ActivityIcon`, tipo no `RoutineEditor` e card de GPS em Meus treinos

**Recruit:** Torv Frontend · **Files:**
- Create: `FrontEndTorv/src/components/RouteTrace/index.tsx`, `styles.ts`; `FrontEndTorv/src/components/ActivityIcon/index.tsx`
- Modify: `FrontEndTorv/src/screens/RoutineEditor/index.tsx`, `styles.ts`; `FrontEndTorv/src/screens/Workouts/index.tsx`, `styles.ts`

- [ ] **Step 1: `ActivityIcon`**

```tsx
import React from 'react';
import { Dumbbell, Footprints, Activity } from 'lucide-react-native';

// Ícone de cada tipo de atividade (Histórico, Perfil, perfil de membro, resumo de GPS).
export function ActivityIcon({ type, color, size = 20 }: { type: string; color: string; size?: number }) {
  if (type === 'STRENGTH') return <Dumbbell color={color} size={size} />;
  if (type === 'WALK') return <Footprints color={color} size={size} />;
  return <Activity color={color} size={size} />;
}
```

- [ ] **Step 2: `RouteTrace`** (SVG, sem mapa de fundo; o visual passa por `/frontend-design`):

```tsx
import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

import { projectRoute } from '../../utils/routeProjection';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

// Traçado da rota (só para o dono da atividade). Sem mapa de fundo: nada de chave de API nem localização enviada a terceiros.
export function RouteTrace({ route, height = 200 }: { route: [number, number][]; height?: number }) {
  const [width, setWidth] = useState(0);
  const pts = useMemo(() => projectRoute(route, width, height, 16), [route, width, height]);
  const start = pts[0];
  const end = pts[pts.length - 1];
  return (
    <View>
      <View
        style={[styles.box, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel="Traçado da rota"
      >
        {width > 0 && pts.length > 1 && (
          <Svg width={width} height={height}>
            <Polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={colors.brand} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <Circle cx={start[0]} cy={start[1]} r={6} fill={colors.brand} stroke={colors.background} strokeWidth={2} />
            <Circle cx={end[0]} cy={end[1]} r={6} fill={colors.text} stroke={colors.background} strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.dot, { backgroundColor: colors.brand }]} /><Text style={styles.legendText}>Início</Text>
        <View style={[styles.dot, { backgroundColor: colors.text }]} /><Text style={styles.legendText}>Fim</Text>
      </View>
    </View>
  );
}
```

Chaves do `styles.ts` do `RouteTrace`:
- `box`: fundo `surfaceAlt`, `borderRadius` `radius.md`, `overflow: 'hidden'`;
- `legend`, `dot` (10 × 10, redondo), `legendText`.

- [ ] **Step 3: `RoutineEditor`**
- Estado `type: RoutineType` (padrão `'STRENGTH'`). Ao editar, `setType(d.activity_type)` junto com o nome.
- **Criando** (`!routineId`), um seletor segmentado no topo, antes do nome, com **Musculação | Corrida | Caminhada**:
  - `accessibilityRole="tab"`, `aria-selected`;
  - alvos de 44 px.
- **Editando:** o tipo aparece fixo, como etiqueta (`activityLabel(type)`).
- Com `type !== 'STRENGTH'`:
  - os cards de exercício e o "Adicionar exercício" somem;
  - aparece a dica "Depois é só importar o .gpx de cada treino em Meus treinos.";
  - o placeholder do nome vira "Ex.: Corrida leve" ou "Ex.: Caminhada no parque".
- O `save` passa a chamar `buildRoutineInput(name, items, type)`.

- [ ] **Step 4: Card em `Workouts`.** Para `r.activity_type !== 'STRENGTH'`:
- etiqueta com `activityLabel(r.activity_type)`;
- linha de detalhe "Importe o .gpx do seu treino" no lugar de "N exercícios · N séries";
- o botão redondo da direita vira **Importar GPX**: ícone `Upload` (lucide), `accessibilityLabel={`Importar GPX em ${r.name}`}`, mesmo tamanho do ▶;
- o botão navega para `GpxImport` com `{ routineId: r.id }`;
- aparece **mesmo com treino de musculação em andamento**.

Rotina de musculação: nada muda.

A rota `GpxImport` só existe depois da Task 11. Para o `tsc` passar já nesta task, acrescentar ao `AppStackParamList` (em `routes/types.ts`) as rotas `GpxImport: { routineId: string };` e `GpsActivity: { activityId: string };`. As telas entram no `PrivateRoutes` na Task 11.

- [ ] **Step 5:** `npx tsc --noEmit` e `node --test src/utils/*.test.mjs` → verdes. No portal, conferir:
  - criar uma rotina Corrida (sem exercícios) → o card aparece com "Importar GPX";
  - editar a rotina → o tipo fica fixo;
  - criar uma de musculação continua igual.
- [ ] **Step 6:** commit (`feat(front): run/walk routines in the editor and Workouts list, route trace and activity icon`).

---

### Task 11: Frontend — telas `GpxImport` e `GpsActivity`

**Recruit:** Torv Frontend · **Files:**
- Create: `FrontEndTorv/src/screens/GpxImport/index.tsx`, `styles.ts`; `FrontEndTorv/src/screens/GpsActivity/index.tsx`, `styles.ts`
- Modify: `FrontEndTorv/src/routes/PrivateRoutes/index.tsx` (as duas telas na pilha)

A lógica vai abaixo. O visual passa por `/frontend-design`, no padrão do `WorkoutSummary`:
- grade de métricas em cards;
- tabela de parciais com cabeçalho Km | Tempo | Pace;
- botões grandes no fim.

- [ ] **Step 1: `GpxImport`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { ArrowLeft, FileUp } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { RouteTrace } from '../../components/RouteTrace';
import { workoutsApi, type RoutineDetail } from '../../services/workouts';
import { gpsApi, type GpsMetrics, type GpsType } from '../../services/gps';
import { parseGpx, GpxError, type ParsedGpx } from '../../utils/gpx';
import { readPickedFile } from '../../utils/readPickedFile';
import { gpsErrorText } from '../../utils/gpsErrors';
import { formatDistance, formatPace, splitRows } from '../../utils/gpsFormat';
import { formatClock } from '../../utils/clock';
import { activityLabel } from '../../utils/activities';
import { bumpSessionsVersion } from '../../utils/sessionsVersion';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const GPS_TYPES: GpsType[] = ['RUN', 'WALK'];
const errorText = (err: unknown) =>
  axios.isAxiosError(err) ? gpsErrorText(err.response?.status, err.response?.data?.error) : gpsErrorText(500);

export default function GpxImport() {
  const navigation = useNavigation<AppNavigation>();
  const { routineId } = useRoute<RouteProp<AppStackParamList, 'GpxImport'>>().params;
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [parsed, setParsed] = useState<ParsedGpx | null>(null);
  const [metrics, setMetrics] = useState<GpsMetrics | null>(null);
  const [type, setType] = useState<GpsType>('RUN');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<'' | 'reading' | 'saving'>('');
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    workoutsApi.getRoutine(routineId)
      .then((r) => { setRoutine(r); setType(r.activity_type === 'WALK' ? 'WALK' : 'RUN'); })
      .catch(() => setError('Não foi possível carregar a rotina.'));
  }, [routineId]);

  const routineType: GpsType = routine?.activity_type === 'WALK' ? 'WALK' : 'RUN';

  const reset = () => { setParsed(null); setMetrics(null); setDuplicateId(null); };

  // Prévia calculada no servidor (mesma conta que vai ser gravada). Mudar o tipo recalcula (calorias mudam).
  const preview = async (gpx: ParsedGpx, t: GpsType) => {
    setBusy('reading');
    setError('');
    try {
      setMetrics(await gpsApi.preview({ activity_type: t, start_time: gpx.startTime, points: gpx.points }));
    } catch (err) {
      reset();
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  };

  // O seletor só abre por toque: o navegador exige gesto do usuário (Review Focus 3 cobre os erros).
  const pick = async () => {
    setError('');
    setDuplicateId(null);
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!/\.gpx$/i.test(asset.name)) return setError('Escolha um arquivo .gpx.');
    if ((asset.size ?? 0) > MAX_FILE_BYTES) return setError('Arquivo grande demais (máx. 25 MB).');
    reset();
    setBusy('reading');
    let gpx: ParsedGpx;
    try {
      gpx = parseGpx(await readPickedFile(asset));
    } catch (err) {
      setBusy('');
      return setError(err instanceof GpxError ? err.message : 'Não foi possível ler o arquivo.');
    }
    setParsed(gpx);
    setTitle(gpx.name ?? routine?.name ?? '');
    setType(routineType);
    await preview(gpx, routineType);
  };

  const changeType = (t: GpsType) => {
    if (!parsed || t === type) return;
    setType(t);
    preview(parsed, t);
  };

  const save = async () => {
    if (!parsed) return;
    setBusy('saving');
    setError('');
    try {
      const created = await gpsApi.create({
        routine_id: routineId, activity_type: type, title: title.trim(), start_time: parsed.startTime, points: parsed.points,
      });
      bumpSessionsVersion(); // Histórico e Perfil recarregam ao voltar
      navigation.replace('GpsActivity', { activityId: created.id });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) setDuplicateId(err.response.data?.activity_id ?? null);
      setError(errorText(err));
      setBusy('');
    }
  };

  const mismatch = parsed?.type === 'RUN' || parsed?.type === 'WALK' ? parsed.type !== routineType : false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Importar GPX</Text>
          {routine && <Text style={styles.headerSub} numberOfLines={1}>{routine.name} · {activityLabel(routine.activity_type)}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!metrics && (
          <Card style={styles.pickCard}>
            <FileUp color={colors.brand} size={32} />
            <Text style={styles.pickTitle}>Escolha o .gpx do seu treino</Text>
            <Text style={styles.pickHint}>Exporte o .gpx no Strava, no Garmin Connect ou no app do seu relógio.</Text>
            <Button title={parsed ? 'Escolher outro arquivo' : 'Escolher arquivo .gpx'} loading={busy === 'reading'} disabled={!routine} onPress={pick} />
          </Card>
        )}

        {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        {duplicateId && <Button title="Ver atividade" outline onPress={() => navigation.replace('GpsActivity', { activityId: duplicateId })} />}

        {parsed && metrics && (
          <>
            {mismatch && (
              <Card style={styles.warning}>
                <Text style={styles.warningText}>
                  O arquivo indica {activityLabel(parsed.type ?? routineType)}, mas a rotina é de {activityLabel(routineType)}. Salvar como:
                </Text>
                <View style={styles.segmented} accessibilityRole="tablist">
                  {GPS_TYPES.map((t) => (
                    <TouchableOpacity key={t} style={[styles.segment, type === t && styles.segmentActive]} onPress={() => changeType(t)} accessibilityRole="tab" accessibilityState={{ selected: type === t }} aria-selected={type === t}>
                      <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>{activityLabel(t)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}

            <Input label="Título" value={title} maxLength={100} onChangeText={setTitle} placeholder={routine?.name} />

            <View style={styles.grid}>
              {[
                ['Distância', formatDistance(metrics.distance_m)],
                ['Tempo', formatClock(metrics.duration_sec)],
                ['Pace', metrics.pace_sec_per_km === null ? '—' : formatPace(metrics.pace_sec_per_km)],
                ['Elevação', metrics.elevation_gain_m === null ? '—' : `${metrics.elevation_gain_m.toLocaleString('pt-BR')} m`],
                ['FC média / máx', metrics.avg_hr === null ? '—' : `${metrics.avg_hr} / ${metrics.max_hr} bpm`],
                ['Cadência', metrics.avg_cadence === null ? '—' : `${metrics.avg_cadence} passos/min`],
                ['Calorias', metrics.calories === null ? '—' : `${metrics.calories} kcal`],
              ].map(([label, value]) => (
                <Card key={label} style={styles.stat}>
                  <Text style={styles.statLabel}>{label}</Text>
                  <Text style={styles.statValue}>{value}</Text>
                </Card>
              ))}
            </View>
            {metrics.calories === null && <Text style={styles.hint}>Cadastre seu peso no Perfil para estimar as calorias.</Text>}

            {metrics.route.length > 1 && <RouteTrace route={metrics.route} />}

            {metrics.splits.length > 0 && (
              <Card style={styles.splits}>
                <View style={styles.splitRow}><Text style={styles.splitHead}>Km</Text><Text style={styles.splitHead}>Tempo</Text><Text style={styles.splitHead}>Pace</Text></View>
                {splitRows(metrics.splits).map((s) => (
                  <View key={s.label} style={styles.splitRow}>
                    <Text style={styles.splitCell}>{s.label}</Text><Text style={styles.splitCell}>{s.time}</Text><Text style={styles.splitCell}>{s.pace}</Text>
                  </View>
                ))}
              </Card>
            )}

            <Button title="Salvar atividade" loading={busy === 'saving'} disabled={busy === 'reading'} onPress={save} />
            <Button title="Escolher outro arquivo" outline disabled={busy !== ''} onPress={pick} />
          </>
        )}
        {busy === 'reading' && metrics === null && parsed !== null && <ActivityIndicator color={colors.brand} />}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: `GpsActivity`**
- **Carga:**
  - `gpsApi.get(activityId)` no foco;
  - estados: carregando; "Atividade não encontrada." (404); erro com "Tentar de novo".
- **Cabeçalho:**
  - voltar;
  - `ActivityIcon` e o tipo (`activityLabel`);
  - título com botão de lápis (`accessibilityLabel="Renomear"`), que troca para `Input` + **Salvar** e **Cancelar** na mesma linha;
  - salvar chama `gpsApi.rename`, atualiza a tela e chama `bumpSessionsVersion()`.
- **Data e hora** locais: "14/10/2026 · 11:08".
- **Corpo:** a mesma grade de métricas do `GpxImport` (incluindo "Tempo total" = `formatClock(elapsed_sec)`), o `RouteTrace` e a tabela de parciais.
- **Excluir atividade** (danger, outline):
  - abre o `ConfirmModal` com título "Excluir atividade?", mensagem "Ela sai do histórico e, se for a única do dia, esse dia deixa de contar nos seus grupos. Isso não pode ser desfeito." e confirmação "Excluir";
  - confirmar chama `gpsApi.remove`, depois `bumpSessionsVersion()` e `navigation.goBack()`;
  - erro mostra `errorText` na tela.

- [ ] **Step 3:** `PrivateRoutes`: `GpxImport` e `GpsActivity` na pilha (importar as telas).
- [ ] **Step 4:** `npx tsc --noEmit` e os testes → verdes. No portal, abrir o `GpxImport` de uma rotina Corrida e escolher um arquivo por injeção (Task 13, Step 2) para conferir a prévia, o salvar, o resumo, o renomear e o excluir.
- [ ] **Step 5:** commit (`feat(front): GPX import and GPS activity screens`).

---

### Task 12: Frontend — atividade de GPS nas listas

**Recruit:** Torv Frontend · **Files:**
- Modify: `FrontEndTorv/src/screens/Workouts/History.tsx`, `src/screens/Profile/index.tsx`, `src/screens/MemberProfile/index.tsx`

- [ ] **Step 1: Histórico**
- ícone por `ActivityIcon`;
- linha de detalhe `activityMeta(item)`, que para musculação continua "HH:MM · duração · N séries";
- toque: `STRENGTH` → `WorkoutSummary`; `RUN`/`WALK` → `GpsActivity` (com `ChevronRight` nos dois);
- os chips de tipo já vêm de `ACTIVITY_TYPES` (Todos, Musculação, Corrida, Caminhada);
- o texto dos vazios passa a ser "Nenhuma atividade ainda" / "Nenhuma atividade nesse período".
- [ ] **Step 2: Perfil** ("Atividade Física"): `ActivityIcon`; `RUN`/`WALK` abrem `GpsActivity`.
- [ ] **Step 3: Perfil de membro:** `ActivityIcon` no lugar do ícone fixo. Segue sem toque; a linha de detalhe já mostra distância e pace pelo `activityMeta`.
- [ ] **Step 4:** `tsc` e testes verdes. No portal: o Histórico com o filtro Corrida mostra a atividade importada, e o toque abre o resumo.
- [ ] **Step 5:** commit (`feat(front): GPS activities in history, profile and member profile`).

---

### Task 13: Teste da etapa de Frontend (usabilidade no navegador)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-gpx-import-frontend-2026-10-14.md`

- [ ] **Step 1:** `node --test src/utils/*.test.mjs` e `npx tsc --noEmit` → verdes; anotar os totais.

- [ ] **Step 2: Arquivos de teste e injeção**

1. **Arquivos.** Numa pasta temporária **fora do repositório**, gerar a partir de `BackEndTorv/src/lib/tests/fixtures/run-sample.json`:
   - `run-recent.gpx`, terminando ~10 min antes;
   - `walk-recent.gpx`, com `<type>walking</type>` e começo diferente;
   - `ride.gpx`, com `<type>cycling</type>`;
   - `old.gpx`, que começou há 4 dias;
   - `nope.txt`, renomeado para `nope.gpx`, com texto qualquer;
   - `route-only.gpx`, só com `<rte>`.
2. **Servidor.** Servir a pasta num servidor estático local com CORS (Node, porta 8099).
3. **Injeção.** O seletor de arquivo do navegador não é automatizável. O `expo-document-picker` 57 dispara `dispatchEvent(new MouseEvent('click'))` no `<input>`, não `.click()`, por isso o listener de captura (QA frontend round 1, I1). Antes de tocar em **Escolher arquivo .gpx**, rodar:

```
maestri portal evaluate "QA Web" "window.__nextGpx='run-recent.gpx'; if(!window.__gpxPatched){window.__gpxPatched=true; document.addEventListener('click', (ev)=>{ const input=ev.target; if(!(input instanceof HTMLInputElement)||input.type!=='file'||!window.__nextGpx) return; ev.preventDefault(); const name=window.__nextGpx; window.__nextGpx=null; fetch('http://localhost:8099/'+name).then(r=>r.text()).then(t=>{ const dt=new DataTransfer(); dt.items.add(new File([t], name, {type:'application/gpx+xml'})); input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); }); }, true); }"
```

   Para cada arquivo, trocar só o `window.__nextGpx`.

- [ ] **Step 3: Fluxos reais, um por um**

As contas: **A**, com peso, dona de um grupo com **B**; **B**, sem peso.

1. **Rotina:**
   - A cria "Corrida leve" (tipo Corrida) no `RoutineEditor`;
   - o card mostra "Importar GPX" e não é "Próximo";
   - editar mostra o tipo fixo.
2. **Importar:**
   - `run-recent.gpx` → a prévia confere com os números esperados;
   - as calorias seguem a fórmula com o peso de A;
   - o traçado aparece;
   - as parciais são 9.
3. **Salvar:**
   - abre o resumo (`GpsActivity`);
   - voltar mostra a atividade no Histórico (filtro Corrida) **sem** puxar para atualizar;
   - aparece no Perfil ("Atividade Física", calendário, streak, card do mês);
   - a Home soma as calorias;
   - o ranking do grupo mostra +1 dia (se for o 1º do dia).
4. **Sem peso (Review Focus 4):** B importa → as calorias aparecem como "—", com a dica.
5. **Tipo divergente:**
   - `walk-recent.gpx` na rotina Corrida → aparece o aviso com Corrida | Caminhada;
   - trocar o tipo recalcula as calorias;
   - salvar como Caminhada → o item mostra o ícone e o rótulo de Caminhada.
6. **Duplicado (Review Focus 2):** importar `run-recent.gpx` de novo → "Você já importou esta atividade." + **Ver atividade**, que abre a existente.
7. **Erros (Review Focus 3):**
   - `ride.gpx` → "Bike chega em breve...";
   - `old.gpx` → "Só dá para importar atividades das últimas 72 horas.";
   - `nope.gpx` → "Este arquivo não é um GPX válido.";
   - `route-only.gpx` → "O arquivo não tem pontos com horário...";
   - nada é gravado (conferir no banco).
8. **Renomear e excluir:**
   - renomear no resumo → o Histórico mostra o título novo;
   - excluir (modal) → some do Histórico e do Perfil, e o ranking cai.
9. **Perfil de membro:** B abre o perfil de A pelo ranking → o item de corrida mostra distância e pace, **sem** abrir nada e sem rota nem FC.
10. **320 px e acessibilidade:**
    - redimensionar o portal para 320 px;
    - o `GpxImport`, o `GpsActivity`, o `RoutineEditor` (seletor de tipo) e o card de GPS não cortam;
    - a tabela de parciais cabe;
    - alvos de 44 px;
    - os ícones têm `accessibilityLabel`;
    - nenhum `Alert.alert`.

- [ ] **Step 4:** relatório com PASS/FAIL e evidência; limpeza (contas, atividades, rotinas, pasta temporária e servidor 8099 encerrado); commit só do relatório. **Falha → reabre a task responsável (9 a 12).**

---

### Task 14: Teste completo (HEAD, as duas features)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-gpx-import-full-2026-10-14.md`

- [ ] **Step 1:** os automatizados dos dois lados: totais antes (base do começo da branch: 239 back e 49 front) e depois.
- [ ] **Step 2: Regressão no navegador**:
  - login e boas-vindas;
  - Home;
  - dieta;
  - treinos de musculação (rotina, sessão, resumo, editar e excluir, cargas);
  - histórico com filtros e períodos;
  - grupos (criar, convite, link, ranking, sair);
  - Perfil.
- [ ] **Step 3: Perfil de membro inteiro**, repetindo o Step 3 da Task 4 e os fluxos da Task 8 do plano `2026-10-14-member-profile.md`.
- [ ] **Step 4: Importador inteiro**, repetindo o Step 3 da Task 8 e os fluxos da Task 13 deste plano.
- [ ] **Step 5: Consistência:**
  - a consulta de ranking da Task 7 do plano de grupos (`docs/superpowers/plans/2026-10-06-groups-competition.md`) devolve 0 linhas;
  - nenhuma `activity_gps_data` órfã.
- [ ] **Step 6:** relatório e commit. **Falha → volta à camada responsável, numa nova rodada.**

---

### Task 15: Security (só com os testes 100% verdes)

**Recruit:** Torv Security · **Files:**
- Create: `docs/security-gpx-import-2026-10-14.md`

- [ ] **Step 1:** revisar o diff do importador (do commit deste plano até o HEAD) pela lente do OWASP Top 10. Pontos obrigatórios:
  - **A01, controle de acesso:**
    - `/activities/gps/*` filtra por `userId`;
    - rotina de outro usuário ou de musculação → 404;
    - nenhum caminho expõe rota, FC ou calorias a outro usuário (conferir `GET /users/:id/activities`).
  - **A03, injeção:** sem SQL cru novo; o `start_time` vira `Date`; o JSON das parciais e da rota é gerado pelo servidor, nunca pelo cliente.
  - **A04/A05, DoS e configuração:**
    - `bodyLimit` de 2 MiB;
    - teto de 30.000 pontos;
    - Douglas-Peucker com entrada de 2.000;
    - rate limit de 30/min (por IP; anotar a limitação);
    - medir o pior caso;
    - a Vercel aceita o corpo (4,5 MB).
  - **Integridade do ranking:**
    - janela de 72 h;
    - fim no futuro;
    - teto diário de todos os tipos sob lock;
    - deduplicação por índice;
    - plausibilidade de velocidade;
    - tentar forjar pontos (arquivo fabricado dentro da janela) e registrar o que sobra de risco.
  - **Privacidade (LGPD):**
    - o `.gpx` não sai do aparelho;
    - não há pontos brutos nem série de FC no banco;
    - a rota é simplificada e só o dono a vê;
    - nada sensível em log.
  - **Frontend:**
    - o parser roda só no aparelho, e as regex não têm retrocesso catastrófico (medir com um arquivo de 25 MB);
    - nenhum segredo;
    - só a nossa API;
    - o `readPickedFile.web` não usa `dangerouslySetInnerHTML` nem `eval`.
- [ ] **Step 2:** relatório e commit (`docs(security): GPX import OWASP review`). **Falha → volta só às camadas apontadas, em novas rodadas.**

---

### Task 16: Fechamento — `revisar5.md`

**Quem:** Maestro · **Files:**
- Create: `revisar5.md` (raiz; **não** entra em commit, como os outros `revisar*.md`)

- [ ] **Step 1:** escrever no formato do `revisar4.md`, cobrindo **as duas features** da branch:
  1. cabeçalho com a branch e os links das 2 specs e dos 2 planos;
  2. status por etapa (rodadas, PASS/FAIL e recruits);
  3. totais dos testes, antes e depois;
  4. o que mudou para o usuário;
  5. causas encontradas e decisões (inclusive a troca do Douglas-Peucker repetido pela passada única, achada no planejamento);
  6. arquivos por camada;
  7. "Para você decidir":
     - apagar `user_streaks` e o trigger antigo;
     - limite do rate limit por IP;
     - bike;
     - registro manual;
     - gráficos;
  8. ambiente;
  9. como testar no celular.
- [ ] **Step 2:** atualizar as notas do canvas com o resultado final.

---

## Acompanhamento no canvas (Maestro)

A nota **"Feature- Importador GPX"** (`maestri note create --name ...`) é criada antes da Task 0 e atualizada a **cada** transição de etapa. Ela traz:
- a etapa em andamento;
- o recruit que está rodando;
- o resultado da última rodada;
- o motivo de cada retrabalho.

## Self-review do plano

- **Cobertura da spec:**

  | Item da spec | Task |
  |---|---|
  | Tipos e rotina | 1 e 5 |
  | Fluxo de importação | 9, 10 e 11 |
  | Tipo divergente | 11 |
  | Janela de 72 h | 4 |
  | Teto de todos os tipos | 6 |
  | Duplicado | 1, 6 e 7 |
  | Métricas, calorias e parciais | 3 |
  | Rota e privacidade | 3, 7 e 15 |
  | Armazenamento | 1 e 6 |
  | Renomear e excluir | 6, 7 e 11 |
  | Listas | 12 |
  | Ranking, streak e calendário | 6 (recompute) e o `dayCounts` do perfil de membro, que já conta qualquer tipo |
  | Testes | 2, 8, 13 e 14 |
  | Segurança | 15 |

- **Mudanças em relação à spec:** a rota usa uma passada só de Douglas-Peucker com entrada de 2.000 pontos (spec já atualizada). O restante segue a spec.
- **Sem placeholders.** O visual das telas e componentes passa por `/frontend-design`, com as chaves e a lógica dadas. O `GpsActivity` é descrito por comportamento porque repete os blocos do `GpxImport`: grade, traçado e parciais.
- **Tipos consistentes:**
  - `GpsPoint` e `ParsedGpx` (`gpx.ts`) são os mesmos de `services/gps.ts`;
  - o shape de `computeMetrics` é igual ao `GpsMetrics` (TypeBox e TS);
  - `createGpsActivity(userId, { routineId, type, title, startTime, metrics })` é igual no controller e no repositório;
  - `lockAndCheckDailyCap` e `serializePerUser` são os mesmos na musculação e no GPS;
  - `buildRoutineInput(name, items, type)` e `RoutineType` coincidem no editor e nos testes.
