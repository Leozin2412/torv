// Métricas de uma atividade com GPS, calculadas no servidor a partir dos pontos que o app extraiu do .gpx.
// points: [[t, lat, lon, ele, hr, cad], ...] já validados (gpsValidation.checkPoints): t em segundos desde o início,
// nunca decrescente; ele/hr/cad podem ser null.

const R = 6371008.8; // raio médio da Terra (m)
const MOVING_MIN_SPEED = 0.5; // m/s: abaixo disso é o GPS parado oscilando, não movimento
const ELEVATION_STEP = 2; // m: histerese do ganho de elevação (corta o ruído do altímetro)
const SPLIT_M = 1000;
const MIN_LAST_SPLIT_M = 50;
const ROUTE_MAX_INPUT = 2000; // limita a entrada do Douglas-Peucker: O(n²) no pior caso = ~2 milhões de contas
const ROUTE_MAX_POINTS = 500;
const ROUTE_EPSILON_M = 5;
// Equações metabólicas da ACSM, por metro: O2 (ml/kg) = h·distância + v·subida + 3,5 ml/kg/min de repouso.
const ACSM = { RUN: { h: 0.2, v: 0.9 }, WALK: { h: 0.1, v: 1.8 } };

const rad = (deg) => (deg * Math.PI) / 180;
const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;

