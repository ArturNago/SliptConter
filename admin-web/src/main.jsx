import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { sincronizarFilaOffline } from './services/offlineQueue';
import api from './services/api';
import './assets/global.css';

// Registro do Service Worker (PWA)
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Falha ao registrar Service Worker:', err);
    });
  });
}

// Sincronização automática da fila offline quando o navegador volta a ficar online
window.addEventListener('online', () => {
  sincronizarFilaOffline(api.http).then((res) => {
    if (res?.sincronizados > 0) {
      console.log(`[PWA] ${res.sincronizados} contagens offline sincronizadas com sucesso.`);
    }
  }).catch(() => {});
});

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </NotificationProvider>
    </ThemeProvider>
  </React.StrictMode>
);
