# Security Review — Calorie & Macro Calculator (Round 6)

- **Date:** 2026-09-24
- **Scope:** commit `75df47f` only — `docs(db): replace test password with placeholder in trigger test script`
- **Previous rounds:** round 1 (FAIL, 1 MEDIUM) → rounds 2–5 (PASS)
- **Precondition:** QA round 8 PASS
- **Verdict: PASS** — round 5's LOW is closed. Nothing else changed.

---

## Round 5 LOW — literal test password — **CLOSED**

One line in `BancoDeDadosTorv/Testes Procedures e Triggers.sql:16`:

```diff
---     email: 'carlos.teste@torv.com', password: 'senhaSegura123', email_confirm: true,
+--     email: 'carlos.teste@torv.com', password: '<senha de teste>', email_confirm: true,
```

Exactly the recommended fix, and the whole of the change. The `createUser` example now matches the placeholder convention its sibling files already used, so nobody following the snippet verbatim creates a live account with a git-published password.

### Verification

Round 5 noted this value was never a real credential, so the point of the check is convention consistency across the directory — verified with a deliberately broad sweep rather than a narrow one:

- **`senhaSegura123` no longer appears anywhere in `BancoDeDadosTorv/`.** The only surviving occurrences in the repository are inside the reports that documented the finding (`security-...-round5.md`, `qa-...-round8.md`). Reports quoting what they found is correct and expected; the value was synthetic, so nothing leaks by being cited.
- **No literal password value survives in any of the 7 files**, including the `bckp/` subfolder (`automated_daily_backup.sql`, `SQLQuery1.sql`), which was covered by the recursive sweep.
- The sweep intentionally matched both syntaxes — `password: 'x'` (colon, JS object) and `PASSWORD 'x'` (bare, SQL `CREATE ROLE`) — since a pattern covering only the SQL form is what let this value slip past an earlier scan. Nothing matched.
- Remaining credential-shaped values are all placeholders: `'<senha de teste>'` in `Mock Dados.sql:18` and `Testes Procedures e Triggers.sql:16`, `'<set-at-deploy-time>'` in `Gestao_e_Performance.sql:27,39`.

### Scope confirmation

`75df47f` touches one file, one line, inside a SQL comment. No executable statement, no schema, no application code. Nothing new to review.

---

## Carried forward — noted, not blocking

Unchanged by this commit.

- **S1 — `ALLOWED_IMAGE_TYPES[data.mimetype]`** (`profile.controller.js:82`) — prototype-chain lookup, blocked by the following signature check. Fold into an `Object.hasOwn` cleanup commit.
- **No RLS in any migration** — authorization rests entirely on the API layer; becomes cross-tenant exposure the day the frontend gets a direct Supabase client with an anon key. `handle_new_user` is `SECURITY DEFINER` and would bypass RLS, so policies and that trigger need designing together.
- **`macros_json: Type.Any()`** — malformed values poison `GET /diet/summary` for that date with a persistent 500.
- **`username` accepted unvalidated** — no length check against `VARCHAR(100)`.
- **Axios errors logged client-side** — `AxiosError` carries `config.headers.Authorization`.
- **Writing GET** — `GET /diet/targets/suggestion` restamps `basis_json`; HTTP-hygiene cleanup.

---

## Conclusion

**PASS.** The round 5 LOW is closed with the exact one-line fix, and the placeholder convention is now consistent across every file in `BancoDeDadosTorv/`. No open finding remains from any round of this feature's review; everything still listed is pre-existing and tracked separately.
