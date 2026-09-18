# Filtro de Data Retroativo (MyDiet) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **TORV override:** execution happens via the Maestri recruit "Torv Frontend" (`maestri ask "Torv Frontend" ...`), never via an internal Agent-tool subagent — see `CLAUDE.md` section 4. Treat each task below as one `maestri ask` turn.

**Goal:** Let the user pick any past date in `MyDiet` and see/edit that date's calendar week (7 days), while the default (no filter) view stays exactly the current rolling last-5-days-ending-today strip.

**Architecture:** Pure frontend change in `FrontEndTorv/src/screens/MyDiet`. No backend/database changes — `/diet/summary?date=X` and `POST /diet` (with `logged_date`) already accept any past date. The date strip becomes a derived value: `filterDate === null` renders the existing 5-day rolling window; a non-null `filterDate` renders the Sunday–Saturday calendar week containing it. A "Hoje" chip clears the filter.

**Tech Stack:** React Native + TypeScript (existing `MyDiet` screen), `@react-native-community/datetimepicker` (new, installed via `npx expo install` for Expo SDK 56 compatibility — see `FrontEndTorv/AGENTS.md`, Expo has changed, read the versioned docs before writing code), `lucide-react-native` (existing icon set, already used in this file for `Plus`/`X`/`Edit2`/`Trash2`).

**Spec:** No separate spec file — this is a bounded change; the approved design lives in the brainstorming conversation. Summary above is authoritative.

## Global Constraints

- Do not change the default (unfiltered) 5-day view's look, order, or data source in any way.
- No backend, database, or API contract changes — verified `/diet/summary?date=X` and `POST /diet {logged_date}` already accept arbitrary past dates.
- Install the datepicker with `npx expo install @react-native-community/datetimepicker` (not bare `npm install`) so the version matches Expo SDK 56.
- Visual details (icon choice/spacing/chip shape/colors for the filter icon, "Hoje" chip, and the 7-card week strip) go through the `/frontend-design` skill — do not freehand them.
- No test runner exists in `FrontEndTorv` (no jest, no test files, no `test` script). Verification is manual: run the Expo dev server and walk through the scenarios listed in each task's test step. This matches how this codebase is actually verified (CLAUDE.md's Torv Review and Tests usability pass), so don't add a test framework to satisfy this plan.

---

### Task 1: Fix retroactive add — send `logged_date` with the selected day

Today `handleAddMeal` never sends `logged_date`, so adding a meal always logs it to *today* server-side regardless of which day is selected in the strip. This silently breaks retroactive entry even once the UI lets you navigate to a past day, so it must be fixed before the filter UI is worth building.

**Files:**
- Modify: `FrontEndTorv/src/screens/MyDiet/index.tsx:136-140`

**Interfaces:**
- Consumes: existing `selectedDate` state (string, `YYYY-MM-DD`), existing `api` axios instance from `../../services/api`.
- Produces: no new exports; `handleAddMeal`'s POST payload now includes `logged_date`.

- [ ] **Step 1: Add `logged_date` to the add-meal payload**

In `FrontEndTorv/src/screens/MyDiet/index.tsx`, inside `handleAddMeal`, change:

```typescript
      const payload = {
        food_name: mealName,
        calories: Number(mealCalories),
        macros_json: { protein: Number(mealProtein), carbs: Number(mealCarbs), fat: Number(mealFat) },
      };

      if (selectedMealId) {
        await api.put(`/diet/${selectedMealId}`, payload);
      } else {
        await api.post('/diet', payload);
      }
```

to:

```typescript
      const payload = {
        food_name: mealName,
        calories: Number(mealCalories),
        macros_json: { protein: Number(mealProtein), carbs: Number(mealCarbs), fat: Number(mealFat) },
      };

      if (selectedMealId) {
        await api.put(`/diet/${selectedMealId}`, payload);
      } else {
        await api.post('/diet', { ...payload, logged_date: selectedDate });
      }
```

Only the create path gets `logged_date` — edits (`PUT /diet/:logId`) keep the log's original date, matching current backend behavior (`updateFoodLog` doesn't accept a date change).

