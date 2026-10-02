import React, { createContext, useState, useEffect, ReactNode } from 'react';
import api, { authApi, refreshSession, setOnSessionExpired } from '../services/api';
import { getSession, setSession, clearSession, Session } from '../services/session';
import { clearDraft } from '../utils/workoutDraft';

interface Profile {
  id: string;
  name: string;
  email: string;
  username?: string;
  goal?: string;
  photo_url?: string;
  goalCalories?: number;
  welcome_pending?: boolean; // true até a pessoa fechar a mensagem de boas-vindas
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  username?: string;
  birth_date: string; // YYYY-MM-DD
  weight_kg: number;
  height_cm: number;
  gender: 'Masculino' | 'Feminino';
  fitness_level: string;
  goal: string;
}

interface AuthContextData {
  signed: boolean;
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Resolves to true when the account needs e-mail confirmation before login.
  register: (payload: RegisterPayload) => Promise<boolean>;
  logout: () => Promise<void>;
  dismissWelcome: () => void;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [signed, setSigned] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const response = await api.get('/profile');
      setUser(response.data);
    } catch (error) {
      console.log('Error loading profile after auth', error);
      setUser(null);
    }
  };

  const startSession = async (session: Session) => {
    await setSession(session);
    setSigned(true);
    await loadProfile();
  };

  useEffect(() => {
    setOnSessionExpired(() => {
      setSigned(false);
      setUser(null);
    });

    getSession().then(async (current) => {
      if (current) {
        setSigned(true);
        await loadProfile();
      }
    }).finally(() => setLoading(false));

    return () => setOnSessionExpired(null);
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.post('/auth/login', { email, password });
    await startSession(data.session);
  };

  const register = async (payload: RegisterPayload) => {
    const { data } = await authApi.post('/auth/register', payload);
    if (data.session) await startSession(data.session);
    return !!data.confirmation_required;
  };

  const logout = async () => {
    let current = await getSession();
    // An expired access token can't revoke; refresh first so GoTrue accepts it.
    if (current && current.expires_at - Date.now() / 1000 < 60) {
      current = await refreshSession().catch(() => null);
    }
    if (current) {
      // Best-effort revoke; local sign-out happens regardless.
      await authApi.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${current.access_token}` },
      }).catch(() => {});
    }
    // Treino em andamento não fica no aparelho depois do logout (aparelho compartilhado).
    if (user?.id) await clearDraft(user.id).catch(() => {});
    await clearSession();
    setSigned(false);
    setUser(null);
  };

  // Fecha na hora; o POST é melhor-esforço: se falhar, a mensagem volta no próximo login.
  const dismissWelcome = () => {
    setUser((current) => (current ? { ...current, welcome_pending: false } : current));
    api.post('/profile/welcome', {}).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ signed, user, loading, login, register, logout, dismissWelcome }}>
      {children}
    </AuthContext.Provider>
  );
};
