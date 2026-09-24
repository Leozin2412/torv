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
