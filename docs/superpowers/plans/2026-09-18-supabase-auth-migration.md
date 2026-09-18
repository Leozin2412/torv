# Supabase Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **TORV override:** execution happens via the matching Maestri recruit (`maestri ask "Torv Database" ...` / `"Torv Backend"` / `"Torv Frontend"`), never via an internal Agent-tool subagent — see `CLAUDE.md` section 4. Treat each task below as one `maestri ask` turn, routed to the recruit named in that task's **Recruit** line.

**Goal:** Replace the app's custom JWT auth (7-day token, no refresh, `AsyncStorage`) with Supabase Auth: the RN app talks to Supabase directly for login/signup via `@supabase/supabase-js` with `expo-secure-store` session storage (the mobile equivalent of an httpOnly cookie), 15-minute access tokens, and refresh handled natively by Supabase's `auth.refresh_tokens`/`auth.sessions` (multi-device, rotation — no custom refresh-token table needed). The backend only verifies Supabase-issued JWTs; it no longer issues its own.

**Architecture:** See the design doc below — RN uses the Supabase client SDK directly for auth (not proxied through Fastify); Fastify's `auth.middleware.js` verifies Supabase JWTs instead of signing its own; a Postgres trigger on `auth.users` replaces the old registration side-effects (creating `user_profiles`/`user_measurements`/`user_streaks` rows).

