import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Camera,
  ClipboardCheck,
  Boxes,
  Menu,
} from 'lucide-react';

export default function BottomNav({ onOpenMenu }) {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav">
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <LayoutDashboard size={20} />
        <span>Início</span>
      </NavLink>

      <NavLink
        to="/estoque"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <Boxes size={20} />
        <span>Estoque</span>
      </NavLink>

      <NavLink
        to="/contagem"
        className={({ isActive }) => `bottom-nav-item bottom-nav-center ${isActive ? 'active' : ''}`}
      >
        <div className="center-button">
          <Camera size={24} color="#fff" />
        </div>
        <span>Contagem IA</span>
      </NavLink>

      <NavLink
        to="/inventarios-contagem"
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <ClipboardCheck size={20} />
        <span>Inventário</span>
      </NavLink>

      <button type="button" className="bottom-nav-item menu-btn" onClick={onOpenMenu}>
        <Menu size={20} />
        <span>Menu</span>
      </button>
    </nav>
  );
}
