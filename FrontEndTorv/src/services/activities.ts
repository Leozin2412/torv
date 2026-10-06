import api from './api';

// Contrato de GET /activities (spec docs/superpowers/specs/2026-10-01-workout-history-design.md).
export const ACTIVITY_TYPES = ['STRENGTH'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  start_time: string; // ISO
  duration_sec: number;
  set_count: number;
}

export interface ActivityPage {
  activities: ActivityItem[];
  next_before: string | null; // mandar como `before` para a próxima página; null = acabou
}

export interface ActivityQuery {
  type?: ActivityType;
  from?: string; // ISO, inclusivo
  before?: string; // ISO, exclusivo (fim do período ou next_before)
  limit?: number;
}

// Contrato de GET /activities/summary. date = dia LOCAL (AAAA-MM-DD); tz_offset_min = -getTimezoneOffset().
export interface ActivitySummary {
  streak_days: number;
  calories_burned: number;
}

export interface ActivitySummaryQuery {
  date: string;
  tz_offset_min: number;
}

export const activitiesApi = {
  list: (query: ActivityQuery = {}) => api.get<ActivityPage>('/activities', { params: query }).then((r) => r.data),
  summary: (query: ActivitySummaryQuery) =>
    api.get<ActivitySummary>('/activities/summary', { params: query }).then((r) => r.data),
};
