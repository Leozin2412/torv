# Torv Mobile — Adversarial QA Pass (2026-09-15)

Live app tested via Maestri portal "Torv Mobile" (Expo web, localhost:8081) against live backend (Furnace, localhost:3000, real Supabase Postgres). Fresh accounts only (`qa-test-1@torv.local`, `qa-test-2@torv.local`), all cleaned up after. No real user data touched.

Severity order: **Crash/500** > **Silent failure (no user feedback)** > **Cosmetic/UX nit**.

---

## Crash / 500

### 1. Long name at registration → 500, no error shown
**Did:** Registered with a 300+ char unicode name (`user_profiles.name` is `VARCHAR(100)`).
**Expected:** 400 with a validation message, or client-side length cap.
**Actual:** `POST /auth/register` → `500`. UI shows nothing — progress spinner just disappears, user is left on the same step with no explanation.
**Backend log:**
```
PrismaClientKnownRequestError: Invalid `prisma.users.create()` invocation in
.../src/repository/auth.repository.js:5:31
The provided value for the column is too long for the column's type.
code: 'P2000'
POST /auth/register -> 500
```
**Where:** `BackEndTorv/src/controller/auth.controller.js` (`register`, no length check) → `BackEndTorv/src/repository/auth.repository.js:4` (`createUser`).

### 2. Absurd calories on food log → 500
**Did:** `POST /diet` with `calories: 999999999999`.
**Expected:** 400 ("invalid calories") — the value is nonsensical for a food log regardless of type width.
**Actual:** `500`. Postgres rejects the `::integer` cast (added in the migration to fix a bigint/int4 mismatch) at the DB level, but nothing catches it as a clean 4xx.
**Backend log:**
```
Raw query failed. Code: `22003`. Message: `ERROR: integer out of range`
at DietRepository.createFoodLog (.../src/repository/diet.repository.js:44:20)
POST /diet -> 500
```
**Where:** `BackEndTorv/src/repository/diet.repository.js:44` (`createFoodLog`).

### 3. Invalid `logged_date` string → 500
**Did:** `POST /diet` with `"logged_date":"not-a-date"`.
**Expected:** 400.
**Actual:** `500`, uncaught `RangeError`.
**Backend log:**
```
RangeError: Invalid time value
    at Date.toISOString (<anonymous>)
    at DietRepository.createFoodLog (.../src/repository/diet.repository.js:37:70)
POST /diet -> 500
```
**Where:** `BackEndTorv/src/repository/diet.repository.js:37` — `new Date(data.logged_date).toISOString()` has no validity check before calling `.toISOString()`.

### 4. Overlong `food_name` → 500
**Did:** `POST /diet` with a 300-char `food_name` (`food_logs.food_name` is `VARCHAR(255)`).
**Expected:** 400.
**Actual:** `500`.
**Backend log:**
```
Raw query failed. Code: `22001`. Message: `ERROR: value too long for type character varying(255)`
at DietRepository.createFoodLog (.../src/repository/diet.repository.js:44:20)
POST /diet -> 500
```
**Where:** same as #2/#3 — `createFoodLog` has no field-length or type validation at all before hitting the DB. Same root cause class as #1: nothing in the request path validates input length before it reaches Postgres.

---

## Silent failure (no crash, but no user feedback)

### 5. Empty register submit
Clicking "Registre-se" with all fields blank fires no request and shows no error. User has no idea why nothing happened.

### 6. Wrong password on login
`POST /auth/login` correctly returns `401`, but the UI shows **zero** visible feedback — screenshot confirms the screen just returns to idle with the same fields filled in, no error text anywhere.

### 7. Non-image file as profile photo
Selecting a non-image file (e.g. `.txt`) in the photo picker: the file input's change handler runs (confirmed — the dynamically-created `<input>` gets torn down) but no upload request ever fires and no error is shown. Separately confirmed via direct API call that **the backend itself has zero MIME/type validation on `/profile/upload`** — a `.txt` file is accepted, written to disk, and set as `photo_url` (`200 OK`). This matches the already-known deferred gap from the migration's security pass (no fileSize/MIME limits on `@fastify/multipart`); this QA pass confirms it's concretely exploitable, not just theoretical.

### 8. Empty meal name on "Adicionar Refeição"
Leaving "Nome da Refeição" blank and clicking "Salvar" does nothing — no request sent, no error shown, modal just stays open.

### 9. "Choose your username" field at registration is discarded
The registration flow has a dedicated username input (`ex: seunome123`), but `auth.controller.js`'s `register()` always auto-generates the username server-side (`email.split('@')[0] + random(1000)`) and never reads any username from the request body. Typed `qatestone` → final profile showed `@qa-test-1500`. Pre-existing product behavior (unrelated to the Postgres/Fastify migration — same logic existed before), but a real dead-input bug worth fixing.

---

## Data integrity (accepted silently, no crash)

### 10. Negative calories accepted
`POST /diet` with `calories: -500` → `201`. Resulting summary: `consumed.calories: -500`, `remaining.calories: 2500` — exceeds the daily goal. No bounds checking anywhere in the stack.

### 11. Negative weight / absurd height accepted at registration
Registered with weight `-10` and height `999` — accepted through every step with no client or server-side range validation.

### 12. Rapid double-submit creates duplicate food logs
Fired two near-simultaneous `POST /diet` with identical payloads — both succeeded (`201` x2), creating two identical log rows. No debounce on the client, no idempotency key/dedup on the server.

### 13. Malformed email format accepted
`"not-an-email"` sails through registration with no format validation anywhere in the flow (frontend or backend only check truthiness, not shape).

---

## Cosmetic / low-confidence

### 14. Session lost on every page reload (web preview only)
Every full-page navigate/reload in the Expo-web portal dropped back to the Login screen, even right after a successful login. This may be specific to how token storage behaves in this dev-mode web build (vs. a real native app using AsyncStorage) — flagged for awareness, not confirmed as a native-app-affecting bug.

---

## Not findings (verified working correctly)
- Duplicate email registration → clean `409`.
- Mismatched password confirmation → shown inline ("senhas não conferem").
- Password under 6 chars → shown inline ("senha deve ter pelo menos 6 caracteres").
- Cross-user food log edit/delete → correctly blocked with `404` (ownership check works).
- Unicode/emoji in food names → stored and returned correctly once verified through a clean UTF-8 request path (an earlier apparent "corruption" was a false positive caused by shell argument encoding in my own test tooling, not an app bug).

## Summary
- **Crash/500:** 4 (all in the food-log/registration write paths — no request validation before hitting Postgres)
- **Silent failure:** 5
- **Data integrity:** 4
- **Cosmetic/low-confidence:** 1
