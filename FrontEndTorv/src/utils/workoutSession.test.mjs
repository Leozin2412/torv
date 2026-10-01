// Roda com: node --test src/utils/workoutSession.test.mjs (Node 24 remove os tipos do .ts sozinho).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession, startSet, finishSet, skipSet, skipExercise, finish,
  totalElapsedSec, phaseElapsedSec, isRestOverdue, toSessionPayload,
  summaryFromState, summaryFromDetail,
} from './workoutSession.ts';

const T0 = Date.parse('2026-09-30T10:00:00Z');
const at = (sec) => T0 + sec * 1000;

const routine = {
  id: 'r1',
  name: 'Dia 1 — Corpo todo A',
  is_default: true,
  exercises: [
    { id: 're1', exercise_id: 'e1', name: 'Supino', muscle_group: 'Peito', position: 1, reps_min: 8, reps_max: 12, rest_sec: 120, sets: [{ set_number: 1, weight_kg: 40 }, { set_number: 2, weight_kg: null }] },
    { id: 're2', exercise_id: 'e2', name: 'Remada', muscle_group: 'Costas', position: 2, reps_min: 8, reps_max: 12, rest_sec: 60, sets: [{ set_number: 1, weight_kg: null }] },
  ],
};

test('createSession copia a rotina e começa em ready', () => {
  const s = createSession(routine, T0);
  assert.equal(s.phase, 'ready');
  assert.deepEqual(s.exercises[0].weights, [40, null]);
  assert.equal(s.started_at, T0);
  assert.deepEqual([s.exercise_index, s.set_index], [0, 0]);
});

test('fluxo completo: série → descanso → série, com tempos e alvo do descanso', () => {
  let s = createSession(routine, T0);
  s = startSet(s, at(5));
  assert.equal(s.phase, 'set');
  assert.equal(s.pending_rest_sec, null); // 1ª série: sem descanso antes

  s = finishSet(s, at(45));
  assert.equal(s.phase, 'resting');
  assert.equal(s.rest_target_sec, 120);
  assert.deepEqual([s.exercise_index, s.set_index], [0, 1]);
  assert.deepEqual(s.sets[0], { exercise_id: 'e1', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null, rest_target_sec: null });

  assert.equal(isRestOverdue(s, at(165)), false); // 120s exatos: ainda não estourou
  assert.equal(isRestOverdue(s, at(166)), true);
  assert.equal(phaseElapsedSec(s, at(166)), 121);

  s = startSet(s, at(225)); // descansou 180s (alvo 120)
  assert.equal(s.pending_rest_sec, 180);
  assert.equal(isRestOverdue(s, at(300)), false); // em série: nunca vermelho
  s = finishSet(s, at(260));
  assert.deepEqual(s.sets[1], { exercise_id: 'e1', position: 1, set_number: 2, duration_sec: 35, rest_before_sec: 180, rest_target_sec: 120 });

  // Último exercício de um: descanso conta contra o rest_sec do Supino (acabou de terminar).
  assert.equal(s.rest_target_sec, 120);
  assert.deepEqual([s.exercise_index, s.set_index], [1, 0]);
  s = startSet(s, at(320));
  s = finishSet(s, at(350));
  assert.equal(s.phase, 'done');
  assert.equal(s.finished_at, at(350));
  assert.equal(totalElapsedSec(s, at(9999)), 350); // congela no fim
});

test('ações fora de hora não mudam o estado', () => {
  const ready = createSession(routine, T0);
  assert.equal(finishSet(ready, at(1)), ready);
  const inSet = startSet(ready, at(1));
  assert.equal(startSet(inSet, at(2)), inSet);
  assert.equal(skipSet(inSet, at(2)), inSet);
  assert.equal(skipExercise(inSet, at(2)), inSet);
});

test('skipSet e skipExercise não gravam série e mantêm o descanso correndo', () => {
  let s = finishSet(startSet(createSession(routine, T0), at(0)), at(30));
  const restStart = s.phase_started_at;
  s = skipSet(s, at(40));
  assert.deepEqual([s.exercise_index, s.set_index], [1, 0]);
  assert.equal(s.phase, 'resting');
  assert.equal(s.phase_started_at, restStart);
  assert.equal(s.sets.length, 1);
  s = skipExercise(s, at(50));
  assert.equal(s.phase, 'done');
  assert.equal(s.finished_at, at(50));
});

test('finish no meio da série grava a série; em ready só fecha', () => {
  const inSet = startSet(createSession(routine, T0), at(10));
  const s = finish(inSet, at(40));
  assert.equal(s.phase, 'done');
  assert.equal(s.sets.length, 1);
  assert.equal(s.sets[0].duration_sec, 30);
  const empty = finish(createSession(routine, T0), at(5));
  assert.equal(empty.phase, 'done');
  assert.equal(empty.sets.length, 0);
});

test('toSessionPayload limita aos tetos do backend e tira rest_target_sec', () => {
  let s = startSet(createSession(routine, T0), at(0));
  s = finishSet(s, at(4000)); // série de 4000s
  s = startSet(s, at(4000 + 8000)); // descanso de 8000s
  s = finish(s, at(30000));
  const p = toSessionPayload(s);
  assert.equal(p.routine_id, 'r1');
  assert.equal(p.started_at, '2026-09-30T10:00:00.000Z');
  assert.equal(p.duration_sec, 21600);
  assert.equal(p.sets[0].duration_sec, 3600);
  assert.equal(p.sets[1].rest_before_sec, 7200);
  assert.equal('rest_target_sec' in p.sets[0], false);
});

test('resumo: agrupa por exercício, média de descanso e vermelho só no ao vivo', () => {
  let s = createSession(routine, T0);
  s = finishSet(startSet(s, at(0)), at(40));
  s = finishSet(startSet(s, at(220)), at(260)); // descanso 180 > 120
  s = finishSet(startSet(s, at(300)), at(330)); // descanso 40 < 120
  const live = summaryFromState(s);
  assert.equal(live.title, 'Dia 1 — Corpo todo A');
  assert.equal(live.total_sec, 330);
  assert.equal(live.set_count, 3);
  assert.equal(live.avg_rest_sec, 110);
  assert.deepEqual(live.groups.map((g) => g.name), ['Supino', 'Remada']);
  assert.deepEqual(live.groups[0].sets.map((x) => x.overdue), [false, true]);
  assert.equal(live.groups[1].sets[0].overdue, false);

  const history = summaryFromDetail({
    id: 'a1', title: 'Treino livre', start_time: '2026-09-30T10:00:00.000Z', duration_sec: 330,
    sets: [
      { exercise_name: 'Exercício removido', position: 1, set_number: 1, duration_sec: 40, rest_before_sec: null },
      { exercise_name: 'Exercício removido', position: 1, set_number: 2, duration_sec: 40, rest_before_sec: 500 },
    ],
  });
  assert.equal(history.groups.length, 1);
  assert.equal(history.groups[0].sets[1].overdue, false);
  assert.equal(history.avg_rest_sec, 500);
});
