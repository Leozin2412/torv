const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generatePlan, buildBasis, diffPlanBasis, CATALOG, SLOTS } = require('../workoutGenerator');

const slugs = (plan) => plan.routines.map((r) => r.exercises.map((e) => e.slug));
const minLevelOf = Object.fromEntries(CATALOG.map((e) => [e.slug, e.minLevel]));

// Aba Gerador da planilha (exemplo Masculino, Avançado, Ganhar Massa Muscular).
const GERADOR_M_AVANCADO = [
  ['supino-reto-com-barra', 'supino-inclinado-com-barra', 'desenvolvimento-militar-com-barra', 'crossover-na-polia', 'elevacao-lateral-com-halteres', 'supino-fechado', 'triceps-pulley-corda-ou-barra'],
  ['remada-curvada-com-barra', 'barra-fixa-pull-up', 'puxada-frontal-na-polia', 'pullover-na-polia-bracos-estendidos', 'crucifixo-inverso-na-maquina-deltoide-posterior', 'rosca-direta-com-barra', 'rosca-alternada-com-halteres', 'rosca-de-punho'],
  ['agachamento-livre-com-barra', 'agachamento-frontal', 'cadeira-extensora', 'stiff-com-barra', 'mesa-flexora', 'elevacao-pelvica-hip-thrust-com-barra', 'gluteo-na-polia-coice', 'panturrilha-em-pe-na-maquina', 'panturrilha-sentado'],
  ['supino-reto-com-halteres', 'remada-baixa-na-polia-triangulo', 'desenvolvimento-com-halteres', 'rosca-martelo', 'triceps-testa', 'abdominal-na-polia-ajoelhado', 'crucifixo-com-halteres'],
  ['hack-squat', 'levantamento-terra-convencional', 'ponte-de-gluteos-peso-do-corpo', 'cadeira-flexora', 'cadeira-abdutora', 'elevacao-de-pernas-na-barra-fixa', 'extensao-lombar-banco-45', 'panturrilha-no-leg-press'],
];

test('Masculino, AVANÇADO, Ganhar Massa = aba Gerador da planilha', () => {
  const plan = generatePlan({ gender: 'Masculino', fitnessLevel: 'AVANÇADO', goals: 'Ganhar Massa Muscular' });
  assert.deepEqual(plan.routines.map((r) => r.name), [
    'Dia 1 — Empurrar (Push)', 'Dia 2 — Puxar (Pull)', 'Dia 3 — Pernas', 'Dia 4 — Superior', 'Dia 5 — Inferior + Core',
  ]);
  assert.deepEqual(plan.routines.map((r) => r.position), [1, 2, 3, 4, 5]);
  assert.deepEqual(slugs(plan), GERADOR_M_AVANCADO);
  for (const r of plan.routines) {
    assert.deepEqual(r.exercises.map((e) => e.position), r.exercises.map((_, i) => i + 1));
    for (const e of r.exercises) {
      assert.equal(e.set_count, 4);
      assert.equal(e.reps_min, 6);
      assert.equal(e.reps_max, 12);
    }
  }
  assert.equal(plan.routines[0].exercises[0].rest_sec, 120); // supino reto: composto
  assert.equal(plan.routines[0].exercises[3].rest_sec, 60); // crossover: isolado
});

test('Feminino no mesmo nível muda só os slots de sexo', () => {
  const f = slugs(generatePlan({ gender: 'Feminino', fitnessLevel: 'AVANÇADO', goals: 'Ganhar Massa Muscular' }));
  const expected = GERADOR_M_AVANCADO.map((day) => [...day]);
  expected[3][6] = 'elevacao-lateral-na-polia';
  expected[4][7] = 'extensao-de-quadril-na-maquina';
  assert.deepEqual(f, expected);
});

test('INICIANTE: 3 rotinas, 3 séries, só exercícios de nível Iniciante', () => {
  const plan = generatePlan({ gender: 'Feminino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso' });
  assert.equal(plan.routines.length, 3);
  for (const r of plan.routines) {
    for (const e of r.exercises) {
      assert.equal(e.set_count, 3);
      assert.equal(e.reps_min, 8);
      assert.equal(e.reps_max, 15);
      assert.equal(minLevelOf[e.slug], 0, e.slug);
    }
  }
});

