# Security Review — Calorie & Macro Calculator (Round 3)

- **Date:** 2026-09-24
- **Scope:** delta `6638c0f` + `79eef56` only
  - `6638c0f` — `fix(diet): validate date and logged_date as real calendar dates`
  - `79eef56` — `fix(diet): restamp targets basis when the recalculated numbers match`
- **Previous rounds:** `security-calorie-calculator-2026-09-24.md` (FAIL, 1 MEDIUM) → `-round2.md` (PASS)
- **Precondition:** tests green — `docs/qa-calorie-calculator-2026-09-24-round4.md` (21/21)
- **Lens:** OWASP Top 10
- **Verdict: PASS** — delta opens nothing. No IDOR on the new write. The GET side effect is an architectural smell with no security impact.

---

## Delta 1 — `format: 'date'` on `diet` querystring and body (`6638c0f`)

Two lines in `src/routes/diet.routes.js`: `date` on the summary querystring (`:40`) and `logged_date` on the create-log body (`:77`) gain `format: 'date'`.

### Verified enforcement

`format` is inert unless the Ajv instance has formats registered, so this was checked rather than assumed. Runtime is Fastify **5.12.4** with **ajv-formats 3.0.1** present, and the default Fastify Ajv compiler registers it. Confirmed empirically with `fastify.inject()` against an isolated instance carrying the same schema — no server bound, port 3000 untouched:

| Input | Result |
|---|---|
| *(omitted)* | 200 — optional, falls back to today |
| `2026-09-24` | 200 |
| `2024-02-29` | 200 — real leap day accepted |
| `2026-02-29` | 400 — non-leap year rejected |
| `2026-02-30` | 400 |
| `2026-13-01` | 400 |
| `2026-9-4` | 400 — unpadded rejected |
| `2026-09-24T00:00:00.000Z` | 400 — full ISO rejected |
| `abc` | 400 |
| `2026-09-24'--` | 400 |
| `' OR 1=1` (url-encoded) | 400 |

Calendar validation is genuine, including per-month day counts and leap years.

### Security reading

This is a **hardening improvement**, and it is worth being precise about what it did and did not fix.

- It did **not** close an injection. `diet.repository.js:32` and `:44` were already parameterized tagged templates (`${targetDate}::date`), so a quoted payload was always passed as a bound parameter, never concatenated into SQL. Round 1 confirmed this and it has not changed.
- What it closed is the **O1 error-handling defect** carried since round 1: an unparseable date previously reached Postgres, failed the `::date` cast, and surfaced as a generic 500. It is now rejected at the schema boundary with a 400 naming the field. Rejecting malformed input before it reaches the data layer is the correct ordering, and it removes a 500-generating path from an authenticated endpoint.
- **No new attack surface.** The change only narrows an existing accepted set. No route, handler, or query was added or altered.

### Client-regression check

`format: 'date'` rejects full ISO-8601, so a client sending `...T00:00:00.000Z` would start receiving 400s. Checked every frontend caller:

- `Home/index.tsx:34` — `new Date().toISOString().split('T')[0]` → `YYYY-MM-DD` ✅
- `MyDiet/index.tsx:146` — `dateStr` from `toISODate(date)` ✅
- `MyDiet/index.tsx:212` — `logged_date: selectedDate`, same `toISODate` origin ✅
- `Profile/index.tsx:53` — no `date` param, uses the default ✅

All senders already emit the padded short form. No client breakage.

---

## Delta 2 — basis restamp inside `buildSuggestion` (`79eef56`)

`src/lib/nutritionSuggestion.js:45-50`. When the basis changed but the recalculated macros round to the same numbers, the function now writes `updateTargetsBasis(userId, calc.basis)` before returning `has_suggestion: false`. `GET /diet/targets/suggestion` therefore became a request that can write.

### IDOR on the new write — clean

This was the main thing to check, and it holds at every hop:

- `buildSuggestion` has exactly **two** callers, both binding identity from the verified JWT and nothing else:
  - `diet.controller.js:203` → `buildSuggestion(request.user.userId)`
  - `profile.controller.js:143` → `buildSuggestion(userId)`, where `const { userId } = request.user`
- The `userId` parameter is threaded straight through to `dietRepository.updateTargetsBasis(userId, ...)` with no reassignment in between.
- `diet.repository.js:109` scopes the write by primary key: `prisma.nutrition_targets.upsert({ where: { user_id: userId } })`.
- No route accepts a user identifier in a path, query, or body anywhere on this surface.

A caller cannot name another user's row. Confirmed by reading every hop, not by pattern-matching the call site.

### GET with a side effect — smell, not a vulnerability

A safe method that mutates state violates HTTP semantics, and that ordinarily raises CSRF, caching, and prefetch concerns. Each is ruled out here on concrete grounds:

