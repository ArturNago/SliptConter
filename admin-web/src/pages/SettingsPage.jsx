import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Button } from '../components/common';
import { useNotification } from '../contexts/NotificationContext';

export default function SettingsPage() {
  const { tema, alternar } = useTheme();
  const { info } = useNotification();
  const apiUrl = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'https://estoque.puratienda.store');

  return (
    <div style={{ maxWidth: 640 }}>
      <Card>
        <h3 style={{ marginTop: 0 }}>Aparência</h3>
        <p style={{ color: 'var(--texto-suave)' }}>Tema atual: <b>{tema === 'dark' ? 'Escuro' : 'Claro'}</b></p>
        <Button variant="primary" onClick={() => { alternar(); }}>
          Alternar para {tema === 'dark' ? 'Claro' : 'Escuro'}
        </Button>
      </Card>

      <Card style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Conexão</h3>
        <p style={{ color: 'var(--texto-suave)' }}>API base: <b>{apiUrl}</b></p>
        <Button variant="ghost" onClick={() => info('Conexão configurada em build-time (VITE_API_URL).')}>
          Verificar status
        </Button>
      </Card>

      <Card style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>Sobre</h3>
        <p style={{ color: 'var(--texto-suave)' }}>
          SliptConter Web Admin — Painel de Administração de Estoque.<br />
          Integração com a API Node.js (Express + PostgreSQL) e o app móvel de galpão.
        </p>
      </Card>
    </div>
  );
}
