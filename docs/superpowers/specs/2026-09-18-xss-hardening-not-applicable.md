# XSS Hardening — Closed as Not Applicable

## Context

Requested alongside CSRF protection and the Supabase Auth migration as one of three subsystems from the same brainstorm. Before designing anything, the codebase was checked for an actual XSS attack surface (script injection later rendered as HTML/JS in some client).

## Findings

- `FrontEndTorv` is React Native only, no `WebView` anywhere in `src/` — RN's `<Text>`/JSX does not interpret HTML or JS, so there is no "render untrusted HTML" surface on the client to exploit.
- `BackEndTorv` has no `views/` templates and returns JSON only — no server-rendered HTML surface either.
- The classic "XSS via file upload" vector (e.g. an SVG containing `<script>` disguised as a profile photo, later opened directly in a browser) is already closed by `BackEndTorv/src/controller/profile.controller.js:uploadPhoto`: it allowlists MIME type to JPEG/PNG/WebP only (no SVG), validates the actual file signature/magic bytes rather than trusting the declared `mimetype`, and generates the stored filename server-side (never from user input), which also rules out path traversal.
- While checking adjacent injection surfaces: `BackEndTorv/src/repository/diet.repository.js` uses `prisma.$queryRaw` with tagged-template interpolation (`${userId}::uuid`), which Prisma parameterizes automatically — not string concatenation, no SQL injection risk found there.

## Decision

No code changes. Closed as not applicable — there is nothing today for XSS protection to defend. Revisit if the app ever gains a surface that renders user-controlled content as HTML/JS (a `WebView`, a web admin panel, server-rendered pages) — at that point this finding is stale and XSS hardening becomes a real, separate piece of work.
