const test = require('node:test');
const assert = require('node:assert/strict');

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '44444444-4444-4444-8444-444444444444';

let state;
const fakePrisma = {
  user_profiles: { findUnique: async (args) => { state.calls.push(['profiles.findUnique', args]); return state.profile; } },
  group_members: { findFirst: async (args) => { state.calls.push(['members.findFirst', args]); return state.membership; } },
};
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: fakePrisma };

const repo = require('../users.repository');

test('sharesGroup: procura o alvo num grupo em que o viewer também é membro', async () => {
  state = { calls: [], membership: { group_id: 'g' } };
  assert.equal(await repo.sharesGroup(USER, OTHER), true);
  const [[name, args]] = state.calls;
  assert.equal(name, 'members.findFirst');
  assert.deepEqual(args.where, { user_id: OTHER, group: { group_members: { some: { user_id: USER } } } });
  state = { calls: [], membership: null };
  assert.equal(await repo.sharesGroup(USER, OTHER), false);
});

test('getPublicProfile: só os campos exibíveis a outros membros', async () => {
  state = { calls: [], profile: { user_id: OTHER, name: 'Bia' } };
  assert.deepEqual(await repo.getPublicProfile(OTHER), { user_id: OTHER, name: 'Bia' });
  const [[, args]] = state.calls;
  assert.deepEqual(args, {
    where: { user_id: OTHER },
    select: { user_id: true, name: true, username: true, photo_url: true, fitness_level: true },
  });
});
