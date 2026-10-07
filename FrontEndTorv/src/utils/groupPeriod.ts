export type GroupStatus = 'upcoming' | 'active' | 'ended';

export interface GroupPeriod {
  starts_at: string; // YYYY-MM-DD
  ends_at: string | null; // null = sem data de término
  tz_offset_min: number;
}

const DAY_MS = 86_400_000;

// Dia local do grupo (YYYY-MM-DD) num instante. Mesma conta do backend (groupRules.groupToday).
export const groupToday = (tzOffsetMin: number, nowMs: number = Date.now()): string =>
  new Date(nowMs + tzOffsetMin * 60_000).toISOString().slice(0, 10);

const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

export const groupStatus = (p: GroupPeriod, nowMs: number = Date.now()): GroupStatus => {
  const today = groupToday(p.tz_offset_min, nowMs);
  if (today < p.starts_at) return 'upcoming';
  if (p.ends_at && today > p.ends_at) return 'ended';
  return 'active';
};

export const formatDay = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const periodLabel = (p: GroupPeriod, nowMs: number = Date.now()): string => {
  const today = groupToday(p.tz_offset_min, nowMs);
  switch (groupStatus(p, nowMs)) {
    case 'upcoming': {
      const n = daysBetween(today, p.starts_at);
      return n === 1 ? 'Começa amanhã' : `Começa em ${n} dias`;
    }
    case 'ended':
      return `Encerrado em ${formatDay(p.ends_at as string)}`;
    default: {
      if (!p.ends_at) return 'Sem data de término';
      const left = daysBetween(today, p.ends_at);
      if (left === 0) return 'Termina hoje';
      return left === 1 ? '1 dia restante' : `${left} dias restantes`;
    }
  }
};
