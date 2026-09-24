# Security Review — Calorie & Macro Calculator (Round 4)

- **Date:** 2026-09-24
- **Scope:** delta `b69d9de` + `af654ee` + `c39bb9d` only
  - `b69d9de` — `fix(front): clear remaining tsc errors in Login gradient and MyDiet macros typing`
  - `af654ee` — `fix(diet): require a uuid for the food log id params`
  - `c39bb9d` — `test(diet): pin today in the suggestion stub so the clock cannot break it`
- **Previous rounds:** round 1 (FAIL, 1 MEDIUM) → round 2 (PASS) → round 3 (PASS)
- **Precondition:** tests green — `docs/qa-calorie-calculator-2026-09-24-round5.md`, `-round6.md`
- **Lens:** OWASP Top 10
- **Verdict: PASS** — nothing new opened. One delta closes a round 3 item; the other two are type-level and test-only.

---

## `af654ee` — `format: 'uuid'` on `logIdParams`

One line in `src/routes/diet.routes.js:143`. This closes the exact item round 3 recorded as *"the remaining instance of that class"* after `6638c0f` fixed the date params.

### Coverage — both routes

`logIdParams` is a shared constant consumed by both schemas, so one line covers two endpoints:

- `updateFoodLogSchema` (`:150`) → `fastify.put('/:logId', ...)` (`:164`)
- `deleteFoodLogSchema` (`:170`) → `fastify.delete('/:logId', ...)` (`:179`)

Both the mutating and the destructive route are now gated.

### Verified enforcement

Checked empirically with `fastify.inject()` on an isolated instance — no server bound, port 3000 untouched:

| Input | Result |
|---|---|
| `4638584d-6437-42c1-9020-c0c326ef979d` | 200 |
| `4638584D-6437-42C1-9020-C0C326EF979D` | 200 — case-insensitive, as expected |
| `00000000-0000-0000-0000-000000000000` | 200 — nil UUID is well-formed |
| `abc` | 400 |
| `1` | 400 |
| `../../etc` | 400 |
| `4638584d-...-c0c326ef979d'--` | 400 |
| `' OR 1=1--` | 400 |

### Regression check — route matching

The real risk in constraining a parametric segment is shadowing a sibling static route. `PUT /diet/targets` and `PUT /diet/:logId` are both registered, and `targets` is not a UUID — if the parametric route won, that endpoint would start returning 400.

Verified it does not. Fastify's router gives static segments priority over parametric ones, confirmed by injecting both shapes against a replica of the registration:

```
PUT /diet/targets                                200 {"route":"static /targets"}
PUT /diet/4638584d-6437-42c1-9020-c0c326ef979d   200 {"route":"param",...}
```

No shadowing. `MyDiet/index.tsx:246` (`api.put('/diet/targets', ...)`) is unaffected.

### Client-regression check

The two frontend senders pass server-issued identifiers, never user-typed text:

- `MyDiet/index.tsx:219` — `api.put(\`/diet/${selectedMealId}\`)`, set from `meal.id` at `:274`
- `MyDiet/index.tsx:292` — `api.delete(\`/diet/${mealToDelete}\`)`, set from the `id` argument at `:285`

Both originate in `log.id`, a `gen_random_uuid()` value from `food_logs`. No breakage.

### Security reading

As with the date fix, precision matters about what changed. This did **not** close an injection — `deleteFoodLog`/`updateFoodLog` reach Postgres through bound Prisma parameters, so a quoted payload was never concatenated into SQL. What it closes is the **500-on-malformed-input** path: a non-UUID previously failed the `uuid` cast at the database and surfaced as a generic 500. It is now rejected at the schema boundary with a 400 naming the field. Malformed input no longer reaches the data layer, which is the correct ordering. The change only narrows an accepted set; no route, handler, or query was added.

---

## `b69d9de` — frontend type and style fixes

Two changes, both confirmed runtime-neutral as the task described.

**`Login/index.tsx:65` — `StyleSheet.absoluteFillObject` → `StyleSheet.absoluteFill`.** Both are React Native constants describing the same four edges pinned to zero; `absoluteFill` is the pre-registered style ID and `absoluteFillObject` is the plain object literal. Either is a valid `ViewStyle` for `LinearGradient`. Purely cosmetic to the type-checker. No security surface — a decorative gradient overlay.

**`MyDiet/index.tsx:30-38, 133` — new `MealMacros` interface, `let macros: MealMacros = {...}`.** A TypeScript `interface` plus one annotation. Both are erased at compile time and emit no JavaScript. The parsing line itself is unchanged:

```js
macros = typeof log.macros_json === 'string' ? JSON.parse(log.macros_json) : log.macros_json || macros;
```

