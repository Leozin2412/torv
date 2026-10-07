// Roda com: node --test src/utils/groupErrors.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { groupErrorText } from './groupErrors.ts';

test('groupErrorText: mensagem do servidor tem prioridade; depois o status', () => {
  assert.equal(groupErrorText(409, 'Group has ended'), 'Este grupo já foi encerrado.');
  assert.equal(groupErrorText(409, 'Already a member'), 'Você já está neste grupo.');
  assert.equal(groupErrorText(409, 'Already pending'), 'Já existe um convite ou pedido pendente.');
  assert.equal(groupErrorText(404, 'Not found', 'Código inválido ou link desativado.'), 'Código inválido ou link desativado.');
  assert.equal(groupErrorText(404), 'Não encontrado.');
  assert.equal(groupErrorText(413), 'A imagem é grande demais (máximo de 5 MB).');
  assert.equal(groupErrorText(429), 'Muitas tentativas. Aguarde um minuto.');
  assert.equal(groupErrorText(500), 'Algo deu errado. Tente de novo.');
  assert.equal(groupErrorText(undefined), 'Sem conexão. Tente de novo.');
});
