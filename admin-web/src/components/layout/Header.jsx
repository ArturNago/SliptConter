import React from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ title, onMenuClick }) {
  const { usuario } = useAuth();
  return (
    <header className="header">
      <button className="icon-btn" onClick={onMenuClick} aria-label="Menu">
        <Menu size={18} />
      </button>
      <h1>{title}</h1>
      <div className="spacer" />
      {usuario && (
        <div style={{ fontSize: 13, color: 'var(--texto-suave)' }}>
          Olá, <b style={{ color: 'var(--texto)' }}>{usuario.nome}</b>
        </div>
      )}
    </header>
  );
}
