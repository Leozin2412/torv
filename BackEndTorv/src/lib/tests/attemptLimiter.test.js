const test = require('node:test');
const assert = require('node:assert/strict');
const { createAttemptLimiter } = require('../attemptLimiter');

function build() {
  const clock = { t: 1000 };
  const limiter = createAttemptLimiter({ max: 3, windowMs: 100, now: () => clock.t });
  return { clock, limiter };
}

test('bloqueia só ao atingir max falhas, por chave', () => {
  const { limiter } = build();
  limiter.fail('a'); limiter.fail('a');
  assert.equal(limiter.isBlocked('a'), false);
  limiter.fail('a');
  assert.equal(limiter.isBlocked('a'), true);
  assert.equal(limiter.isBlocked('b'), false);
});

test('reset zera o contador', () => {
  const { limiter } = build();
  for (let i = 0; i < 3; i++) limiter.fail('a');
  limiter.reset('a');
  assert.equal(limiter.isBlocked('a'), false);
});

test('janela vence: desbloqueia e a entrada some do Map', () => {
  const { clock, limiter } = build();
  for (let i = 0; i < 3; i++) limiter.fail('a');
  clock.t += 99;
  assert.equal(limiter.isBlocked('a'), true);
  clock.t += 1;
  assert.equal(limiter.isBlocked('a'), false);
  assert.equal(limiter.size(), 0);
});

test('entradas vencidas de outras chaves são varridas', () => {
  const { clock, limiter } = build();
  limiter.fail('a');
  clock.t += 50;
  limiter.fail('b');
  clock.t += 60; // a venceu (110 >= 100), b não (60 < 100)
  limiter.fail('c');
  assert.equal(limiter.size(), 2);
  assert.equal(limiter.isBlocked('a'), false);
});
