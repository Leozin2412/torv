const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { spawn } = require('node:child_process');
const path = require('node:path');

// Sobe o server.js de verdade numa porta livre (nunca a 3000, que é do Furnace). Nada toca no banco:
// /health é estático e o login com corpo vazio cai na validação (400), mas o rate limit já contou.
const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

async function start(t, env) {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(__dirname, '../../server.js')], {
    env: { ...process.env, VERCEL: '', ...env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    child.once('exit', () => reject(new Error('server exited')));
    child.stdout.on('data', (d) => d.toString().includes('Server is running') && resolve());
  });
  return `http://127.0.0.1:${port}`;
}

const login = (base, xff) => fetch(`${base}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-forwarded-for': xff },
  body: '{}',
}).then((r) => r.status);

const burst = (base, ip) => Promise.all(Array.from({ length: 11 }, (_, i) => login(base, ip(i))));

test('GET /health: 200 {status:ok} sem auth', async (t) => {
  const base = await start(t, {});
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('sem VERCEL: x-forwarded-for é ignorado, o limite conta pelo IP real', async (t) => {
  const base = await start(t, {});
  const statuses = await burst(base, (i) => `203.0.113.${i + 1}`);
  assert.equal(statuses.filter((s) => s === 429).length, 1);
});

test('VERCEL=1: o limite conta por IP do x-forwarded-for', async (t) => {
  const base = await start(t, { VERCEL: '1' });
  assert.ok((await burst(base, (i) => `203.0.113.${i + 1}`)).every((s) => s === 400)); // 11 IPs distintos
  const same = await burst(base, () => '198.51.100.7'); // mesmo IP, 11 tentativas
  assert.equal(same.filter((s) => s === 429).length, 1);
});

test('VERCEL=1: x-forwarded-for forjado com vários valores conta pelo ÚLTIMO item (o que a Vercel escreveu)', async (t) => {
  const base = await start(t, { VERCEL: '1' });
  // prefixo muda a cada request, o último valor é fixo → mesmo IP → 11º é barrado
  const forged = await burst(base, (i) => `203.0.113.${i + 1}, 192.0.2.${i + 1}, 198.51.100.9`);
  assert.equal(forged.filter((s) => s === 429).length, 1);
  // último valor muda, prefixo fixo → IPs distintos → nenhum barrado
  const distinct = await burst(base, (i) => `203.0.113.1, 198.51.100.${i + 20}`);
  assert.ok(distinct.every((s) => s === 400));
});
