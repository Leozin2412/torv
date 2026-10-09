// Adapter fino pra API REST do GoTrue (Supabase Auth). Isolado pra trocar de provedor sem mexer em rota/controller.
// Nunca propaga o corpo de erro do provedor: só um código tipado.

const MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  INVALID_REFRESH: 'Invalid refresh token',
  EMAIL_TAKEN: 'Email already registered',
  INVALID_INPUT: 'Invalid registration data',
  EMAIL_NOT_CONFIRMED: 'Email not confirmed',
  INVALID_CODE: 'Invalid or expired code',
  RATE_LIMITED: 'Too many requests',
  PROVIDER: 'Authentication provider unavailable',
};

class AuthError extends Error {
  constructor(code) {
    super(MESSAGES[code]);
    this.code = code;
  }
}

async function call(path, body, token) {
  const headers = { apikey: process.env.PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  let data = null;
  try {
    res = await fetch(`${process.env.SUPABASE_URL}/auth/v1${path}`, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status !== 204) data = await res.json().catch(() => null);
  } catch {
    throw new AuthError('PROVIDER');
  }
  return { status: res.status, data: data || {} };
}

function toSession(d) {
  if (!d.access_token) return null;
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at ?? Math.floor(Date.now() / 1000) + d.expires_in,
    user: { id: d.user.id, email: d.user.email },
  };
}

const isClientError = (status) => status >= 400 && status < 500;

async function signUp(email, password, metadata) {
  const { status, data } = await call('/signup', { email, password, data: metadata });
  if (status >= 200 && status < 300) return toSession(data);
  if (['user_already_exists', 'email_exists'].includes(data.error_code)) throw new AuthError('EMAIL_TAKEN');
  if (['weak_password', 'email_address_invalid', 'validation_failed'].includes(data.error_code)) throw new AuthError('INVALID_INPUT');
  throw new AuthError('PROVIDER');
}

async function signIn(email, password) {
  const { status, data } = await call('/token?grant_type=password', { email, password });
  if (status === 200) return toSession(data);
  // GoTrue só responde isso depois de validar a senha, então não revela se a conta existe.
  if (isClientError(status) && data.error_code === 'email_not_confirmed') throw new AuthError('EMAIL_NOT_CONFIRMED');
  throw new AuthError(isClientError(status) && status !== 429 ? 'INVALID_CREDENTIALS' : 'PROVIDER');
}

async function verifyEmail(email, token) {
  const { status, data } = await call('/verify', { type: 'email', email, token });
  if (status === 200) {
    const session = toSession(data);
    if (!session) throw new AuthError('PROVIDER');
    return session;
  }
  if (status === 429 || data.error_code === 'over_request_rate_limit') throw new AuthError('RATE_LIMITED');
  // Expirado e errado ficam indistinguíveis de propósito.
  throw new AuthError(isClientError(status) ? 'INVALID_CODE' : 'PROVIDER');
}

// Resposta uniforme: 4xx "normal" (e-mail inexistente, já confirmado...) vira ok pra não revelar se a conta existe.
async function resendSignup(email) {
  const { status, data } = await call('/resend', { type: 'signup', email });
  if (status >= 200 && status < 300) return;
  if (status === 429 || data.error_code === 'over_email_send_rate_limit') throw new AuthError('RATE_LIMITED');
  if (data.error_code === 'email_address_not_authorized' || !isClientError(status)) throw new AuthError('PROVIDER');
}

async function refresh(refreshToken) {
  const { status, data } = await call('/token?grant_type=refresh_token', { refresh_token: refreshToken });
  if (status === 200) return toSession(data);
  throw new AuthError(isClientError(status) && status !== 429 ? 'INVALID_REFRESH' : 'PROVIDER');
}

async function signOut(accessToken) {
  const { status } = await call('/logout', null, accessToken);
  if (status >= 300) throw new AuthError('PROVIDER');
}

module.exports = { AuthError, signUp, signIn, verifyEmail, resendSignup, refresh, signOut };
