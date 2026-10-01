import type { ActivityType } from '../services/activities';

// Rótulo de cada tipo no app. Tipo novo: uma linha aqui + o enum do backend (activities.routes.js).
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  STRENGTH: 'Musculação',
};

export const activityLabel = (type: string) => ACTIVITY_LABELS[type as ActivityType] ?? type;
