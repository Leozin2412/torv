// Roda com: node --test src/utils/emailTypo.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestEmailDomain, POPULAR_EMAIL_DOMAINS } from './emailTypo.ts';

test('lista na ordem da spec', () => {
  assert.deepEqual([...POPULAR_EMAIL_DOMAINS], [
    'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br', 'yahoo.com', 'icloud.com',
    'live.com', 'hotmail.com.br', 'outlook.com.br', 'uol.com.br', 'bol.com.br', 'terra.com.br',
  ]);
});

test('sugere o domínio popular mais próximo (distância 1 ou 2)', () => {
  assert.equal(suggestEmailDomain('joao@gmial.com'), 'joao@gmail.com');
  assert.equal(suggestEmailDomain('joao@gmail.co'), 'joao@gmail.com');
  assert.equal(suggestEmailDomain('joao@hotmial.com'), 'joao@hotmail.com');
  assert.equal(suggestEmailDomain('joao@outlok.com'), 'joao@outlook.com');
  assert.equal(suggestEmailDomain('joao@yaho.com.br'), 'joao@yahoo.com.br');
  assert.equal(suggestEmailDomain('joao@hotmail.combr'), 'joao@hotmail.com.br');
});

test('transposição conta 1 (Damerau): hotmial.co está a 2 de hotmail.com', () => {
  assert.equal(suggestEmailDomain('joao@hotmial.co'), 'joao@hotmail.com');
});

test('empate: vence o primeiro da lista', () => {
  assert.equal(suggestEmailDomain('joao@col.com.br'), 'joao@uol.com.br');
});

test('espaços e maiúsculas: compara em minúsculas, mantém a parte local', () => {
  assert.equal(suggestEmailDomain('  JOAO@GMIAL.COM '), 'JOAO@gmail.com');
  assert.equal(suggestEmailDomain('joao@Gmail.com'), null);
});

test('sem aviso: domínio exato, desconhecido, distância 3, sem @ ou vazio', () => {
  assert.equal(suggestEmailDomain('joao@gmail.com'), null);
  assert.equal(suggestEmailDomain('joao@bol.com.br'), null);
  assert.equal(suggestEmailDomain('joao@empresa.com.br'), null);
  assert.equal(suggestEmailDomain('joao@gm.com'), null);
  assert.equal(suggestEmailDomain('joao'), null);
  assert.equal(suggestEmailDomain('joao@'), null);
  assert.equal(suggestEmailDomain(''), null);
});

test('entrada enorme não trava', () => {
  const t0 = Date.now();
  assert.equal(suggestEmailDomain('a@' + 'x'.repeat(10000)), null);
  assert.ok(Date.now() - t0 < 50);
});
