import React, { createContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import api from '../services/api';

interface Profile {
  id: string;
  name: string;
  email: string;
  username?: string;
  goal?: string;
  photo_url?: string;
  goalCalories?: number;
}

interface AuthContextData {
  signed: boolean;
  user: Profile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      setSession(current);
      if (current) {
        loadProfile().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile();
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ signed: !!session, user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
