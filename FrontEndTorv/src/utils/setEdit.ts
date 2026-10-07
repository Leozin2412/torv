// Edição de um treino salvo (tela WorkoutEdit). Sem imports: roda no teste de Node puro.
const MAX_WEIGHT_KG = 999.99;
const MAX_SET_SEC = 3600;

export interface EditRow {
  id: string;
  label: string;
  durationText: string; // segundos
  weightText: string; // "7,5"; vazio = sem carga
}

export interface SetDetail {
  id: string;
  exercise_name: string;
  set_number: number;
  duration_sec: number;
  weight_kg: number | null;
}

export const toEditRows = (sets: SetDetail[]): EditRow[] =>
  sets.map((s) => ({
    id: s.id,
    label: `${s.exercise_name} · série ${s.set_number}`,
    durationText: String(s.duration_sec),
    weightText: s.weight_kg === null ? '' : String(s.weight_kg).replace('.', ','),
  }));

// Texto da carga → número; vazio → null (sem carga); inválido → undefined. Passa de 999,99 → 999,99.
export function parseWeightInput(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  const m = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(t);
  if (!m) return undefined;
  const value = Number(`${m[1]}.${m[2] || '0'}`);
  return Math.min(value, MAX_WEIGHT_KG);
}

// Segundos inteiros de 0 a 3600 (acima disso fica em 3600); o resto é inválido.
export function parseSeconds(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return undefined;
  return Math.min(Number(t), MAX_SET_SEC);
}

export interface EditBody {
  duration_sec: number;
  sets: { id: string; duration_sec: number; weight_kg: number | null }[];
}
export type EditResult = { ok: true; body: EditBody } | { ok: false; error: string };

export function toEditPayload(totalSec: number, rows: EditRow[]): EditResult {
  if (rows.length === 0) {
    return { ok: false, error: 'O treino precisa ter ao menos uma série. Para remover tudo, exclua o treino.' };
  }
  const sets: EditBody['sets'] = [];
  for (const r of rows) {
    const duration = parseSeconds(r.durationText);
    if (duration === undefined) return { ok: false, error: `Tempo inválido em "${r.label}".` };
    const weight = parseWeightInput(r.weightText);
    if (weight === undefined) return { ok: false, error: `Carga inválida em "${r.label}".` };
    sets.push({ id: r.id, duration_sec: duration, weight_kg: weight });
  }
  return { ok: true, body: { duration_sec: totalSec, sets } };
}
