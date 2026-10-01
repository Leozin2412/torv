// Agrupa itens (já em ordem decrescente de start_time) por dia no fuso do aparelho.
// Rótulos: "Hoje", "Ontem", "qua, 30/09" (ano junto quando não é o ano atual).
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface DayGroup<T> {
  key: string;
  title: string;
  data: T[];
}

export function dayTitle(d: Date, now: Date) {
  const key = dayKey(d);
  if (key === dayKey(now)) return 'Hoje';
  if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return 'Ontem';
  const year = d.getFullYear() === now.getFullYear() ? '' : `/${d.getFullYear()}`;
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}${year}`;
}

export function groupByDay<T extends { start_time: string }>(items: T[], now: Date): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const d = new Date(item.start_time);
    const key = dayKey(d);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.data.push(item);
    else groups.push({ key, title: dayTitle(d, now), data: [item] });
  }
  return groups;
}
