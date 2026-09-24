# Security Review — Calorie & Macro Calculator

- **Date:** 2026-09-24
- **Scope:** `git diff main...feat/calorie-macro-calculator`
- **Excluded:** `FrontEndTorv/src/services/api.ts`, `FrontEndTorv/tsconfig.json` (unrelated pre-existing working-tree changes); `docs/**` and the `.xlsx` read as context only.
- **Precondition:** tests 100% green — `docs/qa-calorie-calculator-2026-09-24-round2.md`
- **Lens:** OWASP Top 10
- **Verdict: FAIL** — 1 MEDIUM, backend layer. No HIGH. One-line class of fix.

---

## Vuln 1: Enum validation bypass via `Object.prototype` keys — `BackEndTorv/src/lib/profileValidation.js:18`

* **Severity:** Medium
* **Category:** `improper_input_validation` (OWASP A03 / A04)
* **Layer:** Backend
* **Confidence:** 9/10

**Description**

`validateProfileUpdate` gates `fitness_level` with a truthiness check on a bracket lookup:

```js
if (!ACTIVITY_FACTORS[fitness_level]) return { error: 'fitness_level must be ...' };
profileData.fitness_level = fitness_level;
```

`ACTIVITY_FACTORS` is a plain object literal, so the lookup walks the prototype chain. Any inherited key — `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString` — resolves to a truthy function and passes the gate. The raw string is then persisted to `user_profiles.fitness_level` (`VARCHAR(50)`, no DB `CHECK` — confirmed in `prisma/migrations/20260915170948_init_postgres/migration.sql:17`).

This is the exact control the plan required ("PUT /profile valida enum/faixa antes do banco"). The range checks on `weight_kg`/`height_cm` and the `goal` check (`GOAL_NAMES.includes`) are correct — only the two bracket-lookup gates are affected.

**Exploit scenario**

1. Authenticated user sends `PUT /profile` with `{"fitness_level": "constructor"}`. Fastify's `Type.String()` accepts it; `validateProfileUpdate` accepts it; it lands in the DB.
2. `updateProfile` then calls `buildSuggestion` → `calculateTargets`. `nutritionCalculator.js:64` repeats the same unsafe pattern (`ACTIVITY_FACTORS[fitnessLevel] ? fitnessLevel : DEFAULT_FITNESS_LEVEL`), so the poisoned value is kept as the level instead of falling back.
3. `tdee = bmr * ACTIVITY_FACTORS['constructor']` → `number * Function` → `NaN`. Every macro becomes `NaN`, and `pickTargets` preserves it (`??` does not catch `NaN`).
4. Downstream persistence fails hard: `POST /diet/targets/suggestion/accept` writes `NaN` into `Int` columns (Prisma throws → 500), and for a user with no targets row `ensureTargets` inside `GET /diet/summary` throws a non-`P2002` error that is deliberately re-thrown — the diet summary stays 500 until the bad `fitness_level` is overwritten.

Impact is confined to the attacker's own account (no cross-tenant reach), but it defeats a required validation boundary and writes invalid state that persistently breaks the user's own diet endpoints.

**Recommendation**

Use own-property checks in both places:

```js
// profileValidation.js:18
if (!Object.prototype.hasOwnProperty.call(ACTIVITY_FACTORS, fitness_level)) return { error: '...' };

// nutritionCalculator.js:64
const level = Object.prototype.hasOwnProperty.call(ACTIVITY_FACTORS, fitnessLevel) ? fitnessLevel : DEFAULT_FITNESS_LEVEL;
```

Apply the same to `GENDERS[gender]` at `nutritionCalculator.js:58` — same pattern, and `GENDERS['constructor']` silently classifies the user as female. Not reachable from this diff's write path (gender is set at registration, not editable via `PUT /profile`), but `calculateTargets` is new code in this diff and should not ship the pattern. A `Type.Union([Type.Literal(...)])` on the route body schema would be a second layer.

---

## Cleared — checked, no finding

### O2 from round 2: error handler echoing `err.message` on 4xx — `BackEndTorv/server.js:65-67` — **NOT a vulnerability**

Traced every error class that can carry `statusCode < 500`:

- Fastify built-ins (`FST_ERR_VALIDATION`, empty/invalid JSON body, 415 media type, 413 body size, 404 not found) — messages are library constants plus the schema path or request path. No internals.
- `@fastify/multipart` errors on `/profile/upload` — same, library constants.
- Prisma errors (`PrismaClientKnownRequestError`, `PrismaClientValidationError`) carry `code`, **not** `statusCode` → they fall through to the generic `500 / 'An unexpected error occurred'`. No SQL, stack, or connection string can reach a client.
- Auth failures are sent via `reply.status(...).send(...)` in `auth.middleware.js`, never thrown → they never reach this handler.
- App code throws nothing with a `statusCode` (`grep -rn "statusCode" src/` → only `server.js`).

The 404 message reflects the request path, but the response is `application/json` to a React Native client — not an XSS sink. The change is a narrowing, not a widening: it preserves Fastify's own 4xx classification instead of masking it as 500.

