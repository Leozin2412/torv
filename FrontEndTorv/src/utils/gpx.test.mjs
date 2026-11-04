// Roda com: node --test src/utils/gpx.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGpx, gpxTypeFrom, GpxError, MAX_POINTS } from './gpx.ts';

const sample = readFileSync(new URL('./fixtures/run-sample.gpx', import.meta.url), 'utf8');
const gpx = (body, trkHeader = '') => `<?xml version="1.0"?><gpx version="1.1"><trk>${trkHeader}${body}</trk></gpx>`;
const pt = (lat, lon, time, inner = '') => `<trkpt lat="${lat}" lon="${lon}"><time>${time}</time>${inner}</trkpt>`;
const errorOf = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

test('parseGpx: amostra no formato do Strava (nome, tipo, início e pontos compactos)', () => {
  const out = parseGpx(sample);
  assert.equal(out.name, 'Corrida na hora do almoço');
  assert.equal(out.type, 'RUN');
  assert.equal(out.startTime, '2026-01-15T09:00:00.000Z');
  assert.equal(out.points.length, 120);
  assert.deepEqual(out.points[0], [0, -10.5, -52.5, 413.3, 83, 55]);
  assert.ok(out.points.every((p, i) => i === 0 || p[0] >= out.points[i - 1][0]));
});

test('parseGpx: extensão com prefixo do Garmin (ns3:) e sem extensão nenhuma (Review Focus 1)', () => {
  const garmin = parseGpx(gpx(`<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z', '<ele>10</ele><extensions><ns3:TrackPointExtension><ns3:hr>140</ns3:hr><ns3:cad>80</ns3:cad></ns3:TrackPointExtension></extensions>')}${pt(-15.001, -47, '2026-10-14T10:00:05Z')}</trkseg>`));
  assert.deepEqual(garmin.points, [[0, -15, -47, 10, 140, 80], [5, -15.001, -47, null, null, null]]);
  assert.equal(garmin.type, null);
  assert.equal(garmin.name, null);
});

test('parseGpx: vários segmentos e trilhas fora de ordem viram uma sequência por horário (Review Focus 1)', () => {
  const xml = `<gpx><trk><trkseg>${pt(-15.002, -47, '2026-10-14T10:00:10Z')}</trkseg><trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}</trkseg></trk><trk><trkseg>${pt(-15.001, -47, '2026-10-14T10:00:05.500Z')}</trkseg></trk></gpx>`;
  const out = parseGpx(xml);
  assert.deepEqual(out.points.map((p) => p[0]), [0, 5.5, 10]);
  assert.equal(out.startTime, '2026-10-14T10:00:00.000Z');
});

test('parseGpx: ponto sem horário ou com coordenada inválida é descartado', () => {
  const out = parseGpx(gpx(`<trkseg><trkpt lat="-15" lon="-47"/>${pt(-15, -47, '2026-10-14T10:00:00Z')}${pt(95, -47, '2026-10-14T10:00:01Z')}${pt(-15.001, -47, '2026-10-14T10:00:02Z')}</trkseg>`));
  assert.equal(out.points.length, 2);
});

test('parseGpx: erros em pt-BR (não é GPX, rota planejada, bike, pontos de menos) (Review Focus 3)', () => {
  assert.equal(errorOf(() => parseGpx('<html><body>oi</body></html>')), 'Este arquivo não é um GPX válido.');
  assert.equal(errorOf(() => parseGpx('<gpx><rte><rtept lat="-15" lon="-47"/></rte></gpx>')), 'O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade).');
  assert.equal(errorOf(() => parseGpx(gpx(`<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}</trkseg>`, '<type>cycling</type>'))), 'Bike chega em breve. Por enquanto, só corrida e caminhada.');
  assert.equal(errorOf(() => parseGpx(gpx(`<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}</trkseg>`))), 'O arquivo tem pontos de menos.');
});

