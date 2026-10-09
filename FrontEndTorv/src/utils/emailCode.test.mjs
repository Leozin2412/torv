// Roda com: node --test src/utils/emailCode.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCode, isCodeComplete } from './emailCode.ts';

test('sanitizeCode: só dígitos, no máximo 6', () => {
  assert.equal(sanitizeCode('12a3 4-5'), '12345');
  assert.equal(sanitizeCode('1234567890'), '123456');
  assert.equal(sanitizeCode('abc'), '');
  assert.equal(sanitizeCode(''), '');
});

test('isCodeComplete: exatamente 6 dígitos', () => {
  assert.ok(isCodeComplete('123456'));
  assert.ok(isCodeComplete('000000'));
  for (const bad of ['', '12345', '1234567', '12345a', '12 456']) {
    assert.ok(!isCodeComplete(bad), bad);
  }
});
