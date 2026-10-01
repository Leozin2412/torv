# Agent Workflow Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the Maestri recruit-selection guide, mandatory feature development cycle, and canvas task-tracking rule in `CLAUDE.md`, and stand up a new "Torv Frontend Image Gen" recruit wired only to Torv Frontend.

**Architecture:** Pure documentation + Maestri CLI operations — no application code changes. `CLAUDE.md` gets three new sections. A new role preset is created via `maestri role create`, a terminal is recruited into it, connected to the existing Torv Frontend recruit, and Torv Frontend's own role prompt is edited so it knows to delegate to it by name.

**Tech Stack:** Markdown (`CLAUDE.md`), `maestri` CLI (role/recruit/connect commands).

**Spec:** `docs/superpowers/specs/2026-09-16-agent-workflow-cycle-design.md`

## Global Constraints

- Feature-wide cycle, not per-layer: Edit → Test → Security runs once over the whole feature diff, not once per backend/frontend/database layer.
- Test reports live in `docs/`, one new file per round, never overwriting a previous round (matches existing `qa-torv-mobile-*.md` naming pattern already in the repo).
- Security only runs after Testing is 100% green.
- On Security failure, rework is scoped only to the layer(s) Security flagged — not the whole feature.
- The progress tracker is a Maestri canvas sticky note (not a file in `docs/`), updated at every stage transition.
- The new recruit connects only to Torv Frontend — never directly to the Maestro or the other torv recruits.
- `CLAUDE.md` and Maestri role prompts stay in English, matching every existing role prompt and the rest of `CLAUDE.md` (only specs/plans under `docs/superpowers/` use Portuguese, matching the existing migration spec).

---

### Task 1: Add process documentation to CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (append after line 88, the end of the current file)

**Interfaces:**
- Consumes: nothing (pure documentation, no code dependencies)
- Produces: three new `CLAUDE.md` sections (`## 4. Agent Selection (Maestri Recruits)`, `## 5. Development Cycle`, `## 6. Task Tracking`) that Task 2/3 reference by recruit name ("Torv Frontend Image Gen")

- [ ] **Step 1: Append the three sections to CLAUDE.md**

Add this exact block at the end of `CLAUDE.md` (after the `DATABASE_URL` code fence on line 88):

```markdown

---

## 4. Agent Selection (Maestri Recruits)

TORV development is orchestrated through Maestri canvas recruits, not ad-hoc subagents. Each recruit's full role prompt lives in `.maestri/roles/<uuid>/role.json` — this table is only an index for picking the right one.

| Recruit | Use for |
|---|---|
| Torv Backend | Routes, controllers, middlewares, repository code calling Prisma, Express→Fastify migration |
| Torv Frontend | Screens, components, navigation, styling, API client calls |
| Torv Database | Schema, Prisma migrations, raw SQL, profile-photo storage adapter |
| Torv Frontend Image Gen | Image/visual asset generation for a Frontend task — always delegated by Torv Frontend itself, never called directly |
| Torv Review and Tests | After implementation finishes — multi-lens review + test coverage |
| Torv Security | After Review and Tests pass 100% — OWASP Top 10 review of the diff |

Run `maestri list` to see the current team and connections before delegating.

## 5. Development Cycle

Every new feature follows this cycle, tracked feature-wide (not per layer):

1. **Edit** — identify which layers (backend/frontend/database) the feature needs and delegate to the matching recruit(s), in parallel or in sequence depending on real contract dependencies.
2. **Test** — Torv Review and Tests runs against the full feature diff (all layers together). Each round produces a new report file in `docs/` (never overwrite a previous round — follow the existing naming pattern, e.g. `qa-<topic>-YYYY-MM-DD[-roundN].md`).
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
```

- [ ] **Step 2: Verify the file reads correctly**

