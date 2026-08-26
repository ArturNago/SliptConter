import React, { useState } from 'react';
import { useDashboardMetrics } from '../hooks/useStock';
import { KpiCard } from '../components/dashboard/KpiCard';
import { StockLineChart, DistributionDoughnut } from '../components/dashboard/StockChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { Card, Spinner, Badge, Button } from '../components/common';
import { Boxes, DollarSign, Camera, Warehouse, AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Activity, Award, BarChart3, Download } from 'lucide-react';
import { formatarNumero, formatarMoeda } from '../utils/formatters';

function ErrorState({ erro, onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <AlertTriangle size={48} color="var(--aviso)" style={{ marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px', color: 'var(--texto)' }}>Não foi possível carregar o dashboard</h3>
      <p style={{ color: 'var(--texto-suave)', margin: '0 0 20px', maxWidth: 480, marginInline: 'auto' }}>
        {erro || 'Verifique sua conexão ou tente novamente em instantes.'}
      </p>
      <Button variant="primary" onClick={onRetry}>
        <RefreshCw size={16} /> Tentar novamente
      </Button>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <Activity size={48} color="var(--texto-suave)" style={{ marginBottom: 16 }} />
      <h3 style={{ margin: '0 0 8px', color: 'var(--texto)' }}>Nenhum dado disponível</h3>
      <p style={{ color: 'var(--texto-suave)', margin: 0 }}>
        Ainda não há movimentações ou métricas registradas no sistema.
      </p>
    </div>
  );
}

function CrescimentoTag({ valor }) {
  if (valor === null || valor === undefined) {
    return <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>Sem dados</span>;
  }
  if (valor > 0) {
    return (
      <span style={{ color: 'var(--sucesso)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <TrendingUp size={14} /> +{valor.toFixed(1)}%
      </span>
    );
  }
  if (valor < 0) {
    return (
      <span style={{ color: 'var(--perigo)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <TrendingDown size={14} /> {valor.toFixed(1)}%
      </span>
    );
  }
  return <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>0%</span>;
}

import api from '../services/api';

export default function DashboardPage() {
  const { data, loading, error, recarregar } = useDashboardMetrics();
  const [retrying, setRetrying] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const response = await api.get('/relatorios/dashboard-estoque', {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Dashboard_Executivo_Estoque.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    await recarregar();
    setRetrying(false);
  };

  if (loading && !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80, flexDirection: 'column', gap: 16 }}>
        <Spinner size={44} />
        <p style={{ color: 'var(--texto-suave)', margin: 0 }}>Carregando métricas do dashboard…</p>
      </div>
    );
  }

  if (error && !data) {
    return <ErrorState erro={error} onRetry={handleRetry} />;
  }

  const m = data || {};

  const hasAnyData = Object.values(m).some((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v > 0 || v < 0;
    return !!v;
  });

  if (!hasAnyData) {
    return <EmptyState />;
  }

  const produtoMaisVendido = m.produtoMaisVendido || null;
  const crescimento = m.crescimentoVendas || {};
  const totalEmEstoque = typeof m.totalPecasEstoque === 'number' ? m.totalPecasEstoque : 0;
  const baixoEstoqueCount = Array.isArray(m.alertasEstoqueBaixo) ? m.alertasEstoqueBaixo.length : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Visão geral do estoque</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--texto-suave)', fontSize: 13 }}>
            Métricas consolidadas dos armazéns e movimentações recentes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" onClick={handleDownloadReport} disabled={downloading}>
            {downloading ? <Spinner size={16} /> : <Download size={16} />} 
            {downloading ? 'Gerando PDF...' : 'Gerar Relatório'}
          </Button>
          <Button variant="ghost" onClick={handleRetry} disabled={retrying}>
            <RefreshCw size={16} style={{ animation: retrying ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
          </Button>
        </div>
      </div>

      {/* Métricas fixas - sempre visíveis */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <KpiCard
          label="Total em Estoque"
          value={formatarNumero(totalEmEstoque)}
          icon={Boxes}
          tone="primary"
          subtitle="Volumes totais"
        />
        <KpiCard
          label="Crescimento de Vendas"
          value={crescimento.vendas_ultimos_30dias !== undefined ? formatarNumero(crescimento.vendas_ultimos_30dias) : '—'}
          icon={BarChart3}
          tone="success"
          trend={crescimento.crescimento_percentual > 0 ? 'up' : crescimento.crescimento_percentual < 0 ? 'down' : null}
          subtitle={<CrescimentoTag valor={crescimento.crescimento_percentual} />}
        />
        <KpiCard
          label="Produto Mais Vendido"
          value={produtoMaisVendido ? (produtoMaisVendido.descricao || produtoMaisVendido.sku || '—') : '—'}
          icon={Award}
          tone="warning"
          subtitle={
            produtoMaisVendido && produtoMaisVendido.quantidade_vendida
              ? `${formatarNumero(produtoMaisVendido.quantidade_vendida)} vendidos`
              : 'Sem vendas no período'
          }
        />
        <KpiCard
          label="Produtos Baixo Estoque"
          value={formatarNumero(baixoEstoqueCount)}
          icon={AlertTriangle}
          tone={baixoEstoqueCount > 0 ? 'warning' : 'success'}
          subtitle={baixoEstoqueCount > 0 ? 'Requer atenção' : 'Estoque saudável'}
        />
      </div>

      {m.alertasEstoqueBaixo && m.alertasEstoqueBaixo.length > 0 && (
        <Card style={{ marginBottom: 24, borderColor: 'var(--aviso)', background: 'color-mix(in srgb, var(--aviso) 8%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertTriangle color="var(--aviso)" size={22} />
            <b style={{ fontSize: 15 }}>Alertas de estoque baixo/zerado ({m.alertasEstoqueBaixo.length})</b>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {m.alertasEstoqueBaixo.slice(0, 10).map((a) => (
              <Badge key={a.id} tone={a.saldo <= 0 ? 'danger' : 'warning'}>
                {a.sku} — {formatarNumero(a.saldo)}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={18} color="var(--sucesso)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Entradas × Saídas × Ajustes (30 dias)</h3>
          </div>
          <StockLineChart serie={m.serieTemporal || []} />
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={18} color="var(--primario)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Distribuição por Armazém</h3>
          </div>
          <DistributionDoughnut dados={m.distribuicaoPorArmazem || []} labelKey="nome" valueKey="saldo" />
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Boxes size={18} color="var(--primario)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Distribuição por Categoria</h3>
          </div>
          <DistributionDoughnut dados={m.distribuicaoPorCategoria || []} labelKey="categoria" valueKey="saldo" />
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Activity size={18} color="var(--aviso)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Movimentações Recentes</h3>
          </div>
          <RecentActivity />
        </Card>
      </div>
    </div>
  );
}
