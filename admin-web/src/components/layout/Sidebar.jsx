import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Boxes, History, Camera, Layers, Users, Settings, LogOut, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/estoque', label: 'Matriz de Estoque', icon: Boxes },
  { to: '/conferências', label: 'Conferências', icon: Camera },
  { to: '/ledger', label: 'Movimentações', icon: History },
  { to: '/produtos', label: 'Cadastro (SKUs)', icon: Layers },
  { to: '/usuarios', label: 'Operadores', icon: Users },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { usuario, logout } = useAuth();
  const { tema, alternar } = useTheme();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        <img src="/logo.svg" alt="SliptConter" />
        <span>SliptConter</span>
      </div>

      <nav style={{ flex: 1, marginTop: 8 }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="nav-item" onClick={alternar} style={{ cursor: 'pointer' }}>
          {tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{tema === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
        </div>
        <div className="nav-item" onClick={logout} style={{ cursor: 'pointer' }}>
          <LogOut size={18} />
          <span>Sair</span>
        </div>
        {usuario && (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--texto-suave)' }}>
            {usuario.nome} · <b style={{ color: 'var(--texto)' }}>{usuario.papel}</b>
          </div>
        )}
      </div>
    </aside>
  );
}
