// Espelho de BackEndTorv/treino_padrao_referencia.xlsx: abas Niveis, Objetivos e Algoritmo aqui; Exercicios e
// Sessoes no banco (exercises.type/min_level/catalog_order e workout_template_slots, migration 20261001150000).
// Mudou a planilha? Atualize as tabelas daqui (ou uma migration nova) e os testes.

const LEVEL_NAMES = ['INICIANTE', 'INTERMEDIÁRIO', 'AVANÇADO']; // índice = rank
const I = 0; // Iniciante
const M = 1; // Intermediário
const A = 2; // Avançado
const DEFAULT_LEVEL = 'INICIANTE';
const DEFAULT_GOAL = 'Saúde & Bem-estar';

// Aba Niveis: frequência semanal (dias) e séries por exercício, por rank.
const LEVELS = [
  { days: 3, sets: 3 },
  { days: 4, sets: 3 },
  { days: 5, sets: 4 },
];

// Aba Objetivos. rest: descanso em segundos por tipo (C = composto, I = isolado).
const GOALS = {
  'Ganhar Massa Muscular': { priority: 1, reps: [6, 12], rest: { C: 120, I: 60 }, maxDays: 7, maxLevel: A },
  'Perder Peso': { priority: 2, reps: [8, 15], rest: { C: 60, I: 45 }, maxDays: 7, maxLevel: A },
  'Aumentar Resistência': { priority: 3, reps: [15, 25], rest: { C: 45, I: 30 }, maxDays: 7, maxLevel: A },
  'Melhorar Condicionamento': { priority: 4, reps: [12, 20], rest: { C: 45, I: 30 }, maxDays: 7, maxLevel: A },
  'Criar uma Rotina': { priority: 5, reps: [10, 15], rest: { C: 75, I: 60 }, maxDays: 3, maxLevel: I },
  'Saúde & Bem-estar': { priority: 6, reps: [10, 15], rest: { C: 75, I: 60 }, maxDays: 3, maxLevel: M },
};
const REST_KEY = { COMPOSTO: 'C', ISOLADO: 'I' }; // exercises.type → chave de rest

function normalizeGoals(goals) {
  const list = Array.isArray(goals) ? goals : String(goals ?? '').split(',');
  const valid = [...new Set(list.map((g) => String(g).trim()).filter((g) => Object.hasOwn(GOALS, g)))];
  return valid.length ? valid.sort() : [DEFAULT_GOAL];
}

// Dados do perfil que definem o plano, já normalizados. goals ordenado: a ordem de seleção não gera sugestão falsa.
function buildBasis({ gender, fitnessLevel, goals }) {
  return {
    fitness_level: LEVEL_NAMES.includes(fitnessLevel) ? fitnessLevel : DEFAULT_LEVEL,
    goals: normalizeGoals(goals),
    gender: gender === 'Masculino' ? 'M' : gender === 'Feminino' ? 'F' : 'N',
  };
}

// Campos do basis que mudaram (fitness_level, goals, gender).
function diffPlanBasis(saved, current) {
  return Object.keys(current).filter((k) => JSON.stringify(saved?.[k]) !== JSON.stringify(current[k]));
}

// Aba Algoritmo, passos 1–9. Regras do banco (workoutRepository.getGeneratorRules):
// catalog = exercícios do catálogo por catalog_order (a ordem dentro de grupo+tipo é a preferência do algoritmo);
// slots = workout_template_slots por (days_per_week, day, position).
function generatePlan(input, { catalog, slots }) {
  const basis = buildBasis(input);
  const main = basis.goals.map((g) => GOALS[g]).reduce((a, b) => (b.priority < a.priority ? b : a));
  const level = Math.min(LEVEL_NAMES.indexOf(basis.fitness_level), main.maxLevel);
  const days = Math.min(LEVELS[level].days, main.maxDays);

  const eligible = {};
  for (const ex of catalog) {
    if (LEVEL_NAMES.indexOf(ex.min_level) <= level) (eligible[`${ex.muscle_group}|${ex.type}`] ??= []).push(ex);
  }

  const used = {};
  const routines = new Map();
  for (const slot of slots) {
    if (slot.days_per_week !== days || LEVEL_NAMES.indexOf(slot.min_level) > level) continue;
    if (slot.sex !== 'TODOS' && slot.sex !== basis.gender) continue;
    const key = `${slot.muscle_group}|${slot.type}`;
    used[key] = (used[key] ?? 0) + 1;
    const ex = eligible[key]?.[used[key] - 1];
    if (!ex) continue; // acabaram as opções desse grupo+tipo no nível: descarta o slot

    if (!routines.has(slot.day)) {
      routines.set(slot.day, { name: `Dia ${slot.day} — ${slot.session_name}`, position: slot.day, exercises: [] });
    }
    const routine = routines.get(slot.day);
    routine.exercises.push({
      exercise_id: ex.id,
      slug: ex.slug,
      position: routine.exercises.length + 1,
      reps_min: main.reps[0],
      reps_max: main.reps[1],
      rest_sec: main.rest[REST_KEY[ex.type]],
      set_count: LEVELS[level].sets,
    });
  }
  return { basis, routines: [...routines.values()] };
}

module.exports = { generatePlan, buildBasis, diffPlanBasis, GOALS, LEVEL_NAMES };
