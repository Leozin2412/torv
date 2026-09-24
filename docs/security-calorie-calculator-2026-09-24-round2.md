# Security Review — Calorie & Macro Calculator (Round 2)

- **Date:** 2026-09-24
- **Scope:** delta `9573874` only — `fix(security): reject prototype-chain keys in nutrition and profile lookups`
- **Previous round:** `docs/security-calorie-calculator-2026-09-24.md` (FAIL — 1 MEDIUM)
- **Precondition:** tests green — `docs/qa-calorie-calculator-2026-09-24-round3.md` (18/18, live HTTP 400 on `constructor`/`toString`/`__proto__`)
- **Lens:** OWASP Top 10
- **Verdict: PASS** — MEDIUM closed at both layers. No new finding in the delta.

---

## Round 1 Vuln 1 — Enum validation bypass via `Object.prototype` keys — **CLOSED**

### What changed

Four files, 23 insertions. Three production lines, two test additions.

| File | Line | Before | After |
|---|---|---|---|
| `src/lib/profileValidation.js` | 18 | `!ACTIVITY_FACTORS[fitness_level]` | `!Object.hasOwn(ACTIVITY_FACTORS, fitness_level)` |
| `src/lib/nutritionCalculator.js` | 57 | `GENDERS[gender]` | `Object.hasOwn(GENDERS, gender) ? GENDERS[gender] : undefined` |
| `src/lib/nutritionCalculator.js` | 64 | `ACTIVITY_FACTORS[fitnessLevel] ? ...` | `Object.hasOwn(ACTIVITY_FACTORS, fitnessLevel) ? ...` |
| `src/lib/nutritionCalculator.js` | 40 | `.filter((g) => GOALS[g])` | `.filter((g) => Object.hasOwn(GOALS, g))` |

`Object.hasOwn` does not consult the prototype chain, so every inherited key now misses. All three sites recommended in round 1 were fixed, **plus** `parseGoals` at line 40 — a fourth instance of the same pattern that round 1 did not flag. That one was not reachable from `PUT /profile` (the route gates `goal` with `GOAL_NAMES.includes`, which was already safe), but it was reachable from the registration-metadata path in `20260918165833_supabase_auth_link/migration.sql:48`, which writes `goal` straight from `meta->>'goal'` with no enum check. Closing it removes a live second entry point. Good catch beyond the report.

### Independent verification

Not taken on the test suite's word. Ran the suite myself and probed the fixed lookups directly.

Test suite, `npm test` in `BackEndTorv`:

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
```

Direct probe of all eight `Object.prototype` enumerable-through-lookup keys against the fixed code:

```
constructor            validate: REJECT | calc level: INICIANTE | kcal finite: true
toString               validate: REJECT | calc level: INICIANTE | kcal finite: true
valueOf                validate: REJECT | calc level: INICIANTE | kcal finite: true
hasOwnProperty         validate: REJECT | calc level: INICIANTE | kcal finite: true
__proto__              validate: REJECT | calc level: INICIANTE | kcal finite: true
isPrototypeOf          validate: REJECT | calc level: INICIANTE | kcal finite: true
propertyIsEnumerable   validate: REJECT | calc level: INICIANTE | kcal finite: true
toLocaleString         validate: REJECT | calc level: INICIANTE | kcal finite: true

