// Roda com: node --test src/utils/routeProjection.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { projectRoute } from './routeProjection.ts';

const rounded = (pts) => pts.map(([x, y]) => [Math.round(x), Math.round(y)]);

test('projectRoute: cabe com margem, mantém a proporção e põe o norte para cima', () => {
  // largura útil 180, altura útil 80; spanX = 0,002 e spanY = 0,001 → escala = min(90.000, 80.000) = 80.000
  assert.deepEqual(rounded(projectRoute([[0, 0], [0.001, 0], [0.001, 0.002]], 200, 100, 10)), [[20, 90], [20, 10], [180, 10]]);
});

test('projectRoute: linha norte-sul centralizada; ponto único no centro; vazio → vazio', () => {
  assert.deepEqual(rounded(projectRoute([[0, 0], [0.001, 0]], 200, 100, 10)), [[100, 90], [100, 10]]);
  assert.deepEqual(projectRoute([[-15, -47]], 200, 100), [[100, 50]]);
  assert.deepEqual(projectRoute([], 200, 100), []);
});
