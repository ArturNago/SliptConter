import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  Edit3,
  ClipboardCheck,
  TrendingUp,
  FileSpreadsheet,
  Boxes,
  History,
  Layers,
  Users,
  Settings,
  LogOut,
  Sun,
  Moon,
  Link2,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contagem', label: 'Contagem IA (Câmera)', icon: Camera },
  { to: '/contagem-manual', label: 'Contagem Manual', icon: Edit3 },
  { to: '/inventarios-contagem', label: 'Inventário (Galpão)', icon: ClipboardCheck },
  { to: '/pcp', label: 'Painel PCP (Curva ABC)', icon: TrendingUp },
  { to: '/inventarios', label: 'Gestão Inventários', icon: ClipboardCheck },
  { to: '/vendas-conciliacao', label: 'Conciliação Vendas', icon: FileSpreadsheet },
  { to: '/estoque', label: 'Matriz de Estoque', icon: Boxes },
  { to: '/conferências', label: 'Histórico Conferências', icon: History },
  { to: '/ledger', label: 'Ledger Movimentações', icon: History },
  { to: '/produtos', label: 'Cadastro (SKUs)', icon: Layers },
  { to: '/mapeamentos', label: 'Mapeamentos & Kits', icon: Link2 },
  { to: '/usuarios', label: 'Operadores', icon: Users },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onClose }) {
  const { usuario, logout } = useAuth();
  const { tema, alternar } = useTheme();

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.svg" alt="Tebarrot Estoque" />
          <span>Tebarrot Estoque</span>
        </div>
        {mobileOpen && (
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            style={{ color: 'var(--texto-suave)', padding: 4 }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav style={{ flex: 1, marginTop: 8, overflowY: 'auto' }}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (onClose) onClose();
              }}
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
