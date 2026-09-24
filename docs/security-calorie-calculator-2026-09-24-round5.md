# Security Review — Calorie & Macro Calculator (Round 5)

- **Date:** 2026-09-24
- **Scope:** documentation only — `BancoDeDadosTorv/` across `a647fef` + `093eebd`
  - `a647fef` — `docs(db): sync BancoDeDadosTorv with supabase_auth_link and nutrition_targets_basis`
  - `093eebd` — `docs(db): normalize mock fitness_level and goal to exact domain values`
- **Previous rounds:** round 1 (FAIL, 1 MEDIUM) → rounds 2, 3, 4 (PASS)
- **Precondition:** parity green — `docs/qa-calorie-calculator-2026-09-24-round7.md`
- **Focus:** real secrets in the `.sql` files, real personal data in the mock, dangerous runnable statements, and whether the `handle_new_user` / `SECURITY DEFINER` / `search_path` documentation matches the deployed migration
- **Verdict: PASS** — no secrets, no real personal data, nothing destructive, and the trigger documentation is byte-identical to the migration. One LOW consistency note.

---

## 1. Secrets, credentials, connection strings — clean

Swept the whole directory for passwords, keys, tokens, JWTs, private keys and connection strings (`postgres://`, `postgresql://`, `sqlserver://`, `*.supabase.co`, `eyJ…`, `service_role`, `anon key`, `BEGIN … PRIVATE KEY`).

**No connection string, no key, and no JWT of any kind appears anywhere in `BancoDeDadosTorv/`.** Every credential-shaped string is a placeholder:

| Location | Value | Assessment |
|---|---|---|
| `Gestao_e_Performance.sql:27` | `CREATE ROLE torv_api LOGIN PASSWORD '<set-at-deploy-time>'` | Placeholder ✅ |
| `Gestao_e_Performance.sql:39` | `CREATE ROLE torv_analyst LOGIN PASSWORD '<set-at-deploy-time>'` | Placeholder ✅ |
| `Mock Dados.sql:18` | `password: '<senha de teste>'` | Placeholder ✅ |
| `Testes Procedures e Triggers.sql:16` | `password: 'senhaSegura123'` | Literal — see note below |

`Gestao_e_Performance.sql:21-22` carries an explicit standing warning that the real passwords live only in the gitignored `BackEndTorv/.env` and never in this versioned file. Good practice, and it is being followed.

### Improvement delivered by this delta

`Mock Dados.sql` previously inserted `password_hash` values (`'hash123'`, repeated across all five rows). The delta **removes the column from the insert entirely**, replacing it with an explicit note that the password now lives only in `auth.users` and never in `public`. That is a fabricated placeholder disappearing rather than a real secret, but dropping a password-shaped column from a versioned seed script is the right direction and removes a copy-paste hazard.

### LOW — literal test password where the siblings use a placeholder

`Testes Procedures e Triggers.sql:16` spells out `password: 'senhaSegura123'` in the `supabase.auth.admin.createUser` example for `carlos.teste@torv.com`.

This is **not a leaked credential**: it is an obviously synthetic value for a documentation-only example account, and it is **pre-existing** — it was previously the second argument to the removed `fn_register_new_user(...)` call, and the delta carried it into the new example rather than introducing it.

It is still worth changing. The two sibling files both adopted the `<…>` placeholder convention, and this is the one spot that did not. The practical consequence is small but real: anyone following the snippet verbatim against a shared Supabase project creates a live account with a known, weak, git-published password. Since the delta rewrote this exact block, it was the natural moment to normalise it.

**Recommendation:** replace with `'<senha de teste>'`, matching `Mock Dados.sql:18`. Cosmetic, one line, no urgency.

---

## 2. Personal data in the mock — clean

The five demo personas (`João Silva`, `Marina Alves`, `Rafael Costa`, `Julia Lima`, `Pedro Torres`) are generic Brazilian names paired with `@torv.com` addresses on the project's own namespace. UUIDs are transparently synthetic and sequential (`A1000000-0000-0000-0000-00000000000{1..5}`).

