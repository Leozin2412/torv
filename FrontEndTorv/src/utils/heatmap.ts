// Calendário de atividade no estilo do GitHub: colunas = semanas (domingo a sábado), linhas = dias da semana.
// Sem imports de runtime: o teste roda direto no node (type stripping), que não resolve import relativo sem extensão.

export interface HeatCell {
  date: string; // YYYY-MM-DD
  count: number;
  level: 0 | 1 | 2 | 3;
}

export interface HeatmapData {
  weeks: (HeatCell | null)[][]; // 7 posições por semana; null = dia depois de `end`
  months: { label: string; week: number }[]; // mês que começa na coluna `week`
  activeDays: number;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DAY_MS = 86400000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// 0, 1, 2 e 3+ atividades no dia.
export const heatLevel = (count: number): HeatCell['level'] => (count <= 0 ? 0 : count >= 3 ? 3 : (count as 1 | 2));

// start é sempre um domingo (o backend manda assim). Monta semanas até a que contém `end`.
export function buildHeatmap(start: string, end: string, days: { date: string; count: number }[]): HeatmapData {
  const counts = new Map(days.map((d) => [d.date, d.count]));
  const endMs = toMs(end);
  const weeks: (HeatCell | null)[][] = [];
  const months: { label: string; week: number }[] = [];
  let lastMonth = -1;
  for (let weekStart = toMs(start); weekStart <= endMs; weekStart += 7 * DAY_MS) {
    const week: (HeatCell | null)[] = [];
    for (let i = 0; i < 7; i += 1) {
      const ms = weekStart + i * DAY_MS;
      if (ms > endMs) {
        week.push(null);
        continue;
      }
      const date = toDay(ms);
      const count = counts.get(date) ?? 0;
      week.push({ date, count, level: heatLevel(count) });
    }
    // Rótulo na 1ª coluna cujo domingo cai no mês, como no GitHub.
    const month = new Date(weekStart).getUTCMonth();
    if (month !== lastMonth) {
      months.push({ label: MONTHS[month], week: weeks.length });
      lastMonth = month;
    }
    weeks.push(week);
  }
  // O 1º mês, cortado no começo da janela, colaria no rótulo seguinte: sai.
  if (months.length > 1 && months[1].week - months[0].week < 3) months.shift();
  const activeDays = days.filter((d) => d.count > 0 && d.date >= start && d.date <= end).length;
  return { weeks, months, activeDays };
}

// "12 de out. · 2 atividades"
export function cellLabel(cell: HeatCell): string {
  const [, month, day] = cell.date.split('-').map(Number);
  const what = cell.count === 0 ? 'nenhuma atividade' : cell.count === 1 ? '1 atividade' : `${cell.count} atividades`;
  return `${day} de ${MONTHS[month - 1]}. · ${what}`;
}

// Célula sob o toque, com x/y relativos à grade. O espaço entre quadrados conta para o quadrado anterior;
// abaixo da última linha vale o sábado. A semana pode passar do fim: quem chama confere.
export function cellAt(x: number, y: number, size: number, gap: number): { week: number; day: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
  const pitch = size + gap;
  return { week: Math.floor(x / pitch), day: Math.min(6, Math.floor(y / pitch)) };
}
