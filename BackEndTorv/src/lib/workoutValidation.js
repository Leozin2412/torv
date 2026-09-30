// Regras que o schema TypeBox não expressa (faixas e tamanhos ficam em routes/workout.schemas.js).
// Cada função devolve a mensagem de erro (400) ou null.

const MIN_SESSION_START = Date.parse('2026-01-01T00:00:00Z');
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

function checkRoutineBody(body) {
  if (!body.name.trim()) return 'name must not be blank';
  const i = body.exercises.findIndex((e) => e.reps_min > e.reps_max);
  if (i !== -1) return `exercises[${i}]: reps_min must be <= reps_max`;
  return null;
}

function checkExerciseBody(body) {
  return body.name.trim() ? null : 'name must not be blank';
}

function checkSessionBody(body, now = Date.now()) {
  const startedAt = Date.parse(body.started_at);
  if (!(startedAt >= MIN_SESSION_START)) return 'started_at must be on or after 2026-01-01';
  if (startedAt > now + FUTURE_TOLERANCE_MS) return 'started_at must not be in the future';
  return null;
}

module.exports = { checkRoutineBody, checkExerciseBody, checkSessionBody };
