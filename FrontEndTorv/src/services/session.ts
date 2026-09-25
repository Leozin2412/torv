import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  user: { id: string; email: string };
}

const KEY = 'torv.session';

// expo-secure-store has no web implementation (its web build is a stub that
// throws), so web falls back to localStorage — same as before.
const storage = Platform.OS === 'web'
  ? {
      get: async () => localStorage.getItem(KEY),
      set: async (value: string) => localStorage.setItem(KEY, value),
      remove: async () => localStorage.removeItem(KEY),
    }
  : {
      get: () => SecureStore.getItemAsync(KEY),
      set: (value: string) => SecureStore.setItemAsync(KEY, value),
      remove: () => SecureStore.deleteItemAsync(KEY),
    };

export async function getSession(): Promise<Session | null> {
  const raw = await storage.get();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    await storage.remove();
    return null;
  }
}

export const setSession = (session: Session) => storage.set(JSON.stringify(session));

export const clearSession = () => storage.remove();
