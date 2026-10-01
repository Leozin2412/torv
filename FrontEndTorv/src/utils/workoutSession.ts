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
  weights: (number | null)[]; // carga de cada série; length = nº de séries
}

export interface DoneSet {
  exercise_id: string;
  position: number; // ordem do exercício no treino (1..)
  set_number: number; // 1..
  duration_sec: number;
  rest_before_sec: number | null; // null na 1ª série do treino
  rest_target_sec: number | null; // alvo desse descanso; só pro resumo (não vai pro servidor)
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
    })),
  };
}

// Modelo único do resumo: treino recém-finalizado (rascunho) ou do histórico (servidor).
export interface SummaryView {
  title: string;
  total_sec: number;
  set_count: number;
  avg_rest_sec: number | null;
  groups: {
    name: string;
    sets: { set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean }[];
  }[];
}

function buildSummary(
  title: string,
  total_sec: number,
  sets: { position: number; name: string; set_number: number; duration_sec: number; rest_before_sec: number | null; overdue: boolean }[],
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
  })));
