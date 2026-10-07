import api from './api';

// Contrato de /workouts/* (spec docs/superpowers/specs/2026-09-30-workout-module-design.md).

export const MUSCLE_GROUPS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Quadríceps',
  'Posterior de coxa', 'Glúteos', 'Panturrilha', 'Abdômen', 'Lombar', 'Antebraço',
] as const;

export interface RoutineSummary {
  id: string;
  name: string;
  is_default: boolean;
  exercise_count: number;
  set_count: number;
  completed_recently: boolean; // treino feito nos últimos 7 dias → selo "Concluído"
}

export interface PlanSuggestion {
  has_suggestion: boolean;
  changed: string[]; // fitness_level | goals | gender
}

export interface RoutineList {
  routines: RoutineSummary[];
  next_routine_id: string | null;
  plan_suggestion: PlanSuggestion;
}

export interface RoutineExercise {
  id: string;
  exercise_id: string;
  name: string;
  muscle_group: string;
  position: number;
  reps_min: number;
  reps_max: number;
  rest_sec: number;
  sets: { set_number: number; weight_kg: number | null }[];
}

export interface RoutineDetail {
  id: string;
  name: string;
  is_default: boolean;
  exercises: RoutineExercise[];
}

export interface RoutineInput {
  name: string;
  exercises: {
    exercise_id: string;
    reps_min: number;
    reps_max: number;
    rest_sec: number;
    sets: { weight_kg: number | null }[];
  }[];
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  is_custom: boolean;
}

export interface ExerciseInput {
  name: string;
  muscle_group: string;
}

export interface SessionPayload {
  routine_id: string | null;
  started_at: string; // ISO
  duration_sec: number;
  sets: {
    exercise_id: string;
    position: number;
    set_number: number;
    duration_sec: number;
    rest_before_sec: number | null;
    weight_kg: number | null;
  }[];
}

export interface SessionDetail {
  id: string;
  title: string;
  start_time: string;
  duration_sec: number;
  sets: {
    id: string;
    exercise_name: string;
    position: number;
    set_number: number;
    duration_sec: number;
    rest_before_sec: number | null;
    weight_kg: number | null;
  }[];
}

// PUT /workouts/sessions/:id: só duração e carga, por id de série. Séries não listadas são apagadas; a data não muda.
export interface SessionEdit {
  duration_sec: number;
  sets: { id: string; duration_sec: number; weight_kg: number | null }[];
}

// PATCH /workouts/routines/:id/weights: série que não bate com a rotina atual (posição + exercício + nº) é ignorada.
export interface RoutineWeightUpdate {
  position: number;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
}

export const workoutsApi = {
  listRoutines: () => api.get<RoutineList>('/workouts/routines').then((r) => r.data),
  getRoutine: (id: string) => api.get<RoutineDetail>(`/workouts/routines/${id}`).then((r) => r.data),
  createRoutine: (body: RoutineInput) => api.post<RoutineDetail>('/workouts/routines', body).then((r) => r.data),
  updateRoutine: (id: string, body: RoutineInput) => api.put<RoutineDetail>(`/workouts/routines/${id}`, body).then((r) => r.data),
  deleteRoutine: (id: string) => api.delete(`/workouts/routines/${id}`),
  updateRoutineWeights: (id: string, sets: RoutineWeightUpdate[]) =>
    api.patch<{ updated: number }>(`/workouts/routines/${id}/weights`, { sets }).then((r) => r.data.updated),
  acceptPlan: () => api.post<RoutineList>('/workouts/plan/accept', {}).then((r) => r.data),
  dismissPlan: () => api.post('/workouts/plan/dismiss', {}),
  listExercises: () => api.get<{ exercises: Exercise[] }>('/workouts/exercises').then((r) => r.data.exercises),
  createExercise: (body: ExerciseInput) => api.post<Exercise>('/workouts/exercises', body).then((r) => r.data),
  updateExercise: (id: string, body: ExerciseInput) => api.put<Exercise>(`/workouts/exercises/${id}`, body).then((r) => r.data),
  deleteExercise: (id: string) => api.delete(`/workouts/exercises/${id}`),
  saveSession: (body: SessionPayload) => api.post<{ activity_id: string }>('/workouts/sessions', body).then((r) => r.data),
  getSession: (id: string) => api.get<SessionDetail>(`/workouts/sessions/${id}`).then((r) => r.data),
  updateSession: (id: string, body: SessionEdit) => api.put<{ activity_id: string }>(`/workouts/sessions/${id}`, body).then((r) => r.data),
  deleteSession: (id: string) => api.delete(`/workouts/sessions/${id}`),
};
