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
  if (sameNumbers) {
    // Os dados mudaram mas caem na mesma meta arredondada: recarimba o basis pra próxima
    // mudança não ser atribuída ao que já foi visto (ex: modal dizer "seu objetivo mudou" à toa).
    await dietRepository.updateTargetsBasis(userId, calc.basis);
    return { has_suggestion: false };
  }

  return { has_suggestion: true, current, suggested, warnings: calc.warnings, changed };
}

module.exports = { computeForUser, ensureTargets, buildSuggestion, pickTargets };
