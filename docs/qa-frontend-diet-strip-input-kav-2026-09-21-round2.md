# QA round 2 — FrontEndTorv (Input eye toggle, Login/Register KAV, MyDiet date strip) — 2026-09-21

Scope: feature diff only. `api.ts` / `tsconfig.json` = user's local edits, excluded from verdict (round-1 #1 dropped).

Verdict: **PASS (static)**. Usability pass **not run**: no Expo web running (8081/19006 empty), no Supabase test credentials; won't start phone Expo or a 2nd backend on :3000. Judged on static analysis + node check.

## Round-1 re-verify
| # | Finding | Result |
|---|---|---|
| 2 MEDIUM | strip stale scroll on week change | **FIXED.** Active item's `onLayout` now records x and calls `scrollStripTo` (MyDiet/index.tsx:330-333). New/never-visited week: item lays out → scrolls to it. 7→7 week switch: new items mount → their onLayout fires → scrolls (no longer depends on content-size change). Cached same-week pick: effect (l.156) scrolls. Stale x from other strip variant: if x changed, item re-fires onLayout and corrects; if same, stale value equals correct. |
| 4 LOW | toggle height 50 vs input | **FIXED/OK.** `styles.input.height` = 50 = toggle height. |
| TZ 21h UTC-3 | toISODate local | **PASS** (round-1 node check, TZ=America/Sao_Paulo 22:30 → local 2026-09-21 vs UTC 2026-09-22). Unchanged. |
| 3 LOW | KAV `behavior="padding"` on Android | Open, unverified on device. Not blocking. |
| 5 INFO | flexShrink/flexGrow 0 fix, eye toggle logic | OK. |
| tsc | 3 errors (Login:65, MyDiet:127/129) | Same 3, all in untouched lines, pre-existing. |

## Residual (non-blocking)
- LOW: `scrollTo` from onLayout could be clamped if ScrollView content width not yet final when active item lays out (esp. last item of a 7-day strip). RN normally lays out siblings in same pass; only a device/web run confirms. Fallback if seen: also keep `onContentSizeChange={() => scrollStripTo(selectedDate)}`.
- LOW: KAV behavior on Android (see above).
- Cosmetic: `<View>` wrapper in Input still mis-indented.
- No test runner in FrontEndTorv; no automated tests added.

## Gate
Tests: green on static analysis; runtime usability **not run: no credentials / no running web app**. Advance to Security allowed; recommend a quick manual device check of "pick old date in another week → selected day visible" before release.
