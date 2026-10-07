const test = require('node:test');
const assert = require('node:assert/strict');
const { checkRoutineBody, checkExerciseBody, checkSessionBody } = require('../workoutValidation');

const exercise = (over = {}) => ({ exercise_id: 'x', reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ weight_kg: null }], ...over });

test('checkRoutineBody: nome em branco e reps_min > reps_max', () => {
  assert.equal(checkRoutineBody({ name: 'Peito', exercises: [exercise()] }), null);
  assert.equal(checkRoutineBody({ name: '   ', exercises: [exercise()] }), 'name must not be blank');
  assert.equal(checkRoutineBody({ name: 'A', exercises: [exercise(), exercise({ reps_min: 13 })] }), 'exercises[1]: reps_min must be <= reps_max');
  assert.equal(checkRoutineBody({ name: 'A', exercises: [exercise({ reps_min: 12, reps_max: 12 })] }), null);
});

test('checkExerciseBody: nome em branco', () => {
  assert.equal(checkExerciseBody({ name: 'Remada', muscle_group: 'Costas' }), null);
  assert.equal(checkExerciseBody({ name: ' \t ', muscle_group: 'Costas' }), 'name must not be blank');
});

// duration_sec fica em 0 onde o teste e so sobre started_at: o termino (started_at + duracao) nao interfere.
const body = (started_at, duration_sec = 0) => ({ started_at, duration_sec });

test('checkSessionBody: started_at entre 2026-01-01, agora - 72 h e agora + 5 min', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  assert.equal(checkSessionBody(body('2026-09-30T11:00:00Z'), now), null);
  assert.equal(checkSessionBody(body('2026-09-30T12:05:00Z'), now), null);
  assert.equal(checkSessionBody(body('2026-09-30T12:05:01Z'), now), 'started_at must not be in the future');
  assert.equal(checkSessionBody(body('2025-12-31T23:59:59Z'), now), 'started_at must be on or after 2026-01-01');
  assert.equal(checkSessionBody(body('lixo'), now), 'started_at must be on or after 2026-01-01');
  // o piso de 2026-01-01 continua valendo quando a janela de 72 h o alcanca
  const early = Date.parse('2026-01-02T00:00:00Z');
  assert.equal(checkSessionBody(body('2026-01-01T00:00:00Z'), early), null);
  assert.equal(checkSessionBody(body('2025-12-31T23:59:59Z'), early), 'started_at must be on or after 2026-01-01');
});

test('checkSessionBody: janela de backdating de 72 h (limite inclusivo)', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  const MSG = 'started_at must be within the last 72 hours';
  assert.equal(checkSessionBody(body('2026-09-27T12:00:00Z'), now), null); // exatamente 72 h
  assert.equal(checkSessionBody(body('2026-09-27T12:00:00.001Z'), now), null);
  assert.equal(checkSessionBody(body('2026-09-27T11:59:59.999Z'), now), MSG); // 1 ms alem
  assert.equal(checkSessionBody(body('2026-09-20T12:00:00Z'), now), MSG);
});

test('checkSessionBody: o treino nao pode terminar no futuro (tolerancia de 5 min)', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  const MSG = 'workout must not end in the future';
  // o app envia ao concluir: comeco + duracao ~ agora, e isso passa
  assert.equal(checkSessionBody(body('2026-09-30T11:00:00Z', 3600), now), null);
  assert.equal(checkSessionBody(body('2026-09-30T11:00:00Z', 3600 + 300), now), null); // termina em agora + 5 min
  assert.equal(checkSessionBody(body('2026-09-30T11:00:00Z', 3600 + 301), now), MSG);
  assert.equal(checkSessionBody(body('2026-09-30T12:05:00Z', 1), now), MSG); // comeco ainda na tolerancia, mas termina depois dela
  assert.equal(checkSessionBody(body('2026-09-30T11:55:00Z', 21600), now), MSG);
  assert.equal(checkSessionBody({ started_at: '2026-09-30T11:00:00Z' }, now), MSG); // sem duracao: recusa, nao deixa passar
});
