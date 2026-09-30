// Espelho de BackEndTorv/treino_padrao_referencia.xlsx (abas Niveis, Objetivos, Sessoes, Exercicios, Algoritmo).
// Mudou a planilha? Atualize as tabelas daqui e os testes.

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

// Aba Exercicios: [slug, grupo, tipo, nível mínimo]. A ordem dentro de grupo+tipo é a preferência do algoritmo.
// Nome e grupo também estão no seed da migration (mesmo slug); o tipo e o nível mínimo só existem aqui.
const CATALOG = [
  ['supino-reto-com-barra', 'Peito', 'C', M],
  ['supino-inclinado-com-barra', 'Peito', 'C', M],
  ['supino-reto-com-halteres', 'Peito', 'C', I],
  ['supino-inclinado-com-halteres', 'Peito', 'C', I],
  ['chest-press-maquina', 'Peito', 'C', I],
  ['flexao-de-bracos', 'Peito', 'C', I],
  ['mergulho-nas-paralelas-foco-peito', 'Peito', 'C', M],
  ['crossover-na-polia', 'Peito', 'I', M],
  ['crucifixo-com-halteres', 'Peito', 'I', M],
  ['crucifixo-na-maquina-peck-deck', 'Peito', 'I', I],
  ['remada-curvada-com-barra', 'Costas', 'C', M],
  ['barra-fixa-pull-up', 'Costas', 'C', M],
  ['puxada-frontal-na-polia', 'Costas', 'C', I],
  ['remada-baixa-na-polia-triangulo', 'Costas', 'C', I],
  ['remada-unilateral-com-haltere-serrote', 'Costas', 'C', I],
  ['remada-na-maquina', 'Costas', 'C', I],
  ['barra-fixa-assistida', 'Costas', 'C', I],
  ['barra-fixa-com-carga', 'Costas', 'C', A],
  ['pullover-na-polia-bracos-estendidos', 'Costas', 'I', M],
  ['desenvolvimento-militar-com-barra', 'Ombros', 'C', M],
  ['desenvolvimento-com-halteres', 'Ombros', 'C', I],
  ['desenvolvimento-na-maquina', 'Ombros', 'C', I],
  ['elevacao-lateral-com-halteres', 'Ombros', 'I', I],
  ['crucifixo-inverso-na-maquina-deltoide-posterior', 'Ombros', 'I', I],
  ['elevacao-lateral-na-polia', 'Ombros', 'I', M],
  ['face-pull', 'Ombros', 'I', M],
  ['elevacao-frontal-com-halteres', 'Ombros', 'I', I],
  ['rosca-direta-com-barra', 'Bíceps', 'I', I],
  ['rosca-alternada-com-halteres', 'Bíceps', 'I', I],
  ['rosca-martelo', 'Bíceps', 'I', I],
  ['rosca-scott', 'Bíceps', 'I', M],
  ['rosca-na-polia', 'Bíceps', 'I', M],
  ['supino-fechado', 'Tríceps', 'C', M],
  ['triceps-banco-mergulho-no-banco', 'Tríceps', 'C', M],
  ['triceps-pulley-corda-ou-barra', 'Tríceps', 'I', I],
  ['triceps-testa', 'Tríceps', 'I', M],
  ['triceps-frances-com-haltere', 'Tríceps', 'I', M],
  ['agachamento-livre-com-barra', 'Quadríceps', 'C', M],
  ['agachamento-frontal', 'Quadríceps', 'C', A],
  ['hack-squat', 'Quadríceps', 'C', M],
  ['agachamento-bulgaro', 'Quadríceps', 'C', M],
  ['leg-press-45', 'Quadríceps', 'C', I],
  ['agachamento-goblet', 'Quadríceps', 'C', I],
  ['agachamento-no-smith', 'Quadríceps', 'C', I],
  ['afundo-passada-com-halteres', 'Quadríceps', 'C', I],
  ['cadeira-extensora', 'Quadríceps', 'I', I],
  ['stiff-com-barra', 'Posterior de coxa', 'C', M],
  ['levantamento-terra-convencional', 'Posterior de coxa', 'C', A],
  ['levantamento-terra-com-barra-hexagonal', 'Posterior de coxa', 'C', M],
  ['stiff-com-halteres', 'Posterior de coxa', 'C', I],
  ['mesa-flexora', 'Posterior de coxa', 'I', I],
  ['cadeira-flexora', 'Posterior de coxa', 'I', I],
  ['elevacao-pelvica-hip-thrust-com-barra', 'Glúteos', 'C', M],
  ['ponte-de-gluteos-peso-do-corpo', 'Glúteos', 'C', I],
  ['agachamento-sumo-com-halter', 'Glúteos', 'C', I],
  ['gluteo-na-polia-coice', 'Glúteos', 'I', I],
  ['cadeira-abdutora', 'Glúteos', 'I', I],
  ['extensao-de-quadril-na-maquina', 'Glúteos', 'I', I],
  ['panturrilha-em-pe-na-maquina', 'Panturrilha', 'I', I],
  ['panturrilha-sentado', 'Panturrilha', 'I', I],
  ['panturrilha-no-leg-press', 'Panturrilha', 'I', I],
  ['abdominal-na-polia-ajoelhado', 'Abdômen', 'I', M],
  ['elevacao-de-pernas-na-barra-fixa', 'Abdômen', 'I', M],
  ['roda-abdominal', 'Abdômen', 'I', A],
  ['abdominal-crunch-solo', 'Abdômen', 'I', I],
  ['prancha', 'Abdômen', 'I', I],
  ['elevacao-de-pernas-deitado', 'Abdômen', 'I', I],
  ['extensao-lombar-banco-45', 'Lombar', 'I', I],
  ['superman-extensao-no-solo', 'Lombar', 'I', I],
  ['rosca-de-punho', 'Antebraço', 'I', I],
  ['rosca-inversa', 'Antebraço', 'I', I],
].map(([slug, group, type, minLevel]) => ({ slug, group, type, minLevel }));