test('Criar uma Rotina limita AVANÇADO ao plano de Iniciante', () => {
  const capped = generatePlan({ gender: 'Masculino', fitnessLevel: 'AVANÇADO', goals: 'Criar uma Rotina' });
  const beginner = generatePlan({ gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Criar uma Rotina' });
  assert.deepEqual(capped.routines, beginner.routines);
  assert.equal(capped.routines.length, 3);
  const first = capped.routines[0].exercises;
  assert.deepEqual([first[0].reps_min, first[0].reps_max, first[0].rest_sec], [10, 15, 75]); // leg press: composto
  assert.equal(first.find((e) => e.slug === 'abdominal-crunch-solo').rest_sec, 60);
  assert.equal(capped.basis.fitness_level, 'AVANÇADO'); // basis guarda o perfil, não o nível efetivo
});

test('fallbacks: gênero nulo → N, objetivos vazios → Saúde & Bem-estar, nível desconhecido → INICIANTE', () => {
  assert.deepEqual(buildBasis({ gender: null, fitnessLevel: 'PRO', goals: '' }), {
    fitness_level: 'INICIANTE', goals: ['Saúde & Bem-estar'], gender: 'N',
  });
  assert.deepEqual(buildBasis({ gender: 'Feminino', fitnessLevel: 'INTERMEDIÁRIO', goals: ['Voar', 'Perder Peso'] }).goals, ['Perder Peso']);
  const plan = generatePlan({ gender: undefined, fitnessLevel: undefined, goals: undefined });
  assert.equal(plan.routines.length, 3);
  assert.ok(plan.routines.flatMap((r) => r.exercises).some((e) => e.slug === 'rosca-direta-com-barra')); // slot N (bíceps)
});

test('ordem dos objetivos não muda o basis; principal = menor prioridade', () => {
  const a = generatePlan({ gender: 'Masculino', fitnessLevel: 'INTERMEDIÁRIO', goals: 'Perder Peso, Ganhar Massa Muscular' });
  const b = generatePlan({ gender: 'Masculino', fitnessLevel: 'INTERMEDIÁRIO', goals: 'Ganhar Massa Muscular, Perder Peso' });
  assert.deepEqual(a, b);
  assert.deepEqual(a.basis.goals, ['Ganhar Massa Muscular', 'Perder Peso']);
  assert.equal(a.routines[0].exercises[0].reps_min, 6); // Ganhar Massa (prioridade 1)
});

test('diffPlanBasis lista só os campos que mudaram', () => {
  const saved = buildBasis({ gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso' });
  assert.deepEqual(diffPlanBasis(saved, buildBasis({ gender: 'Masculino', fitnessLevel: 'INICIANTE', goals: ['Perder Peso'] })), []);
  assert.deepEqual(diffPlanBasis(saved, buildBasis({ gender: 'Masculino', fitnessLevel: 'AVANÇADO', goals: 'Perder Peso' })), ['fitness_level']);
  assert.deepEqual(diffPlanBasis(saved, buildBasis({ gender: 'Feminino', fitnessLevel: 'INICIANTE', goals: 'Perder Peso, Criar uma Rotina' })), ['goals', 'gender']);
});

test('catálogo: 71 slugs únicos e todo grupo+tipo de slot tem exercício', () => {
  assert.equal(CATALOG.length, 71);
  assert.equal(new Set(CATALOG.map((e) => e.slug)).size, 71);
  const keys = new Set(CATALOG.map((e) => `${e.group}|${e.type}`));
  for (const s of SLOTS) assert.ok(keys.has(`${s.group}|${s.type}`), `${s.group}|${s.type}`);
});

test('seed da migration tem exatamente os slugs do CATALOG', () => {
  const dir = path.join(__dirname, '../../../prisma/migrations');
  const folder = fs.readdirSync(dir).find((d) => d.endsWith('_workout_module'));
  const sql = fs.readFileSync(path.join(dir, folder, 'migration.sql'), 'utf8');
  const seeded = [...sql.matchAll(/\('([a-z0-9-]+)', '/g)].map((m) => m[1]);
  assert.deepEqual(seeded, CATALOG.map((e) => e.slug));
});
