import axios from 'axios';
import { supabase } from './supabase';

// Escolha a URL base dependendo de como você está testando o app:

// 1. Se estiver testando no NAVEGADOR (Web) ou iOS Simulator:
const baseURL = 'http://localhost:3000';

// 2. Se estiver testando no ANDROID EMULATOR (Android Studio):
//const baseURL = 'http://10.0.2.2:3000';

// 3. Se estiver testando no CELULAR FÍSICO (Expo Go na mesma rede Wi-Fi):
// const baseURL = 'http://192.168.15.179:3000';  // IP atual da maquina (confira com ipconfig)

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export default api;