// Aba Sessoes: [dias/semana, dia, sessão, grupo, tipo, nível mínimo, sexo ('Todos' | 'M' | 'F' | 'N')].
const SLOTS = [
  [3, 1, 'Corpo todo A', 'Quadríceps', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Peito', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Costas', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Ombros', 'C', I, 'Todos'],
  [3, 1, 'Corpo todo A', 'Peito', 'I', M, 'Todos'],
  [3, 1, 'Corpo todo A', 'Ombros', 'I', M, 'Todos'],
  [3, 1, 'Corpo todo A', 'Peito', 'I', I, 'M'],
  [3, 1, 'Corpo todo A', 'Ombros', 'I', I, 'F'],
  [3, 1, 'Corpo todo A', 'Bíceps', 'I', I, 'N'],
  [3, 1, 'Corpo todo A', 'Abdômen', 'I', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Posterior de coxa', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Glúteos', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Costas', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Costas', 'C', M, 'Todos'],
  [3, 2, 'Corpo todo B', 'Peito', 'C', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Quadríceps', 'I', M, 'Todos'],
  [3, 2, 'Corpo todo B', 'Tríceps', 'I', I, 'Todos'],
  [3, 2, 'Corpo todo B', 'Panturrilha', 'I', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Quadríceps', 'C', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Ombros', 'C', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Posterior de coxa', 'I', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Glúteos', 'C', I, 'Todos'],
  [3, 3, 'Corpo todo C', 'Posterior de coxa', 'C', M, 'Todos'],
  [3, 3, 'Corpo todo C', 'Glúteos', 'I', M, 'Todos'],
  [3, 3, 'Corpo todo C', 'Panturrilha', 'I', I, 'M'],
  [3, 3, 'Corpo todo C', 'Glúteos', 'I', I, 'F'],
  [3, 3, 'Corpo todo C', 'Abdômen', 'I', I, 'N'],
  [3, 3, 'Corpo todo C', 'Bíceps', 'I', I, 'Todos'],
  [4, 1, 'Superior A', 'Peito', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Costas', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Ombros', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Peito', 'I', M, 'Todos'],
  [4, 1, 'Superior A', 'Costas', 'C', M, 'Todos'],
  [4, 1, 'Superior A', 'Bíceps', 'I', M, 'Todos'],
  [4, 1, 'Superior A', 'Tríceps', 'I', M, 'Todos'],
  [4, 2, 'Inferior A', 'Quadríceps', 'C', M, 'Todos'],
  [4, 2, 'Inferior A', 'Posterior de coxa', 'C', M, 'Todos'],
  [4, 2, 'Inferior A', 'Glúteos', 'C', M, 'Todos'],
  [4, 2, 'Inferior A', 'Quadríceps', 'I', M, 'Todos'],
  [4, 2, 'Inferior A', 'Panturrilha', 'I', M, 'Todos'],
  [4, 2, 'Inferior A', 'Abdômen', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Costas', 'C', M, 'Todos'],
  [4, 3, 'Superior B', 'Peito', 'C', M, 'Todos'],
  [4, 3, 'Superior B', 'Ombros', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Ombros', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Bíceps', 'I', M, 'Todos'],
  [4, 3, 'Superior B', 'Peito', 'I', M, 'M'],
  [4, 3, 'Superior B', 'Ombros', 'I', M, 'F'],
  [4, 3, 'Superior B', 'Tríceps', 'I', M, 'N'],
  [4, 4, 'Inferior B', 'Quadríceps', 'C', M, 'Todos'],
  [4, 4, 'Inferior B', 'Posterior de coxa', 'C', M, 'Todos'],
  [4, 4, 'Inferior B', 'Glúteos', 'C', M, 'Todos'],
  [4, 4, 'Inferior B', 'Posterior de coxa', 'I', M, 'Todos'],
  [4, 4, 'Inferior B', 'Glúteos', 'I', M, 'Todos'],
  [4, 4, 'Inferior B', 'Panturrilha', 'I', M, 'Todos'],
  [4, 4, 'Inferior B', 'Panturrilha', 'I', M, 'M'],
  [4, 4, 'Inferior B', 'Glúteos', 'I', M, 'F'],
  [4, 4, 'Inferior B', 'Abdômen', 'I', M, 'N'],
  [5, 1, 'Empurrar (Push)', 'Peito', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Peito', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Ombros', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Peito', 'I', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Ombros', 'I', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Tríceps', 'C', A, 'Todos'],
  [5, 1, 'Empurrar (Push)', 'Tríceps', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'C', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'C', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'C', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Costas', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Ombros', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Bíceps', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Bíceps', 'I', A, 'Todos'],
  [5, 2, 'Puxar (Pull)', 'Antebraço', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Quadríceps', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Quadríceps', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Quadríceps', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Posterior de coxa', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Posterior de coxa', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Glúteos', 'C', A, 'Todos'],
  [5, 3, 'Pernas', 'Glúteos', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Panturrilha', 'I', A, 'Todos'],
  [5, 3, 'Pernas', 'Panturrilha', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Peito', 'C', A, 'Todos'],
  [5, 4, 'Superior', 'Costas', 'C', A, 'Todos'],
  [5, 4, 'Superior', 'Ombros', 'C', A, 'Todos'],
  [5, 4, 'Superior', 'Bíceps', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Tríceps', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Abdômen', 'I', A, 'Todos'],
  [5, 4, 'Superior', 'Peito', 'I', A, 'M'],
  [5, 4, 'Superior', 'Ombros', 'I', A, 'F'],
  [5, 4, 'Superior', 'Antebraço', 'I', A, 'N'],
  [5, 5, 'Inferior + Core', 'Quadríceps', 'C', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Posterior de coxa', 'C', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Glúteos', 'C', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Posterior de coxa', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Glúteos', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Abdômen', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Lombar', 'I', A, 'Todos'],
  [5, 5, 'Inferior + Core', 'Panturrilha', 'I', A, 'M'],
  [5, 5, 'Inferior + Core', 'Glúteos', 'I', A, 'F'],
  [5, 5, 'Inferior + Core', 'Abdômen', 'I', A, 'N'],
].map(([days, day, session, group, type, minLevel, sex]) => ({ days, day, session, group, type, minLevel, sex }));

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

// Aba Algoritmo, passos 1–9.
function generatePlan(input) {
  const basis = buildBasis(input);
  const main = basis.goals.map((g) => GOALS[g]).reduce((a, b) => (b.priority < a.priority ? b : a));
  const level = Math.min(LEVEL_NAMES.indexOf(basis.fitness_level), main.maxLevel);
  const days = Math.min(LEVELS[level].days, main.maxDays);

  const eligible = {};
  for (const ex of CATALOG) {
    if (ex.minLevel <= level) (eligible[`${ex.group}|${ex.type}`] ??= []).push(ex);
  }

  const used = {};
  const routines = new Map();
  for (const slot of SLOTS) {
    if (slot.days !== days || slot.minLevel > level) continue;
    if (slot.sex !== 'Todos' && slot.sex !== basis.gender) continue;
    const key = `${slot.group}|${slot.type}`;
    used[key] = (used[key] ?? 0) + 1;
    const ex = eligible[key]?.[used[key] - 1];
    if (!ex) continue; // acabaram as opções desse grupo+tipo no nível: descarta o slot

    if (!routines.has(slot.day)) {
      routines.set(slot.day, { name: `Dia ${slot.day} — ${slot.session}`, position: slot.day, exercises: [] });
    }
    const routine = routines.get(slot.day);
    routine.exercises.push({
      slug: ex.slug,
      position: routine.exercises.length + 1,
      reps_min: main.reps[0],
      reps_max: main.reps[1],
      rest_sec: main.rest[ex.type],
      set_count: LEVELS[level].sets,
    });
  }
  return { basis, routines: [...routines.values()] };
}

module.exports = { generatePlan, buildBasis, diffPlanBasis, CATALOG, SLOTS, GOALS, LEVEL_NAMES };