// Distância em metros entre dois pontos [t, lat, lon, ...].
function haversine(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[2] - a[2]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Pares de pontos consecutivos em movimento (>= 0,5 m/s). i = índice do ponto final do par.
function movingSegments(points) {
  const segs = [];
  for (let i = 1; i < points.length; i += 1) {
    const dt = points[i][0] - points[i - 1][0];
    if (dt <= 0) continue;
    const d = haversine(points[i - 1], points[i]);
    if (d / dt >= MOVING_MIN_SPEED) segs.push({ i, d, dt });
  }
  return segs;
}

// Soma das subidas com histerese de 2 m. Menos de 2 altitudes → null.
function elevationGain(points) {
  let anchor = null;
  let gain = 0;
  let seen = 0;
  for (const p of points) {
    const ele = p[3];
    if (ele == null) continue;
    seen += 1;
    if (anchor === null) {
      anchor = ele;
    } else if (ele - anchor >= ELEVATION_STEP) {
      gain += ele - anchor;
      anchor = ele;
    } else if (anchor - ele >= ELEVATION_STEP) {
      anchor = ele;
    }
  }
  return seen < 2 ? null : round(gain, 1);
}

function heartRate(points) {
  let sum = 0;
  let n = 0;
  let max = null;
  for (const p of points) {
    const hr = p[4];
    if (hr == null) continue;
    sum += hr;
    n += 1;
    if (max === null || hr > max) max = hr;
  }
  return n === 0 ? { avg_hr: null, max_hr: null } : { avg_hr: Math.round(sum / n), max_hr: max };
}

// O gpxtpx:cad é por perna: passos/min = 2×. Só nos pontos finais de segmentos em movimento, com cad > 0.
function cadence(points, segs) {
  let sum = 0;
  let n = 0;
  for (const { i } of segs) {
    const cad = points[i][5];
    if (cad == null || cad <= 0) continue;
    sum += cad;
    n += 1;
  }
  return n === 0 ? null : Math.round((2 * sum) / n);
}

// Parciais por km em movimento. A fronteira de cada km é interpolada dentro do segmento; a duração de cada parcial é a
// diferença entre fronteiras ACUMULADAS e arredondadas, então as parciais completas somam exatamente até a última fronteira.
function splits(segs) {
  const out = [];
  let dist = 0;
  let time = 0;
  let next = SPLIT_M;
  let prevBoundary = 0;
  for (const { d, dt } of segs) {
    while (dist + d >= next) {
      const boundary = Math.round(time + ((next - dist) / d) * dt);
      out.push({ km: out.length + 1, distance_m: SPLIT_M, duration_sec: boundary - prevBoundary });
      prevBoundary = boundary;
      next += SPLIT_M;
    }
    dist += d;
    time += dt;
  }
  const rest = dist - (next - SPLIT_M);
  if (rest >= MIN_LAST_SPLIT_M) {
    out.push({ km: out.length + 1, distance_m: Math.round(rest), duration_sec: Math.round(time) - prevBoundary });
  }
  return out;
}

// Douglas-Peucker iterativo sobre [x, y] em metros. Devolve os índices mantidos, em ordem.
function rdp(xy, eps) {
  const keep = new Uint8Array(xy.length);
  keep[0] = 1;
  keep[xy.length - 1] = 1;
  const stack = [[0, xy.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [x1, y1] = xy[s];
    const [x2, y2] = xy[e];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i += 1) {
      const [x, y] = xy[i];
      const dist = len === 0 ? Math.hypot(x - x1, y - y1) : Math.abs(dy * (x - x1) - dx * (y - y1)) / len;
      if (dist > max) {
        max = dist;
        idx = i;
      }
    }
    if (idx !== -1 && max > eps) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = [];
  for (let i = 0; i < keep.length; i += 1) if (keep[i]) out.push(i);
  return out;
}

// Redução por passo uniforme a no máximo `max` itens, sempre com o primeiro e o último.
function thin(list, max) {
  if (list.length <= max) return list;
  const step = Math.ceil((list.length - 1) / (max - 1));
  const out = [];
  for (let i = 0; i < list.length - 1; i += step) out.push(list[i]);
  out.push(list[list.length - 1]);
  return out;
}

// Rota para o traçado: no máximo 500 pontos [lat, lon] com 5 casas (~1 m), mantendo início e fim.
// Uma passada só de Douglas-Peucker (5 m) sobre no máximo 2.000 pontos; se sobrar mais de 500, passo uniforme.
// (Repetir a passada aumentando a tolerância levava 2,3 s num zigue-zague de 20 mil pontos: vetor de DoS.)
function simplifyRoute(points) {
  const pts = thin(points, ROUTE_MAX_INPUT);
  const lat0 = rad(pts.reduce((n, p) => n + p[1], 0) / pts.length);
  const xy = pts.map((p) => [R * rad(p[2]) * Math.cos(lat0), R * rad(p[1])]);
  const kept = thin(rdp(xy, ROUTE_EPSILON_M), ROUTE_MAX_POINTS);
  return kept.map((i) => [round(pts[i][1], 5), round(pts[i][2], 5)]);
}

function estimateCalories(type, distanceM, gainM, movingSec, weightKg) {
  if (weightKg == null) return null;
  const { h, v } = ACSM[type];
  const o2 = h * distanceM + v * (gainM ?? 0) + 3.5 * (movingSec / 60);
  return Math.round(((o2 * weightKg) / 1000) * 5);
}

// type: 'RUN' | 'WALK'; weightKg: último peso do usuário ou null.
function computeMetrics(points, { type, weightKg = null }) {
  const segs = movingSegments(points);
  const distance = segs.reduce((n, s) => n + s.d, 0);
  const movingSec = Math.round(segs.reduce((n, s) => n + s.dt, 0));
  const gain = elevationGain(points);
  return {
    distance_m: round(distance, 2),
    duration_sec: movingSec,
    elapsed_sec: Math.round(points[points.length - 1][0] - points[0][0]),
    pace_sec_per_km: distance > 0 ? Math.round(movingSec / (distance / 1000)) : null,
    elevation_gain_m: gain,
    ...heartRate(points),
    avg_cadence: cadence(points, segs),
    calories: estimateCalories(type, distance, gain, movingSec, weightKg),
    splits: splits(segs),
    route: simplifyRoute(points),
  };
}

module.exports = {
  haversine, movingSegments, elevationGain, heartRate, cadence, splits, thin, simplifyRoute, estimateCalories, computeMetrics,
};
