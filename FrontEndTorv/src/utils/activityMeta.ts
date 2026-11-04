import type { ActivityItem } from '../services/activities';
import { formatClock } from './clock';
import { formatDistance, formatPace, paceOf } from './gpsFormat';

const pad = (n: number) => String(n).padStart(2, '0');

// Linha de detalhes de um item de atividade. Data e hora no fuso do aparelho.
// Musculação: "12/10 · 11:08 · 47:57 · 18 séries". GPS (tem distância): "12/10 · 11:08 · 8,67 km · 47:57 · 5:32 /km".
export function activityMeta(item: ActivityItem, { date = false }: { date?: boolean } = {}): string {
  const d = new Date(item.start_time);
  const parts: string[] = [];
  if (date) parts.push(`${pad(d.getDate())}/${pad(d.getMonth() + 1)}`);
  parts.push(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
  if (item.distance_m != null) {
    parts.push(formatDistance(item.distance_m), formatClock(item.duration_sec));
    const pace = paceOf(item.duration_sec, item.distance_m);
    if (pace !== null) parts.push(formatPace(pace));
  } else {
    parts.push(formatClock(item.duration_sec));
    if (item.activity_type === 'STRENGTH') parts.push(`${item.set_count} ${item.set_count === 1 ? 'série' : 'séries'}`);
  }
  return parts.join(' · ');
}
