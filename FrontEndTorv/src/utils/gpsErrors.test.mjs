// Roda com: node --test src/utils/gpsErrors.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { gpsErrorText } from './gpsErrors.ts';

test('gpsErrorText: mensagens conhecidas, ponto inválido e status (Review Focus 3)', () => {
  assert.equal(gpsErrorText(400, 'start_time must be within the last 72 hours'), 'Só dá para importar atividades das últimas 72 horas.');
  assert.equal(gpsErrorText(409, 'Activity already imported'), 'Você já importou esta atividade.');
  assert.equal(gpsErrorText(400, 'invalid point at index 7'), 'O arquivo tem pontos inválidos.');
  assert.equal(gpsErrorText(400, 'body/points must NOT have more than 30000 items'), 'Não foi possível processar o arquivo.');
  assert.equal(gpsErrorText(undefined), 'Sem conexão. Tente de novo.');
  assert.equal(gpsErrorText(413), 'Arquivo grande demais para enviar.');
  assert.equal(gpsErrorText(429), 'Muitas tentativas. Aguarde um minuto.');
  assert.equal(gpsErrorText(500), 'Algo deu errado. Tente de novo.');
});
