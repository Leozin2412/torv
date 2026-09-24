# Calculadora de Calorias e Macros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **No TORV, cada task é executada pelo recruta Maestri indicado em "Owner"** (CLAUDE.md §4), nunca por subagent interno.

**Goal:** Metas de calorias/macros calculadas automaticamente a partir do perfil (algoritmo da planilha), com sugestão de nova meta sempre que idade, peso, altura, objetivo ou nível físico mudarem, e edição de nível/peso/altura no Perfil.

**Architecture:** Função pura `calculateTargets` em `BackEndTorv/src/lib/nutritionCalculator.js` (espelho da planilha) + helper `nutritionSuggestion.js` que compara os dados usados na meta salva (`nutrition_targets.basis_json`) com os atuais. O backend cria a meta quando falta (lazy), expõe GET/accept/dismiss de sugestão, e `PUT /profile` devolve a sugestão inline. O front mostra um modal único de sugestão (Perfil após editar; MyDiet via banner).

**Tech Stack:** Node 24 + Fastify 5 + TypeBox + Prisma 6 (Postgres/Supabase); `node:test` (stdlib, sem dependência nova); React Native 0.86 / Expo 57 / TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-24-calorie-macro-calculator-design.md`

**Fonte do algoritmo:** `BackEndTorv/calculadora_calorias_macros_app.xlsx` (aba `Macros`).

## Global Constraints

- Branch: `feat/calorie-macro-calculator`. Commits nessa branch; **não fazer push** (o usuário avisa quando).
- Nunca alterar a meta sozinho: toda mudança de meta vem de accept, de edição manual no MyDiet ou da criação lazy quando **não existe** linha em `nutrition_targets`.
- `accept` sempre recalcula no servidor; ignora qualquer número do cliente.
- Sem dependências novas (back e front). Testes backend com `node --test`.
- Schema/migration: só o recruta **Torv Database** toca `prisma/`.
- Postgres puro (JSONB ok); nada proprietário do Supabase.
- Faixas: peso 20–300 kg (decimal), altura 50–250 cm (inteiro); iguais aos CHECK de `user_measurements`.
- Valores de domínio exatos: níveis `'INICIANTE' | 'INTERMEDIÁRIO' | 'AVANÇADO'`; sexo `'Masculino' | 'Feminino'`; objetivos `'Perder Peso'`, `'Ganhar Massa Muscular'`, `'Melhorar Condicionamento'`, `'Aumentar Resistência'`, `'Criar uma Rotina'`, `'Saúde & Bem-estar'`; `user_profiles.goal` continua string `", "`-separada.
- Backend roda no terminal Maestri **Furnace** (porta 3000); nunca subir segunda instância.
- Fibra fora do escopo.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `BackEndTorv/prisma/schema.prisma` | + `basis_json`, `updated_at` em `nutrition_targets` |
| `BackEndTorv/prisma/migrations/<ts>_nutrition_targets_basis/migration.sql` | DDL das 2 colunas |
| `BackEndTorv/src/lib/nutritionCalculator.js` **(novo)** | Algoritmo puro: `calculateTargets`, `ageOn`, `diffBasis`, constantes |
| `BackEndTorv/src/lib/nutritionCalculator.test.js` **(novo)** | Testes unitários do algoritmo |
| `BackEndTorv/src/lib/nutritionSuggestion.js` **(novo)** | `computeForUser`, `ensureTargets`, `buildSuggestion`, `pickTargets` (usa repository) |
| `BackEndTorv/src/lib/profileValidation.js` **(novo)** | `validateProfileUpdate` puro |
| `BackEndTorv/src/lib/profileValidation.test.js` **(novo)** | Testes da validação |
| `BackEndTorv/src/repository/diet.repository.js` | + `getCalcInputs`, `getNutritionTargets`, `updateTargetsBasis`; `upsertNutritionTargets` grava `basis_json` |
| `BackEndTorv/src/repository/profile.repository.js` | + `getProfileRow`, `getLatestMeasurement`, `addMeasurement`; `getUserProfile` inclui última medição |
| `BackEndTorv/src/routes/nutrition.schemas.js` **(novo)** | Schema TypeBox da sugestão (usado por diet e profile) |
| `BackEndTorv/src/controller/diet.controller.js` / `routes/diet.routes.js` | Lazy seed + 3 rotas de sugestão + basis na edição manual |
| `BackEndTorv/src/controller/profile.controller.js` / `routes/profile.routes.js` | PUT com nível/peso/altura + sugestão inline; GET com peso/altura/idade |
| `BackEndTorv/package.json` | script `test` → `node --test` |
| `FrontEndTorv/src/utils/profileOptions.ts` **(novo)** | `FITNESS_LEVELS`, `GOAL_OPTIONS`, `hasGoalConflict`, `fitnessLevelLabel` |
| `FrontEndTorv/src/components/GoalConflictWarning/` **(novo)** | Aviso de conflito (Register + Profile) |
| `FrontEndTorv/src/components/NutritionSuggestionModal/` **(novo)** | Modal atual → sugerida, aceitar/manter |
| `FrontEndTorv/src/screens/Register/index.tsx` | Usa `profileOptions` + aviso de conflito |
| `FrontEndTorv/src/screens/Profile/index.tsx` + `styles.ts` | Cards/modais de nível e peso/altura; aviso no modal de objetivo; modal de sugestão |
| `FrontEndTorv/src/screens/MyDiet/index.tsx` + `styles.ts` | Banner de sugestão + modal |

---

### Task 1: Migration `basis_json` / `updated_at`

**Owner:** Torv Database

**Files:**
- Modify: `BackEndTorv/prisma/schema.prisma` (model `nutrition_targets`)
- Create: `BackEndTorv/prisma/migrations/<timestamp>_nutrition_targets_basis/migration.sql`

**Interfaces:**
- Produces: colunas `nutrition_targets.basis_json` (`Json?`, JSONB) e `nutrition_targets.updated_at` (`DateTime?`, timestamptz), acessíveis via Prisma client como `basis_json` / `updated_at`.

- [ ] **Step 1: Editar o model**

```prisma
model nutrition_targets {
  user_id        String    @id @db.Uuid
  daily_calories Int?
  protein_g      Int?
  carbs_g        Int?
  fat_g          Int?
  basis_json     Json?     @db.JsonB
  updated_at     DateTime? @db.Timestamptz

  user           users     @relation(fields: [user_id], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Gerar a migration sem aplicar**

Run: `cd BackEndTorv && npx prisma migrate dev --create-only --name nutrition_targets_basis`
Expected: nova pasta `prisma/migrations/<ts>_nutrition_targets_basis/` com:

```sql
-- AlterTable
ALTER TABLE "nutrition_targets" ADD COLUMN     "basis_json" JSONB,
ADD COLUMN     "updated_at" TIMESTAMPTZ;
```

Conferir que o SQL gerado contém **só** essas duas colunas (nada de drop/recreate de outra tabela, função ou trigger). Se vier algo além, apagar a pasta e investigar drift antes de seguir.

- [ ] **Step 3: Aplicar e gerar client**

Run: `npx prisma migrate dev && npx prisma generate`
Expected: `Already in sync` / `Generated Prisma Client`. Se o `generate` falhar por DLL travada no Windows (Furnace rodando), pedir ao Maestro pra parar o Furnace, gerar, e religar.

- [ ] **Step 4: Commit**

```bash
git add BackEndTorv/prisma/schema.prisma BackEndTorv/prisma/migrations
git commit -m "feat(db): add basis_json and updated_at to nutrition_targets"
```

---

### Task 2: Algoritmo puro `nutritionCalculator`

**Owner:** Torv Backend

**Files:**
- Create: `BackEndTorv/src/lib/nutritionCalculator.js`
- Create: `BackEndTorv/src/lib/nutritionCalculator.test.js`
- Modify: `BackEndTorv/package.json` (script `test`)

**Interfaces:**
- Produces:
  - `calculateTargets({ gender, birthDate, weightKg, heightCm, fitnessLevel, goals, today? }) → null | { daily_calories: number, protein_g: number, carbs_g: number, fat_g: number, bmi: number, bmiClass: 'under'|'normal'|'over', adjust: number, warnings: string[], basis: Basis }`
  - `Basis = { age: number, weight_kg: number, height_cm: number, gender: 'Masculino'|'Feminino', fitness_level: string, goals: string[] }` (goals ordenado)
  - `ageOn(birthDate: Date|string, today: Date) → number`
  - `diffBasis(saved: Basis|null|undefined, current: Basis) → string[]` (chaves que diferem; todas se `saved` vazio)
  - Constantes: `GOALS` (objeto por nome), `GOAL_NAMES` (array), `ACTIVITY_FACTORS`, `GENDERS`, `BASIS_KEYS`
  - `goals` aceita string `", "`-separada ou array.

- [ ] **Step 1: Script de teste**

Em `BackEndTorv/package.json`, trocar o script `test`:

```json
"test": "node --test"
```

- [ ] **Step 2: Escrever os testes (falhando)**

`BackEndTorv/src/lib/nutritionCalculator.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateTargets, ageOn, diffBasis } = require('./nutritionCalculator');

const TODAY = new Date('2026-09-24T12:00:00Z');
const base = {
  gender: 'Masculino',
  birthDate: '1996-01-15', // 30 anos em TODAY
  weightKg: 80,
  heightCm: 175,
  fitnessLevel: 'INTERMEDIÁRIO',
  today: TODAY,
};

test('exemplo da planilha: Perder Peso + Criar uma Rotina', () => {
  const r = calculateTargets({ ...base, goals: 'Perder Peso, Criar uma Rotina' });
  assert.equal(r.bmi, 26.1);
  assert.equal(r.bmiClass, 'over');
  assert.equal(r.adjust, -225);
  assert.equal(r.daily_calories, 2486); // 1748.75 * 1.55 - 225
  assert.equal(r.protein_g, 171);
  assert.equal(r.carbs_g, 264);
  assert.equal(r.fat_g, 83);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.basis, {
    age: 30, weight_kg: 80, height_cm: 175, gender: 'Masculino',
    fitness_level: 'INTERMEDIÁRIO', goals: ['Criar uma Rotina', 'Perder Peso'],
  });
});

test('conflito: acima do peso, Perder Peso + Ganhar Massa → média -137.5 e alerta', () => {
  const r = calculateTargets({ ...base, goals: ['Perder Peso', 'Ganhar Massa Muscular'] });
  assert.equal(r.adjust, -137.5); // (-450 + 350/2) / 2
  assert.equal(r.daily_calories, 2573);
  assert.equal(r.protein_g, 193);
  assert.equal(r.carbs_g, 273);
  assert.equal(r.fat_g, 79);
  assert.deepEqual(r.warnings, ['GOAL_CONFLICT']);
});

test('abaixo do peso + Perder Peso → ajuste zerado', () => {
  const r = calculateTargets({ ...base, weightKg: 50, goals: 'Perder Peso' });
  assert.equal(r.bmiClass, 'under');
  assert.equal(r.adjust, 0);
});

test('65+ usa faixa Lipschitz: IMC 26 é ideal aos 70, acima aos 40', () => {
  const old = calculateTargets({ ...base, weightKg: 79.6, birthDate: '1956-01-15', goals: 'Perder Peso' });
  const adult = calculateTargets({ ...base, weightKg: 79.6, birthDate: '1986-01-15', goals: 'Perder Peso' });
  assert.equal(old.bmi, 26);
  assert.equal(old.bmiClass, 'normal');
  assert.equal(adult.bmiClass, 'over');
});

test('mulher, iniciante, Saúde & Bem-estar', () => {
  const r = calculateTargets({
    gender: 'Feminino', birthDate: '2001-01-15', weightKg: 60, heightCm: 165,
    fitnessLevel: 'INICIANTE', goals: 'Saúde & Bem-estar', today: TODAY,
  });
  assert.equal(r.daily_calories, 1614); // (600 + 1031.25 - 125 - 161) * 1.2
  assert.equal(r.protein_g, 101);
  assert.equal(r.carbs_g, 182);
  assert.equal(r.fat_g, 54);
});

test('sem objetivos válidos → Saúde & Bem-estar; nível desconhecido → INICIANTE', () => {
  const r = calculateTargets({ ...base, fitnessLevel: null, goals: 'Objetivo Inventado' });
  assert.deepEqual(r.basis.goals, ['Saúde & Bem-estar']);
  assert.equal(r.basis.fitness_level, 'INICIANTE');
});

test('peso Decimal-like (string) funciona', () => {
  const r = calculateTargets({ ...base, weightKg: '80.00', goals: 'Criar uma Rotina' });
  assert.equal(r.basis.weight_kg, 80);
});

test('dado faltando → null', () => {
  assert.equal(calculateTargets({ ...base, weightKg: null, goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, birthDate: null, goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, gender: 'Outro', goals: 'Perder Peso' }), null);
  assert.equal(calculateTargets({ ...base, heightCm: undefined, goals: 'Perder Peso' }), null);
});

test('ageOn vira no dia do aniversário', () => {
  assert.equal(ageOn('1996-09-24', new Date('2026-09-23T12:00:00Z')), 29);
  assert.equal(ageOn('1996-09-24', new Date('2026-09-24T12:00:00Z')), 30);
  assert.equal(ageOn(new Date('1996-09-24T00:00:00.000Z'), new Date('2026-09-24T12:00:00Z')), 30);
});

test('diffBasis', () => {
  const cur = calculateTargets({ ...base, goals: 'Perder Peso' }).basis;
  assert.deepEqual(diffBasis(null, cur), ['age', 'weight_kg', 'height_cm', 'gender', 'fitness_level', 'goals']);
  assert.deepEqual(diffBasis({ ...cur }, cur), []);
  assert.deepEqual(diffBasis({ ...cur, age: 29, goals: ['Criar uma Rotina'] }, cur), ['age', 'goals']);
  assert.deepEqual(diffBasis({ ...cur, weight_kg: '80' }, cur), []); // JSON guarda número; tolera string
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd BackEndTorv && npm test`
Expected: FAIL com `Cannot find module './nutritionCalculator'`.

- [ ] **Step 4: Implementar**

`BackEndTorv/src/lib/nutritionCalculator.js`:

```js
// Espelho da planilha calculadora_calorias_macros_app.xlsx (aba Macros).
// Mifflin-St Jeor → TDEE por nível físico → ajuste médio dos objetivos (com trava por IMC).

const ACTIVITY_FACTORS = {
  'INICIANTE': 1.2,
  'INTERMEDIÁRIO': 1.55,
  'AVANÇADO': 1.9,
};
const DEFAULT_FITNESS_LEVEL = 'INICIANTE';

const GOALS = {
  'Perder Peso': { adjust: -450, protein: 0.30, carbs: 0.40, fat: 0.30 },
  'Ganhar Massa Muscular': { adjust: 350, protein: 0.30, carbs: 0.45, fat: 0.25 },
  'Melhorar Condicionamento': { adjust: 0, protein: 0.25, carbs: 0.50, fat: 0.25 },
  'Aumentar Resistência': { adjust: 150, protein: 0.20, carbs: 0.55, fat: 0.25 },
  'Criar uma Rotina': { adjust: 0, protein: 0.25, carbs: 0.45, fat: 0.30 },
  'Saúde & Bem-estar': { adjust: 0, protein: 0.25, carbs: 0.45, fat: 0.30 },
};
const GOAL_NAMES = Object.keys(GOALS);
const DEFAULT_GOAL = 'Saúde & Bem-estar';

const GENDERS = { 'Masculino': 'M', 'Feminino': 'F' };

const BASIS_KEYS = ['age', 'weight_kg', 'height_cm', 'gender', 'fitness_level', 'goals'];

// birth_date vem do Prisma como Date em meia-noite UTC; usamos partes UTC dos dois lados.
// ponytail: "hoje" é UTC — aniversário vira às 21h de Brasília; ajustar se precisar de fuso do usuário.
function ageOn(birthDate, today) {
  const b = new Date(birthDate);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

function parseGoals(goals) {
  const list = Array.isArray(goals) ? goals : String(goals || '').split(',');
  const valid = list
    .map((g) => String(g).trim().normalize('NFC'))
    .filter((g) => GOALS[g]);
  return [...new Set(valid)].sort();
}

function classifyBmi(bmi, age) {
  if (age >= 65) return bmi < 22 ? 'under' : bmi <= 27 ? 'normal' : 'over'; // Lipschitz
  return bmi < 18.5 ? 'under' : bmi < 25 ? 'normal' : 'over'; // OMS
}

function effectiveAdjust(goal, bmiClass) {
  const { adjust } = GOALS[goal];
  if (goal === 'Perder Peso' && bmiClass === 'under') return 0;
  if (goal === 'Ganhar Massa Muscular' && bmiClass === 'over') return Math.round(adjust / 2);
  return adjust;
}

function calculateTargets({ gender, birthDate, weightKg, heightCm, fitnessLevel, goals, today = new Date() }) {
  const sex = GENDERS[gender];
  const weight = Number(weightKg);
  const height = Number(heightCm);
  if (!sex || !birthDate || !(weight > 0) || !(height > 0)) return null;

  const age = ageOn(birthDate, today);
  const level = ACTIVITY_FACTORS[fitnessLevel] ? fitnessLevel : DEFAULT_FITNESS_LEVEL;
  let selected = parseGoals(goals);
  if (selected.length === 0) selected = [DEFAULT_GOAL];

  const bmi = Math.round((weight / (height / 100) ** 2) * 10) / 10;
  const bmiClass = classifyBmi(bmi, age);

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === 'M' ? 5 : -161);
  const tdee = bmr * ACTIVITY_FACTORS[level];

  const avg = (fn) => selected.reduce((sum, g) => sum + fn(g), 0) / selected.length;
  const adjust = avg((g) => effectiveAdjust(g, bmiClass));
  const kcal = tdee + adjust;

  const warnings = selected.includes('Perder Peso') && selected.includes('Ganhar Massa Muscular')
    ? ['GOAL_CONFLICT']
    : [];

  return {
    daily_calories: Math.round(kcal),
    protein_g: Math.round((kcal * avg((g) => GOALS[g].protein)) / 4),
    carbs_g: Math.round((kcal * avg((g) => GOALS[g].carbs)) / 4),
    fat_g: Math.round((kcal * avg((g) => GOALS[g].fat)) / 9),
    bmi,
    bmiClass,
    adjust,
    warnings,
    basis: { age, weight_kg: weight, height_cm: height, gender, fitness_level: level, goals: selected },
  };
}

function diffBasis(saved, current) {
  if (!saved) return [...BASIS_KEYS];
  return BASIS_KEYS.filter((key) => {
    if (key === 'goals') return JSON.stringify([...(saved.goals || [])].sort()) !== JSON.stringify(current.goals);
    if (key === 'gender' || key === 'fitness_level') return saved[key] !== current[key];
    return Number(saved[key]) !== Number(current[key]);
  });
}

module.exports = {
  calculateTargets,
  ageOn,
  diffBasis,
  GOALS,
  GOAL_NAMES,
  ACTIVITY_FACTORS,
  GENDERS,
  BASIS_KEYS,
};
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test`
Expected: `# pass 10`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add BackEndTorv/package.json BackEndTorv/src/lib/nutritionCalculator.js BackEndTorv/src/lib/nutritionCalculator.test.js
git commit -m "feat(diet): pure calorie & macro calculator mirroring the xlsx"
```

---

### Task 3: Repository + helper de sugestão + endpoints de dieta

**Owner:** Torv Backend (depende da Task 1 aplicada e da Task 2)

**Files:**
- Modify: `BackEndTorv/src/repository/diet.repository.js`
- Create: `BackEndTorv/src/lib/nutritionSuggestion.js`
- Create: `BackEndTorv/src/routes/nutrition.schemas.js`
- Modify: `BackEndTorv/src/controller/diet.controller.js`
- Modify: `BackEndTorv/src/routes/diet.routes.js`

**Interfaces:**
- Consumes: `calculateTargets`, `diffBasis` (Task 2); colunas `basis_json`, `updated_at` (Task 1).
- Produces:
  - `dietRepository.getCalcInputs(userId) → null | { gender, birthDate, fitnessLevel, goals, weightKg, heightCm }`
  - `dietRepository.getNutritionTargets(userId) → row | null`
  - `dietRepository.upsertNutritionTargets(userId, { daily_calories, protein_g, carbs_g, fat_g, basis_json })`
  - `dietRepository.updateTargetsBasis(userId, basis)`
  - `nutritionSuggestion.computeForUser(userId) → calc | null`
  - `nutritionSuggestion.ensureTargets(userId) → void`
  - `nutritionSuggestion.buildSuggestion(userId) → { has_suggestion: boolean, current?, suggested?, warnings?, changed? }`
  - `nutritionSuggestion.pickTargets(obj) → { daily_calories, protein_g, carbs_g, fat_g }`
  - `nutritionSchemas.suggestionSchema` (TypeBox)
  - HTTP: `GET /diet/targets/suggestion`, `POST /diet/targets/suggestion/accept`, `POST /diet/targets/suggestion/dismiss`

- [ ] **Step 1: Repository**

Em `diet.repository.js`, adicionar dentro da classe (antes de `upsertNutritionTargets`):

```js
  async getCalcInputs(userId) {
    const [profile, measurement] = await Promise.all([
      prisma.user_profiles.findUnique({
        where: { user_id: userId },
        select: { gender: true, birth_date: true, fitness_level: true, goal: true },
      }),
      prisma.user_measurements.findFirst({
        where: { user_id: userId },
        orderBy: { recorded_at: 'desc' },
        select: { weight_kg: true, height_cm: true },
      }),
    ]);
    if (!profile) return null;
    return {
      gender: profile.gender,
      birthDate: profile.birth_date,
      fitnessLevel: profile.fitness_level,
      goals: profile.goal,
      weightKg: measurement?.weight_kg ?? null,
      heightCm: measurement?.height_cm ?? null,
    };
  }

  async getNutritionTargets(userId) {
    return await prisma.nutrition_targets.findUnique({ where: { user_id: userId } });
  }

  async updateTargetsBasis(userId, basis) {
    return await prisma.nutrition_targets.upsert({
      where: { user_id: userId },
      update: { basis_json: basis, updated_at: new Date() },
      create: { user_id: userId, basis_json: basis, updated_at: new Date() },
    });
  }
```

E substituir `upsertNutritionTargets` por:

```js
  async upsertNutritionTargets(userId, targets) {
    const data = {
      daily_calories: targets.daily_calories,
      protein_g: targets.protein_g,
      carbs_g: targets.carbs_g,
      fat_g: targets.fat_g,
      basis_json: targets.basis_json ?? null,
      updated_at: new Date(),
    };
    return await prisma.nutrition_targets.upsert({
      where: { user_id: userId },
      update: data,
      create: { user_id: userId, ...data },
    });
  }
```

- [ ] **Step 2: Helper de sugestão**

`BackEndTorv/src/lib/nutritionSuggestion.js`:

```js
const dietRepository = require('../repository/diet.repository');
const { calculateTargets, diffBasis } = require('./nutritionCalculator');

// Mesmos defaults do fn_get_diet_summary quando não há meta.
const DEFAULT_TARGETS = { daily_calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };

function pickTargets(obj) {
  return {
    daily_calories: obj?.daily_calories ?? DEFAULT_TARGETS.daily_calories,
    protein_g: obj?.protein_g ?? DEFAULT_TARGETS.protein_g,
    carbs_g: obj?.carbs_g ?? DEFAULT_TARGETS.carbs_g,
    fat_g: obj?.fat_g ?? DEFAULT_TARGETS.fat_g,
  };
}

async function computeForUser(userId) {
  const inputs = await dietRepository.getCalcInputs(userId);
  return inputs ? calculateTargets(inputs) : null;
}

// Cria a meta só quando não existe linha — nunca sobrescreve.
async function ensureTargets(userId) {
  if (await dietRepository.getNutritionTargets(userId)) return;
  const calc = await computeForUser(userId);
  if (!calc) return;
  try {
    await dietRepository.upsertNutritionTargets(userId, { ...pickTargets(calc), basis_json: calc.basis });
  } catch (error) {
    if (error.code !== 'P2002') throw error; // corrida entre summary e suggestion: outra request já criou
  }
}

async function buildSuggestion(userId) {
  await ensureTargets(userId);
  const calc = await computeForUser(userId);
  if (!calc) return { has_suggestion: false };

  const saved = await dietRepository.getNutritionTargets(userId);
  const changed = diffBasis(saved?.basis_json, calc.basis);
  if (changed.length === 0) return { has_suggestion: false };

  const current = pickTargets(saved);
  const suggested = pickTargets(calc);
  const sameNumbers = Object.keys(current).every((k) => current[k] === suggested[k]);
  if (sameNumbers) return { has_suggestion: false };

  return { has_suggestion: true, current, suggested, warnings: calc.warnings, changed };
}

module.exports = { computeForUser, ensureTargets, buildSuggestion, pickTargets };
```

- [ ] **Step 3: Schema compartilhado**

`BackEndTorv/src/routes/nutrition.schemas.js`:

```js
const { Type } = require('@sinclair/typebox');

const targetsShape = Type.Object({
  daily_calories: Type.Number(),
  protein_g: Type.Number(),
  carbs_g: Type.Number(),
  fat_g: Type.Number(),
});

const suggestionSchema = Type.Object({
  has_suggestion: Type.Boolean(),
  current: Type.Optional(targetsShape),
  suggested: Type.Optional(targetsShape),
  warnings: Type.Optional(Type.Array(Type.String())),
  changed: Type.Optional(Type.Array(Type.String())),
});

module.exports = { suggestionSchema };
```

- [ ] **Step 4: Controller**

Em `diet.controller.js`, no topo:

```js
const { computeForUser, ensureTargets, buildSuggestion, pickTargets } = require('../lib/nutritionSuggestion');
```

Em `getDietSummary`, logo depois de resolver `date` e antes de `getDietSummaryByDate`:

```js
      await ensureTargets(userId);
```

Em `updateNutritionTargets`, trocar o `upsertNutritionTargets(...)` por:

```js
      const calc = await computeForUser(userId);
      await dietRepository.upsertNutritionTargets(userId, {
        daily_calories, protein_g: protein_g || 0, carbs_g: carbs_g || 0, fat_g: fat_g || 0,
        basis_json: calc ? calc.basis : null,
      });
```

Adicionar 3 métodos na classe:

```js
  async getTargetsSuggestion(request, reply) {
    try {
      reply.status(200).send(await buildSuggestion(request.user.userId));
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error fetching targets suggestion' });
    }
  }

  async acceptTargetsSuggestion(request, reply) {
    try {
      const { userId } = request.user;
      const calc = await computeForUser(userId); // recalcula: nunca usa números do cliente
      if (!calc) {
        return reply.status(409).send({ error: 'Not enough profile data to calculate targets' });
      }
      await dietRepository.upsertNutritionTargets(userId, { ...pickTargets(calc), basis_json: calc.basis });

      const date = new Date().toISOString().split('T')[0];
      const spResult = await dietRepository.getDietSummaryByDate(userId, date);
      const { foodLogs } = await dietRepository.getDietDataByDate(userId, date);
      reply.status(200).send(formatDietSummaryResponse(date, spResult, foodLogs || []));
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error accepting targets suggestion' });
    }
  }

  async dismissTargetsSuggestion(request, reply) {
    try {
      const { userId } = request.user;
      const calc = await computeForUser(userId);
      if (!calc) {
        return reply.status(409).send({ error: 'Not enough profile data to calculate targets' });
      }
      await dietRepository.updateTargetsBasis(userId, calc.basis);
      reply.status(200).send({ message: 'Suggestion dismissed' });
    } catch (error) {
      request.log.error(error);
      reply.status(500).send({ error: 'Internal server error dismissing targets suggestion' });
    }
  }
```

- [ ] **Step 5: Rotas**

Em `diet.routes.js`, no topo: `const { suggestionSchema } = require('./nutrition.schemas');`. Antes do bloco `logIdParams`, adicionar:

```js
  fastify.get('/targets/suggestion', {
    schema: {
      description: 'Sugere nova meta quando idade, peso, altura, sexo, nível ou objetivo mudaram desde a meta atual',
      tags: ['Diet'],
      security: [{ bearerAuth: [] }],
      response: { 200: suggestionSchema, 500: Type.Object({ error: Type.String() }) },
    },
  }, dietController.getTargetsSuggestion);

  fastify.post('/targets/suggestion/accept', {
    schema: {
      description: 'Aplica a meta recalculada no servidor e retorna o resumo do dia',
      tags: ['Diet'],
      security: [{ bearerAuth: [] }],
      response: {
        200: dietSummarySchema,
        409: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, dietController.acceptTargetsSuggestion);

  fastify.post('/targets/suggestion/dismiss', {
    schema: {
      description: 'Mantém a meta atual e marca os dados atuais como vistos',
      tags: ['Diet'],
      security: [{ bearerAuth: [] }],
      response: {
        200: Type.Object({ message: Type.String() }),
        409: Type.Object({ error: Type.String() }),
        500: Type.Object({ error: Type.String() }),
      },
    },
  }, dietController.dismissTargetsSuggestion);
```

- [ ] **Step 6: Verificar**

Run: `cd BackEndTorv && npm test && node -e "require('./src/routes/diet.routes'); require('./src/controller/diet.controller'); console.log('ok')"`
Expected: testes passam; `ok`.

Furnace (nodemon) recarrega sozinho; conferir no terminal Furnace que subiu sem erro e que `http://localhost:3000/documentation` lista as 3 rotas novas.

- [ ] **Step 7: Commit**

```bash
git add BackEndTorv/src
git commit -m "feat(diet): lazy target seeding and suggestion accept/dismiss endpoints"
```

---

### Task 4: Perfil — nível, peso, altura e sugestão inline

**Owner:** Torv Backend (depois da Task 3)

**Files:**
- Create: `BackEndTorv/src/lib/profileValidation.js`
- Create: `BackEndTorv/src/lib/profileValidation.test.js`
- Modify: `BackEndTorv/src/repository/profile.repository.js`
- Modify: `BackEndTorv/src/controller/profile.controller.js`
- Modify: `BackEndTorv/src/routes/profile.routes.js`

**Interfaces:**
- Consumes: `GOAL_NAMES`, `ACTIVITY_FACTORS`, `ageOn` (Task 2); `buildSuggestion` (Task 3); `suggestionSchema` (Task 3).
- Produces:
  - `validateProfileUpdate(body) → { error: string } | { profileData: object, measurement: null | { weight_kg?: number, height_cm?: number } }`
  - `PUT /profile` body: `{ username?, goal?, fitness_level?, weight_kg?, height_cm? }` → `{ message, profile, nutrition_suggestion }`
  - `GET /profile` ganha `weight_kg: number|null`, `height_cm: number|null`, `age: number|null`

- [ ] **Step 1: Testes da validação (falhando)**

`BackEndTorv/src/lib/profileValidation.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProfileUpdate } = require('./profileValidation');

test('nada enviado → erro', () => {
  assert.ok(validateProfileUpdate({}).error);
});

test('username e goal válidos passam como hoje', () => {
  const r = validateProfileUpdate({ username: 'leo', goal: 'Perder Peso, Criar uma Rotina' });
  assert.deepEqual(r, { profileData: { username: 'leo', goal: 'Perder Peso, Criar uma Rotina' }, measurement: null });
});

test('goal com objetivo desconhecido → erro', () => {
  assert.ok(validateProfileUpdate({ goal: 'Perder Peso, Voar' }).error);
  assert.ok(validateProfileUpdate({ goal: '' }).error);
});

test('fitness_level só aceita os 3 valores', () => {
  assert.deepEqual(validateProfileUpdate({ fitness_level: 'AVANÇADO' }).profileData, { fitness_level: 'AVANÇADO' });
  assert.ok(validateProfileUpdate({ fitness_level: 'PRO' }).error);
});

test('peso e altura dentro das faixas viram measurement', () => {
  const r = validateProfileUpdate({ weight_kg: 72.5, height_cm: 180 });
  assert.deepEqual(r, { profileData: {}, measurement: { weight_kg: 72.5, height_cm: 180 } });
  assert.deepEqual(validateProfileUpdate({ weight_kg: 70 }).measurement, { weight_kg: 70 });
});

test('peso/altura fora da faixa ou altura não inteira → erro', () => {
  assert.ok(validateProfileUpdate({ weight_kg: 19.9 }).error);
  assert.ok(validateProfileUpdate({ weight_kg: 300.1 }).error);
  assert.ok(validateProfileUpdate({ height_cm: 49 }).error);
  assert.ok(validateProfileUpdate({ height_cm: 251 }).error);
  assert.ok(validateProfileUpdate({ height_cm: 175.5 }).error);
});
```

Run: `npm test` → Expected: FAIL `Cannot find module './profileValidation'`.

- [ ] **Step 2: Implementar a validação**

`BackEndTorv/src/lib/profileValidation.js`:

```js
const { GOAL_NAMES, ACTIVITY_FACTORS } = require('./nutritionCalculator');

// Faixas iguais aos CHECK de user_measurements.
function validateProfileUpdate({ username, goal, fitness_level, weight_kg, height_cm } = {}) {
  const profileData = {};
  const measurement = {};

  if (username) profileData.username = username;

  if (goal !== undefined) {
    const goals = String(goal).split(',').map((g) => g.trim().normalize('NFC')).filter(Boolean);
    if (goals.length === 0 || goals.some((g) => !GOAL_NAMES.includes(g))) {
      return { error: 'goal must list one or more valid goals' };
    }
    profileData.goal = goals.join(', ');
  }

  if (fitness_level !== undefined) {
    if (!ACTIVITY_FACTORS[fitness_level]) return { error: 'fitness_level must be INICIANTE, INTERMEDIÁRIO or AVANÇADO' };
    profileData.fitness_level = fitness_level;
  }

  if (weight_kg !== undefined) {
    const w = Number(weight_kg);
    if (!(w >= 20 && w <= 300)) return { error: 'weight_kg must be between 20 and 300' };
    measurement.weight_kg = w;
  }

  if (height_cm !== undefined) {
    const h = Number(height_cm);
    if (!Number.isInteger(h) || h < 50 || h > 250) return { error: 'height_cm must be an integer between 50 and 250' };
    measurement.height_cm = h;
  }

  const hasMeasurement = Object.keys(measurement).length > 0;
  if (Object.keys(profileData).length === 0 && !hasMeasurement) return { error: 'No fields provided for update' };

  return { profileData, measurement: hasMeasurement ? measurement : null };
}

module.exports = { validateProfileUpdate };
```

Run: `npm test` → Expected: todos passam (Task 2 + Task 4).

- [ ] **Step 3: Repository**

Em `profile.repository.js`, trocar o `include` de `getUserProfile` por:

```js
      include: {
        user_profiles: true,
        user_streaks: true,
        user_measurements: { orderBy: { recorded_at: 'desc' }, take: 1 },
      },
```

E adicionar à classe:

```js
  async getProfileRow(userId) {
    return await prisma.user_profiles.findUnique({ where: { user_id: userId } });
  }

  async getLatestMeasurement(userId) {
    return await prisma.user_measurements.findFirst({
      where: { user_id: userId },
      orderBy: { recorded_at: 'desc' },
    });
  }

  async addMeasurement(userId, { weight_kg, height_cm }) {
    return await prisma.user_measurements.create({
      data: { user_id: userId, weight_kg, height_cm },
    });
  }
```

- [ ] **Step 4: Controller**

Em `profile.controller.js`, no topo:

```js
const { validateProfileUpdate } = require('../lib/profileValidation');
const { buildSuggestion } = require('../lib/nutritionSuggestion');
const { ageOn } = require('../lib/nutritionCalculator');
```

Em `getProfile`, depois de `const streaks = ...`:

```js
      const measurement = user.user_measurements?.[0];
```

e no objeto enviado, depois de `gender: profile.gender,`:

```js
        weight_kg: measurement?.weight_kg != null ? Number(measurement.weight_kg) : null,
        height_cm: measurement?.height_cm ?? null,
        age: profile.birth_date ? ageOn(profile.birth_date, new Date()) : null,
```

Substituir o corpo do `try` de `updateProfile` por (remove também os `console.log` de debug do método):

```js
      const { userId } = request.user;
      const result = validateProfileUpdate(request.body);
      if (result.error) {
        return reply.status(400).send({ error: result.error });
      }

      const updatedProfile = Object.keys(result.profileData).length > 0
        ? await profileRepository.updateProfile(userId, result.profileData)
        : await profileRepository.getProfileRow(userId);

      if (result.measurement) {
        const last = await profileRepository.getLatestMeasurement(userId);
        const next = {
          weight_kg: result.measurement.weight_kg ?? (last?.weight_kg != null ? Number(last.weight_kg) : null),
          height_cm: result.measurement.height_cm ?? last?.height_cm ?? null,
        };
        const changed = !last
          || Number(last.weight_kg) !== Number(next.weight_kg)
          || last.height_cm !== next.height_cm;
        if (changed) await profileRepository.addMeasurement(userId, next);
      }

      reply.status(200).send({
        message: 'Profile updated successfully',
        profile: updatedProfile,
        nutrition_suggestion: await buildSuggestion(userId),
      });
```

(o `catch` com o tratamento de `P2002` continua igual.)

- [ ] **Step 5: Rotas**

Em `profile.routes.js`, no topo: `const { suggestionSchema } = require('./nutrition.schemas');`.

No schema do GET 200, depois de `gender`:

```js
        weight_kg: Type.Union([Type.Number(), Type.Null()]),
        height_cm: Type.Union([Type.Number(), Type.Null()]),
        age: Type.Union([Type.Number(), Type.Null()]),
```

No `updateProfileSchema`: `description: 'Atualiza username, objetivos, nível físico, peso e/ou altura do usuário autenticado'`, body:

```js
    body: Type.Object({
      username: Type.Optional(Type.String()),
      goal: Type.Optional(Type.String()),
      fitness_level: Type.Optional(Type.String()),
      weight_kg: Type.Optional(Type.Number()),
      height_cm: Type.Optional(Type.Number()),
    }),
```

e no objeto de resposta 200, depois de `profile: Type.Object({...}),`:

```js
        nutrition_suggestion: suggestionSchema,
```

- [ ] **Step 6: Verificar**

Run: `npm test && node -e "require('./src/routes/profile.routes'); require('./src/controller/profile.controller'); console.log('ok')"`
Expected: testes passam; `ok`. Furnace recarregou sem erro; `/documentation` mostra o body novo do `PUT /profile`.

- [ ] **Step 7: Commit**

```bash
git add BackEndTorv/src
git commit -m "feat(profile): edit fitness level, weight and height; return nutrition suggestion"
```

---

### Task 5: Front — opções compartilhadas + aviso de conflito no cadastro

**Owner:** Torv Frontend (pode começar em paralelo à Task 3; o contrato já está fixado neste plano)

**Files:**
- Create: `FrontEndTorv/src/utils/profileOptions.ts`
- Create: `FrontEndTorv/src/components/GoalConflictWarning/index.tsx`
- Create: `FrontEndTorv/src/components/GoalConflictWarning/styles.ts`
- Modify: `FrontEndTorv/src/screens/Register/index.tsx`

**Interfaces:**
- Produces:
  - `FITNESS_LEVELS: { value: string; label: string; color: string; description: string }[]`
  - `GOAL_OPTIONS: string[]`
  - `hasGoalConflict(goals: string[]): boolean`
  - `fitnessLevelLabel(value?: string | null): string`
  - `<GoalConflictWarning goals={string[]} />` (renderiza `null` sem conflito)

- [ ] **Step 1: `profileOptions.ts`**

```ts
import { colors } from '../theme/tokens';

export const FITNESS_LEVELS = [
  { value: 'INICIANTE', label: 'Iniciante', color: colors.brand, description: 'Está começando agora ou treina raramente. Vamos construir sua base do zero.' },
  { value: 'INTERMEDIÁRIO', label: 'Intermediário', color: colors.accentIntermediate, description: 'Treina com regularidade. Quer evoluir com mais inteligência e consistência.' },
  { value: 'AVANÇADO', label: 'Avançado', color: colors.accentAdvanced, description: 'Treina pesado há muito tempo. Busca performance máxima e superação.' },
];

export const GOAL_OPTIONS = [
  'Perder Peso',
  'Ganhar Massa Muscular',
  'Melhorar Condicionamento',
  'Aumentar Resistência',
  'Criar uma Rotina',
  'Saúde & Bem-estar',
];

export const hasGoalConflict = (goals: string[]) =>
  goals.includes('Perder Peso') && goals.includes('Ganhar Massa Muscular');

export const fitnessLevelLabel = (value?: string | null) =>
  FITNESS_LEVELS.find((level) => level.value === value)?.label ?? 'Não definido';
```

- [ ] **Step 2: `GoalConflictWarning`**

`index.tsx`:

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { hasGoalConflict } from '../../utils/profileOptions';
import { styles } from './styles';

export const GoalConflictWarning: React.FC<{ goals: string[] }> = ({ goals }) => {
  if (!hasGoalConflict(goals)) return null;
  return (
    <View style={styles.container} accessibilityRole="alert">
      <AlertTriangle color={colors.accentIntermediate} size={18} />
      <Text style={styles.text}>
        Perder peso e ganhar massa ao mesmo tempo são metas opostas — recomendamos focar em um objetivo por vez.
      </Text>
    </View>
  );
};
```

`styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginTop: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentIntermediate,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
```

- [ ] **Step 3: Register**

Em `Register/index.tsx`:
- remover a constante local `FITNESS_LEVELS` (linhas 15–19) e importar: `import { FITNESS_LEVELS, GOAL_OPTIONS } from '../../utils/profileOptions';` e `import { GoalConflictWarning } from '../../components/GoalConflictWarning';`
- no step 5, trocar o array literal de objetivos por `GOAL_OPTIONS.map((option) => (`
- logo depois do fechamento desse `.map(...)`, antes do `</>` do step 5: `<GoalConflictWarning goals={goals} />`
- se `colors` ficar sem uso no arquivo após remover a constante, remover o import.

- [ ] **Step 4: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add FrontEndTorv/src/utils FrontEndTorv/src/components/GoalConflictWarning FrontEndTorv/src/screens/Register
git commit -m "feat(register): shared profile options and goal conflict warning"
```

---

### Task 6: Front — `NutritionSuggestionModal`

**Owner:** Torv Frontend

**Files:**
- Create: `FrontEndTorv/src/components/NutritionSuggestionModal/index.tsx`
- Create: `FrontEndTorv/src/components/NutritionSuggestionModal/styles.ts`

**Interfaces:**
- Consumes: `POST /diet/targets/suggestion/accept|dismiss` (Task 3); `Button` existente (`title`, `onPress`, `outline`, `loading`, `style`).
- Produces:
  - `export interface NutritionSuggestion { has_suggestion: boolean; current?: Targets; suggested?: Targets; warnings?: string[]; changed?: string[] }`
  - `<NutritionSuggestionModal suggestion={NutritionSuggestion | null} onClose={() => void} onResolved={(accepted: boolean) => void} />`: visível quando `suggestion?.has_suggestion`.

- [ ] **Step 1: Componente**

`index.tsx`:

```tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native';
import { X, ArrowRight } from 'lucide-react-native';
import { Button } from '../Button';
import api from '../../services/api';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface Targets {
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionSuggestion {
  has_suggestion: boolean;
  current?: Targets;
  suggested?: Targets;
  warnings?: string[];
  changed?: string[];
}

const REASONS: Record<string, string> = {
  age: 'Você fez aniversário',
  weight_kg: 'Seu peso mudou',
  height_cm: 'Sua altura mudou',
  goals: 'Seu objetivo mudou',
  fitness_level: 'Seu nível físico mudou',
  gender: 'Seus dados mudaram',
};
const ALL_BASIS_KEYS = 6; // meta sem histórico: backend marca tudo como mudado

const ROWS: { label: string; key: keyof Targets; unit: string }[] = [
  { label: 'Calorias', key: 'daily_calories', unit: 'kcal' },
  { label: 'Proteína', key: 'protein_g', unit: 'g' },
  { label: 'Carboidrato', key: 'carbs_g', unit: 'g' },
  { label: 'Gordura', key: 'fat_g', unit: 'g' },
];

interface Props {
  suggestion: NutritionSuggestion | null;
  onClose: () => void;
  onResolved: (accepted: boolean) => void;
}

export const NutritionSuggestionModal: React.FC<Props> = ({ suggestion, onClose, onResolved }) => {
  const [loading, setLoading] = useState<'accept' | 'dismiss' | null>(null);
  const { current, suggested, changed = [], warnings = [] } = suggestion || {};
  const visible = !!suggestion?.has_suggestion && !!current && !!suggested;

  const reasons = changed.length >= ALL_BASIS_KEYS
    ? ['Calculamos uma meta personalizada com base no seu perfil']
    : [...new Set(changed.map((key) => REASONS[key]).filter(Boolean))];

  const resolve = async (accept: boolean) => {
    setLoading(accept ? 'accept' : 'dismiss');
    try {
      await api.post(`/diet/targets/suggestion/${accept ? 'accept' : 'dismiss'}`);
      onResolved(accept);
    } catch (error) {
      console.log('Failed to resolve nutrition suggestion', error);
      Alert.alert('Erro', 'Não foi possível atualizar sua meta.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Nova meta sugerida</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar sugestão de meta">
              <X color={colors.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          {reasons.map((reason) => (
            <Text key={reason} style={styles.reason}>• {reason}</Text>
          ))}

          {visible && ROWS.map(({ label, key, unit }) => (
            <View key={key} style={styles.row} accessibilityLabel={`${label}: de ${current![key]} para ${suggested![key]} ${unit}`}>
              <Text style={styles.rowLabel}>{label}</Text>
              <View style={styles.rowValues}>
                <Text style={styles.oldValue}>{current![key]}</Text>
                <ArrowRight color={colors.textSecondary} size={14} />
                <Text style={styles.newValue}>{suggested![key]} {unit}</Text>
              </View>
            </View>
          ))}

          {warnings.includes('GOAL_CONFLICT') && (
            <Text style={styles.warning}>
              Seus objetivos incluem perder peso e ganhar massa — a meta é uma média entre déficit e superávit. Focar em um objetivo por vez traz resultados mais previsíveis.
            </Text>
          )}

          <Button title="Aplicar nova meta" onPress={() => resolve(true)} loading={loading === 'accept'} disabled={loading !== null} />
          <Button title="Manter atual" outline onPress={() => resolve(false)} loading={loading === 'dismiss'} disabled={loading !== null} style={styles.secondaryButton} />
        </View>
      </View>
    </Modal>
  );
};
```

Antes de usar `disabled`: conferir em `components/Button/index.tsx` se as props estendem `TouchableOpacityProps` (repassa `disabled`). Se não repassar, remover a prop `disabled` das duas linhas (o `loading` já impede toque duplo no botão clicado).

`styles.ts`:

```ts
import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  content: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20 },
  reason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  rowValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldValue: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, textDecorationLine: 'line-through' },
  newValue: { color: colors.brand, fontFamily: fontFamily.extraBold, fontSize: 16 },
  warning: {
    color: colors.accentIntermediate,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: { marginTop: 4 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add FrontEndTorv/src/components/NutritionSuggestionModal
git commit -m "feat(diet): nutrition suggestion modal"
```

---

### Task 7: Front — Perfil (nível, peso/altura, conflito, sugestão)

**Owner:** Torv Frontend (depois das Tasks 5 e 6)

**Files:**
- Modify: `FrontEndTorv/src/screens/Profile/index.tsx`
- Modify: `FrontEndTorv/src/screens/Profile/styles.ts`

**Interfaces:**
- Consumes: `FITNESS_LEVELS`, `GOAL_OPTIONS`, `fitnessLevelLabel` (Task 5); `GoalConflictWarning` (Task 5); `NutritionSuggestionModal`, `NutritionSuggestion` (Task 6); `PUT /profile` → `nutrition_suggestion`, `GET /profile` → `fitness_level`, `weight_kg`, `height_cm` (Task 4).

- [ ] **Step 1: Imports e estado**

Imports novos:

```tsx
import { Activity, Scale } from 'lucide-react-native'; // adicionar à lista existente de lucide
import { GoalConflictWarning } from '../../components/GoalConflictWarning';
import { NutritionSuggestionModal, type NutritionSuggestion } from '../../components/NutritionSuggestionModal';
import { FITNESS_LEVELS, GOAL_OPTIONS, fitnessLevelLabel } from '../../utils/profileOptions';
```

Estado novo (depois de `editGoals`):

```tsx
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editLevel, setEditLevel] = useState('');

  const [showBodyModal, setShowBodyModal] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [bodyError, setBodyError] = useState('');

  const [suggestion, setSuggestion] = useState<NutritionSuggestion | null>(null);
```

- [ ] **Step 2: Handlers**

Em `handleSaveGoals`, trocar `await api.put('/profile', { goal: newGoalStr });` por:

```tsx
      const response = await api.put('/profile', { goal: newGoalStr });
      setSuggestion(response.data.nutrition_suggestion ?? null);
```

Novos handlers (depois de `handleSaveGoals`):

```tsx
  const handleOpenLevelEdit = () => {
    setEditLevel(profileData?.fitness_level || '');
    setShowLevelModal(true);
  };

  const handleSaveLevel = async () => {
    if (!editLevel) return;
    try {
      const response = await api.put('/profile', { fitness_level: editLevel });
      setProfileData((prev: any) => ({ ...prev, fitness_level: editLevel }));
      setShowLevelModal(false);
      setSuggestion(response.data.nutrition_suggestion ?? null);
    } catch (error) {
      console.log('Failed to save fitness level', error);
      Alert.alert('Erro', 'Não foi possível atualizar o nível físico.');
    }
  };

  const handleOpenBodyEdit = () => {
    setEditWeight(profileData?.weight_kg != null ? String(profileData.weight_kg) : '');
    setEditHeight(profileData?.height_cm != null ? String(profileData.height_cm) : '');
    setBodyError('');
    setShowBodyModal(true);
  };

  const handleSaveBody = async () => {
    const weight = Number(editWeight.replace(',', '.'));
    const height = Number(editHeight);
    if (!(weight >= 20 && weight <= 300)) return setBodyError('Peso deve estar entre 20 e 300 kg.');
    if (!Number.isInteger(height) || height < 50 || height > 250) return setBodyError('Altura deve ser um número inteiro entre 50 e 250 cm.');
    try {
      const response = await api.put('/profile', { weight_kg: weight, height_cm: height });
      setProfileData((prev: any) => ({ ...prev, weight_kg: weight, height_cm: height }));
      setShowBodyModal(false);
      setSuggestion(response.data.nutrition_suggestion ?? null);
    } catch (error) {
      console.log('Failed to save weight/height', error);
      setBodyError('Não foi possível salvar. Tente novamente.');
    }
  };
```

- [ ] **Step 3: Cards**

Logo depois do `</Card>` do bloco "Objetivo" (antes de `{/* Relógio conectado */}`):

```tsx
        {/* Nível físico */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleInline}>Nível físico</Text>
          <TouchableOpacity onPress={handleOpenLevelEdit} accessibilityRole="button" accessibilityLabel="Editar nível físico">
            <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Activity color={colors.brand} size={22} />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>{fitnessLevelLabel(profileData?.fitness_level)}</Text>
          </View>
        </Card>

        {/* Peso e altura */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleInline}>Peso e altura</Text>
          <TouchableOpacity onPress={handleOpenBodyEdit} accessibilityRole="button" accessibilityLabel="Editar peso e altura">
            <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Scale color={colors.brand} size={22} />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>
              {profileData?.weight_kg != null ? `${profileData.weight_kg} kg` : '— kg'} · {profileData?.height_cm != null ? `${profileData.height_cm} cm` : '— cm'}
            </Text>
          </View>
        </Card>
```

- [ ] **Step 4: Modal de objetivo**

No modal "Meus Objetivos": trocar o array literal por `GOAL_OPTIONS.map((option) => (`; logo depois do `.map(...)`, ainda dentro do `ScrollView`: `<GoalConflictWarning goals={editGoals} />`.

- [ ] **Step 5: Modais novos + sugestão**

Antes de `</SafeAreaView>` final:

```tsx
      {/* Fitness Level Edit Modal */}
      <Modal visible={showLevelModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient colors={[colors.brandTint, colors.background]} style={styles.modalContent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nível físico</Text>
              <TouchableOpacity onPress={() => setShowLevelModal(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de nível físico">
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Escolha a opção que melhor descreve sua rotina atual.</Text>
            {FITNESS_LEVELS.map((level) => (
              <SelectCard
                key={level.value}
                title={level.label}
                titleColor={level.color}
                description={level.description}
                selected={editLevel === level.value}
                onPress={() => setEditLevel(level.value)}
              />
            ))}
            <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveLevel}>
              <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.futuristicButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.futuristicButtonText}>ATUALIZAR NÍVEL</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Weight & Height Edit Modal */}
      <Modal visible={showBodyModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient colors={[colors.brandTint, colors.background]} style={styles.modalContent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Peso e altura</Text>
              <TouchableOpacity onPress={() => setShowBodyModal(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de peso e altura">
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Mantenha seus dados atualizados para ajustarmos suas metas.</Text>
            <Input label="Peso (kg)" placeholder="Ex: 70" value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad" />
            <Input label="Altura (cm)" placeholder="Ex: 175" value={editHeight} onChangeText={setEditHeight} keyboardType="number-pad" />
            {bodyError ? <Text style={styles.formError}>{bodyError}</Text> : null}
            <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveBody}>
              <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.futuristicButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.futuristicButtonText}>SALVAR</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      <NutritionSuggestionModal
        suggestion={suggestion}
        onClose={() => setSuggestion(null)}
        onResolved={() => setSuggestion(null)}
      />
```

Em `Profile/styles.ts`, adicionar:

```ts
  formError: {
    color: colors.error,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginBottom: 8,
  },
```

(conferir que `colors` e `fontFamily` já são importados em `styles.ts`; importar de `../../theme/tokens` se faltar.)

- [ ] **Step 6: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros. (`Activity` e `Scale` existem no `lucide-react-native`; se o nome não resolver, usar `Gauge` / `Ruler`.)

- [ ] **Step 7: Commit**

```bash
git add FrontEndTorv/src/screens/Profile
git commit -m "feat(profile): edit fitness level, weight and height with target suggestion"
```

---

### Task 8: Front — banner de sugestão no MyDiet

**Owner:** Torv Frontend (depois da Task 6)

**Files:**
- Modify: `FrontEndTorv/src/screens/MyDiet/index.tsx`
- Modify: `FrontEndTorv/src/screens/MyDiet/styles.ts`

**Interfaces:**
- Consumes: `GET /diet/targets/suggestion` (Task 3); `NutritionSuggestionModal`, `NutritionSuggestion` (Task 6).

- [ ] **Step 1: Imports e estado**

```tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Sparkles, ChevronRight } from 'lucide-react-native'; // adicionar à lista existente
import { NutritionSuggestionModal, type NutritionSuggestion } from '../../components/NutritionSuggestionModal';
```

Estado (junto dos outros):

```tsx
  const [pendingSuggestion, setPendingSuggestion] = useState<NutritionSuggestion | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);
```

- [ ] **Step 2: Carregar ao focar**

Depois do `useEffect` de `selectedDate`:

```tsx
  const loadSuggestion = useCallback(async () => {
    try {
      const response = await api.get('/diet/targets/suggestion');
      setPendingSuggestion(response.data?.has_suggestion ? response.data : null);
    } catch (error) {
      console.log('Error fetching targets suggestion', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSuggestion();
    }, [loadSuggestion])
  );
```

Em `handleSaveTargets`, depois de `await loadDataForDate(selectedDate);`: `await loadSuggestion();` (edição manual grava o basis e some com o banner).

- [ ] **Step 3: Banner**

Dentro do primeiro `<View>` do `ScrollView` principal, **antes** de `{/* Main Calories Progress Bar */}`:

```tsx
      {pendingSuggestion && (
        <TouchableOpacity
          style={styles.suggestionBanner}
          onPress={() => setShowSuggestion(true)}
          accessibilityRole="button"
          accessibilityLabel="Nova meta sugerida, toque para ver"
        >
          <Sparkles color={colors.brand} size={18} />
          <Text style={styles.suggestionBannerText}>Nova meta sugerida — toque para ver</Text>
          <ChevronRight color={colors.textSecondary} size={18} />
        </TouchableOpacity>
      )}
```

Antes do `{/* Delete Confirmation Modal */}`:

```tsx
      <NutritionSuggestionModal
        suggestion={showSuggestion ? pendingSuggestion : null}
        onClose={() => setShowSuggestion(false)}
        onResolved={(accepted) => {
          setShowSuggestion(false);
          setPendingSuggestion(null);
          if (accepted) loadDataForDate(selectedDate);
        }}
      />
```

`MyDiet/styles.ts`:

```ts
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  suggestionBannerText: {
    flex: 1,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 14,
  },
```

(conferir imports de `colors`, `radius`, `fontFamily` em `styles.ts`.)

- [ ] **Step 4: Typecheck**

Run: `cd FrontEndTorv && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add FrontEndTorv/src/screens/MyDiet
git commit -m "feat(diet): suggestion banner on MyDiet"
```

---

### Task 9: Test — review + usabilidade no emulador

**Owner:** Torv Review and Tests (diff completo da branch: `git diff main...feat/calorie-macro-calculator`)

**Relatório:** `docs/qa-calorie-calculator-2026-09-24.md` (rodadas seguintes: `-round2`, `-round3`…; nunca sobrescrever).

- [ ] **Step 1: Automatizado**

Run: `cd BackEndTorv && npm test` → todos passam. `cd FrontEndTorv && npx tsc --noEmit` → sem erros.

- [ ] **Step 2: Contrato HTTP** (backend no Furnace, token de uma conta de teste obtido da sessão ativa no app, como no QA de 2026-09-18)

- `GET /diet/summary` para conta sem `nutrition_targets` → linha criada com `basis_json`; metas ≠ 2000/150/250/65.
- `GET /diet/targets/suggestion` logo depois → `{ has_suggestion: false }`.
- `PUT /profile { fitness_level: 'AVANÇADO' }` → `nutrition_suggestion.has_suggestion: true`, `changed: ['fitness_level']`.
- `POST .../dismiss` → meta igual; nova `GET .../suggestion` → `false`.
- `PUT /profile { goal: 'Perder Peso, Ganhar Massa Muscular' }` → `changed: ['goals']`, `warnings: ['GOAL_CONFLICT']`.
- `POST .../accept` com body `{ "daily_calories": 1 }` → meta = `suggested`, ignora o body.
- `PUT /profile { weight_kg: 19 }` → 400; `{ height_cm: 175.5 }` → 400; `{ goal: 'Voar' }` → 400; `{ fitness_level: 'PRO' }` → 400.
- `PUT /profile { weight_kg: 75 }` → nova linha em `user_measurements` com a altura anterior copiada.
- `GET /profile` → `weight_kg`, `height_cm`, `age` corretos.
- Envelhecimento: `UPDATE user_profiles SET birth_date = birth_date - interval '1 year'` na conta de teste → `GET .../suggestion` com `changed: ['age']`.

- [ ] **Step 3: Usabilidade no emulador** (portal Maestri "Pixel", `emulator-5554`; logs via `adb logcat`)

Fluxos:
1. Cadastro novo marcando Perder Peso + Ganhar Massa → aviso aparece, não bloqueia; ao entrar no MyDiet, metas personalizadas (não 2000) e **sem** banner.
2. Perfil → Nível físico → trocar → modal de sugestão com motivo "Seu nível físico mudou" → **Aplicar** → MyDiet reflete.
3. Perfil → Peso e altura → valor inválido mostra erro; válido → modal → **Manter atual** → MyDiet sem banner e meta igual.
4. Perfil → Objetivo → trocar → fechar o modal no X → MyDiet mostra banner → tocar → aplicar.
5. Editar Metas Diárias no MyDiet manualmente → banner não aparece.
6. `adb logcat` sem erros JS/red box durante os fluxos.

- [ ] **Step 4: Relatório**

Registrar pass/fail por item no relatório. Qualquer falha → volta pra Edit só na camada responsável, nova rodada com novo arquivo.

---

### Task 10: Security

**Owner:** Torv Security — só depois da Task 9 100% verde.

- [ ] **Step 1: OWASP Top 10 no diff completo**, com atenção a:
  - IDOR: todas as rotas novas usam `request.user.userId`, nunca id do cliente.
  - Integridade: `accept` ignora payload; `PUT /profile` valida enum/faixa antes do banco.
  - Mass assignment: `updateProfile` só grava campos de `profileData` montados pela validação.
  - Vazamento de erro: respostas 4xx/5xx sem stack/detalhe Prisma.
- [ ] **Step 2:** Falha → rework só na camada apontada, nova rodada da Task 9 (novo relatório) apenas sobre o que mudou.

**Feature pronta** quando Task 9 e Task 10 estiverem verdes na mesma rodada. Depois: Expo no aparelho do usuário e aprovação da branch pelo usuário.