**Tech Stack:** `@supabase/supabase-js`, `expo-secure-store`, `react-native-url-polyfill` (frontend); `jose` for JWKS-based JWT verification (backend — new dependency, the project's Supabase Auth uses asymmetric signing keys, not a static secret); raw SQL migration + Postgres trigger (database).

**Spec:** `docs/superpowers/specs/2026-09-18-supabase-auth-migration-design.md`

## Global Constraints

- No CSRF work — confirmed not applicable (no cookie-based auth involved).
- No MFA, social login, or password-reset-by-email flow — not requested, out of scope (spec's "Fora de escopo" section).
- Existing account data is test-only and may be reset; no bcrypt-hash-preserving migration needed (spec decision).
- Access token TTL 15 minutes, refresh token TTL 30 days, multi-device sessions allowed — all configured on the Supabase project, not hand-built.
- `SUPABASE_URL` (frontend and backend — not sensitive) and `SUPABASE_ANON_KEY` (frontend only — the new **publishable key**, format `sb_publishable_...`, Supabase's own dashboard marks it "safe to use in a browser") must be pulled from the real project's dashboard (project ref `figlsyikardnbfuykhxq`, Project Settings → API Keys) — this session's connected Supabase MCP account does not include this project, so these are supplied by whoever runs the task, not guessed. No backend secret is needed at all: JWT verification uses the project's public JWKS (Task 3).

---

### Task 1: Database — schema changes for the `auth.users` link

**Recruit:** Torv Database

**Files:**
- Modify: `BackEndTorv/prisma/schema.prisma:11-30` (`users` model)

**Interfaces:**
- Produces: `users.id` is no longer self-generated (`dbgenerated("gen_random_uuid()")` removed) — it will be supplied explicitly by the Task 2 trigger, equal to the `auth.users.id` that created it. `users.password_hash` is removed.

- [ ] **Step 1: Edit the `users` model**

In `BackEndTorv/prisma/schema.prisma`, change:

```prisma
model users {
  id                String              @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email             String              @unique @db.VarChar(255)
  password_hash     String              @db.VarChar(255)
  auth_provider     String?             @db.VarChar(50)
  created_at        DateTime?           @default(now()) @db.Timestamptz
```

to:

```prisma
model users {
  id                String              @id @db.Uuid
  email             String              @unique @db.VarChar(255)
  auth_provider     String?             @db.VarChar(50)
  created_at        DateTime?           @default(now()) @db.Timestamptz
```

(only `id`'s `@default(...)` and the `password_hash` line change — the relation fields below stay untouched.)

- [ ] **Step 2: Generate a migration without applying it yet**

```bash
cd BackEndTorv
npx prisma migrate dev --create-only --name supabase_auth_link
```

This creates `BackEndTorv/prisma/migrations/<timestamp>_supabase_auth_link/migration.sql` with the `ALTER TABLE` for the column drop — leave it as generated, Task 2 appends to the same file.

- [ ] **Step 3: Commit the schema change and generated migration stub**

```bash
git add BackEndTorv/prisma/schema.prisma BackEndTorv/prisma/migrations
git commit -m "feat(db): drop password_hash, prepare users.id for auth.users link"
```

---

### Task 2: Database — FK to `auth.users`, validation constraints, reset test data

**Recruit:** Torv Database

**Files:**
- Modify: `BackEndTorv/prisma/migrations/<timestamp from Task 1>_supabase_auth_link/migration.sql` (append)

**Interfaces:**
- Consumes: the `ALTER TABLE users DROP COLUMN password_hash` statement Prisma generated in Task 1.
- Produces: `users.id` FK'd to `auth.users(id)`, `user_measurements` gets range checks on `weight_kg`/`height_cm` (replacing the app-layer bounds check that lived in the removed `authController.register`).

- [ ] **Step 1: Append the FK and validation constraints to the migration file**

Add to the end of the migration file generated in Task 1:

```sql
-- Reset test data: no production accounts to preserve (confirmed in design doc).
TRUNCATE TABLE users CASCADE;

-- users.id must equal the auth.users.id that owns it.
ALTER TABLE users
  ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Bounds that used to live in authController.register (BackEndTorv/src/controller/auth.controller.js,
-- now removed) move here so they hold for every future writer, not just registration.
ALTER TABLE user_measurements
  ADD CONSTRAINT user_measurements_weight_kg_check CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 300)),
  ADD CONSTRAINT user_measurements_height_cm_check CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250));
```

- [ ] **Step 2: Write the `handle_new_user` trigger in the same migration file**

Append:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := NEW.raw_user_meta_data;
  final_username text;
BEGIN
  final_username := NULLIF(meta->>'username', '');
  IF final_username IS NULL THEN
    final_username := split_part(NEW.email, '@', 1) || '_' || substr(NEW.id::text, 1, 8);
  END IF;

  INSERT INTO public.users (id, email, auth_provider, created_at)
  VALUES (NEW.id, NEW.email, 'email', now());

  INSERT INTO public.user_profiles (user_id, username, name, fitness_level, goal, birth_date, gender)
  VALUES (
    NEW.id,
    final_username,
    meta->>'name',
    meta->>'fitness_level',
    meta->>'goal',
    NULLIF(meta->>'birth_date', '')::date,
    meta->>'gender'
  );

  INSERT INTO public.user_measurements (id, user_id, weight_kg, height_cm)
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NULLIF(meta->>'weight', '')::decimal,
    NULLIF(meta->>'height', '')::int
  );

  INSERT INTO public.user_streaks (user_id, current_streak, longest_streak)
  VALUES (NEW.id, 0, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

`user_profiles.name` is `NOT NULL` in the schema (unchanged) — if `raw_user_meta_data` has no `name`, this insert fails and the whole signup fails (same requirement `authController.register` enforced with its `if (!name)` check, now enforced by the database instead of app code). The frontend (Task 8) always sends `name`, so this only fires for a signup that bypasses the app (e.g. someone testing directly against the Supabase dashboard).

If a caller supplies an explicit `username` in metadata that collides with an existing one, the unique constraint on `user_profiles.username` makes the insert (and the whole signup) fail — unlike the old code, which silently discarded the requested username and generated a new one. This is intentional: silently overriding what someone typed is worse than surfacing "username taken."

- [ ] **Step 3: Apply the migration**

```bash
cd BackEndTorv
npx prisma migrate dev
npx prisma generate
```

Expected: migration applies cleanly, Prisma client regenerates without `users.password_hash` in its types.

- [ ] **Step 4: Verify the trigger manually**

In the Supabase SQL editor (or `psql` against `DIRECT_URL`), sanity-check the function exists and the FK is in place:

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
SELECT conname FROM pg_constraint WHERE conname = 'users_id_fkey';
```

Expected: one row each. Full end-to-end verification (an actual signup creating all 4 rows) happens in Task 10, once the frontend can call `signUp`.

- [ ] **Step 5: Commit**

```bash
git add BackEndTorv/prisma/migrations BackEndTorv/prisma/schema.prisma
git commit -m "feat(db): link users to auth.users, add handle_new_user trigger and measurement bounds"
```

---

### Task 3: Backend — verify Supabase JWTs instead of the app's own

**Recruit:** Torv Backend

**This project's Supabase Auth already rotated to asymmetric JWT signing keys (ECC P-256) — confirmed on the dashboard's JWT Keys page, "CURRENT KEY" is ECC P-256, the old HS256 shared secret is listed under "Previously used keys" and only still validates tokens issued before the rotation.** New tokens can't be verified with a static secret. Verification has to fetch the project's public JSON Web Key Set (JWKS) instead — this is a plain HTTPS GET to a public, non-secret URL, so there's nothing sensitive to paste into `.env` for this task, just the project URL.

**Files:**
- Modify: `BackEndTorv/src/middlewares/auth.middleware.js`
- Modify: `BackEndTorv/.env` (add `SUPABASE_URL`)
- Modify: `BackEndTorv/package.json` (new dependency: `jose`)

**Interfaces:**
- Produces: `request.user.userId` (string, the Supabase `sub` claim) — same shape the 9 existing call sites in `diet.controller.js`/`profile.controller.js` already destructure, so **no changes needed in those files**.

- [x] **Step 1: Add the env var and the JWKS-verification dependency**

`jsonwebtoken` (already installed) has no JWKS support — it only verifies against a key/secret you hand it directly, it can't fetch and cache a remote key set or pick the right key by `kid`. `jose` does, and is the library Supabase's own docs point to for this exact case.

```bash
cd BackEndTorv
npm install jose
```

In `BackEndTorv/.env`, add (Project URL from the Supabase dashboard → Project Settings → API Keys, project ref `figlsyikardnbfuykhxq` — not sensitive, just documented here for setup):

```env
SUPABASE_URL="<project API URL from the dashboard>"
```

- [x] **Step 2: Rewrite the middleware**

Replace the full contents of `BackEndTorv/src/middlewares/auth.middleware.js`:

```javascript
const { createRemoteJWKSet, jwtVerify } = require('jose');

const SUPABASE_URL = process.env.SUPABASE_URL;
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

const authenticateToken = async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return reply.status(401).send({ error: 'Access token is missing' });

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
    });
    request.user = { ...payload, userId: payload.sub };
  } catch (err) {
    return reply.status(403).send({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;
```

The handler is `async` now instead of taking a `done` callback — Fastify's `preHandler` hooks support both styles, and `jwtVerify` is promise-based, so `async`/`await` is the natural fit here rather than wrapping it back into callback style. `createRemoteJWKSet` caches the fetched key set internally and automatically re-fetches if a token references a `kid` it hasn't seen yet (e.g. right after a future key rotation), so there's no manual caching or rotation handling to write.

- [x] **Step 3: Delete the now-unused custom secret file**

`BackEndTorv/src/lib/jwt-secret.js` was only used by the old middleware and the removed `auth.controller.js` (Task 4 deletes the controller). Confirm no other importer, then delete:

```bash
grep -rn "jwt-secret" BackEndTorv/src
```

Expected: only `auth.middleware.js` (just edited) and `auth.controller.js` (about to be deleted in Task 4) show up. Delete the file:

```bash
rm BackEndTorv/src/lib/jwt-secret.js
```

- [x] **Step 4: Commit**

```bash
git add BackEndTorv/src/middlewares/auth.middleware.js BackEndTorv/.env BackEndTorv/package.json BackEndTorv/package-lock.json
git rm BackEndTorv/src/lib/jwt-secret.js
git commit -m "feat(auth): verify Supabase-issued JWTs via JWKS instead of a self-signed token"
```

---

### Task 4: Backend — remove the app's own login/register endpoints

**Recruit:** Torv Backend

**Files:**
- Delete: `BackEndTorv/src/controller/auth.controller.js`, `BackEndTorv/src/routes/auth.routes.js`
- Modify: `BackEndTorv/server.js`

**Interfaces:**
- Consumes: nothing (this task only removes code).

- [x] **Step 1: Remove the route registration**

In `BackEndTorv/server.js`, delete this line:

```javascript
fastify.register(require('./src/routes/auth.routes'), { prefix: '/auth' });
```

- [x] **Step 2: Delete the controller and routes files**

```bash
git rm BackEndTorv/src/controller/auth.controller.js BackEndTorv/src/routes/auth.routes.js BackEndTorv/src/repository/auth.repository.js
```

(`auth.repository.js` is deleted too — its only callers were `auth.controller.js`.)

- [x] **Step 3: Verify nothing else references the removed files**

```bash
grep -rn "auth.controller\|auth.routes\|auth.repository" BackEndTorv/src BackEndTorv/server.js
```

Expected: no matches.

- [x] **Step 4: Start the server and confirm it boots**

```bash
cd BackEndTorv
node server.js
```

Expected: starts without error, no `/auth` routes registered (check `http://localhost:3000/documentation` in dev — `/auth/login` and `/auth/register` should no longer be listed). Stop the server after confirming (do not leave it running on port 3000 outside the "Furnace" Maestri terminal that normally owns it).

- [x] **Step 5: Commit**

```bash
git add BackEndTorv/server.js
git commit -m "feat(auth): remove app-owned login/register endpoints, Supabase Auth owns them now"
```

---

### Task 5: Frontend — install the Supabase client and its RN prerequisites

**Recruit:** Torv Frontend

**Files:**
- Modify: `FrontEndTorv/package.json`, `FrontEndTorv/package-lock.json` (via install commands)

**Interfaces:**
- Produces: `@supabase/supabase-js` (`createClient`), `expo-secure-store`, `react-native-url-polyfill` available for Task 6.

- [ ] **Step 1: Install**

```bash
cd FrontEndTorv
npx expo install @supabase/supabase-js expo-secure-store react-native-url-polyfill
```

`react-native-url-polyfill` is required by `@supabase/supabase-js` on React Native (it uses `URL`, which RN's JS engine doesn't provide natively) — this is Supabase's own documented Expo setup requirement, not an extra choice made here.

- [ ] **Step 2: Remove the now-unused AsyncStorage dependency**

It's only used by `AuthContext.tsx` today, which Task 6 rewrites to stop using it.

```bash
grep -rln "AsyncStorage" FrontEndTorv/src
```

Expected: only `FrontEndTorv/src/contexts/AuthContext.tsx` (confirms it's safe to remove once Task 6 lands — do the actual `npm uninstall` at the end of Task 6, Step 4, after the rewrite, not here, so this task alone still leaves a working app).

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/package.json FrontEndTorv/package-lock.json
git commit -m "chore(frontend): add @supabase/supabase-js, expo-secure-store, url-polyfill"
```

---

### Task 6: Frontend — Supabase client + AuthContext rewrite

**Recruit:** Torv Frontend

**Files:**
- Create: `FrontEndTorv/src/services/supabase.ts`
- Modify: `FrontEndTorv/src/contexts/AuthContext.tsx` (full rewrite)
- Modify: `FrontEndTorv/package.json` (remove `@react-native-async-storage/async-storage`)

**Interfaces:**
- Produces: `supabase` (named export, `SupabaseClient`) from `services/supabase.ts`, consumed by Tasks 7–9. `AuthContext` still exposes `signed: boolean`, `user: Profile | null`, `loading: boolean`, `logout: () => void` (same names existing consumers — `Home`, `Profile` screens, `routes/index.tsx` — already use), but `login()` is removed (Login/Register call `supabase.auth` directly now; Task 7/8 update those call sites).

- [ ] **Step 1: Env vars for the client**

In `FrontEndTorv` (create `.env` if it doesn't exist, or add to the existing one — check first):

```bash
grep -c "" FrontEndTorv/.env 2>/dev/null || echo "no .env yet"
```

Add (values from Supabase dashboard → Project Settings → API Keys, project ref `figlsyikardnbfuykhxq` — use the **"Publishable and secret API keys"** tab's `Publishable key` (`sb_publishable_...`), not the "Legacy anon, service_role API keys" tab):

```env
EXPO_PUBLIC_SUPABASE_URL="<project API URL>"
EXPO_PUBLIC_SUPABASE_ANON_KEY="<publishable key, sb_publishable_...>"
```

(`EXPO_PUBLIC_` prefix is required for Expo to inline these into the client bundle — a bare `SUPABASE_URL` would be `undefined` at runtime.)

- [ ] **Step 2: Create the Supabase client**

Create `FrontEndTorv/src/services/supabase.ts`:

```typescript
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 3: Rewrite `AuthContext.tsx`**

Replace the full contents of `FrontEndTorv/src/contexts/AuthContext.tsx`:

```typescript
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import api from '../services/api';

interface Profile {
  id: string;
  name: string;
  email: string;
  username?: string;
  goal?: string;
  photo_url?: string;
  goalCalories?: number;
}

interface AuthContextData {
  signed: boolean;
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile');
      setUser(response.data);
    } catch (error) {
      console.log('Error loading profile after auth', error);
      setUser(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      if (current) {
        loadProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile();
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ signed: !!session, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

`login()` is gone from the context on purpose — Login/Register (Tasks 7–8) call `supabase.auth.signInWithPassword`/`signUp` directly, and `onAuthStateChange` above picks up the resulting session automatically, so there's nothing left for a context-level `login()` to do.

- [ ] **Step 4: Remove the now-unused AsyncStorage dependency**

```bash
cd FrontEndTorv
npx expo uninstall @react-native-async-storage/async-storage
```

- [ ] **Step 5: Manual verification**

```bash
cd FrontEndTorv
npx tsc --noEmit
```

Expected: no type errors referencing `AuthContext`'s removed `token`/`login` fields (Task 7/8 fix the call sites that used them — if this fails before those tasks, that's expected and resolves once they're done; don't chase it in isolation here).

- [ ] **Step 6: Commit**

```bash
git add FrontEndTorv/src/services/supabase.ts FrontEndTorv/src/contexts/AuthContext.tsx FrontEndTorv/package.json FrontEndTorv/.env
git commit -m "feat(auth): AuthContext follows Supabase session instead of managing its own token"
```

---

### Task 7: Frontend — Login screen calls Supabase directly

**Recruit:** Torv Frontend

**Files:**
- Modify: `FrontEndTorv/src/screens/Login/index.tsx:1-56`

**Interfaces:**
- Consumes: `supabase` from `../../services/supabase` (Task 6).

- [ ] **Step 1: Swap the import and the login call**

Replace:

```typescript
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
```

with:

```typescript
import { supabase } from '../../services/supabase';
```

(drop the now-unused `AuthContext`/`useContext` import and the `const { login } = useContext(AuthContext);` line — nothing else in this file reads from the context.)

Replace:

```typescript
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      login(token, user);
    } catch (error: any) {
      console.log(error);
      if (error?.response?.status === 401) {
        setLoginError('Email ou senha incorretos.');
      } else {
        setLoginError('Falha ao realizar login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
```

with:

```typescript
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      console.log(error);
      if (error?.status === 400 || error?.message?.includes('Invalid login credentials')) {
        setLoginError('Email ou senha incorretos.');
      } else {
        setLoginError('Falha ao realizar login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
```

No manual navigation is needed after a successful login — `AuthContext`'s `onAuthStateChange` listener (Task 6) picks up the new session and `routes/index.tsx` (unchanged) already switches stacks based on `signed`.

- [ ] **Step 2: Manual verification**

Run the app, log in with a valid test account, confirm it navigates past the auth stack. Log in with a wrong password, confirm "Email ou senha incorretos." shows.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/screens/Login/index.tsx
git commit -m "feat(auth): Login calls Supabase directly instead of the removed /auth/login"
```

---

### Task 8: Frontend — Register screen calls Supabase directly

**Recruit:** Torv Frontend

**Files:**
- Modify: `FrontEndTorv/src/screens/Register/index.tsx:1-128`

**Interfaces:**
- Consumes: `supabase` from `../../services/supabase` (Task 6).
- Produces: signup metadata shape the Task 2 trigger reads: `{ name, username, birth_date (YYYY-MM-DD), weight, height, gender, fitness_level, goal }`.

- [ ] **Step 1: Swap the import**

Replace:

```typescript
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
```

with:

```typescript
import { supabase } from '../../services/supabase';
```

Remove `const { login } = useContext(AuthContext);` (line 24) and the now-unused `useContext` import.

- [ ] **Step 2: Convert the birth date to ISO before sending**

The trigger casts `birth_date` with `::date`, which needs `YYYY-MM-DD`, not the `DD/MM/AAAA` the date field collects. Add a small helper above `handleRegister`:

```typescript
  const toIsoDate = (ddmmyyyy: string) => {
    const [day, month, year] = ddmmyyyy.split('/');
    return `${year}-${month}-${day}`;
  };
```

- [ ] **Step 3: Replace `handleRegister`**

Replace:

```typescript
  const handleRegister = async () => {
    if (loading || goals.length === 0) return;

    setLoading(true);
    setRegisterError('');
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        name,
        username,
        birth_date: birthDate,
        weight: Number(weight),
        height: Number(height),
        gender,
        fitness_level: fitnessLevel,
        goal: goals.join(', '),
      });

      login(response.data.token, response.data.user);
    } catch (error) {
      console.log(error);
      setRegisterError('Falha ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
```

with:

```typescript
  const handleRegister = async () => {
    if (loading || goals.length === 0) return;

    setLoading(true);
    setRegisterError('');
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            username,
            birth_date: toIsoDate(birthDate),
            weight: Number(weight),
            height: Number(height),
            gender,
            fitness_level: fitnessLevel,
            goal: goals.join(', '),
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.log(error);
      if (error?.message?.includes('already registered')) {
        setRegisterError('Já existe uma conta com esse e-mail.');
      } else {
        setRegisterError('Falha ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };
```

Same as Login: no manual navigation needed, `AuthContext`'s listener picks up the new session once Supabase confirms the signup.

- [ ] **Step 4: Manual verification**

Run the app, complete the full registration wizard (steps 0–5) with a fresh email, submit, confirm it lands past the auth stack and the profile screen shows the name/username just entered (proves the trigger's inserts into `user_profiles` worked). Try registering the same email again, confirm "Já existe uma conta com esse e-mail." shows.

- [ ] **Step 5: Commit**

```bash
git add FrontEndTorv/src/screens/Register/index.tsx
git commit -m "feat(auth): Register calls Supabase directly instead of the removed /auth/register"
```

---

### Task 9: Frontend — attach the live Supabase access token to API calls

**Recruit:** Torv Frontend

**Files:**
- Modify: `FrontEndTorv/src/services/api.ts`

**Interfaces:**
- Consumes: `supabase` from `./supabase` (Task 6).

- [ ] **Step 1: Replace the static header approach with a request interceptor**

Replace the full contents of `FrontEndTorv/src/services/api.ts`:

```typescript
import axios from 'axios';
import { supabase } from './supabase';

const baseURL = 'http://localhost:3000';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default api;
```

`supabase.auth.getSession()` returns the cached session instantly (it only hits the network if a refresh is due), and `autoRefreshToken: true` (Task 6) means the SDK keeps it current in the background — this interceptor never sends a stale token without an extra round trip on the hot path.

- [ ] **Step 2: Manual verification**

Run the app, log in, open `MyDiet` (or any authenticated screen), confirm data loads (proves the interceptor attaches a token the backend's new middleware, Task 3, accepts).

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/services/api.ts
git commit -m "feat(auth): api client reads the live Supabase session token per request"
```

---

### Task 10: End-to-end verification

**Recruit:** none — this is the Maestro's own check before handing off to `torv-review-tests` per `CLAUDE.md` section 5.

- [ ] **Step 1: Fresh signup**

Register a brand-new account through the app. Confirm in the Supabase dashboard (Table Editor) that `auth.users` has the new row AND `public.users`/`user_profiles`/`user_measurements`/`user_streaks` all got matching rows with the right data (proves the Task 2 trigger works against the real project, not just the syntax check from Task 2 Step 4).

- [ ] **Step 2: Login/logout/relaunch**

Log out, log back in with that account. Force-quit and reopen the app — confirm it's still logged in (session persisted via `expo-secure-store`, Task 6).

- [ ] **Step 3: Token expiry doesn't log the user out**

Leave the app open (or backgrounded) past 15 minutes, then perform an authenticated action (e.g. add a meal in `MyDiet`). Confirm it still works — proves `autoRefreshToken` silently refreshed the access token rather than the request failing with 403.

- [ ] **Step 4: Existing authenticated routes still work**

Exercise `MyDiet` (view summary, add/edit/delete a meal) and `Profile` (view, edit) — confirms the `request.user.userId` normalization in Task 3 didn't break the 9 existing call sites.

- [ ] **Step 5: Hand off**

Once all of the above pass, this feature moves to the `CLAUDE.md` section 5 Test stage (`Torv Review and Tests`, full diff across all three layers, including the frontend usability pass) and then Security — not part of this plan, tracked by the Maestro separately.
