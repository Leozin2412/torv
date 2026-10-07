const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TOKEN_ALPHABET, generateInviteToken, normalizeToken, isValidToken,
  groupToday, dateOnly, toDbDate, isEnded, checkGroupDates, rankRows,
} = require('../groupRules');

test('generateInviteToken: 8 caracteres do alfabeto sem 0 O 1 I L', () => {
  for (let i = 0; i < 200; i++) {
    const t = generateInviteToken();
    assert.equal(t.length, 8);
    assert.ok(isValidToken(t), t);
  }
  for (const bad of ['0', 'O', '1', 'I', 'L']) assert.ok(!TOKEN_ALPHABET.includes(bad), bad);
});

test('normalizeToken: tira espaços e põe em maiúsculas; isValidToken recusa tamanho e letras proibidas', () => {
  assert.equal(normalizeToken('  ab3dk7mn '), 'AB3DK7MN');
  assert.ok(isValidToken('AB3DK7MN'));
  assert.ok(!isValidToken('AB3DK7M'));      // curto
  assert.ok(!isValidToken('AB3DK7MNP'));    // longo
  assert.ok(!isValidToken('AB3DK7M0'));     // zero
  assert.ok(!isValidToken('AB3DK7MI'));     // I
  assert.ok(!isValidToken('ab3dk7mn'));     // minúsculas só depois de normalizar
});

test('groupToday: usa o fuso do grupo (22h no Brasil já é o dia seguinte em UTC)', () => {
  const now = Date.parse('2026-10-07T01:30:00Z'); // 22:30 de 06/10 em UTC-3
  assert.equal(groupToday(-180, now), '2026-10-06');
  assert.equal(groupToday(0, now), '2026-10-07');
  assert.equal(groupToday(180, Date.parse('2026-10-06T22:30:00Z')), '2026-10-07'); // UTC+3
});

test('dateOnly / toDbDate: ida e volta, nulo passa', () => {
  assert.equal(dateOnly(toDbDate('2026-10-06')), '2026-10-06');
  assert.equal(dateOnly(null), null);
});

test('isEnded: sem fim nunca encerra; encerra só depois do dia final no fuso do grupo', () => {
  const now = Date.parse('2026-10-07T01:30:00Z');
  assert.equal(isEnded({ ends_at: null, tz_offset_min: 0 }, now), false);
  assert.equal(isEnded({ ends_at: toDbDate('2026-10-06'), tz_offset_min: -180 }, now), false); // ainda 06/10 no grupo
  assert.equal(isEnded({ ends_at: toDbDate('2026-10-06'), tz_offset_min: 0 }, now), true);
  assert.equal(isEnded({ ends_at: toDbDate('2026-10-07'), tz_offset_min: 0 }, now), false);
});

test('checkGroupDates: datas reais e fim >= início', () => {
  assert.equal(checkGroupDates({ starts_at: '2026-10-06', ends_at: null }), null);
  assert.equal(checkGroupDates({ starts_at: '2026-10-06', ends_at: '2026-10-06' }), null);
  assert.match(checkGroupDates({ starts_at: '2026-10-06', ends_at: '2026-10-05' }), /ends_at/);
  assert.match(checkGroupDates({ starts_at: '2026-02-31', ends_at: null }), /starts_at/);
  assert.match(checkGroupDates({ starts_at: '2026-10-06', ends_at: '2026-13-01' }), /ends_at/);
});

test('rankRows: pontos, depois atividades, depois quem entrou primeiro; posições sequenciais', () => {
  const rows = [
    { user_id: 'c', joined_at: new Date('2026-10-03'), total_points: 3, activities_count: 4 },
    { user_id: 'a', joined_at: new Date('2026-10-02'), total_points: 5, activities_count: 5 },
    { user_id: 'b', joined_at: new Date('2026-10-01'), total_points: 3, activities_count: 4 },
    { user_id: 'd', joined_at: new Date('2026-10-04'), total_points: 3, activities_count: 6 },
  ];
  const ranked = rankRows(rows);
  assert.deepEqual(ranked.map((r) => [r.user_id, r.position]), [['a', 1], ['d', 2], ['b', 3], ['c', 4]]);
  assert.equal(rows[0].position, undefined, 'não muta a entrada');
});
