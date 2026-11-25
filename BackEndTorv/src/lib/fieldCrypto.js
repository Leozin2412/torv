const crypto = require('node:crypto');

const KEY_ERROR = 'DATA_ENCRYPTION_KEY ausente ou inválida: precisa de 32 bytes em base64';
const DECRYPT_ERROR = 'falha ao decifrar campo';

// Lida a cada chamada para a troca de env nos testes valer.
function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, 'base64') : null;
  if (!key || key.length !== 32 || key.toString('base64') !== raw) throw new Error(KEY_ERROR);
  return key;
}

const aad = ({ table, column, userId }) => Buffer.from(`${table}.${column}:${userId}`);

function encryptField(value, ctx) {
  if (value === null || value === undefined) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  cipher.setAAD(aad(ctx));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), ct].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.');
}

function decryptField(text, ctx) {
  if (text === null || text === undefined) return null;
  try {
    const parts = String(text).split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error();
    const [, iv, tag, ct] = parts.map((p, i) => (i ? Buffer.from(p, 'base64url') : p));
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAAD(aad(ctx));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'));
  } catch {
    throw new Error(DECRYPT_ERROR);
  }
}

const assertKey = () => { getKey(); };

module.exports = { encryptField, decryptField, assertKey };
