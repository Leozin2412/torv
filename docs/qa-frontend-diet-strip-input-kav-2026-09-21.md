# QA — FrontEndTorv uncommitted diff (Input eye toggle, Login/Register KAV, MyDiet date strip) — 2026-09-21

Verdict: **FAIL (1 MEDIUM functional bug + 1 HIGH commit-hygiene blocker)**. Security not yet run.

## Method
- Static review of `git diff -- FrontEndTorv` (9 files).
- `tsc --noEmit`: 3 errors, all in untouched lines (Login:65 absoluteFillObject, MyDiet:127/129 macros.protein/fat) → pre-existing, not from this diff.
- TZ check (`TZ=America/Sao_Paulo`, 22:30 local 2026-09-21): old `toISOString().split('T')[0]` = 2026-09-22 (wrong), new `toISODate` = 2026-09-21 (correct). **PASS**. Same fix covers "today" default, "voltar para hoje", picker `max`, native picker callback. All `toISOString` uses in MyDiet replaced.
- No jest/test runner in FrontEndTorv → no automated tests added. Only pure fn changed is `toISODate`; verified by node one-liner above.
- Usability pass (Expo web + browser): **NOT RUN.** No web server up (8081 empty), no test credentials for Supabase login, and starting Expo would touch shared infra. Backend on :3000 (Furnace) untouched. Runtime behaviour of strip scroll therefore reasoned from RN layout semantics, not observed.

## Findings (ranked)
1. **HIGH — api.ts:7-13** baseURL flipped to LAN IP `192.168.15.179` (localhost commented out); tsconfig.json key reorder is noise. Local dev-env toggles, not feature code. Scenario: committed → web/emulator/other devs hit dead host. Fix: exclude both from commit (`git add -p`/checkout).
2. **MEDIUM — MyDiet/index.tsx:151-159,324 strip stale scroll on week change.** `scrollStripTo` needs `itemX[date]`, filled only by item `onLayout` (async, after effect). Picking a date in a *different, never-visited week* → effect finds x undefined → no scroll. `onContentSizeChange` re-scrolls only if content width changes: last-5→week (5→7 items) fires, but week→other week (7→7) does NOT. Scenario (phone, 7 items ~530px > screen): strip scrolled right in week A, pick Sunday of week B via calendar → old offset kept, selected day (x≈0) off-screen left. Also even in 5→7 case, if content-size event precedes item onLayout, itemX still undefined. Fix: call scrollStripTo from the item's own onLayout when `item.fullDate===selectedDate` (and keep effect for cached case); or key ScrollView by filterDate to remount at offset 0 + scroll.
3. LOW — Login/Register `KeyboardAvoidingView behavior="padding"` on all platforms; Android with edge-to-edge usually ok, but pre-Android 15 non-edge may double-pad. Use `Platform.OS==='ios' ? 'padding' : undefined`/'height' if seen on device. Unverified.
4. LOW — Input toggle hardcoded `height:50` vs input height; confirm equal to `styles.input` height. Cosmetic: mis-indented `<View>` wrapper in Input/Login/Register (no lint fail).
5. INFO — `dateSelector` flexGrow/flexShrink 0 fix is right for the collapse; margin/`flexDirection` removal harmless for horizontal ScrollView. Eye toggle logic correct (secureTextEntry override placed after `{...rest}`; hidden when not secure).

## Checklist vs focus
| Item | Result |
|---|---|
| Strip not collapsing (flexShrink) | PASS (static) |
| Correct day highlighted after 21h UTC-3 | PASS (verified) |
| Old date picked: selected day visible, no gap | FAIL for cross-week case (#2); unverified at runtime |
| Eye toggle | PASS (static) |
| KAV+ScrollView Login/Register | PASS (static), device unverified |

## Blockers to advance to Security
Fix #2, drop #1 from commit, then round2 with a real browser/device pass (needs test creds + Expo web/phone).
