# QA — MyDiet sticky header (screens/MyDiet index.tsx + styles.ts) — 2026-09-21

Verdict: **PASS (static)**. Usability pass **not run: no Expo web running (8081/19006 empty), no Supabase test credentials; won't start phone Expo or a 2nd backend on :3000.** Judged on static analysis. api.ts/tsconfig.json excluded.

## Checks
| Item | Result |
|---|---|
| `stickyHeaderIndices={[1]}` correctness | **PASS.** ScrollView direct children: `<View>`(0: calories card + macro row, wrapped) , `<Text sectionTitle>`(1), `<View>`(2: meals + add button). No fragments/conditionals at top level; wrapping Views make count deterministic. Index 1 = "Refeições". |
| Header fixed | PASS. Header + calendar icon + strip in `fixedHeader` View outside ScrollView (separate layout region, `flex:1` scroll below). |
| Cards slide under header | PASS. Content scrolls inside ScrollView bounds, clipped at header's bottom edge; header has opaque `colors.background`. |
| Refeições sticks under header | PASS. Sticky Text has opaque `backgroundColor` + `paddingBottom:16` (replaces marginBottom, so no transparent gap letting meal cards show through). |
| Z-order | PASS. `fixedHeader zIndex:1`; no overlap possible since regions disjoint; web `<input type=date>` picker lives inside header, above scroll. |
| Tab-bar clearance | PASS. `paddingBottom:120` moved to `scrollContent` (same value as before); add-meal button is last child inside it. |
| Date strip no regression | PASS. Diff doesn't touch strip/onLayout/scrollStripTo/toISODate/effect; strip now in fixedHeader, `flexGrow/flexShrink:0` kept. |
| Empty state / loading | PASS. Empty card (`meals.length===0 && !isDateLoading`) and loading branch unchanged, inside child 2, sticky index unaffected. |
| Calendar picker | PASS (static). Web `<input>` and native DateTimePicker branches unchanged; still rendered in header before strip. |
| tsc | Same 3 pre-existing errors (Login:65, MyDiet:127/129), none from this diff. |

## Findings
- LOW: `dateSelector marginBottom:32` now sits inside the fixed header → permanent 32px dead band above stuck "Refeições" and less scroll viewport on small phones. Consider ≈16.
- LOW: Android sticky + opaque bg untested on device; RN-web sticky untested. Only a run confirms no 1px seam between stuck title and header.
- Cosmetic: new wrapper Views unindented. No FrontEnd test runner → no automated tests.

## Gate
Static PASS, runtime not run. Security may proceed; recommend quick manual check: scroll with 0 and many meals, pick old date, confirm title sticks and last meal + add button clear the tab bar.
