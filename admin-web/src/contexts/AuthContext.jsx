import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

function decodificarToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { id: payload.sub, nome: payload.nome, papel: payload.papel, exp: payload.exp };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => authService.getToken());
  const [usuario, setUsuario] = useState(() => {
    const t = authService.getToken();
    return t ? decodificarToken(t) : null;
  });

  const login = useCallback(async (username, senha) => {
    const res = await authService.login(username, senha);
    setToken(res.token);
    setUsuario(decodificarToken(res.token));
    return res;
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setToken(null);
    setUsuario(null);
  }, []);

  const autenticado = !!token;
  const ehAdminOuGestor = usuario?.papel === 'admin' || usuario?.papel === 'gestor';

  return (
    <AuthContext.Provider value={{ token, usuario, autenticado, ehAdminOuGestor, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
