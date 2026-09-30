import type { Exercise, RoutineDetail, RoutineInput } from '../services/workouts';

// Estado do editor de rotina (texto cru dos inputs) e conversão pro corpo do POST/PUT /workouts/routines.
// Mesmos limites do backend.

export interface FormExercise {
  key: string; // chave local: o mesmo exercício pode entrar 2x na rotina
  exercise_id: string;
  name: string;
  muscle_group: string;
  reps_min: string;
  reps_max: string;
  rest_sec: number;
  weights: string[]; // uma por série; '' = sem carga
}

export const LIMITS = { name: 100, exercises: 20, sets: 10, reps: 100, rest: 600, restStep: 15, weight: 999.99 };

let seq = 0;
const nextKey = () => `k${++seq}`;

export const formFromDetail = (d: RoutineDetail): FormExercise[] => d.exercises.map((e) => ({
  key: nextKey(),
  exercise_id: e.exercise_id,
  name: e.name,
  muscle_group: e.muscle_group,
  reps_min: String(e.reps_min),
  reps_max: String(e.reps_max),
  rest_sec: e.rest_sec,
  weights: e.sets.map((s) => (s.weight_kg === null ? '' : String(s.weight_kg))),
}));

// Padrão ao adicionar: 3 séries sem carga, 8–12 reps, 60s de descanso.
export const newFormExercise = (e: Exercise): FormExercise => ({
  key: nextKey(),
  exercise_id: e.id,
  name: e.name,
  muscle_group: e.muscle_group,
  reps_min: '8',
  reps_max: '12',
  rest_sec: 60,
  weights: ['', '', ''],
});

export const clampRest = (sec: number) => Math.min(LIMITS.rest, Math.max(0, sec));

export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

// '' → null (sem carga); "40,5" → 40.5; qualquer outra coisa → NaN.
export function parseWeight(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}

const parseReps = (text: string) => (/^\d+$/.test(text.trim()) ? Number(text) : NaN);

export function buildRoutineInput(name: string, items: FormExercise[]): { error: string } | { body: RoutineInput } {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Dê um nome para a rotina.' };
  if (trimmed.length > LIMITS.name) return { error: 'O nome pode ter no máximo 100 caracteres.' };
  if (items.length === 0) return { error: 'Adicione pelo menos um exercício.' };
  if (items.length > LIMITS.exercises) return { error: 'Máximo de 20 exercícios por rotina.' };

  const exercises: RoutineInput['exercises'] = [];
  for (const it of items) {
    const min = parseReps(it.reps_min);
    const max = parseReps(it.reps_max);
    if (!(min >= 1 && max <= LIMITS.reps && min <= max)) return { error: `${it.name}: repetições de 1 a 100, com mínimo ≤ máximo.` };
    const weights = it.weights.map(parseWeight);
    if (weights.some((w) => w !== null && !(w >= 0 && w <= LIMITS.weight))) return { error: `${it.name}: carga entre 0 e 999,99 kg.` };
    exercises.push({ exercise_id: it.exercise_id, reps_min: min, reps_max: max, rest_sec: it.rest_sec, sets: weights.map((weight_kg) => ({ weight_kg })) });
  }
  return { body: { name: trimmed, exercises } };
}
