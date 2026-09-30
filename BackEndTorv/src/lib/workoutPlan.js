const workoutRepository = require('../repository/workout.repository');
const { generatePlan, buildBasis, diffPlanBasis } = require('./workoutGenerator');

// Gera o plano default só quando nunca foi gerado (workout_plan_basis NULL). Apagar as rotinas
// não recria. Corrida entre requests (Home e Treinos juntas): o UPDATE condicional do savePlan decide.
async function ensureDefaultPlan(userId) {
  const inputs = await workoutRepository.getPlanInputs(userId);
  if (!inputs || inputs.savedBasis) return inputs;
  const { basis, routines } = generatePlan(inputs);
  await workoutRepository.savePlan(userId, basis, routines, 'create');
  return { ...inputs, savedBasis: basis };
}

function planSuggestion(inputs) {
  if (!inputs?.savedBasis) return { has_suggestion: false, changed: [] };
  const changed = diffPlanBasis(inputs.savedBasis, buildBasis(inputs));
  return { has_suggestion: changed.length > 0, changed };
}

// Sem sugestão pendente (ou clique duplo) o savePlan 'replace' não faz nada.
async function acceptPlan(userId) {
  const inputs = await workoutRepository.getPlanInputs(userId);
  if (!inputs) return;
  const { basis, routines } = generatePlan(inputs);
  await workoutRepository.savePlan(userId, basis, routines, 'replace');
}

async function dismissPlan(userId) {
  const inputs = await workoutRepository.getPlanInputs(userId);
  if (inputs) await workoutRepository.setPlanBasis(userId, buildBasis(inputs));
}

// A rotina seguinte à do último treino, voltando ao início; sem histórico ou rotina apagada → a primeira.
function nextRoutineId(routines, lastRoutineId) {
  if (routines.length === 0) return null;
  const i = routines.findIndex((r) => r.id === lastRoutineId);
  return routines[(i + 1) % routines.length].id;
}

module.exports = { ensureDefaultPlan, planSuggestion, acceptPlan, dismissPlan, nextRoutineId };
