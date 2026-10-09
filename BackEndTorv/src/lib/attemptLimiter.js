// Contador de tentativas por chave numa janela fixa que começa na 1ª. Chamar fail() síncrono antes de qualquer await mantém a contagem atômica no event loop.
// ponytail: Map em memória, por instância (serverless tem várias, cada uma conta sozinha). Serverless pede contador no Postgres (upsert atômico); o backstop de hoje é o rate limit do GoTrue + expiração do código.
function createAttemptLimiter({ max, windowMs, now = Date.now }) {
  const entries = new Map(); // key -> { count, resetAt }

  // Janelas começam em now crescente e o Map preserva ordem de inserção: vencidas ficam sempre na frente.
  function sweep() {
    const t = now();
    for (const [key, e] of entries) {
      if (e.resetAt > t) break;
      entries.delete(key);
    }
  }

  return {
    isBlocked(key) {
      sweep();
      return (entries.get(key)?.count ?? 0) >= max;
    },
    fail(key) {
      sweep();
      const e = entries.get(key);
      if (e) e.count += 1;
      else entries.set(key, { count: 1, resetAt: now() + windowMs });
    },
    reset(key) {
      entries.delete(key);
    },
    size: () => entries.size,
  };
}

module.exports = { createAttemptLimiter };
