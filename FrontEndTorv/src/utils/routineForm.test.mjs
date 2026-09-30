// Roda com: node --test src/utils/routineForm.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { formFromDetail, newFormExercise, clampRest, moveItem, parseWeight, buildRoutineInput } from './routineForm.ts';

const supino = { id: 'e1', name: 'Supino', muscle_group: 'Peito', is_custom: false };

test('newFormExercise: 3 séries vazias, 8–12, 60s; chaves únicas', () => {
  const a = newFormExercise(supino);
  const b = newFormExercise(supino);
  assert.deepEqual([a.reps_min, a.reps_max, a.rest_sec, a.weights], ['8', '12', 60, ['', '', '']]);
  assert.notEqual(a.key, b.key);
});

test('formFromDetail converte números em texto e null em vazio', () => {
  const [ex] = formFromDetail({
    id: 'r', name: 'R', is_default: false,
    exercises: [{ id: 're', exercise_id: 'e1', name: 'Supino', muscle_group: 'Peito', position: 1, reps_min: 6, reps_max: 10, rest_sec: 90, sets: [{ set_number: 1, weight_kg: 42.5 }, { set_number: 2, weight_kg: null }] }],
  });
  assert.deepEqual([ex.reps_min, ex.reps_max, ex.rest_sec, ex.weights], ['6', '10', 90, ['42.5', '']]);
});

test('parseWeight aceita vírgula, vazio vira null e lixo vira NaN', () => {
  assert.equal(parseWeight(''), null);
  assert.equal(parseWeight('  '), null);
  assert.equal(parseWeight('40,5'), 40.5);
  assert.equal(parseWeight('100'), 100);
  assert.ok(Number.isNaN(parseWeight('-1')));
  assert.ok(Number.isNaN(parseWeight('1.234')));
  assert.ok(Number.isNaN(parseWeight('abc')));
});

test('clampRest e moveItem', () => {
  assert.equal(clampRest(-15), 0);
  assert.equal(clampRest(615), 600);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
});

test('buildRoutineInput monta o corpo com nome aparado e cargas numéricas', () => {
  const ex = { ...newFormExercise(supino), weights: ['40,5', '', '42'] };
  assert.deepEqual(buildRoutineInput('  Peito  ', [ex]), {
    body: { name: 'Peito', exercises: [{ exercise_id: 'e1', reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ weight_kg: 40.5 }, { weight_kg: null }, { weight_kg: 42 }] }] },
  });
});

test('buildRoutineInput: erros de nome, lista e campos', () => {
  const ex = newFormExercise(supino);
  assert.deepEqual(buildRoutineInput('  ', [ex]), { error: 'Dê um nome para a rotina.' });
  assert.deepEqual(buildRoutineInput('x'.repeat(101), [ex]), { error: 'O nome pode ter no máximo 100 caracteres.' });
  assert.deepEqual(buildRoutineInput('A', []), { error: 'Adicione pelo menos um exercício.' });
  assert.deepEqual(buildRoutineInput('A', Array(21).fill(ex)), { error: 'Máximo de 20 exercícios por rotina.' });
  for (const bad of [{ reps_min: '0' }, { reps_max: '101' }, { reps_min: '13' }, { reps_min: '' }, { reps_min: '8.5' }]) {
    assert.match(buildRoutineInput('A', [{ ...ex, ...bad }]).error, /repetições/);
  }
  for (const w of ['1000', 'abc', '-5']) {
    assert.match(buildRoutineInput('A', [{ ...ex, weights: [w] }]).error, /carga/);
  }
});