No real-person identifiers of any kind: no CPF, no phone number, no address, no real email domain, no photo URL pointing at a real asset. Birth dates are round fictional values. The remaining mock rows are nutrition and workout figures carrying no personal information.

`093eebd` only normalises `fitness_level` and `goal` to the exact domain values the application writes (`INICIANTE`/`INTERMEDIÁRIO`/`AVANÇADO`; the six goal names). This is a correctness alignment with `nutritionCalculator.js` — and a welcome one, since the previous mock values (`'Intermediário'`, `'Ganhar Massa'`) did not match any domain constant and would have exercised precisely the fallback paths that rounds 1 and 2 hardened. Seeding data that matches production values makes the mock a more honest test of the real code path.

---

## 3. Dangerous runnable statements — clean

Swept for `TRUNCATE`, `DROP TABLE|DATABASE|SCHEMA|COLUMN`, `DELETE FROM`, and `ALTER TABLE … DROP`.

**No `TRUNCATE`. No `DROP TABLE`, `DROP DATABASE`, `DROP SCHEMA` or `DROP COLUMN`. No unqualified `DELETE FROM`.**

The single `DROP` in the whole directory is `Regras BD.sql:136`:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

This is the standard idempotent re-install pattern: guarded by `IF EXISTS` and immediately followed by the `CREATE` that restores it. Running it re-installs the trigger identically rather than leaving anything dropped.

Worth noting explicitly what the docs **did not** copy: the real migration `20260918165833_supabase_auth_link` contains `TRUNCATE TABLE users CASCADE;` (a one-time reset, annotated there as having no production accounts to preserve). That statement was correctly **left out** of the documentation copy. Had it been carried across, this file would have become genuinely dangerous to run — a reader treating `Regras BD.sql` as a re-runnable reference would have wiped every user. Its absence is the right call and the most important thing this section confirms.

### Residual consideration (not a finding)

All four files declare *"This file has no runtime effect; it exists for readability/presentation only"*, yet they contain executable `CREATE TABLE`, `CREATE VIEW`, `CREATE OR REPLACE FUNCTION`, `CREATE ROLE` and `INSERT` statements. The header sets expectations correctly and nothing here is destructive, so this is not a defect. The real hazard in a file like this is **drift** — a documentation copy that has fallen behind the deployed code, which someone then runs and silently downgrades production. That risk is addressed directly in section 4, and it checks out.

---

## 4. `handle_new_user` / `SECURITY DEFINER` / `search_path` — verified against the migration

### Parity — byte-identical

Rather than reading both and judging by eye, the block was extracted from each file and compared mechanically: from `CREATE OR REPLACE FUNCTION public.handle_new_user` through `EXECUTE FUNCTION public.handle_new_user();`.

```
48 lines  BackEndTorv/prisma/migrations/20260918165833_supabase_auth_link/migration.sql
48 lines  BancoDeDadosTorv/Regras BD.sql
diff → no differences
```

The documented function, its `SECURITY DEFINER` and `SET search_path` clauses, its body, and the trigger registration are **byte-for-byte identical to the deployed migration**. There is no drift, so the downgrade hazard described above does not exist here.

### Is the security posture itself correct?

Parity only proves the doc is faithful; the pattern still deserves its own look.

**`SECURITY DEFINER` is necessary here and correctly justified.** The trigger fires on `INSERT INTO auth.users`, in a context that holds no write privilege on the `public` tables. Without `SECURITY DEFINER` the propagation would fail. The doc's explanation of this is accurate.

**`SET search_path = public` is the right mitigation**, and the doc's stated reason — preventing hijack by a schema planted in the caller's `search_path` — is the correct threat model. A `SECURITY DEFINER` function without a pinned `search_path` is the classic Postgres privilege-escalation pattern; this one pins it.

**The function body reinforces that pinning.** Every relation it touches is schema-qualified: `public.users`, `public.user_profiles`, `public.user_measurements`, `public.user_streaks`. This matters more than the `SET` clause alone, because Postgres searches `pg_temp` ahead of the path for *relation* names even when `pg_temp` is not listed. Full qualification means a temp table named `users` cannot shadow the real target. The strongest form would be `SET search_path = ''` with every function call qualified too (`pg_catalog.gen_random_uuid()`, `pg_catalog.split_part()`), but the residual exposure is narrow: unqualified function calls resolve against `pg_catalog` first, and shadowing them would require `CREATE` privilege on `public`, which Supabase does not grant to `anon` or `authenticated` by default. The current form follows Supabase's own documented recommendation. No change required.

