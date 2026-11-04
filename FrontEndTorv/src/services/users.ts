import api from './api';
import type { ActivityPage } from './activities';
import { toISODate } from '../utils/date';

// Contrato de /users/:id/* (spec docs/superpowers/specs/2026-10-14-member-profile-design.md).
export interface MemberProfileData {
  user: { id: string; name: string; username: string; photo_url: string | null; fitness_level: string | null };
  is_me: boolean;
  streak: { current: number; longest: number };
  month: { active_days: number; activities: number; active_days_delta: number };
  total_activities: number;
  calendar: { start: string; end: string; days: { date: string; count: number }[] };
}

// Dia LOCAL do aparelho (AAAA-MM-DD) e o fuso, como a Home manda para /activities/summary.
export interface LocalDayQuery {
  date: string;
  tz_offset_min: number;
}

export const localDayQuery = (now = new Date()): LocalDayQuery => ({ date: toISODate(now), tz_offset_min: -now.getTimezoneOffset() });

export const usersApi = {
  profile: (id: string, query: LocalDayQuery) =>
    api.get<MemberProfileData>(`/users/${id}/profile`, { params: query }).then((r) => r.data),
  activities: (id: string, query: { before?: string; limit?: number } = {}) =>
    api.get<ActivityPage>(`/users/${id}/activities`, { params: query }).then((r) => r.data),
};
