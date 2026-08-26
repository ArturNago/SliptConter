import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useMobile } from './hooks/useMobile';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import BottomNav from './components/layout/BottomNav';
import NotificationStack from './components/common/NotificationStack';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PcpDashboardPage from './pages/PcpDashboardPage';
import InventariosPage from './pages/InventariosPage';
import VendasConciliacaoPage from './pages/VendasConciliacaoPage';
import StockMatrixPage from './pages/StockMatrixPage';
import ConferencesPage from './pages/ConferencesPage';
import LedgerHistoryPage from './pages/LedgerHistoryPage';
import ProductsPage from './pages/ProductsPage';
import MappingsPage from './pages/MappingsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import MobileContagemPage from './pages/MobileContagemPage';
import MobileManualCountPage from './pages/MobileManualCountPage';
import MobileInventarioPage from './pages/MobileInventarioPage';

const TITLES = {
  '/dashboard': 'Dashboard Executivo',
  '/contagem': 'Contagem com IA (Câmera)',
  '/contagem-manual': 'Lançamento Manual de Estoque',
  '/inventarios-contagem': 'Inventário Cíclico (Galpão)',
  '/pcp': 'Planejamento & Controle (PCP)',
  '/inventarios': 'Inventários Cíclicos & Auditoria',
  '/vendas-conciliacao': 'Conciliação de Vendas & Lotes',
  '/estoque': 'Matriz Completa de Estoque',
  '/conferências': 'Auditoria de Conferências',
  '/ledger': 'Ledger de Movimentações',
  '/produtos': 'Cadastro de SKUs (Master Data)',
  '/mapeamentos': 'Mapeamento de Anúncios & Kits',
  '/usuarios': 'Gestão de Operadores',
  '/configuracoes': 'Configurações',
};

function AppRoutes() {
  const { autenticado } = useAuth();
  const location = useLocation();
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    document.body.style.overflow = isMobile && sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobile, sidebarOpen]);

  const handleMenuClick = () => {
    if (isMobile) {
      setSidebarOpen((o) => !o);
    } else {
      setCollapsed((c) => !c);
    }
  };

  if (!autenticado) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className={`app-shell ${isMobile ? 'is-mobile-view' : ''}`}>
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar
        collapsed={collapsed}
        onToggle={handleMenuClick}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Header
          title={TITLES[location.pathname] || 'Tebarrot Estoque'}
          onMenuClick={handleMenuClick}
          isMobile={isMobile}
          sidebarOpen={sidebarOpen}
        />
        <div className="page-container">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/contagem" element={<MobileContagemPage />} />
            <Route path="/contagem-manual" element={<MobileManualCountPage />} />
            <Route path="/inventarios-contagem" element={<MobileInventarioPage />} />
            <Route path="/pcp" element={<PcpDashboardPage />} />
            <Route path="/inventarios" element={<InventariosPage />} />
            <Route path="/vendas-conciliacao" element={<VendasConciliacaoPage />} />
            <Route path="/estoque" element={<StockMatrixPage />} />
            <Route path="/conferências" element={<ConferencesPage />} />
            <Route path="/ledger" element={<LedgerHistoryPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/mapeamentos" element={<MappingsPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={isMobile ? "/contagem" : "/dashboard"} replace />} />
          </Routes>
        </div>
      </div>
      {isMobile && <BottomNav onOpenMenu={() => setSidebarOpen(true)} />}
    </div>
  );
}

export default function App() {
  return (
    <>
      <AppRoutes />
      <NotificationStack />
    </>
  );
}