### IDOR — clean

All three new routes derive identity from the JWT only:

- `GET /diet/targets/suggestion`, `POST /diet/targets/suggestion/accept`, `POST /diet/targets/suggestion/dismiss` → `request.user.userId`, no id in path, query, or body.
- `diet.routes.js:37` registers `preHandler: authenticateToken` at plugin scope, which covers every route in the encapsulation context regardless of registration order — the new routes at lines 107-139 are protected.
- Every new repository method (`getCalcInputs`, `getNutritionTargets`, `updateTargetsBasis`, `getProfileRow`, `getLatestMeasurement`, `addMeasurement`) takes `userId` as its filter. No unscoped reads.

### Integrity of `accept` — clean

`acceptTargetsSuggestion` declares no body schema and reads no body. It calls `computeForUser(userId)` and persists `pickTargets(calc)` — server-recalculated values only. A client cannot inject target numbers through this route. Returns 409 when profile data is insufficient rather than falling back to client input.

*Design note (not a vulnerability):* the pre-existing `PUT /diet/targets` still accepts client-supplied macros and now stamps `basis_json: calc.basis` beside them. A client can therefore set arbitrary targets and simultaneously suppress future suggestions (`diffBasis` sees no change). This is self-scoped data the user is entitled to set, so it is a product decision, not a security issue.

### Mass assignment in `updateProfile` — clean

`validateProfileUpdate` destructures a fixed five-field whitelist (`username`, `goal`, `fitness_level`, `weight_kg`, `height_cm`) and builds `profileData` / `measurement` from scratch. `request.body` is never spread into a Prisma call, so no `user_id`, `role`, or `photo_url` passthrough. Unknown body fields are silently discarded.

*Hardening (optional):* the route body schema lacks `additionalProperties: false`, so unknown fields are accepted before being dropped. Defense in depth only — the whitelist is the real control.

### SQL injection — clean

`$queryRaw` calls in `diet.repository.js:32` and `:44` are tagged templates with `${}` placeholders plus explicit casts — parameterized by Prisma. Untouched by this diff; the new repository methods use the typed Prisma client exclusively.

### Secrets / crypto — clean

No hardcoded credentials, keys, or tokens in the diff. No crypto introduced. `auth.middleware.js` (unchanged) verifies Supabase JWTs via remote JWKS with an issuer check.

### Deserialization — clean

`basis_json` is written only by the server from `calculateTargets(...).basis` and read back only by `diffBasis`, which reads a fixed `BASIS_KEYS` list and compares scalars. No user-supplied JSON is parsed into an object graph, and no key from the stored JSON is used as an assignment target — no prototype-pollution sink.

### Frontend — clean

React Native only. No `dangerouslySetInnerHTML`, no `eval`, no `WebView`. Values render through `<Text>`, which escapes by construction.

### Supabase Storage / RLS — not applicable to this diff

No photo-path or Storage work here; profile photos still go to local disk via `@fastify/static` on `profilePhotos/`. The migration adds two columns to `nutrition_targets` and introduces no new Storage surface.

*Architectural note for the Maestro:* the repo has **no** `ROW LEVEL SECURITY` or `CREATE POLICY` statements in any migration. Authorization currently rests entirely on the API layer (auth middleware plus `userId` scoping), which this diff respects consistently. That holds only while Postgres is reached exclusively through Prisma with backend credentials. If the frontend ever gets a direct Supabase client with an anon key, `nutrition_targets` and `user_measurements` — including the new `basis_json` — would be readable across tenants. Worth tracking as its own item; it is not a regression introduced here.

---

## Pre-existing, non-blocking (noted, not caused by this diff)

- **O1 (carried from round 2):** 500 instead of 400 on invalid query/path params. Outside the diff. Does not block.
- **`username` accepted unvalidated** — `profileValidation.js:9` keeps `if (username) profileData.username = username`, identical to the code it replaced. No length check against `VARCHAR(100)`, so an over-long username surfaces as a 500. Pre-existing behavior, carried forward verbatim.
- **Axios errors logged client-side** — three new `console.log('...', error)` calls (`NutritionSuggestionModal/index.tsx:62`, `MyDiet/index.tsx:171`, `Profile/index.tsx`) follow an established repo pattern (14 occurrences, most pre-dating this branch). An `AxiosError` carries `config.headers.Authorization`, so a release build that keeps `console.*` could surface a bearer token in the device log. Repo-wide cleanup item, not a PR blocker.

## Improvement worth recording

`updateProfile` dropped three `console.log` statements that were printing `userId`, the requested username, and the raw DB row on every call. Net reduction in PII logging.

---

## Required before this feature can pass

1. Fix Vuln 1 in `BackEndTorv/src/lib/profileValidation.js:18` and `BackEndTorv/src/lib/nutritionCalculator.js:64` (and `:58` for `GENDERS`). **Backend layer only.**
2. Re-run the test round scoped to the backend change; Security re-reviews that delta.