Run: `grep -n "^## 4\|^## 5\|^## 6" "CLAUDE.md"`
Expected: three matches, one per new section header, all after line 88.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add agent selection, dev cycle, and task tracking rules to CLAUDE.md"
```

---

### Task 2: Create the "Torv Frontend Image Gen" role preset

**Files:** none directly — `maestri role create` writes `.maestri/roles/<new-uuid>/role.json` (plus `AGENTS.md`/`CLAUDE.md` wrapper copies) itself; do not hand-author these files.

**Interfaces:**
- Consumes: none
- Produces: a role preset named exactly `Torv Frontend Image Gen`, referenced by name in Task 3's `maestri recruit --role` and `maestri connect` calls

- [ ] **Step 1: Confirm the role doesn't already exist**

Run: `maestri role list`
Expected: no existing role named `Torv Frontend Image Gen` in the list (if the workspace already has one, stop and tell the user instead of creating a duplicate).

- [ ] **Step 2: Create the role**

Run (single command, prompt text exactly as below):

```bash
maestri role create "Torv Frontend Image Gen" "Torv Frontend Image Gen recruit. Use caveman mode by default: compressed answers, no filler.

Function: generates image/visual assets (icons, illustrations, mockups) for Frontend tasks using Antigravity. Only acts when Torv Frontend delegates a task to you via 'maestri ask' — never invoked directly by the Maestro or the other torv recruits.

Boundaries: you don't write application code, only produce image assets and hand them back to Torv Frontend to place/reference. If Antigravity isn't available or the request isn't actually visual, flag it back to Torv Frontend rather than improvising.

Topology: you report only to Torv Frontend. You are not connected to the Maestro or the other torv recruits. Run 'maestri list' if unsure of your connections." --scope current
```

- [ ] **Step 3: Verify the role prompt saved correctly**

Run: `maestri role show "Torv Frontend Image Gen"`
Expected: prints the exact prompt text from Step 2, unmodified.

---

### Task 3: Recruit the terminal, wire it to Torv Frontend, and update Torv Frontend's role

**Files:**
- Modify: `.maestri/roles/c2c125c6-98a0-4b40-b383-16fb265efdca/role.json` (Torv Frontend's role — edited via `maestri role edit`, not by hand)

**Interfaces:**
- Consumes: role preset `Torv Frontend Image Gen` from Task 2
- Produces: a live canvas recruit named `Chroma`, connected only to `Torv Frontend`, discoverable by Torv Frontend under that exact name

- [ ] **Step 1: Confirm no existing recruit already covers this**

Run: `maestri list`
Expected: no existing recruit already doing image generation for Torv Frontend. If one exists, stop and tell the user instead of recruiting a duplicate.

- [ ] **Step 2: Recruit the terminal into the new role**

Run:
```bash
maestri recruit "Chroma" --role "Torv Frontend Image Gen"
```
Expected: command returns confirming the `Chroma` terminal was created (auto-connected to the Maestro terminal by default — this gets scoped down to Frontend-only in Step 4).

- [ ] **Step 3: Connect Chroma to Torv Frontend**

Run:
```bash
maestri connect "Torv Frontend" "Chroma"
```
Expected: confirms the connection between `Torv Frontend` and `Chroma`.

- [ ] **Step 4: Update Torv Frontend's role prompt to name Chroma explicitly**

Run:
```bash
maestri role edit "Torv Frontend" "Topology: you report only to the Maestro (Claude Code orchestrator), you are not connected to the other torv recruits. Run 'maestri list' if unsure of your connections." "Topology: you report only to the Maestro (Claude Code orchestrator). You are connected to one recruit, Chroma (Torv Frontend Image Gen) — when a task needs a generated image or visual asset, delegate it with 'maestri ask \"Chroma\" \"...\"' instead of sourcing or generating it yourself. Run 'maestri list' if unsure of your connections."
```
Expected: confirms the substring was replaced.

- [ ] **Step 5: Verify the full picture**

Run: `maestri list`
Expected: `Chroma` appears connected to `Torv Frontend` (not to the Maestro as a direct child once the topology is as intended — if `maestri list` still shows Chroma directly under the Maestro after Step 3, that reflects the Maestro's own view of its team tree per the CLI's documented behavior, not a misconfiguration; what matters is that `Torv Frontend`'s nested connections include `Chroma`).

Run: `maestri role show "Torv Frontend"`
Expected: prompt now contains the new Topology paragraph naming `Chroma`.

- [ ] **Step 6: Commit the role.json change**

```bash
git add .maestri/roles/c2c125c6-98a0-4b40-b383-16fb265efdca/role.json .maestri/roles/c2c125c6-98a0-4b40-b383-16fb265efdca/AGENTS.md .maestri/roles/c2c125c6-98a0-4b40-b383-16fb265efdca/CLAUDE.md
git commit -m "docs(maestri): wire Torv Frontend to the new Chroma image-gen recruit"
```