- **CSRF does not apply.** Authentication is a bearer token in the `Authorization` header (`auth.middleware.js`), not an ambient cookie. A cross-origin page cannot attach the victim's token, so it cannot drive this endpoint at all. Worth noting the CORS registration in `server.js:15` sets no `origin` (defaulting to reflect-any) — but it also sets no `credentials: true`, and with header-based auth there is nothing for a hostile origin to ride on. Not exploitable.
- **The written value is not attacker-controlled.** `calc.basis` is recomputed server-side from the caller's own `user_profiles` and `user_measurements` rows. A client cannot influence its contents through this request — there is no request body, and the querystring is not read.
- **The write is idempotent and bounded.** It is an upsert on the primary key with a server-derived value, so repeated calls converge on the same row. No unbounded insert, no growth vector.
- **Blast radius is one notification.** Worst case, the user's next suggestion modal is suppressed once. Product behaviour, not a security boundary.

**Recommendation (design, non-blocking):** move the restamp onto the existing `POST /diet/targets/suggestion/dismiss`, or make the suggestion endpoint a `POST`, so the read stays a read. This is about HTTP hygiene and future-proofing — if auth ever moves to cookies, or a proxy/CDN starts caching or prefetching GETs, a writing GET becomes a real problem. No urgency at present.

### Latent edge — checked and absorbed

`updateTargetsBasis` is an upsert, and its `create` branch writes `user_id`, `basis_json`, `updated_at` with **no macro columns** — a row with NULL `daily_calories`/`protein_g`/`carbs_g`/`fat_g`. Two questions follow.

*Can it fire?* Barely. `buildSuggestion` calls `ensureTargets` first, which creates the row whenever `calc` is non-null, and returns early when `calc` is null. Reaching the restamp with no row requires the row being deleted between two statements in the same request. Practically unreachable.

*Would it matter if it did?* No. `fn_get_diet_summary` wraps each target column in its own `COALESCE` (`20260915170948_init_postgres/migration.sql:296-299`), falling back to `2000 / 150 / 250 / 65` — exactly the `DEFAULT_TARGETS` constants in `nutritionSuggestion.js:5`. A macro-less row degrades to the documented defaults. No NULL can reach the `Type.Number()` response schema, so there is no serialization-failure 500.

Fully absorbed by the existing design. Recorded for completeness, not as a finding.

### Error-path note (non-blocking)

`profile.controller.js:143` awaits `buildSuggestion` while constructing the `PUT /profile` response, so a throw there yields a 500 *after* the profile write has already committed — the client sees a failure for an update that succeeded. This shape predates the delta (round 1 already had the call there); `79eef56` adds one more statement that can throw inside it. Worth resolving the suggestion before building the reply, or tolerating its failure, whenever this file is next touched.

### Tests

Ran the suite independently rather than taking the QA report's word:

```
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

The three new cases in `nutritionSuggestion.test.js` stub the repository via `t.mock.method` and assert the behaviour that matters: restamp fires exactly once on the same-numbers path with the *new* goals in the basis, does not fire when the basis already matches, and does not fire when numbers genuinely differ. They also assert `upsertNutritionTargets` is **not** called on the restamp path — which is the property that keeps the user's macros untouched. Genuine regression tests, not assertions fitted to the new output. `t.mock` restores the singleton repository at test end, so no bleed into neighbouring files.

---

## Carried forward — noted, not blocking

None of these is touched by this delta.

- **`logId` not validated as a UUID** — `diet.routes.js` declares `logId: Type.String()` with no `format: 'uuid'`. A non-UUID path param reaches Postgres and fails the `uuid` cast as a 500, exactly the class of defect `6638c0f` just fixed for dates. This is now the remaining instance of that pattern; `format: 'uuid'` would finish the job. Pre-existing, self-scoped, no injection reach (Prisma binds the parameter).
- **S1 — `ALLOWED_IMAGE_TYPES[data.mimetype]`** (`profile.controller.js:82`) — prototype-chain lookup in the upload path. Pre-existing, outside the feature, and blocked by the subsequent `hasValidImageSignature` check whose default is `return false`. Re-confirmed in round 2. Fold into the `Object.hasOwn` cleanup commit.
- **No RLS in any migration** — authorization rests entirely on the API layer. Correct while Postgres is reached only through Prisma with backend credentials; becomes cross-tenant exposure the day the frontend gets a direct Supabase client with an anon key. Deserves its own tracked item.
- **`username` accepted unvalidated** — no length check against `VARCHAR(100)`; an over-long value surfaces as a 500.
- **Axios errors logged client-side** — established repo pattern; `AxiosError` carries `config.headers.Authorization`, so a release build retaining `console.*` could leak a bearer token to the device log.

---

## Conclusion

**PASS.** Both commits are narrowing or corrective. `6638c0f` removes a 500-generating path and was verified to enforce real calendar validation without breaking any existing client. `79eef56` introduces a write on a GET, which is an HTTP-semantics smell worth cleaning up, but it carries no security impact: the write is identity-scoped by the JWT at every hop, its content is server-derived, it is idempotent, and it is unreachable to CSRF under header-based auth.

Feature remains green on Testing and Security in the same round. Remaining items are pre-existing and tracked above.
