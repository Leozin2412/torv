import type { RoutineDetail, SessionDetail, SessionPayload } from '../services/workouts';

// Máquina de estados do treino em andamento. Pura (sem React nem I/O): o estado inteiro é o
// rascunho salvo no aparelho. Tempos saem de timestamps em ms, então continuam certos com a
// tela apagada ou o app em background.

export type Phase = 'ready' | 'set' | 'resting' | 'done';

export interface SessionExercise {
  exercise_id: string;
  name: string;
  muscle_group: string;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  weights: (number | null)[]; // carga atual de cada série (muda no treino com setWeight); length = nº de séries
  planned_weights: (number | null)[]; // carga da rotina no início do treino: base de weightChanges
}

export interface DoneSet {
  exercise_id: string;
  position: number; // ordem do exercício no treino (1..)
  set_number: number; // 1..
  duration_sec: number;
  rest_before_sec: number | null; // null na 1ª série do treino
  rest_target_sec: number | null; // alvo desse descanso; só pro resumo (não vai pro servidor)
  weight_kg: number | null; // carga com que a série foi feita; null = sem carga
}

export interface SessionState {
  routine_id: string;
  routine_name: string;
  exercises: SessionExercise[];
  started_at: number;
  finished_at: number | null;
  phase: Phase;
  phase_started_at: number;
  exercise_index: number; // exercício da série em andamento ou da próxima
  set_index: number;
  rest_target_sec: number | null; // rest_sec do exercício cuja série acabou de terminar
  pending_rest_sec: number | null; // descanso medido antes da série em andamento
  sets: DoneSet[];
}

// Tetos do POST /workouts/sessions: rascunho retomado horas depois não pode prender o envio.
export const MAX_TOTAL_SEC = 21600;
export const MAX_SET_SEC = 3600;
export const MAX_REST_SEC = 7200;
export const MAX_WEIGHT = 999.99;
export const WEIGHT_STEP = 2.5;

const secondsBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 1000));
const canSkip = (s: SessionState) => s.phase === 'ready' || s.phase === 'resting';

export function createSession(routine: RoutineDetail, now: number): SessionState {
  return {
    routine_id: routine.id,
    routine_name: routine.name,
    exercises: routine.exercises.map((e) => ({
      exercise_id: e.exercise_id,
      name: e.name,
      muscle_group: e.muscle_group,
      reps_min: e.reps_min,
      reps_max: e.reps_max,
      rest_sec: e.rest_sec,
      weights: e.sets.map((s) => s.weight_kg),
      planned_weights: e.sets.map((s) => s.weight_kg),
    })),
    started_at: now,
    finished_at: null,
    phase: 'ready',
    phase_started_at: now,
    exercise_index: 0,
    set_index: 0,
    rest_target_sec: null,
    pending_rest_sec: null,
    sets: [],
  };
}

// Próxima série depois de (e, s); null = não sobrou nenhuma.
function after(s: SessionState, e: number, set: number) {
  if (set + 1 < s.exercises[e].weights.length) return { exercise_index: e, set_index: set + 1 };
  if (e + 1 < s.exercises.length) return { exercise_index: e + 1, set_index: 0 };
  return null;
}

const done = (s: SessionState, now: number): SessionState =>
  ({ ...s, phase: 'done', finished_at: now, phase_started_at: now, pending_rest_sec: null });

// "Iniciar série" / "Acabou o descanso": fecha o descanso em curso.
export function startSet(s: SessionState, now: number): SessionState {
  if (!canSkip(s)) return s;
  return {
    ...s,
    phase: 'set',
    phase_started_at: now,
    pending_rest_sec: s.phase === 'resting' ? secondsBetween(s.phase_started_at, now) : null,
  };
}

// "Terminei a série": grava a série e abre o descanso contra o rest_sec deste exercício.
export function finishSet(s: SessionState, now: number): SessionState {
  if (s.phase !== 'set') return s;
  const ex = s.exercises[s.exercise_index];
  const sets = [...s.sets, {
    exercise_id: ex.exercise_id,
    position: s.exercise_index + 1,
    set_number: s.set_index + 1,
    duration_sec: secondsBetween(s.phase_started_at, now),
    rest_before_sec: s.pending_rest_sec,
    rest_target_sec: s.pending_rest_sec === null ? null : s.rest_target_sec,
    weight_kg: ex.weights[s.set_index] ?? null,
  }];
  const next = after(s, s.exercise_index, s.set_index);
  if (!next) return done({ ...s, sets }, now);
  return { ...s, ...next, sets, phase: 'resting', phase_started_at: now, rest_target_sec: ex.rest_sec, pending_rest_sec: null };
}

// Pula a próxima série sem gravar; o descanso continua contando.
export function skipSet(s: SessionState, now: number): SessionState {
  if (!canSkip(s)) return s;
  const next = after(s, s.exercise_index, s.set_index);
  return next ? { ...s, ...next } : done(s, now);
}

// Pula as séries restantes do exercício atual.
export function skipExercise(s: SessionState, now: number): SessionState {
  if (!canSkip(s)) return s;
  const e = s.exercise_index + 1;
  return e < s.exercises.length ? { ...s, exercise_index: e, set_index: 0 } : done(s, now);
}

// Carga da série atual (a em andamento ou, no descanso, a próxima). Só ela muda: as seguintes continuam
// com a carga da rotina. Limita a 0–999,99 com 2 casas; NaN (texto inválido) não muda nada.
export function setWeight(s: SessionState, kg: number | null): SessionState {
  if (s.phase === 'done' || Number.isNaN(kg)) return s;
  const value = kg === null ? null : Math.round(Math.min(MAX_WEIGHT, Math.max(0, kg)) * 100) / 100;
  const ex = s.exercises[s.exercise_index];
  if (ex.weights[s.set_index] === value) return s;
  const weights = ex.weights.map((w, i) => (i === s.set_index ? value : w));
  return { ...s, exercises: s.exercises.map((e, i) => (i === s.exercise_index ? { ...e, weights } : e)) };
}