Still `JSON.parse` rather than `eval`, still wrapped in `try/catch`, still rendering through `<Text>`, which escapes by construction. No new sink, and the data being parsed is the caller's own previously-submitted content. Adding a type does not widen what the code accepts — TypeScript types are not a runtime boundary, and none is being relied on as one here.

---

## `c39bb9d` — pinned `today` in the test fixture

Test-only file (`src/lib/nutritionSuggestion.test.js`), adding `today: new Date('2026-09-24T12:00:00Z')` to the stubbed `getCalcInputs` return so the computed age — and therefore the expected macro numbers — no longer drift with the wall clock. Legitimate determinism fix.

One thing here genuinely warranted checking rather than waving through: the fixture demonstrates that a `today` key on the `getCalcInputs` result flows into `calculateTargets` and overrides its clock. If any request-controlled value could reach that key in production, a client could shift its own computed age and steer its macro targets — an integrity lever on exactly the calculation round 1 established must stay server-authoritative.

It cannot. Verified:

- `calculateTargets` has exactly **one** production caller: `nutritionSuggestion.js:18`, `calculateTargets(inputs)`.
- `inputs` comes solely from `dietRepository.getCalcInputs(userId)`.
- That method (`diet.repository.js:82-103`) returns a fixed six-key object — `gender`, `birthDate`, `fitnessLevel`, `goals`, `weightKg`, `heightCm`. **No `today` key**, and no request object is in scope to supply one.
- `calculateTargets` therefore falls back to its `today = new Date()` default on every production path.

The override is reachable only by a test stubbing the repository. No client-controlled clock exists.

### Tests

Ran the suite independently rather than relying on the QA reports:

```
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

---

## New observation — out of delta scope, non-blocking

Surfacing this because it is the strongest remaining member of the *malformed-input-reaches-the-data-layer* class the team has been closing across rounds 3 and 4, and it has not been recorded in any prior report. **It is not part of this delta and does not affect the verdict.**

`POST /diet` declares `macros_json: Type.Any()`, so any JSON value is accepted. `diet.repository.js:38` stores a client-supplied string verbatim (`typeof data.macros_json === 'string' ? data.macros_json : JSON.stringify(...)`), and the column is `TEXT` (`schema.prisma:172`), so nothing validates it on write. On read, `fn_get_diet_summary` casts it: `fl.macros_json::json->>'protein')::int` (`20260915170948_init_postgres/migration.sql:304-306`).

A value that is not valid JSON — or valid JSON whose macro fields are not integer-castable, such as `{"protein": 12.5}` — therefore fails the cast at read time. The `COALESCE` wrapping those expressions does not help: the error is raised inside the cast, before `COALESCE` ever sees a value.

Consequence: one malformed log poisons `GET /diet/summary` for that date with a persistent 500. Recovery from the app is awkward, since `DELETE /diet/:logId` needs the log id and the screen that lists ids is the endpoint that is failing. Self-scoped, no cross-tenant reach and no injection (Prisma binds the parameter), and the non-integer case is as likely to be hit by accident as by intent.

**Recommendation:** validate the shape on the way in rather than on the way out — a real TypeBox object for `macros_json` in place of `Type.Any()`, matching the treatment `date`, `logged_date`, and `logId` just received. Worth its own item outside this feature's cycle.

---

## Carried forward — noted, not blocking

Unchanged by this delta.

- **S1 — `ALLOWED_IMAGE_TYPES[data.mimetype]`** (`profile.controller.js:82`) — prototype-chain lookup in the upload path. Pre-existing, blocked by the following `hasValidImageSignature` check whose default is `return false`. Fold into an `Object.hasOwn` cleanup commit.
- **No RLS in any migration** — authorization rests entirely on the API layer. Correct while Postgres is reached only through Prisma with backend credentials; becomes cross-tenant exposure the day the frontend gets a direct Supabase client with an anon key. Deserves its own tracked item.
- **`username` accepted unvalidated** — no length check against `VARCHAR(100)`; an over-long value surfaces as a 500.
- **Axios errors logged client-side** — established repo pattern; `AxiosError` carries `config.headers.Authorization`, so a release build retaining `console.*` could leak a bearer token to the device log.
- **Writing GET** (`GET /diet/targets/suggestion` restamps `basis_json`, round 3) — HTTP-hygiene cleanup, no security impact under header-based auth.

---

## Conclusion

**PASS.** `af654ee` is corrective and closes the item round 3 left open, verified to enforce UUIDs on both the PUT and DELETE routes without shadowing the sibling static route or breaking either frontend caller. `b69d9de` is type-level and emits no JavaScript. `c39bb9d` touches only a test, and the one substantive question it raised — whether a client can influence the calculation's clock — was traced to ground and answered no.

Feature remains green on Testing and Security in the same round.