**Metadata trust is documented rather than introduced.** The function reads `NEW.raw_user_meta_data`, which is client-supplied at `signUp`, and writes `fitness_level` and `goal` into `user_profiles` with no enum validation. This is exactly the second entry point flagged in round 2 — and it is already neutralised on the backend: since `9573874`, `parseGoals` and the activity-factor lookup use `Object.hasOwn`, so an invalid or prototype-chain value falls back to `INICIANTE` / `Saúde & Bem-estar` with finite macros. The documentation now makes this path visible, which is an improvement: the trust boundary is easier to see in the docs than it was in the migration alone. No new exposure.

### Surrounding documentation accuracy

Two related claims were checked rather than assumed, since an inaccurate security claim in a reference file is itself a hazard:

- **`Gestao_e_Performance.sql:36-38`** now states the analyst role is restricted to views to protect *"e-mails, datas de nascimento"*, replacing the stale *"senhas, e-mails"*. Verified against the actual grants: `torv_analyst` receives `SELECT` only on `vw_dashboard_user_stats` and `vw_group_leaderboard`. Those views project `user_id`, `name`, `username`, `photo_url`, streak counts, `goal_calories` and group standings — **no `email`, no `birth_date`, no `gender`**. The claim is accurate as written, and the correction away from "senhas" is right, since `password_hash` no longer exists in `public`.
- **`SQL BANCO DE DADOS.sql`** drops `password_hash` and the `id` default from `users`, and adds the two `user_measurements` CHECK constraints (`weight_kg` 20–300, `height_cm` 50–250). All four changes match `20260918165833_supabase_auth_link` exactly. The documented bounds are the same ones `profileValidation.js` enforces at the API layer — defence in depth, correctly mirrored in both places.

---

## Carried forward — noted, not blocking

Unchanged by this documentation delta.

- **S1 — `ALLOWED_IMAGE_TYPES[data.mimetype]`** (`profile.controller.js:82`) — prototype-chain lookup in the upload path, blocked by the following signature check. Fold into an `Object.hasOwn` cleanup commit.
- **No RLS in any migration** — authorization rests entirely on the API layer. Correct while Postgres is reached only through Prisma with backend credentials; becomes cross-tenant exposure the day the frontend gets a direct Supabase client with an anon key. This round reinforces the point: `handle_new_user` runs `SECURITY DEFINER` and would bypass RLS if any existed, so the policies and this trigger need designing together when RLS lands.
- **`macros_json: Type.Any()`** (round 4) — malformed values poison `GET /diet/summary` for that date with a persistent 500.
- **`username` accepted unvalidated** — no length check against `VARCHAR(100)`.
- **Axios errors logged client-side** — `AxiosError` carries `config.headers.Authorization`.
- **Writing GET** (`GET /diet/targets/suggestion` restamps `basis_json`, round 3) — HTTP-hygiene cleanup.

---

## Conclusion

**PASS.** The `BancoDeDadosTorv/` sync contains no real secret, credential or connection string — every credential-shaped value is a placeholder, and the delta actively removed the `password_hash` column from the seed script. The mock holds no real personal data, and `093eebd` improves it by aligning with the production domain values. Nothing destructive is present: the one `DROP` is a guarded trigger re-install, and the migration's `TRUNCATE TABLE users CASCADE` was correctly left out of the documentation copy.

The `handle_new_user` documentation is byte-identical to the deployed migration, so there is no drift to mislead a reader. The `SECURITY DEFINER` + pinned `search_path` posture is sound, correctly explained, and reinforced by full schema qualification throughout the body. The surrounding claims about what the analyst role can reach were verified against the actual view definitions and hold.

Only a one-line cosmetic note (`senhaSegura123` → placeholder). Feature remains green on Testing and Security in the same round.
