# Torv Mobile — Adversarial QA Round 2 (2026-09-16)

Re-test of `docs/qa-torv-mobile-2026-09-15.md` against the live app after backend fixes (`f4d2ed3`, `d4e9c1d`) and frontend fixes (`2b3a780`, `5593ed6`). Tested via Maestri portal "Torv Mobile" (Expo web, localhost:8081) + direct API calls against Furnace (localhost:3000). Fresh accounts (`qa-test-r2-*@torv.local`), all cleaned up after (DB rows + uploaded test photo deleted).

Severity order: **Crash/500** > **Silent failure (no user feedback)** > **Cosmetic/UX nit**.

---

## Round-1 items re-tested

| # | Finding | Result | Evidence |
|---|---|---|---|
| 1 | Long name → 500 | **Fixed** | `POST /auth/register` → `400 {"error":"Name must be at most 100 characters"}` |
| 2 | Absurd calories → 500 | **Fixed** | `POST /diet` → `400 {"error":"calories must be an integer between 0 and 10000"}` |
| 3 | Invalid `logged_date` → 500 | **Fixed** | `POST /diet` → `400 {"error":"Invalid logged_date"}` |
| 4 | Overlong `food_name` → 500 | **Fixed** | `POST /diet` → `400 {"error":"food_name must be at most 255 characters"}` |
| 5 | Empty register submit, no feedback | **Fixed** | Inline red errors render: "Informe seu e-mail.", "A senha deve ter pelo menos 6 caracteres." No request sent. |
| 6 | Wrong password, no feedback | **Fixed** | Visible red text: "Email ou senha incorretos." |
| 7 | Non-image profile photo accepted | **Partially fixed** | `.svg` (real SVG content) now correctly rejected: `400 {"error":"File must be a JPEG, PNG, or WebP image"}`. But a plain-text file sent with a `.jpg` extension (client-controlled `Content-Type: image/jpeg`) is still **accepted** (`200`), saved to disk, and served byte-for-byte as `/uploads/*.jpg` — the check (`profile.controller.js:63`, `ALLOWED_IMAGE_TYPES[data.mimetype]`) trusts the client-supplied MIME type/extension, never inspects file magic bytes. Still exploitable, just narrower than round 1. |
| 8 | Empty meal name, no feedback | **Fixed** | Modal stays open, visible red text: "Nome e calorias são obrigatórios." No request sent. |
| 9 | Typed username discarded | **Fixed** | Registered with `username:"qatestr2two"` → `GET /profile` returns `"username":"qatestr2two"`, not a generated one. |
| 10 | Negative calories accepted | **Fixed** | `POST /diet` with `calories:-500` → `400 {"error":"calories must be an integer between 0 and 10000"}` |
| 11 | Negative weight / absurd height accepted | **Fixed** | `weight:-10` → `400 {"error":"Weight must be a number between 20 and 300 kg"}`; `height:999` → `400 {"error":"Height must be a number between 50 and 250 cm"}` |
| 12 | Rapid double-submit creates duplicate logs | **Fixed** | Two near-simultaneous UI clicks on "Salvar" (via portal, real React state) produced exactly one `POST /diet -> 201` and one log row. (Note: hitting the raw API twice concurrently still creates two rows — there's no server-side idempotency key — but the fix was the client-side debounce the finding asked for, and that works.) |
| 13 | Malformed email accepted | **Fixed** | `email:"not-an-email"` → `400 {"error":"Invalid email format"}` |
| 14 | Session lost on reload | **Fixed** | `maestri portal navigate` to `/Home` after login stays on Home, still authenticated — no drop to Login screen. |

**Regressions:** none found.

---

## New findings (fresh exploration)

### 15. Profile-photo MIME check trusts client-supplied Content-Type (no magic-byte check)
**Severity:** Silent failure / security gap (accepted content masquerading as an image).
**Did:** `POST /profile/upload` with a plain-text file (`this is not a jpeg at all...`) with filename `fake.jpg`, letting curl auto-set `Content-Type: image/jpeg` from the extension.
**Expected:** Rejected, since the actual file content isn't a JPEG.
**Actual:** `200 {"message":"Profile photo updated successfully", "photo_url":".../fake...jpg"}`. Fetching that URL returns the raw text content, served with a `.jpg` name.
**Where:** `BackEndTorv/src/controller/profile.controller.js:63` — `ALLOWED_IMAGE_TYPES[data.mimetype]` only checks the multipart field's declared `Content-Type`/extension, never the file's actual bytes (e.g. JPEG/PNG magic numbers). See item #7 in the table above for the full comparison against the round-1 finding.
**Not a regression** — narrower than round 1 (SVG is now blocked), but the underlying gap (spoofable client-declared type) is unchanged.

### 16. No upper bound on `logged_date` (future dates accepted)
**Severity:** Cosmetic / data integrity, low priority.
**Did:** `POST /diet` with `"logged_date":"3000-01-01"`.
**Actual:** `201`, accepted and stored as a valid log for the year 3000.
**Where:** `BackEndTorv/src/repository/diet.repository.js` — date format/parseability is now validated (fixes #3) but no range check against "today" exists.

## Not findings (verified working correctly)
- SQL-injection-style `food_name` (`'; DROP TABLE food_logs; --`) stored as inert literal text via Prisma's parameterized `$queryRaw` — table intact, no injection.
- `calories` as a string (`"abc"`) → clean `400 {"error":"body/calories must be number"}` (Fastify/AJV schema validation).
- `calories: 0` and `calories: 10000` (exact boundaries) → both accepted (`201`), consistent with the stated `0–10000` range.
- Cross-user food-log delete → still correctly blocked with `404` (no regression from the diet repository changes).

## Summary
- **Round-1 fixed:** 13 / 14 fully fixed, 1 partially fixed (#7)
- **Round-1 regressed:** 0
- **New findings:** 2 (1 silent-failure/security gap, 1 cosmetic)

---

## Round 3 — focused retest (fix commit `d1c94ce`)

### #15 profile-photo magic-byte check — Fixed
Spoofed upload (plain-text content, `.jpg` name, `Content-Type: image/jpeg`) now rejected: `400 {"error":"File content does not match a JPEG, PNG, or WebP image"}`.
Regression check: a minimal valid JPEG (real `\xFF\xD8\xFF...\xFF\xD9` magic bytes) still uploads fine: `200`, file written and served.

### #16 future-date cap on `/diet` — Fixed
`logged_date: "3000-01-01"` now rejected: `400 {"error":"logged_date cannot be more than 1 day in the future"}`.
Regression check: today's date → `201`; a date ~18h ahead (timezone tolerance) → `201`. Both still accepted.

**Round 3 regressed:** 0. Both findings closed.
