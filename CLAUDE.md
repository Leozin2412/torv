# TORV - Project Context & Architecture

This document serves as the primary context guide for Gemini (and other AI assistants) to understand the architecture, tech stack, and development patterns of the **TORV** project.

Always refer to the guidelines and stack constraints defined below when generating code, refactoring, or designing architecture for this project.

---

## 1. Project Overview
* **Project Name:** TORV
* **Platform:** Mobile Application (Decoupled Front-End & Back-End)
* **Core Domain:** Fitness, nutrition tracking, caloric monitoring, and social gamification (e.g., streaks, activity tracking).

---

## 2. Tech Stack & Architecture

TORV is split into two distinct, isolated directories: `FrontEndTorv` and `BackEndTorv`.

### 📱 Front-End Mobile (`FrontEndTorv`)
* **Framework:** React Native
* **Language:** TypeScript (`.ts`, `.tsx`)
* **Design Pattern:** Component-driven development. Logic, structure, and UI layout are encapsulated within component/screen folders.
* **Styling:** React Native `StyleSheet` (JavaScript-based styling, camelCase properties, Flexbox layout).
* **State Management & Side Effects:** React Hooks (`useState`, `useEffect`, custom hooks).
* **API Client:** Axios / Fetch API for handling asynchronous HTTP requests to the backend.

### ⚙️ Back-End API (`BackEndTorv`)
* **Runtime Environment:** Node.js
* **Language:** JavaScript (ES6+)
* **Framework:** Express
* **Database Communication:** Prisma ORM (used to handle migrations, type-safe queries, and database abstractions).
* **Communication Protocol:** RESTful API returning structured JSON.

### 🗄️ Database Configuration
* **Database Engine:** Microsoft SQL Server (MSSQL)
* **Database Name:** `torv`
* **Prisma Provider:** `sqlserver`
* **Local Connection URL:** `sqlserver://DESKTOP-GKF0OQB\SQLEXPRESS;database=torv;integratedSecurity=true;trustServerCertificate=true;`
* **Prisma Rule:** When generating schema models, always use types and attributes native/compatible with SQL Server (e.g., `@db.VarChar`, `@db.UniqueIdentifier`, identity increments). Ensure Prisma client queries leverage type-safe features based on this engine.

---

## 3. Directory Structure Strategy

When generating, suggesting, or placing new files, strictly adhere to the specific structures of each directory:

### 📁 FrontEndTorv/
```text
src/
├── components/       # Reusable, small UI elements (Buttons, Cards, Inputs)
│   └── ComponentName/
│       ├── index.tsx       # Component structure and local state
│       └── styles.ts       # StyleSheet definitions
├── screens/          # Full application screens/views
│   └── ScreenName/
│       ├── index.tsx       # Screen layout, backend API calls, local logic
│       └── styles.ts       # StyleSheet definitions
├── routes/           # Navigation configuration and route definitions
├── services/         # API clients and HTTP configuration (e.g., axios instances)
└── utils/            # Helper functions (date formatters, calorie calculators, etc.)


###📁 BackEndTorv/
```text
├── sql/              # Raw SQL scripts, procedures, or database backups
├── src/
│   ├── controller/   # Processes incoming requests, handles business logic, and sends responses
│   ├── lib/          # Core libraries, initializations, or shared utilities
│   ├── middlewares/  # Express middlewares (Authentication, validation, error handling)
│   ├── repository/   # Direct data access layer (Prisma client queries and data operations)
│   ├── routes/       # Endpoint definitions mapping URLs to controllers
│   ├── views/        # Email templates or specific rendering views
│   └── config.js     # Global environment configurations and constants
├── .env              # Environment variables (Secret keys, Database URLs)
├── .gitignore        # Git ignore rules
├── .puppeteerrc.cjs  # Puppeteer configuration file
├── GEMINI.md         # This AI context file
├── package-lock.json # Locked dependency tree
├── package.json      # Dependencies and execution scripts
├── README.md         # Project human documentation
└── server.js         # Application entry point (Initializes Express server)

### 💡 Nota importante para a sua `.env` no back-end:
Quando você for configurar o Prisma, o seu arquivo `.env` dentro de `BackEndTorv` deve conter a variável com uma sintaxe parecida com esta (convertendo os caracteres especiais se necessário, dependendo de como a biblioteca ler a contrabarra):

```env
DATABASE_URL="sqlserver://localhost:1433;database=nome_do_seu_banco;user=LeoTorv;password=12345;encrypt=false;trustServerCertificate=true;"
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