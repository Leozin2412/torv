const { Prisma } = require('@prisma/client');

// Teto de atividades por dia UTC do início, somando TODOS os tipos (musculação e GPS). O ranking dos grupos desempata
// por activities_count, e cada POST cria uma atividade: sem teto, repetir POSTs no mesmo dia forjaria o desempate.
const MAX_ACTIVITIES_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// Fila por usuário, em memória: cada chamada espera a anterior do mesmo userId (mesmo que ela tenha falhado), roda fn e
// devolve o resultado ou o erro de fn ao chamador. Sem ela, uma rajada do mesmo usuário abre N transações interativas, todas
// presas no advisory lock, e esgota o pool (connection_limit=5): as excedentes viram 500 e os outros usuários ficam lentos.
// A entrada do Map sai quando a chamada é a última da fila, então o Map não cresce.
// ponytail: fila de 1 processo. Com várias instâncias o advisory lock continua garantindo o teto, mas a rajada volta a
// segurar conexões; subir para limite por usuário (rate limit) se virar instância múltipla.
const sessionQueues = new Map();
function serializePerUser(userId, fn) {
  const run = (sessionQueues.get(userId) ?? Promise.resolve()).then(fn);
  const tail = run.then(() => {}, () => {});
  sessionQueues.set(userId, tail);
  tail.then(() => { if (sessionQueues.get(userId) === tail) sessionQueues.delete(userId); });
  return run;
}

// Dentro da transação: advisory lock do usuário (serializa os salvamentos até o commit; sem ele, POSTs paralelos contam
// o mesmo total antes de qualquer insert e furam o teto em READ COMMITTED; userId parametrizado) e o teto do dia,
// contado antes do insert. A mensagem é a mesma de antes, para os dois caminhos.
async function lockAndCheckDailyCap(tx, userId, startTime) {
  await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${userId}::text))`);
  const dayStart = new Date(Math.floor(startTime.getTime() / DAY_MS) * DAY_MS);
  const sameDay = await tx.activities.count({
    where: { user_id: userId, start_time: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } },
  });
  if (sameDay >= MAX_ACTIVITIES_PER_DAY) {
    throw Object.assign(new Error('too many sessions on that day'), { code: 'SESSION_DAY_LIMIT' });
  }
}

module.exports = { MAX_ACTIVITIES_PER_DAY, serializePerUser, lockAndCheckDailyCap };
