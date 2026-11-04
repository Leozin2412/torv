import api from './api';
import type { GpsPoint } from '../utils/gpx';

// Contrato de /activities/gps (spec docs/superpowers/specs/2026-10-14-gpx-import-design.md).
export type GpsType = 'RUN' | 'WALK';

export interface GpsSplit {
  km: number;
  distance_m: number;
  duration_sec: number;
}

export interface GpsMetrics {
  activity_type: GpsType;
  start_time: string;
  distance_m: number;
  duration_sec: number; // em movimento
  elapsed_sec: number;
  pace_sec_per_km: number | null;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence: number | null; // passos/min
  calories: number | null; // null sem peso cadastrado
  splits: GpsSplit[];
  route: [number, number][];
}

export interface GpsActivityDetail extends GpsMetrics {
  id: string;
  title: string;
  routine_id: string | null;
}

export interface GpsUpload {
  activity_type: GpsType;
  start_time: string;
  points: GpsPoint[];
}

export const gpsApi = {
  preview: (body: GpsUpload) => api.post<GpsMetrics>('/activities/gps/preview', body).then((r) => r.data),
  create: (body: GpsUpload & { routine_id: string; title?: string }) =>
    api.post<GpsActivityDetail>('/activities/gps', body).then((r) => r.data),
  get: (id: string) => api.get<GpsActivityDetail>(`/activities/gps/${id}`).then((r) => r.data),
  rename: (id: string, title: string) => api.patch<GpsActivityDetail>(`/activities/gps/${id}`, { title }).then((r) => r.data),
  remove: (id: string) => api.delete(`/activities/gps/${id}`),
};
