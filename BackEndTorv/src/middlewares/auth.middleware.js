const { createRemoteJWKSet, jwtVerify } = require('jose');

const SUPABASE_URL = process.env.SUPABASE_URL;
const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

const authenticateToken = async (request, reply) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return reply.status(401).send({ error: 'Access token is missing' });

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
