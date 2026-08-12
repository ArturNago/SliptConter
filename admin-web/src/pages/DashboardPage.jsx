import React from 'react';
import { useDashboardMetrics } from '../hooks/useStock';
import { KpiCard } from '../components/dashboard/KpiCard';
import { StockLineChart, DistributionDoughnut } from '../components/dashboard/StockChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { Card, Spinner, Badge } from '../components/common';
import { Boxes, DollarSign, Camera, Warehouse, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatarNumero, formatarMoeda } from '../utils/formatters';

export default function DashboardPage() {
  const { data, loading } = useDashboardMetrics();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Spinner size={40} />
      </div>
    );
  }

  const m = data || {};

  return (
    <div>
      <div className="kpi-grid">
        <KpiCard label="Total de Volumes em Estoque" value={formatarNumero(m.totalPecasEstoque)} icon={Boxes} />
        <KpiCard label="Valor Total do Estoque" value={formatarMoeda(m.valorTotalEstoque)} icon={DollarSign} />
        <KpiCard label="SKUs Ativos" value={formatarNumero(m.totalSkusAtivos)} icon={Boxes} />
        <KpiCard label="Conferências Hoje" value={formatarNumero(m.conferenciasHoje)} icon={Camera} />
        <KpiCard label="Armazéns" value={formatarNumero(m.totalArmazens)} icon={Warehouse} />
        <KpiCard
          label="Pendências Sheets"
          value={formatarNumero(m.pendenciasSheets)}
          icon={RefreshCw}
          tone="warning"
        />
      </div>

      {m.alertasEstoqueBaixo && m.alertasEstoqueBaixo.length > 0 && (
        <Card style={{ marginBottom: 24, borderColor: 'var(--aviso)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <AlertTriangle color="var(--aviso)" size={20} />
            <b>Alertas de estoque baixo/zerado ({m.alertasEstoqueBaixo.length})</b>
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
          <h3 style={{ marginTop: 0 }}>Entradas × Saídas × Ajustes (30 dias)</h3>
          <StockLineChart serie={m.serieTemporal || []} />
        </Card>
        <Card>
          <h3 style={{ marginTop: 0 }}>Distribuição por Armazém</h3>
          <DistributionDoughnut dados={m.distribuicaoPorArmazem || []} labelKey="nome" valueKey="saldo" />
        </Card>
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <Card>
          <h3 style={{ marginTop: 0 }}>Distribuição por Categoria</h3>
          <DistributionDoughnut dados={m.distribuicaoPorCategoria || []} labelKey="categoria" valueKey="saldo" />
        </Card>
        <Card>
          <h3 style={{ marginTop: 0 }}>Movimentações Recentes</h3>
          <RecentActivity />
        </Card>
      </div>
    </div>
  );
}
