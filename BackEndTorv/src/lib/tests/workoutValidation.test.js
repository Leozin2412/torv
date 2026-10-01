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

test('checkSessionBody: started_at entre 2026-01-01 e agora + 5 min', () => {
  const now = Date.parse('2026-09-30T12:00:00Z');
  assert.equal(checkSessionBody({ started_at: '2026-09-30T11:00:00Z' }, now), null);
  assert.equal(checkSessionBody({ started_at: '2026-01-01T00:00:00Z' }, now), null);
  assert.equal(checkSessionBody({ started_at: '2025-12-31T23:59:59Z' }, now), 'started_at must be on or after 2026-01-01');
  assert.equal(checkSessionBody({ started_at: '2026-09-30T12:05:00Z' }, now), null);
  assert.equal(checkSessionBody({ started_at: '2026-09-30T12:05:01Z' }, now), 'started_at must not be in the future');
  assert.equal(checkSessionBody({ started_at: 'lixo' }, now), 'started_at must be on or after 2026-01-01');
});
