// Métricas de GPS em texto pt-BR. Sem imports de runtime: testado direto no node.

const pad = (n: number) => String(n).padStart(2, '0');

// 8670.74 → "8,67 km"
export const formatDistance = (meters: number) => `${(meters / 1000).toFixed(2).replace('.', ',')} km`;

// 332 → "5:32 /km"
export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${pad(s % 60)} /km`;
}

// Pace médio (s/km) a partir de um item de atividade: duration_sec é o tempo em movimento. null sem distância.
export const paceOf = (durationSec: number, distanceM: number | null) =>
  distanceM && distanceM > 0 ? Math.round(durationSec / (distanceM / 1000)) : null;

// Parciais → linhas da tabela: "1" (km cheio) ou "0,67 km" (sobra), tempo "5:38" e pace "5:38 /km".
export function splitRows(splits: { km: number; distance_m: number; duration_sec: number }[]) {
  return splits.map((s) => ({
    label: s.distance_m === 1000 ? String(s.km) : formatDistance(s.distance_m),
    time: `${Math.floor(s.duration_sec / 60)}:${pad(s.duration_sec % 60)}`,
    pace: formatPace(s.duration_sec / (s.distance_m / 1000)),
  }));
}
