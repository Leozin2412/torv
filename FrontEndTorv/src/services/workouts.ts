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

export const workoutsApi = {
  listRoutines: () => api.get<RoutineList>('/workouts/routines').then((r) => r.data),
  getRoutine: (id: string) => api.get<RoutineDetail>(`/workouts/routines/${id}`).then((r) => r.data),
  createRoutine: (body: RoutineInput) => api.post<RoutineDetail>('/workouts/routines', body).then((r) => r.data),
  updateRoutine: (id: string, body: RoutineInput) => api.put<RoutineDetail>(`/workouts/routines/${id}`, body).then((r) => r.data),
  deleteRoutine: (id: string) => api.delete(`/workouts/routines/${id}`),
  acceptPlan: () => api.post<RoutineList>('/workouts/plan/accept', {}).then((r) => r.data),
  dismissPlan: () => api.post('/workouts/plan/dismiss', {}),
  listExercises: () => api.get<{ exercises: Exercise[] }>('/workouts/exercises').then((r) => r.data.exercises),
  createExercise: (body: ExerciseInput) => api.post<Exercise>('/workouts/exercises', body).then((r) => r.data),
  updateExercise: (id: string, body: ExerciseInput) => api.put<Exercise>(`/workouts/exercises/${id}`, body).then((r) => r.data),
  deleteExercise: (id: string) => api.delete(`/workouts/exercises/${id}`),
};
