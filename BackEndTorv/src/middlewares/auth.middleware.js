const jwt = require('jsonwebtoken');

const authenticateToken = (request, reply, done) => {
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return reply.status(401).send({ error: 'Access token is missing' });

  jwt.verify(token, process.env.JWT_SECRET || 'uma_frase_longa_com_letras_numeros_e_simbolos_bem_aleatorios', (err, user) => {
    if (err) return reply.status(403).send({ error: 'Invalid or expired token' });
    request.user = user;
    done();
  });
};

module.exports = authenticateToken;