- [ ] **Step 2: Manual verification**

Run the Expo dev server (`npx expo start` in `FrontEndTorv`), open `MyDiet`, select a day other than today in the date strip, add a meal, confirm it appears in that day's list (not today's). Switch to today and confirm today's list is unaffected.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/screens/MyDiet/index.tsx
git commit -m "fix(diet): send logged_date so adding a meal respects the selected day"
```

---

### Task 2: Install the native date picker

**Files:**
- Modify: `FrontEndTorv/package.json`, `FrontEndTorv/package-lock.json` (via install command, not hand-edited)

**Interfaces:**
- Produces: `@react-native-community/datetimepicker` default export (`DateTimePicker` component), used by Task 4.

- [ ] **Step 1: Install via Expo's version-matching installer**

```bash
cd FrontEndTorv
npx expo install @react-native-community/datetimepicker
```

- [ ] **Step 2: Verify it installed a version pinned for the current Expo SDK**

```bash
npx expo install --check
```

Expected: no mismatch reported for `@react-native-community/datetimepicker`.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/package.json FrontEndTorv/package-lock.json
git commit -m "chore(frontend): add @react-native-community/datetimepicker"
```

---

### Task 3: Derive the date strip from an optional `filterDate`

Replace the static `availableDates` (computed once via `useState(generateDates())`) with a value derived on every render from a new `filterDate` state: `null` → today-ending 5-day window (current behavior, byte-for-byte the same dates as `generateDates()` today), a set date → the Sunday–Saturday week containing it (7 days).

