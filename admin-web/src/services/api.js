/**
 * Cliente HTTP da API para o Painel Web Admin.
 * Base URL resolvida em build-time via __API_URL__ (definido no vite.config.js
 * a partir de VITE_API_URL / fallback do túnel Cloudflare).
 *
 * Mantém o token JWT em sessionStorage e redireciona para o login em 401.
 */
import axios from 'axios';

const API_URL = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'https://bemviverdecor.com.br');

export const TOKEN_KEY = 'sliptconter_admin_token';

const http = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // Sessão expirada/inválida: limpa e recarrega para a tela de login.
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default http;
