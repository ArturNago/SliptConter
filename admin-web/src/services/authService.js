/**
 * Serviço de autenticação do Painel Web.
 * Login é feito por username + senha (mesmo fluxo do app mobile / authController).
 */
import http from './api';
import { TOKEN_KEY } from './api';

export async function login(username, senha) {
  const { data } = await http.post('/auth/login', { username, senha });
  if (data.token) {
    sessionStorage.setItem(TOKEN_KEY, data.token);
  }
  return data;
}

export function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  return !!getToken();
}