test('parseGpx: entidades e CDATA no nome; nome cortado em 100 caracteres', () => {
  const body = `<trkseg>${pt(-15, -47, '2026-10-14T10:00:00Z')}${pt(-15.001, -47, '2026-10-14T10:00:05Z')}</trkseg>`;
  assert.equal(parseGpx(gpx(body, '<name>Corrida &amp; caf&#233; &#x1F3C3;</name>')).name, 'Corrida & café 🏃');
  assert.equal(parseGpx(gpx(body, '<name><![CDATA[Trilha <leve>]]></name>')).name, 'Trilha <leve>');
  assert.equal(parseGpx(gpx(body, `<name>${'a'.repeat(150)}</name>`)).name.length, 100);
});

test('parseGpx: acima de 30.000 pontos reduz por passo uniforme, mantendo o primeiro e o último (Review Focus 5)', () => {
  const n = MAX_POINTS + 1;
  const base = Date.parse('2026-10-14T10:00:00Z');
  const pts = Array.from({ length: n }, (_, i) => pt(-15 + i * 1e-5, -47, new Date(base + i * 1000).toISOString())).join('');
  const out = parseGpx(gpx(`<trkseg>${pts}</trkseg>`));
  assert.ok(out.points.length <= MAX_POINTS, String(out.points.length));
  assert.equal(out.points[0][0], 0);
  assert.equal(out.points[out.points.length - 1][0], n - 1);
});

test('gpxTypeFrom: nomes do Strava e do Garmin; número e desconhecido → null', () => {
  assert.deepEqual(['Running', ' hiking ', 'trail_running', 'Walking', 'Cycling', 'virtualride', '9', 'yoga', null].map(gpxTypeFrom),
    ['RUN', 'WALK', 'RUN', 'WALK', 'RIDE', 'RIDE', null, null, null]);
});

test('parseGpx: lat/lon arredondados a 6 casas e elevação a 1 (JSON de 30.000 pontos < 2 MiB)', () => {
  const body = `<trkseg>${pt(-15.123456789012345, -47.987654321098765, '2026-10-14T10:00:00Z', '<ele>1234.56789</ele>')}${pt(-15.2, -47.9, '2026-10-14T10:00:05Z')}</trkseg>`;
  assert.deepEqual(parseGpx(gpx(body)).points[0], [0, -15.123457, -47.987654, 1234.6, null, null]);
});

test('parseGpx: ~1 MB malformado (trkpt, time, name e trk sem fechar) termina em tempo linear (security F1)', () => {
  const MB = 1e6;
  const fill = (unit) => unit.repeat(Math.ceil(MB / unit.length));
  const cases = {
    'trkpt sem fechar': `<gpx><trk><trkseg>${fill('<trkpt lat="1" lon="2"><time>2026-01-01T00:00:00Z</time>')}`,
    'trkpt sem >': `<gpx><trk><trkseg>${fill('<trkpt lat="1" ')}`,
    'time sem fechar': `<gpx><trk><trkseg><trkpt lat="1" lon="2">${fill('<time>x')}`,
    'time sem >': `<gpx><trk><trkseg><trkpt lat="1" lon="2">${fill('<time ')}</trkpt>`,
    'name sem fechar': `<gpx><trk>${fill('<name>')}`,
    'trk sem fechar': `<gpx>${fill('<trk>')}`,
  };
  for (const [label, xml] of Object.entries(cases)) {
    const t0 = performance.now();
    try { parseGpx(xml); } catch (e) { assert.ok(e instanceof GpxError, label); }
    // Medido ~35 ms no pior caso; antes da correção passava de 4,6 s (até > 20 s). 1 s dá folga de CI.
    assert.ok(performance.now() - t0 < 1000, `${label}: ${(performance.now() - t0).toFixed(0)} ms`);
  }
});

test('parseGpx: ~5 MB de <trkpt> curto repetido, sem fechar, termina em tempo linear (security F1b)', () => {
  const xml = `<gpx><trk><trkseg>${'<trkpt>'.repeat(Math.ceil(5e6 / 7))}`;
  const t0 = performance.now();
  assert.throws(() => parseGpx(xml), GpxError);
  const ms = performance.now() - t0;
  // 5 MB: o parser de bbf8b8e (varredura por ponto) levava ~1,8 s; o atual, alguns ms. 500 ms dá folga de CI e ainda pega o antigo.
  assert.ok(ms < 500, `${ms.toFixed(0)} ms`);
});
