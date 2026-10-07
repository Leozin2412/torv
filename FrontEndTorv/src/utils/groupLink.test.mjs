// Roda com: node --test src/utils/groupLink.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, isValidCode, joinTokenFromUrl } from './groupLink.ts';

test('normalizeCode: tira espaços e põe em maiúsculas', () => {
  assert.equal(normalizeCode(' ab3d k7mn\n'), 'AB3DK7MN');
});

test('isValidCode: 8 caracteres do alfabeto, sem 0 O 1 I L', () => {
  assert.ok(isValidCode('AB3DK7MN'));
  for (const bad of ['', 'AB3DK7M', 'AB3DK7MNP', 'AB3DK7M0', 'AB3DK7MO', 'AB3DK7M1', 'AB3DK7MI', 'AB3DK7ML', 'ab3dk7mn']) {
    assert.ok(!isValidCode(bad), bad);
  }
});

test('joinTokenFromUrl: esquema próprio, Expo Go, minúsculas, parâmetros e %20', () => {
  assert.equal(joinTokenFromUrl('torv://join/AB3DK7MN'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('torv://join/ab3dk7mn'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('exp://192.168.0.2:8081/--/join/AB3DK7MN'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('torv://join/AB3DK7MN?utm=x#y'), 'AB3DK7MN');
  assert.equal(joinTokenFromUrl('torv://join/AB3D%20K7MN'), 'AB3DK7MN');
});

test('joinTokenFromUrl: URL malformada, sem código, código inválido ou outro caminho → null', () => {
  for (const bad of [null, undefined, '', 'torv://join/', 'torv://join', 'torv://join/0O1IL234', 'torv://join/ABC',
    'torv://home/AB3DK7MN', 'https://x.com/rejoin/AB3DK7MN', 'torv://join/%E0%A4%A']) {
    assert.equal(joinTokenFromUrl(bad), null, String(bad));
  }
});
