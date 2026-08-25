import React from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ title, onMenuClick, isMobile, sidebarOpen }) {
  const { usuario } = useAuth();
  return (
    <header className="header">
      {isMobile ? (
        <button className="icon-btn" onClick={onMenuClick} aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      ) : (
        <button className="icon-btn" onClick={onMenuClick} aria-label="Menu">
          <Menu size={18} />
        </button>
      )}
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
