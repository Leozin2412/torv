import axios, { InternalAxiosRequestConfig } from 'axios';
import { getSession, setSession, clearSession, Session } from './session';

// Web/iOS simulator: default localhost. Android emulator: http://10.0.2.2:3000.
// Physical phone (Expo Go): set EXPO_PUBLIC_API_URL=http://<LAN IP>:3000 in FrontEndTorv/.env.
const baseURL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// /auth/* goes through here: no interceptors, so a failing refresh can't loop.
export const authApi = axios.create({ baseURL });

const api = axios.create({ baseURL });

let onSessionExpired: (() => void) | null = null;
export const setOnSessionExpired = (cb: (() => void) | null) => { onSessionExpired = cb; };

let refreshing: Promise<Session | null> | null = null;

async function doRefresh(): Promise<Session | null> {
  const current = await getSession();
  if (!current) return null;
  try {
    const { data } = await authApi.post('/auth/refresh', { refresh_token: current.refresh_token });
    await setSession(data.session);
    return data.session;
  } catch (error) {
    // Only a rejected refresh token ends the session; network/5xx/429 keep it
    // so a flaky connection doesn't log the user out.
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    if (status === 400 || status === 401) {
      await clearSession();
      onSessionExpired?.();
      return null;
    }
    throw error;
  }
}

// Single-flight: concurrent callers share the same refresh.
export function refreshSession(): Promise<Session | null> {
  if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
  return refreshing;
}

api.interceptors.request.use(async (config) => {
  let session = await getSession();
  if (session && session.expires_at - Date.now() / 1000 < 60) {
    session = await refreshSession().catch(() => session);
  }
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(undefined, async (error) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  const status = error.response?.status;
  if (!config || config._retry || (status !== 401 && status !== 403)) throw error;

  config._retry = true;
  const session = await refreshSession();
  if (!session) throw error;
  return api(config);
});

export default api;
