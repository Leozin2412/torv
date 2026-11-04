const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  haversine, movingSegments, elevationGain, heartRate, cadence, splits, thin, simplifyRoute, estimateCalories, computeMetrics,
} = require('../gpsMetrics');

// 1 grau de latitude em metros com o mesmo raio do código (R = 6.371.008,8 m).
const DEG_M = (6371008.8 * Math.PI) / 180;
// n pontos, um a cada `dt` s, andando `stepM` metros para o norte a cada ponto; `extra` = [ele, hr, cad].
const northLine = (n, stepM, dt, extra = []) =>
  Array.from({ length: n }, (_, i) => [i * dt, -15 + (i * stepM) / DEG_M, -47, ...extra]);

test('haversine: 1 grau de latitude e ponto parado', () => {
  assert.ok(Math.abs(haversine([0, 0, 0], [0, 1, 0]) - 111195.08) < 0.01);
  assert.equal(haversine([0, -15, -47], [5, -15, -47]), 0);
});

test('movingSegments: abaixo de 0,5 m/s é GPS parado; dt 0 é ignorado', () => {
  const pts = [[0, 0, 0], [10, 1 / DEG_M, 0], [10, 2 / DEG_M, 0], [12, 4 / DEG_M, 0]];
  const segs = movingSegments(pts);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].i, 3);
  assert.equal(segs[0].dt, 2);
  assert.ok(Math.abs(segs[0].d - 2) < 0.001);
});

test('elevationGain: histerese de 2 m corta ruído; menos de 2 altitudes → null', () => {
  const ele = (...vals) => vals.map((e, i) => [i, 0, 0, e]);
  assert.equal(elevationGain(ele(100, 101, 100, 101, 100)), 0);
  assert.equal(elevationGain(ele(100, 103, 102, 106)), 6);
  assert.equal(elevationGain(ele(100, 97, 100)), 3);
  assert.equal(elevationGain([[0, 0, 0], [1, 0, 0, null], [2, 0, 0, 100]]), null);
});

test('heartRate: média arredondada e máximo; sem FC → null', () => {
  assert.deepEqual(heartRate([[0, 0, 0, null, 150], [1, 0, 0, null, 151], [2, 0, 0, null, null]]), { avg_hr: 151, max_hr: 151 });
  assert.deepEqual(heartRate([[0, 0, 0], [1, 0, 0]]), { avg_hr: null, max_hr: null });
});

test('cadence: cad por perna × 2, só nos segmentos em movimento e com cad > 0', () => {
  const pts = northLine(4, 3, 1, [100, 150]).map((p, i) => [...p, [80, 0, 90, 85][i]]);
  assert.equal(cadence(pts, movingSegments(pts)), 175);
  const plain = northLine(3, 3, 1);
  assert.equal(cadence(plain, movingSegments(plain)), null);
});

test('splits: reta de 2,5 km a 4 m/s → 250 s por km e a sobra de 500 m', () => {
  const segs = movingSegments(northLine(126, 20, 5));
  assert.deepEqual(splits(segs), [
    { km: 1, distance_m: 1000, duration_sec: 250 },
    { km: 2, distance_m: 1000, duration_sec: 250 },
    { km: 3, distance_m: 500, duration_sec: 125 },
  ]);
});

test('splits: sobra menor que 50 m não vira parcial', () => {
  assert.deepEqual(splits(movingSegments(northLine(52, 20, 5))), [{ km: 1, distance_m: 1000, duration_sec: 250 }]);
});

test('thin: passo uniforme até o máximo, sempre com o primeiro e o último', () => {
  assert.deepEqual(thin([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4), [1, 4, 7, 10]);
  assert.deepEqual(thin([1, 2, 3], 5), [1, 2, 3]);
});

test('simplifyRoute: reta vira só as pontas, com 5 casas', () => {
  const route = simplifyRoute(northLine(200, 10, 3));
  assert.equal(route.length, 2);
  assert.deepEqual(route[0], [-15, -47]);
  assert.equal(route[1][1], -47);
});

test('simplifyRoute: zigue-zague longo fica com no máximo 500 pontos, mantém as pontas e é rápido (Review Focus 5)', () => {
  // 20.000 pontos; a cada 4 pontos o desvio de ~54 m alterna. Antes de entrar no Douglas-Peucker, a entrada cai para 2.000.
  const pts = Array.from({ length: 20000 }, (_, i) => [i, -15 + (i * 10) / DEG_M, -47 + (Math.floor(i / 4) % 2) * 0.0005]);
  const started = Date.now();
  const route = simplifyRoute(pts);
  assert.ok(Date.now() - started < 1000, 'uma passada só: dezenas de ms, nunca segundos');
  assert.ok(route.length <= 500, String(route.length));
  assert.deepEqual(route[0], [-15, -47]);
  const last = pts[pts.length - 1];
  assert.deepEqual(route[route.length - 1], [Math.round(last[1] * 1e5) / 1e5, Math.round(last[2] * 1e5) / 1e5]);
});

test('estimateCalories: ACSM por metro nos dois tipos; sem peso → null (Review Focus 4)', () => {
  assert.equal(estimateCalories('RUN', 10000, 100, 3600, 70), 805); // (2000 + 90 + 210) ml/kg × 70 kg / 1000 × 5
  assert.equal(estimateCalories('WALK', 5000, null, 3600, 70), 249); // (500 + 0 + 210) × 70 / 1000 × 5 = 248,5
  assert.equal(estimateCalories('RUN', 10000, 100, 3600, null), null);
});

test('computeMetrics: amostra sintética (passos, horários, FC e cadência de uma corrida de 48 min a 1 Hz)', () => {
  const { points } = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'run-sample.json'), 'utf8'));
  const m = computeMetrics(points, { type: 'RUN', weightKg: 75 });
  assert.deepEqual({ ...m, route: m.route.length }, {
    distance_m: 8671.66,
    duration_sec: 2877,
    elapsed_sec: 2882,
    pace_sec_per_km: 332,
    elevation_gain_m: 38.3,
    avg_hr: 151,
    max_hr: 169,
    avg_cadence: 175,
    calories: 726,
    splits: [
      { km: 1, distance_m: 1000, duration_sec: 338 },
      { km: 2, distance_m: 1000, duration_sec: 318 },
      { km: 3, distance_m: 1000, duration_sec: 334 },
      { km: 4, distance_m: 1000, duration_sec: 323 },
      { km: 5, distance_m: 1000, duration_sec: 354 },
      { km: 6, distance_m: 1000, duration_sec: 360 },
      { km: 7, distance_m: 1000, duration_sec: 312 },
      { km: 8, distance_m: 1000, duration_sec: 321 },
      { km: 9, distance_m: 672, duration_sec: 217 },
    ],
    route: 69,
  });
  assert.deepEqual(m.route[0], [-10.5, -52.5]);
  assert.equal(m.splits.reduce((n, s) => n + s.duration_sec, 0), m.duration_sec);
  assert.equal(computeMetrics(points, { type: 'WALK', weightKg: 75 }).calories, 414);
  assert.equal(computeMetrics(points, { type: 'RUN' }).calories, null);
});
