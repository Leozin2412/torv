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