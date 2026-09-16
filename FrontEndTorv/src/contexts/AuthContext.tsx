import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const STORAGE_KEY = '@torv:auth';

interface User {
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
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Keep useEffect as a fallback in case state triggers differently
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Restore session on app start
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!stored) return;
      const { token: storedToken, user: storedUser } = JSON.parse(stored);
      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      setToken(storedToken);
      setUser(storedUser);
    });
  }, []);

  const login = (newToken: string, loggedUser: User) => {
    // Set headers synchronously before state updates trigger child renders
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(loggedUser);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: loggedUser }));
  };

  const logout = () => {
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ signed: !!token, user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
