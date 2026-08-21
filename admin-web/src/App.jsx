import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useMobile } from './hooks/useMobile';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import NotificationStack from './components/common/NotificationStack';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StockMatrixPage from './pages/StockMatrixPage';
import ConferencesPage from './pages/ConferencesPage';
import LedgerHistoryPage from './pages/LedgerHistoryPage';
import ProductsPage from './pages/ProductsPage';
import MappingsPage from './pages/MappingsPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';

const TITLES = {
  '/dashboard': 'Dashboard Executivo',
  '/estoque': 'Matriz Completa de Estoque',
  '/conferências': 'Auditoria de Conferências',
  '/ledger': 'Ledger de Movimentações',
  '/produtos': 'Cadastro de SKUs (Master Data)',
  '/mapeamentos': 'Mapeamento de Anúncios',
  '/usuarios': 'Gestão de Operadores',
  '/configuracoes': 'Configurações',
};

function AppRoutes() {
  const { autenticado } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  if (!autenticado) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
        <Header title={TITLES[location.pathname] || 'SliptConter'} onMenuClick={() => setCollapsed((c) => !c)} />
        <div className="page-container">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/estoque" element={<StockMatrixPage />} />
            <Route path="/conferências" element={<ConferencesPage />} />
            <Route path="/ledger" element={<LedgerHistoryPage />} />
            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/mapeamentos" element={<MappingsPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
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
