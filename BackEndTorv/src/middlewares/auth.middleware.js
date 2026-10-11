const SUPABASE_URL = process.env.SUPABASE_URL;

// jose 6 é ESM-only: require() quebra na Vercel (ERR_REQUIRE_ESM), então carrega com import() dinâmico, uma vez.
let verifier;
const loadVerifier = () => (verifier ??= import('jose').then(({ createRemoteJWKSet, jwtVerify }) => ({
  jwtVerify,
  JWKS: createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)),
})));

const authenticateToken = async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return reply.status(401).send({ error: 'Access token is missing' });

  // Fora do try: falha ao carregar a lib é erro do servidor (500), não token inválido (403).
  const { jwtVerify, JWKS } = await loadVerifier();
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
    });
    request.user = { ...payload, userId: payload.sub };
  } catch (err) {
    return reply.status(403).send({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;