// Botões −/+ (passo de 2,5 kg): de 2,5 o "−" vai para sem carga (null); de sem carga o "+" vai para 2,5.
export function stepWeight(kg: number | null, dir: 1 | -1): number | null {
  if (kg === null) return dir > 0 ? WEIGHT_STEP : null;
  const next = Math.round((kg + dir * WEIGHT_STEP) * 100) / 100;
  return next <= 0 ? null : Math.min(MAX_WEIGHT, next);
}

// "7,5 kg"; null = "Sem carga".
export const formatWeight = (kg: number | null) => (kg === null ? 'Sem carga' : `${String(kg).replace('.', ',')} kg`);

// "Finalizar treino": série em andamento conta como feita.
export function finish(s: SessionState, now: number): SessionState {
  if (s.phase === 'done') return s;
  const closed = s.phase === 'set' ? finishSet(s, now) : s;
  return closed.phase === 'done' ? closed : done(closed, now);
}

export const totalElapsedSec = (s: SessionState, now: number) => secondsBetween(s.started_at, s.finished_at ?? now);
export const phaseElapsedSec = (s: SessionState, now: number) => secondsBetween(s.phase_started_at, now);
export const isRestOverdue = (s: SessionState, now: number) =>
  s.phase === 'resting' && s.rest_target_sec !== null && phaseElapsedSec(s, now) > s.rest_target_sec;

export function toSessionPayload(s: SessionState): SessionPayload {
  return {
    routine_id: s.routine_id,
    started_at: new Date(s.started_at).toISOString(),
    duration_sec: Math.min(Math.max(totalElapsedSec(s, s.finished_at ?? s.started_at), 1), MAX_TOTAL_SEC),
    sets: s.sets.map((set) => ({
      exercise_id: set.exercise_id,
      position: set.position,
      set_number: set.set_number,
      duration_sec: Math.min(set.duration_sec, MAX_SET_SEC),
      rest_before_sec: set.rest_before_sec === null ? null : Math.min(set.rest_before_sec, MAX_REST_SEC),
      weight_kg: set.weight_kg,
    })),
  };
}

// Rascunho gravado antes da carga por série: sem planned_weights (vira a carga atual) e séries sem weight_kg.
export const upgradeState = (s: SessionState): SessionState => ({
  ...s,
  exercises: s.exercises.map((e) => ({ ...e, planned_weights: e.planned_weights ?? e.weights })),
  sets: s.sets.map((set) => ({ ...set, weight_kg: set.weight_kg ?? null })),
});

export interface WeightChange {
  position: number;
  exercise_id: string;
  set_number: number;
  name: string;
  from: number | null; // carga da rotina no início do treino
  to: number | null; // carga feita
}

// Séries feitas com carga diferente da que a rotina tinha no início do treino (pulada não conta).
export function weightChanges(s: SessionState): WeightChange[] {
  if (!s.routine_id) return [];
  return s.sets.flatMap((set) => {
    const ex = s.exercises[set.position - 1];
    const from = ex.planned_weights[set.set_number - 1] ?? null;
    if (set.weight_kg === from) return [];
    return [{ position: set.position, exercise_id: set.exercise_id, set_number: set.set_number, name: ex.name, from, to: set.weight_kg }];
  });
}

// Modelo único do resumo: treino recém-finalizado (rascunho) ou do histórico (servidor).
export interface SummaryView {
  title: string;
  total_sec: number;
  set_count: number;
  avg_rest_sec: number | null;
  groups: {
    name: string;
    sets: { set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean; weight_kg: number | null }[];
  }[];
}

function buildSummary(
  title: string,
  total_sec: number,
  sets: { position: number; name: string; set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean; weight_kg: number | null }[],
): SummaryView {
  const rests = sets.map((s) => s.rest_before_sec).filter((r): r is number => r !== null);
  const groups: SummaryView['groups'] = [];
  let lastPosition = -1;
  for (const { position, name, ...set } of sets) {
    if (position !== lastPosition) groups.push({ name, sets: [] });
    groups[groups.length - 1].sets.push(set);
    lastPosition = position;
  }
  return {
    title,
    total_sec,
    set_count: sets.length,
    avg_rest_sec: rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : null,
    groups,
  };
}

export const summaryFromState = (s: SessionState) =>
  buildSummary(s.routine_name, toSessionPayload(s).duration_sec, s.sets.map((set) => ({
    position: set.position,
    name: s.exercises[set.position - 1].name,
    set_number: set.set_number,
    duration_sec: set.duration_sec,
    rest_before_sec: set.rest_before_sec,
    overdue: set.rest_before_sec !== null && set.rest_target_sec !== null && set.rest_before_sec > set.rest_target_sec,
    weight_kg: set.weight_kg,
  })));

// Histórico não guarda o alvo do descanso: nada fica em vermelho.
export const summaryFromDetail = (d: SessionDetail) =>
  buildSummary(d.title, d.duration_sec, d.sets.map((set) => ({
    position: set.position,
    name: set.exercise_name,
    set_number: set.set_number,
    duration_sec: set.duration_sec,
    rest_before_sec: set.rest_before_sec,
    overdue: false,
    weight_kg: set.weight_kg ?? null, // treino anterior à carga por série: null
  })));
