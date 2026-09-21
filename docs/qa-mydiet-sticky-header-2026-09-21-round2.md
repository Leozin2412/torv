# QA round 2 — MyDiet sticky header rework — 2026-09-21

Verdict: **PASS (static)**. Usability pass **not run: no Expo web running, no Supabase creds; no phone Expo / 2nd backend on :3000.** api.ts/tsconfig.json excluded.

## Verified
- **Root cause confirmed** in `node_modules/react-native/.../ScrollViewStickyHeader.js:297-308`: wrapper `Animated.View` takes `child.props.style` and the cloned child gets `style: styles.fill` ("transfer the child style to the wrapper"). Old direct `<Text style=sectionTitle>` therefore lost font/color (moved onto wrapper View, where Text props don't inherit).
- **Fix works:** sticky child is now `<View style={sectionHeader}>` (opaque `colors.background` + `paddingBottom:16`) → style lands on wrapper (bg stays opaque, correct for a View). Inner `<Text style={sectionTitle}>` (fontSize 18, extraBold, `colors.text`) is untouched by the clone → applies. `sectionTitle` no longer carries bg/padding.
- **`stickyHeaderIndices={[1]}`:** ScrollView children = [View (cards), View sectionHeader, View (meals)] → index 1 = section header. Correct, no conditionals/fragments at top level.
- **No regressions:** rest of MyDiet diff unchanged from round 1 (fixedHeader, scrollContent paddingBottom 120, meals/empty/loading branches, strip code, toISODate, picker). tsc: same 3 pre-existing errors (Login:65, MyDiet:127/129).

## Open (non-blocking, from round 1)
- LOW: `dateSelector marginBottom:32` inside fixed header = permanent gap; ~16 suggested.
- LOW: Android/web sticky seam untested at runtime. No FrontEnd test runner.

## Gate
Static PASS; runtime not run. Security may proceed; manual device check advised (title font/color visible while stuck, no seam).
