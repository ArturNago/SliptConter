import React, { useState, useEffect } from 'react';
import { obterIndicadoresPCP } from '../services/api';
import { Card, Button, Spinner, Badge, Input, Select } from '../components/common';
import { formatarNumero, formatarMoeda } from '../utils/formatters';
import {
  TrendingUp,
  AlertTriangle,
  Boxes,
  CheckCircle,
  Clock,
  Package,
  Layers,
  RefreshCw,
  Zap,
  BarChart3,
} from 'lucide-react';

const STATUS_COBERTURA = {
  critico: { rotulo: 'Crítico (≤7d)', tone: 'danger' },
  atencao: { rotulo: 'Atenção (8-15d)', tone: 'warning' },
  ideal: { rotulo: 'Ideal (16-45d)', tone: 'success' },
  excesso: { rotulo: 'Excesso (>45d)', tone: 'neutral' },
  sem_giro: { rotulo: 'Sem Giro Recente', tone: 'neutral' },
  zerado: { rotulo: 'Estoque Zerado', tone: 'danger' },
};

const COR_CURVA = {
  A: '#10b981',
  B: '#f59e0b',
  C: '#94a3b8',
};

export default function PcpDashboardPage() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dias, setDias] = useState(30);
  const [filtroCurva, setFiltroCurva] = useState('');
  const [filtroCobertura, setFiltroCobertura] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const res = await obterIndicadoresPCP(dias);
      setDados(res);
    } catch (err) {
      console.error('Erro ao carregar métricas PCP:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [dias]);

  if (loading && !dados) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80, flexDirection: 'column', gap: 16 }}>
        <Spinner size={44} />
        <p style={{ color: 'var(--texto-suave)', margin: 0 }}>Calculando indicadores de PCP, Curva ABC e Giro...</p>
      </div>
    );
  }

  const skusFiltrados = (dados?.skus || []).filter((item) => {
    if (filtroCurva && item.curvaABC !== filtroCurva) return false;
    if (filtroCobertura && item.statusCobertura !== filtroCobertura) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return (
        item.sku.toLowerCase().includes(b) ||
        item.descricao.toLowerCase().includes(b) ||
        item.categoria.toLowerCase().includes(b)
      );
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Planejamento & Controle de Estoque (PCP)</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--texto-suave)', fontSize: 13 }}>
            Inteligência de Curva ABC, Acuracidade (IRA %), Dias de Cobertura e Sugestão de Produção.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Select value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            <option value={15}>Últimos 15 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={60}>Últimos 60 dias</option>
          </Select>
          <Button variant="ghost" onClick={carregar} disabled={loading}>
            <RefreshCw size={16} /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards Superiores */}
      <div className="kpi-grid">
        <Card style={{ borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--texto-suave)', fontWeight: 600 }}>Acuracidade Média (IRA)</span>
            <CheckCircle size={20} color="#10b981" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--texto)' }}>
            {dados?.acuracidadeInventario?.media_acuracidade_pct || '0'}%
          </div>
          <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
            {dados?.acuracidadeInventario?.total_inventarios || 0} inventários concluídos
          </span>
        </Card>

        <Card style={{ borderLeft: '4px solid #ef4444' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--texto-suave)', fontWeight: 600 }}>Ruptura Iminente (≤7d)</span>
            <AlertTriangle size={20} color="#ef4444" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>
            {dados?.resumoCobertura?.criticos || 0} SKUs
          </div>
          <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Necessitam produção imediata</span>
        </Card>

        <Card style={{ borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--texto-suave)', fontWeight: 600 }}>Estoque em Atenção (8-15d)</span>
            <Clock size={20} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>
            {dados?.resumoCobertura?.atencao || 0} SKUs
          </div>
          <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Ponto de reposição próximo</span>
        </Card>

        <Card style={{ borderLeft: '4px solid #0F766E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--texto-suave)', fontWeight: 600 }}>Distribuição Curva ABC</span>
            <Layers size={20} color="#0F766E" />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginTop: 4 }}>
            <span style={{ fontWeight: 800, color: '#10b981' }}>A: {dados?.distribuicaoCurvaABC?.A}</span>
            <span style={{ fontWeight: 800, color: '#f59e0b' }}>B: {dados?.distribuicaoCurvaABC?.B}</span>
            <span style={{ fontWeight: 800, color: '#94a3b8' }}>C: {dados?.distribuicaoCurvaABC?.C}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Total de {dados?.totalSkus || 0} SKUs ativos</span>
        </Card>
      </div>

      {/* Grid: Sugestão de Produção & Perdas/Avarias */}
      <div className="grid-2">
        {/* Sugestão de Produção */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Zap size={20} color="#0F766E" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Sugestão Prioritária de Produção (Meta 30 Dias)</h3>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {(dados?.sugestoesProducao || []).length === 0 ? (
              <p style={{ color: 'var(--texto-suave)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                Nenhuma necessidade urgente de produção para itens de Curva A/B.
              </p>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Curva</th>
                    <th>Saldo</th>
                    <th>Giro/Dia</th>
                    <th style={{ color: '#0F766E' }}>Produzir</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.sugestoesProducao.map((item) => (
                    <tr key={item.skuId}>
                      <td>
                        <b>{item.sku}</b>
                        <div style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{item.descricao}</div>
                      </td>
                      <td>
                        <Badge tone={item.curvaABC === 'A' ? 'success' : 'warning'}>{item.curvaABC}</Badge>
                      </td>
                      <td>{formatarNumero(item.saldoAtual)}</td>
                      <td>{item.mediaDiariaSaidas}/dia</td>
                      <td>
                        <b style={{ color: '#0F766E', fontSize: 14 }}>+{formatarNumero(item.sugestaoProducao)} un</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Motivos de Perdas e Avarias */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={20} color="#ef4444" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Impacto de Perdas & Avarias (Scrap)</h3>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {(dados?.perdasPorMotivo || []).length === 0 ? (
              <p style={{ color: 'var(--texto-suave)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                Nenhuma perda ou avaria negativa registrada no período.
              </p>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Motivo da Perda</th>
                    <th>Ocorrências</th>
                    <th>Peças</th>
                    <th>Impacto (Custo)</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.perdasPorMotivo.map((p, idx) => (
                    <tr key={idx}>
                      <td style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {p.motivo.replace(/_/g, ' ')}
                      </td>
                      <td>{p.ocorrencias}</td>
                      <td>{formatarNumero(p.total_pecas)} un</td>
                      <td style={{ color: '#ef4444', fontWeight: 700 }}>
                        {formatarMoeda(p.impacto_financeiro)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Matriz Completa de Giro e Cobertura PCP */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Boxes size={20} color="var(--primario)" />
            <h3 style={{ margin: 0, fontSize: 16 }}>Análise Detalhada de Cobertura e Curva ABC ({skusFiltrados.length})</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Input
              placeholder="Buscar SKU, produto..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ width: 220 }}
            />
            <Select value={filtroCurva} onChange={(e) => setFiltroCurva(e.target.value)}>
              <option value="">Todas Curvas</option>
              <option value="A">Curva A (80% Faturado)</option>
              <option value="B">Curva B (15% Faturado)</option>
              <option value="C">Curva C (5% Faturado)</option>
            </Select>
            <Select value={filtroCobertura} onChange={(e) => setFiltroCobertura(e.target.value)}>
              <option value="">Todos Status</option>
              <option value="critico">Crítico (≤7 dias)</option>
              <option value="atencao">Atenção (8-15 dias)</option>
              <option value="ideal">Ideal (16-45 dias)</option>
              <option value="excesso">Excesso (&gt;45 dias)</option>
            </Select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table" style={{ width: '100%', fontSize: 13 }}>
            <thead>
              <tr>
                <th>Curva</th>
                <th>SKU</th>
                <th>Descrição / Categoria</th>
                <th>Saídas ({dias}d)</th>
                <th>Giro/Dia</th>
                <th>Saldo Atual</th>
                <th>Dias Cobertura</th>
                <th>Status</th>
                <th>Meta 30d</th>
              </tr>
            </thead>
            <tbody>
              {skusFiltrados.map((item) => {
                const statusInfo = STATUS_COBERTURA[item.statusCobertura] || STATUS_COBERTURA.sem_giro;
                return (
                  <tr key={item.skuId}>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          textAlign: 'center',
                          lineHeight: '24px',
                          fontWeight: 800,
                          color: '#fff',
                          backgroundColor: COR_CURVA[item.curvaABC] || '#94a3b8',
                          fontSize: 12,
                        }}
                      >
                        {item.curvaABC}
                      </span>
                    </td>
                    <td><b>{item.sku}</b></td>
                    <td>
                      <div>{item.descricao}</div>
                      <div style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{item.categoria}</div>
                    </td>
                    <td>{formatarNumero(item.totalSaidas)}</td>
                    <td><b>{item.mediaDiariaSaidas}</b> /dia</td>
                    <td><b>{formatarNumero(item.saldoAtual)}</b></td>
                    <td>
                      {item.diasCobertura !== null ? (
                        <b>{item.diasCobertura} dias</b>
                      ) : (
                        <span style={{ color: 'var(--texto-suave)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={statusInfo.tone}>{statusInfo.rotulo}</Badge>
                    </td>
                    <td>{item.metaEstoque30Dias} un</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
