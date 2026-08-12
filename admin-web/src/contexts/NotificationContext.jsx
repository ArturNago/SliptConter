import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const NotificationContext = createContext(null);

let idSeq = 0;

export function NotificationProvider({ children }) {
  const [notificacoes, setNotificacoes] = useState([]);
  const timers = useRef({});

  const remover = useCallback((id) => {
    setNotificacoes((list) => list.filter((n) => n.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const notificar = useCallback(
    (tipo, mensagem, duracao = 4000) => {
      const id = ++idSeq;
      setNotificacoes((list) => [...list, { id, tipo, mensagem }]);
      timers.current[id] = setTimeout(() => remover(id), duracao);
      return id;
    },
    [remover]
  );

  const sucesso = useCallback((msg) => notificar('sucesso', msg), [notificar]);
  const erro = useCallback((msg) => notificar('erro', msg, 6000), [notificar]);
  const info = useCallback((msg) => notificar('info', msg), [notificar]);

  return (
    <NotificationContext.Provider value={{ notificacoes, notificar, sucesso, erro, info, remover }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification deve ser usado dentro de NotificationProvider');
  return ctx;
}
