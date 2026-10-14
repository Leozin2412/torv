# TORV - Project Context & Architecture

This document is the primary context guide for AI assistants working on the **TORV** project. Follow the stack and structure below when generating code, refactoring, or designing architecture.

---

## 1. Project Overview
* **Project Name:** TORV
* **Platform:** Mobile application (decoupled front-end & back-end)
* **Core Domain:** Fitness, nutrition tracking, caloric monitoring, workouts, and social gamification (groups, rankings, activity tracking).

---

## 2. Tech Stack & Architecture

TORV is split into two isolated directories: `FrontEndTorv` and `BackEndTorv`.

### 📱 Front-End Mobile (`FrontEndTorv`)
* **Framework:** React Native + Expo
* **Language:** TypeScript (`.ts`, `.tsx`)
* **Navigation:** React Navigation (native stack + bottom tabs), split into `PublicRoutes` / `PrivateRoutes` by `AuthContext.signed`.
* **Design Pattern:** Component-driven. Logic, structure, and UI layout live inside component/screen folders.
* **Styling:** React Native `StyleSheet`; shared design tokens in `src/theme/tokens.ts`.
* **State & Side Effects:** React Hooks + `AuthContext`.
* **API Client:** Axios (`src/services/api.ts`), base URL from `EXPO_PUBLIC_API_URL`.

### ⚙️ Back-End API (`BackEndTorv`)
* **Runtime:** Node.js
* **Language:** JavaScript (CommonJS)
* **Framework:** Fastify 5 — the Express → Fastify migration is complete.
* **Schemas & Docs:** Every route declares TypeBox schemas; `@fastify/swagger` + `@fastify/swagger-ui` serve OpenAPI at `/documentation` (non-production only).
* **Auth:** Supabase Auth (GoTrue). `src/lib/authProvider.js` wraps the REST API; `src/middlewares/auth.middleware.js` validates JWTs against the Supabase JWKS (`jose`).
* **Storage:** Profile photos and group covers go to Supabase Storage (`src/lib/imageUpload.js`).
* **Database Access:** Prisma ORM, only through `src/repository/`.
* **Tests:** `node --test` (`npm test`), tests live in `tests/` folders next to the code.
* **Deploy:** Vercel (`trustProxy` and upload limits are tuned for it in `server.js`).

### 🗄️ Database
* **Engine:** PostgreSQL on Supabase. The MSSQL → Postgres migration is complete; `BancoDeDadosTorv/` holds the legacy SQL Server scripts for reference only.
* **Prisma Provider:** `postgresql`, with `DATABASE_URL` (pooled) and `DIRECT_URL` (direct, for migrations).
* **Migrations:** `BackEndTorv/prisma/migrations/`.
* **Prisma Rule:** Use Postgres-native types and attributes (`@db.Uuid`, `@db.VarChar(n)`, `@db.Timestamptz`, etc.). Schema and migration changes belong to the Torv Database recruit.

