Set up 5 specialized subagents for this project — one each for backend,
frontend, database, security, and review/testing — following the subagent
orchestration pattern (main session plans and delegates, never implements
alone; specialist subagents do the work).

## 1. Discover what's already installed
Before creating anything, inspect the currently installed plugins, skills,
and connectors in this environment/project — including the Supabase MCP
connector, since the database subagent will depend on it. For each one
found, determine:
- What it actually does (read its description/SKILL.md, don't guess from
  the name alone)
- Which of the 5 domains below it's most useful for — a skill can belong
  to more than one if it genuinely applies to both
- Whether it's general-purpose enough to be shared across all 5, or
  narrow enough to belong to just one

Report this mapping back to me before creating the subagents, so I can
correct it if something's off.

## 2. Target stack (what each subagent maintains going forward)
This is the steady-state stack each subagent's system prompt should be
written against — not the migration path, which is separate (section 3).

- **Backend**: Fastify + TypeScript. Every new or migrated route must ship
  with documentation (OpenAPI/Swagger via a Fastify plugin) as part of the
  same change, not as a follow-up.
- **Database**: PostgreSQL via Supabase, accessed only through Prisma ORM.
  The database subagent uses the Supabase MCP connector for
  project/schema/migration operations instead of raw SQL where a tool
  exists for it.
- **Frontend**: React Native + TypeScript. No stack change — see below.

## 3. Migration in progress (task context, not a permanent identity)
Two migrations are underway. These live in the subagents' working
instructions, not in their core identity — once complete, this section
gets removed and the subagents keep operating on the target stack alone.

- **Backend**: migrating Express → Fastify, route by route. Each migrated
  route must be documented (OpenAPI) as part of the same commit that
  migrates it — not stubbed for later. Flag any route still on Express so
  progress is trackable.
- **Database**: migrating MS SQL Server → PostgreSQL/Supabase via Prisma.
  The database subagent is the ONLY one authorized to touch schema or
  migration files. It must map SQL Server types/constraints to their
  Postgres equivalents explicitly (dates/datetime2, GUID → uuid, IDENTITY
  → serial/identity columns, nvarchar sizing) and call out anywhere
  semantics differ, not just syntax.
- **Frontend**: no migration. Only touched if the backend migration
  changes an API contract in a breaking way — and even then, only the
  affected contract, not a broader refactor.

## 4. Create the 5 subagents
For each one, write a subagent definition (in this project's subagent
format) with:
- A clear `description` stating exactly when the main session should
  delegate to it (so routing is unambiguous, not "handles backend stuff")
- Only the tools/skills relevant to its domain — don't give every
  subagent access to everything
- A system prompt written against the TARGET stack (section 2), with the
  migration context (section 3) referenced as current working state, not
  baked into its permanent identity

### Backend
Owns API/business-logic code on Fastify. Enforces layer boundaries (no
reaching into the database layer directly, no skipping the domain layer
— Prisma calls go through the database subagent's contracts, not ad hoc).
Every route change includes its OpenAPI doc. Flags anything touching
money/auth as needing extra scrutiny. Currently also executing the
Express → Fastify migration (section 3).

### Frontend
Owns React Native / TypeScript UI code. Enforces framework-specific
conventions (hook rules, accessibility, render performance) and never
assumes server-side validation exists just because client-side validation
does. Watches for breaking API contract changes coming from the backend
migration and reacts only to those.

### Database
Owns Postgres/Supabase schema, migrations, and all Prisma data-access
code. Is the ONLY layer allowed direct database access — flags any other
subagent's code that tries to bypass it. Uses the Supabase MCP connector
for project and migration operations where available. Currently also
executing the SQL Server → Postgres migration (section 3), including type
mapping and constraint verification. Watches for float arithmetic on
monetary values and missing indexes/constraints.

Also owns profile-photo storage, behind a single adapter interface
(`uploadPhoto` / `getPhotoUrl` / `deletePhoto`) with two implementations
switched by environment variable, never called directly by other layers:
- Local dev branches: writes to a `profilePhotos/` folder at the project
  root, gitignored, never committed.
- Staging/production: Supabase Storage, access controlled via RLS
  policies on the bucket.
Any change touching photo access permissions must be tested against real
Supabase Storage + RLS before merge — local mode doesn't exercise RLS, so
a permission bug (user A reading user B's photo) won't surface in local
dev at all.

### Security
Reviews everything the other three produce through an OWASP Top 10 lens:
hardcoded secrets, injection, broken auth, unsafe deserialization,
dependency CVEs. Pays extra attention during the migration window — a
half-migrated auth flow or a Supabase key handled incorrectly is a
higher-risk moment than steady-state code. Also verifies that no photo
ever reaches Supabase Storage without an RLS policy already covering it.
Does not write feature code — only reviews and flags.

### Review/Tests
Runs the multi-reviewer synthesis process: dispatch independent lenses in
parallel (quality, security, type-safety, framework — dropping whichever
doesn't apply), each reporting `file:line — severity — claim — concrete
failure scenario`, then dedupe → filter (drop anything without a real
failure scenario) → rank (CRITICAL → HIGH → MEDIUM → LOW). Also owns
running and writing tests — nothing merges without this subagent's pass,
including a check that a migrated route/table has equivalent test
coverage to what it's replacing, not less.

## 5. Wire them together
- Backend/Frontend/Database can run in parallel waves on independent,
  non-overlapping files.
- Security and Review/Tests always run AFTER the implementation subagents
  finish, never in parallel with them — they need a real diff to review.
- The main session stays the only one deciding what gets built; subagents
  never talk directly to each other, only report back to the main session.
- During the migration window specifically: database migration work
  should be dispatched before backend route migration for the same
  feature, since a route can't finish migrating to Fastify+Prisma until
  its table already exists on the Postgres side.

Project: torv — C:\Users\Tradsul\GitHub\Pessoal\torv 