gender: constructor / __proto__ / toString  → calculateTargets() === null  (OK)
goals:  'constructor,__proto__,toString'    → ["Saúde & Bem-estar"], kcal finite, protein finite
```

Both layers of the round 1 exploit chain are now severed independently:

1. **Validation layer** — `PUT /profile` rejects the poisoned value with 400, so it never reaches `user_profiles.fitness_level`.
2. **Calculation layer** — even if a bad value were already in the database (from the registration path, or a row written while the bug was live), `calculateTargets` falls back to `INICIANTE` and every macro stays finite. No `NaN` can reach a Prisma `Int` column, so the persistent-500 condition on `GET /diet/summary` and `POST /diet/targets/suggestion/accept` is gone.

That second point matters for rollout: no data cleanup is required for rows written while the bug was live, because the calculator now neutralises them on read.

---

## Delta review — nothing new introduced

- **No new attack surface.** No route, schema, repository method, or database access added. The delta only narrows four existing predicates.
- **No behaviour change for valid input.** `Object.hasOwn` is strictly narrower than the truthiness check it replaces; every legitimate value (`INICIANTE`, `INTERMEDIÁRIO`, `AVANÇADO`, the six goal names, `Masculino`/`Feminino`) is an own enumerable property, so it still passes. Confirmed by the 16 pre-existing tests still passing unchanged.
- **No unsafe input to `Object.hasOwn` itself.** The second argument is coerced to a property key and never throws for `null`, `undefined`, or a number. The route schema constrains `fitness_level` to `Type.String()`; `gender` and `goal` reach the calculator from the database as string-or-null. No throw path.
- **Residual bracket lookups are safe by construction.** Swept the backend for every object-literal map and its lookups. `GOALS[goal]` (`:50`), `ACTIVITY_FACTORS[level]` (`:71`) and `GOALS[g]` (`:83-85`) remain plain lookups, but each is now fed exclusively by an own-key-guarded upstream (`parseGoals` output, or the `level` ternary). The guard moved to the right place rather than being sprinkled at each use — correct, and leaves the hot path clean.
- **Tests are genuine regression tests**, not assertions rewritten to match the new behaviour. They assert the security property directly (`basis.fitness_level === 'INICIANTE'`, `Number.isFinite(daily_calories)`, `calculateTargets(...) === null` for poisoned gender) and would fail if the guards were reverted.

---

## S1 from round 3 — `ALLOWED_IMAGE_TYPES[data.mimetype]` — noted, not a finding

`src/controller/profile.controller.js:82` carries the same prototype-chain pattern in the photo upload path.

**Confirmed pre-existing and outside this feature.** No added or removed line in `git diff main...feat/calorie-macro-calculator` touches `ALLOWED_IMAGE_TYPES` or `mimetype` — it appears in the diff as context only.

**Confirmed not exploitable.** A multipart part declaring `Content-Type: constructor` does pass the first gate (`ext` resolves to a truthy `Function`), but the very next check is `hasValidImageSignature(buffer, data.mimetype)`, whose three branches match on the literal strings `image/jpeg`, `image/png`, `image/webp` and whose default is `return false`. Any prototype key therefore falls straight to `400 File content does not match a JPEG, PNG, or WebP image`. Nothing is written to disk and nothing reaches the database. Defence in depth held.

Even in a hypothetical bypass of the signature check, the derived `ext` (`Object`'s string form) contains no `/` or `..`, and the rest of `fileName` is a JWT-derived UUID plus a numeric suffix, so there is no path-traversal reach.

**Recommendation (cleanup, not a blocker):** fold `profile.controller.js:82` into the same `Object.hasOwn` treatment in a separate hygiene commit, so the pattern is gone repo-wide rather than fixed in three places out of four. Track it outside this feature's cycle.

---

## Minor note (non-blocking)

`Object.hasOwn` requires Node ≥ 16.9. The runtime here is **v24.11.1**, and `package.json` has no `engines` field. Nothing is broken, and Node 16.9 predates this code by years, but an `"engines": { "node": ">=18" }` entry would make the floor explicit and fail fast at install time on an under-spec host instead of throwing `TypeError: Object.hasOwn is not a function` at request time. One line, whenever convenient.

---

## Carried forward from round 1 — still open, still non-blocking

These were recorded as pre-existing and outside the feature. None is affected by this delta; none blocks.

- **O1:** 500 instead of 400 on invalid query/path params.
- **`username` accepted unvalidated** — no length check against `VARCHAR(100)`.
- **Axios errors logged client-side** — established repo pattern (14 occurrences); `AxiosError` carries `config.headers.Authorization`.
- **No RLS anywhere in migrations** — authorization rests entirely on the API layer. Correct while Postgres is reached only through Prisma with backend credentials; becomes a cross-tenant exposure the day the frontend gets a direct Supabase client with an anon key. Worth its own tracked item.

---

## Conclusion

**PASS.** The round 1 MEDIUM is closed at both the validation and the calculation layer, verified independently rather than accepted from the test report. The delta adds no new attack surface and changes no behaviour for valid input. The feature is green on Testing and Security in the same round.

Remaining items are pre-existing, non-blocking, and recorded above for separate tracking.