### 🔑 Environment variables
`BackEndTorv/.env` (gitignored): `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`, optional `PORT`.
`FrontEndTorv/.env` (gitignored): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_UXCAM_KEY`.
Never commit real values.

---

## 3. Directory Structure Strategy

When generating, suggesting, or placing new files, follow each directory's structure:

### 📁 FrontEndTorv/
```text
src/
├── components/       # Reusable UI elements (Button, Card, Input, modals...)
│   └── ComponentName/
│       ├── index.tsx       # Component structure and local state
│       └── styles.ts       # StyleSheet definitions
├── contexts/         # React contexts (AuthContext)
├── screens/          # Full application screens
│   └── ScreenName/
│       ├── index.tsx       # Screen layout, API calls, local logic
│       └── styles.ts       # StyleSheet definitions
├── routes/           # Navigation (index.tsx, PublicRoutes/, PrivateRoutes/, types.ts)
├── services/         # Axios instance and per-domain API clients
├── theme/            # Design tokens
└── utils/            # Helpers (dates, workout/group logic...) with *.test.mjs beside them
```

### 📁 BackEndTorv/
```text
├── prisma/
│   ├── schema.prisma # Data model (PostgreSQL)
│   └── migrations/   # Prisma migrations
├── src/
│   ├── controller/   # Handles requests, business logic, sends responses
│   ├── lib/          # Shared utilities and adapters (auth provider, image upload, calculators, validation)
│   ├── middlewares/  # Fastify hooks (authentication)
│   ├── repository/   # Data access layer (all Prisma queries)
│   └── routes/       # Fastify plugins mapping URLs to controllers, plus TypeBox *.schemas.js
├── .env              # Environment variables (gitignored)
├── package.json      # Dependencies and scripts (start, dev, test)
└── server.js         # Entry point (builds Fastify, registers plugins and routes)
```

---

## 4. Agent Selection (Maestri Recruits)

TORV development is orchestrated through Maestri canvas recruits, not ad-hoc subagents. Each recruit's full role prompt lives in `.maestri/roles/<uuid>/role.json` — this table is only an index for picking the right one.

Every recruit runs as a live Maestri canvas terminal (`maestri recruit`), never as an internal Agent-tool subagent — this keeps the whole flow visible to the user on the canvas.

| Recruit | Use for |
|---|---|
| Torv Backend | Routes, controllers, middlewares, repository code calling Prisma, Express→Fastify migration |
| Torv Frontend | Screens, components, navigation, styling, API client calls |
| Torv Database | Schema, Prisma migrations, raw SQL, profile-photo storage adapter |
| Torv Frontend Image Gen | Image/visual asset generation for a Frontend task — always delegated by Torv Frontend itself, never called directly |
| Torv Review and Tests | After implementation finishes — multi-lens review + test coverage |
| Torv Security | After Review and Tests pass 100% — OWASP Top 10 review of the diff |

Torv Frontend Image Gen is always connected in the canvas only to Torv Frontend, as its subagent — never directly to the Maestro or the other recruits.

Run `maestri list` to see the current team and connections before delegating.

## 5. Development Cycle

Every new feature follows this cycle, tracked feature-wide (not per layer):

1. **Edit** — identify which layers (backend/frontend/database) the feature needs and delegate to the matching recruit(s), in parallel or in sequence depending on real contract dependencies.
2. **Test** — Torv Review and Tests runs against the full feature diff (all layers together). If the feature touches `FrontEndTorv`, this step also includes a usability pass (real user flow, via agent-browser/claude-in-chrome) — not just correctness/security checks. Each round produces a new report file in `docs/` (never overwrite a previous round — follow the existing naming pattern, e.g. `qa-<topic>-YYYY-MM-DD[-roundN].md`).
3. If any test fails: the report records the failure, the cycle does not advance to Security. Rework goes back to step 1, scoped to the layer(s) responsible for the failure.
4. Repeat 2-3 until every test passes.
5. **Security** — only runs once tests are 100% green. Torv Security reviews the full diff.
6. If Security fails: rework goes back to step 1, scoped only to the layer(s) Security flagged — not the whole feature. Testing then reruns only on what changed (new report, new round).
7. A feature is done only when both Testing and Security are green in the same round.

## 6. Task Tracking

For every feature in progress, the Maestro keeps a Maestri canvas sticky note (via the `maestri` skill) up to date with:
- Feature name.
- Current stage (Edit / Test / Security) and which recruit is running.
- Result of the latest test/security round (pass/fail, link to the `docs/` report if any).
- If in rework: which layer(s) were reopened and why.

Update the note at every stage transition, not just at the start/end. This is a live view for the user on the canvas — it does not replace the versioned reports in `docs/`.

## 7. Models and Effort

| Who | Model | Effort | Launch |
|---|---|---|---|
| Maestro (main session) | Opus 5.5 | max | `claude --model opus --effort max` |
| Every recruit using the "Claude Code" preset | Sonnet | high | `maestri recruit "Name" --preset "Claude Code" --role "<role>" --command "claude --model sonnet --effort high"` |

- **The Maestro makes every hard decision:** architecture, contracts between layers, data model, trade-offs, scope, how to read the spec, and which layer to reopen after a failure.
- **Recruits execute.** They receive a decision that is already made, plus the exact files, interfaces and acceptance criteria.
- **When a recruit hits an ambiguous or hard decision that the task does not cover, it asks the Maestro back (ask-back) instead of choosing on its own.**
- Shell recruits (Furnace, Expo, Backend Server) run no model, so this rule does not apply to them.
- **Switching a recruit that is already running** (no restart):
  - From PowerShell (Git Bash rewrites `/model` into a Windows path), send `maestri ask "<recruit>" --raw "/model sonnet\n"`, then `maestri ask "<recruit>" --raw "/effort high\n"`.
  - Then confirm in `maestri check` that the status line reads `Sonnet … [high]`.
  - **Side effect:** `/model` writes `"model"` into the global `~/.claude/settings.json`. Set it back to `"opus"` afterwards; the running sessions keep Sonnet.
