import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const TEMAS = {
  dark: {
    nome: 'dark',
    bg: '#0f172a',
    bgElevado: '#1e293b',
    bgCard: 'rgba(30, 41, 59, 0.7)',
    borda: 'rgba(148, 163, 184, 0.15)',
    texto: '#e2e8f0',
    textoSuave: '#94a3b8',
    primario: '#6366f1',
    primarioHover: '#4f46e5',
    sucesso: '#10b981',
    perigo: '#ef4444',
    aviso: '#f59e0b',
    vidro: 'rgba(255,255,255,0.04)',
  },
  light: {
    nome: 'light',
    bg: '#f1f5f9',
    bgElevado: '#ffffff',
    bgCard: 'rgba(255, 255, 255, 0.9)',
    borda: 'rgba(15, 23, 42, 0.1)',
    texto: '#0f172a',
    textoSuave: '#475569',
    primario: '#4f46e5',
    primarioHover: '#4338ca',
    sucesso: '#059669',
    perigo: '#dc2626',
    aviso: '#d97706',
    vidro: 'rgba(15, 23, 42, 0.03)',
  },
};

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => {
    const salvo = localStorage.getItem('sliptconter_tema');
    return salvo === 'light' ? 'light' : 'dark';
  });

  // Aplica o tema tanto no atributo data-tema (CSS) quanto nas variáveis
  // inline (garante consistência imediata em qualquer elemento).
  React.useEffect(() => {
    const cores = TEMAS[tema];
    const root = document.documentElement;
    root.setAttribute('data-tema', tema);
    Object.entries(cores).forEach(([chave, valor]) => {
      if (chave === 'nome') return;
      root.style.setProperty(`--${chave.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`, valor);
    });
  }, [tema]);

  const alternar = () => {
    setTema((t) => {
      const novo = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sliptconter_tema', novo);
      return novo;
    });
  };

  return (
    <ThemeContext.Provider value={{ tema, cores: TEMAS[tema], alternar }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx || !ctx.cores) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
