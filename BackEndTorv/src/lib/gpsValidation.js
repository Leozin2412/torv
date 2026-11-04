// Regras dos pontos de GPS e da atividade que o TypeBox não expressa (o schema já garante um array de 2 a 30.000
// arrays de 3 a 6 números ou null). Cada função devolve a mensagem de erro (400) ou null.
const { MIN_SESSION_START, BACKDATE_WINDOW_MS, FUTURE_TOLERANCE_MS } = require('./workoutValidation');

const MAX_SPEED_MS = 25 / 3.6; // 25 km/h: acima disso não é corrida nem caminhada (bike, carro, arquivo errado)
const MIN_ELAPSED_SEC = 60;
const MAX_ELAPSED_SEC = 24 * 3600;
const MIN_DISTANCE_M = 100;

const inRange = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

// Forma e faixas de cada ponto [t, lat, lon, ele?, hr?, cad?]. O 1º t é 0 e t nunca diminui. FC e cadência fora da faixa
// viram null (sensor ruim não derruba a importação). Devolve { points } normalizados (sempre 6 posições) ou { error }.
function checkPoints(points) {
  const out = new Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    const [t, lat, lon, ele = null, hr = null, cad = null] = points[i];
    const valid = inRange(t, 0, Number.MAX_SAFE_INTEGER) && (i > 0 || t === 0)
      && inRange(lat, -90, 90) && inRange(lon, -180, 180)
      && (ele === null || inRange(ele, -500, 9000))
      && (hr === null || typeof hr === 'number') && (cad === null || typeof cad === 'number');
    if (!valid) return { error: `invalid point at index ${i}` };
    if (i > 0 && t < out[i - 1][0]) return { error: 'points must be in chronological order' };
    out[i] = [t, lat, lon, ele, inRange(hr, 20, 250) ? hr : null, inRange(cad, 0, 255) ? cad : null];
  }
  return { points: out };
}

// Mesma janela da musculação (impede forjar dias no ranking): início nas últimas 72 h e a partir de 2026-01-01, fim até
// agora + 5 min. startMs em ms; elapsedSec = t do último ponto.
function checkWindow(startMs, elapsedSec, now = Date.now()) {
  if (!(startMs >= MIN_SESSION_START)) return 'start_time must be on or after 2026-01-01';
  if (startMs < now - BACKDATE_WINDOW_MS) return 'start_time must be within the last 72 hours';
  if (startMs > now + FUTURE_TOLERANCE_MS) return 'start_time must not be in the future';
  if (!(startMs + elapsedSec * 1000 <= now + FUTURE_TOLERANCE_MS)) return 'activity must not end in the future';
  return null;
}

// Sobre as métricas já calculadas (gpsMetrics.computeMetrics).
function checkPlausible({ elapsed_sec: elapsed, distance_m: distance, duration_sec: moving }) {
  if (elapsed < MIN_ELAPSED_SEC || distance < MIN_DISTANCE_M) return 'activity too short';
  if (elapsed > MAX_ELAPSED_SEC) return 'activity too long';
  if (distance / moving > MAX_SPEED_MS) return 'speed not compatible with run or walk';
  return null;
}

module.exports = { checkPoints, checkWindow, checkPlausible };
