import axios from 'axios';

// Escolha a URL base dependendo de como você está testando o app:

// 1. Se estiver testando no NAVEGADOR (Web) ou iOS Simulator:
// const baseURL = 'http://localhost:3000';

// 2. Se estiver testando no ANDROID EMULATOR (Android Studio):
// const baseURL = 'http://10.0.2.2:3000';

// 3. Se estiver testando no CELULAR FÍSICO (Expo Go na mesma rede Wi-Fi):
const baseURL = 'http://192.168.84.1:3000';

const api = axios.create({
  baseURL,
});

// We will add the token to the requests using an interceptor inside the AuthContext
// or we can export a function to update the token here, but doing it in the Context is cleaner.

export default api;