**Files:**
- Modify: `FrontEndTorv/src/screens/MyDiet/index.tsx:49-74` (state + `generateDates`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `filterDate: string | null` state and setter `setFilterDate`, `displayedDates: { fullDate: string; dayName: string; dayNumber: number }[]` (same shape `availableDates` had, so the existing render loop at line 232 keeps working once Task 5 swaps the variable name).

- [ ] **Step 1: Replace the date-generation block**

Replace:

```typescript
  const generateDates = () => {
    const dates = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      dates.push({
        fullDate: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
        dayNumber: d.getDate(),
      });
    }
    return dates;
  };

  const [availableDates] = useState(generateDates());
```

with:

```typescript
  const DAY_NAMES = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

  const toDateEntry = (d: Date) => ({
    fullDate: d.toISOString().split('T')[0],
    dayName: DAY_NAMES[d.getDay()],
    dayNumber: d.getDate(),
  });

  const getLastFiveDays = () => {
    const dates = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(toDateEntry(d));
    }
    return dates;
  };

  const getWeekOf = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const anchor = new Date(year, month - 1, day);
    const sunday = new Date(anchor);
    sunday.setDate(anchor.getDate() - anchor.getDay());
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      dates.push(toDateEntry(d));
    }
    return dates;
  };

  const [filterDate, setFilterDate] = useState<string | null>(null);
  const displayedDates = filterDate ? getWeekOf(filterDate) : getLastFiveDays();
```

`getWeekOf` parses `dateStr` into local year/month/day components (instead of `new Date(dateStr)`, which UTC-parses `YYYY-MM-DD` and can land on the wrong local day near midnight) before anchoring the week — this avoids an off-by-one week for users west of UTC.

- [ ] **Step 2: Manual verification**

Add a temporary `console.log(displayedDates)` after the new block, reload the app, confirm the default log (no filter yet, `filterDate` is `null`) lists exactly the same 5 dates `generateDates()` produced before this change (today plus the 4 prior days, ending today). Remove the `console.log` once confirmed.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/screens/MyDiet/index.tsx
git commit -m "refactor(diet): derive date strip from optional filterDate"
```

---

### Task 4: Filter icon, native date picker, and "Hoje" reset chip

**Files:**
- Modify: `FrontEndTorv/src/screens/MyDiet/index.tsx:1-12` (imports), `:225-230` (header JSX), `:231-246` (date strip render — swap `availableDates` for `displayedDates`)
- Modify: `FrontEndTorv/src/screens/MyDiet/styles.ts` (new styles for the filter button and "Hoje" chip)

**Interfaces:**
- Consumes: `filterDate`/`setFilterDate` from Task 3, `DateTimePicker` from `@react-native-community/datetimepicker` (Task 2).
- Produces: no new exports.

- [ ] **Step 1: Use `/frontend-design` for the visual spec**

Before writing JSX, invoke the `/frontend-design` skill to get concrete direction for: which `lucide-react-native` icon to use for the filter trigger (e.g. `Calendar` or `CalendarDays` — confirm it's in the installed `lucide-react-native` version), the "Hoje" chip's shape/color/placement next to it, and how the 7-card week strip should read against the existing 5-card `dateItem`/`dateItemActive` styles so it doesn't look like a different component. Apply its output in the steps below instead of guessing spacing/colors.

- [ ] **Step 2: Add state for picker visibility and import the picker + icon**

In the imports block, add:

```typescript
import { Plus, X, Edit2, Trash2, UtensilsCrossed, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
```

(swap `Calendar` for whatever `/frontend-design` recommends if different.)

Near the `filterDate` state from Task 3, add:

```typescript
  const [pickerVisible, setPickerVisible] = useState(false);
```

- [ ] **Step 3: Render the filter icon + "Hoje" chip in the header**

Replace:

```tsx
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Minha Dieta</Text>
      </View>
```

with:

```tsx
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Minha Dieta</Text>
        <View style={styles.headerActions}>
          {filterDate && (
            <TouchableOpacity
              onPress={() => setFilterDate(null)}
              accessibilityRole="button"
              accessibilityLabel="Voltar para hoje"
              style={styles.todayChip}
            >
              <Text style={styles.todayChipText}>Hoje</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Filtrar por data"
          >
            <Calendar size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {pickerVisible && (
        <DateTimePicker
          value={filterDate ? new Date(filterDate) : new Date()}
          mode="date"
          maximumDate={new Date()}
          onChange={(_event, date) => {
            setPickerVisible(false);
            if (date) {
              setFilterDate(date.toISOString().split('T')[0]);
            }
          }}
        />
      )}
```

`maximumDate={new Date()}` blocks picking a future date at the UI layer — the backend still caps future `logged_date` server-side, so this is a UX guard, not the source of truth for validation.

- [ ] **Step 4: Point the strip render at `displayedDates`**

In the `ScrollView` that renders the strip, change `{availableDates.map((item) => {` to `{displayedDates.map((item) => {`. No other change needed in that block — it already keys off `item.fullDate`/`item.dayName`/`item.dayNumber`, which `displayedDates` still provides.

- [ ] **Step 5: Add the new styles**

In `FrontEndTorv/src/screens/MyDiet/styles.ts`, add (adjust colors/spacing to match whatever `/frontend-design` specified in Step 1 — this is a starting point, not the final word):

```typescript
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  todayChip: {
    backgroundColor: colors.brandTint,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayChipText: {
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
    fontSize: 13,
  },
```

Check the top of `styles.ts` for the existing import line and add `radius`/`fontFamily` to it if not already imported (the file already uses `colors` per the earlier grep of `dateItem`/`dateDay`).

- [ ] **Step 6: Manual verification**

Run the app. Confirm: (a) default screen on load is unchanged — still 5 days ending today, no chip visible; (b) tapping the calendar icon opens a native date picker; (c) picking e.g. a Tuesday shows a 7-card strip spanning that Sunday–Saturday, with the "Hoje" chip now visible; (d) tapping a day within that week loads its summary (existing `loadDataForDate` behavior, unchanged); (e) tapping "Hoje" returns to the original 5-day view and hides the chip; (f) the picker cannot select a date after today.

- [ ] **Step 7: Commit**

```bash
git add FrontEndTorv/src/screens/MyDiet/index.tsx FrontEndTorv/src/screens/MyDiet/styles.ts
git commit -m "feat(diet): add date filter with week view and today reset"
```

---

## After this plan

This plan only covers the **Edit** stage. Per `CLAUDE.md` section 5, the Maestro (not this plan) is responsible for running the full Test → Security cycle against the resulting diff before considering "Retroativo e Filtro de Datas" done, including the frontend usability pass since this touches `FrontEndTorv`.
