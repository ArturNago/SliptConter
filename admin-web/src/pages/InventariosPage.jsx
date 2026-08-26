import React, { useState, useEffect } from 'react';
import {
  listarInventarios,
  buscarInventario,
  criarInventario,
  finalizarInventario,
  cancelarInventario,
  listarArmazens,
} from '../services/api';
import { Card, Button, Spinner, Badge, Modal, Input, Select } from '../components/common';
import { formatarNumero, formatarData } from '../utils/formatters';
import {
  ClipboardCheck,
  Plus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Eye,
  Check,
  X,
  Warehouse,
} from 'lucide-react';

const STATUS_MAP = {
  aberto: { rotulo: 'Aberto', tone: 'neutral' },
  em_contagem: { rotulo: 'Em Contagem', tone: 'warning' },
  concluido: { rotulo: 'Concluído', tone: 'success' },
  cancelado: { rotulo: 'Cancelado', tone: 'danger' },
};

export default function InventariosPage() {
  const [ordens, setOrdens] = useState([]);
  const [armazens, setArmazens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalNovo, setModalNovo] = useState(false);
  const [detalheOrdem, setDetalheOrdem] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [processandoAprovacao, setProcessandoAprovacao] = useState(false);

  // Form de criação
  const [formArmazem, setFormArmazem] = useState('');
  const [formTipo, setFormTipo] = useState('ciclico');
  const [formDescricao, setFormDescricao] = useState('');
  const [formCategoria, setFormCategoria] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [ordensRes, armazensRes] = await Promise.all([
        listarInventarios(),
        listarArmazens(),
      ]);
      setOrdens(ordensRes || []);
      setArmazens(armazensRes || []);
      if (armazensRes?.length > 0 && !formArmazem) {
        setFormArmazem(armazensRes[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar inventários:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirDetalhes = async (id) => {
    setLoadingDetalhe(true);
    try {
      const res = await buscarInventario(id, false); // inclui saldos do sistema para o PCP
      setDetalheOrdem(res);
    } catch (err) {
      alert('Erro ao carregar detalhes da ordem.');
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const handleCriar = async () => {
    if (!formArmazem) {
      alert('Selecione um armazém.');
      return;
    }

    try {
      await criarInventario({
        armazemId: formArmazem,
        tipo: formTipo,
        descricao: formDescricao,
        categoria: formCategoria || null,
      });
      setModalNovo(false);
      setFormDescricao('');
      setFormCategoria('');
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao criar inventário.');
    }
  };

  const handleFinalizar = async () => {
    if (!detalheOrdem) return;
    if (!window.confirm(`Deseja aprovar e conciliar os ajustes do inventário ${detalheOrdem.codigo}? As divergências serão gravadas no ledger com auditoria.`)) {
      return;
    }

    setProcessandoAprovacao(true);
    try {
      const res = await finalizarInventario(detalheOrdem.id);
      alert(`Inventário concluído com sucesso!\nAcuracidade (IRA): ${res.acuracidadePct}%\nAjustes gerados no ledger: ${res.ajustesRealizados}`);
      setDetalheOrdem(null);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao finalizar inventário.');
    } finally {
      setProcessandoAprovacao(false);
    }
  };

  const handleCancelar = async (id) => {
    if (!window.confirm('Tem certeza que deseja cancelar este inventário?')) return;
    try {
      await cancelarInventario(id);
      setDetalheOrdem(null);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao cancelar inventário.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Inventários Cíclicos & Auditoria (PCP)</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--texto-suave)', fontSize: 13 }}>
            Ordens de contagem cega para operadores no galpão com conciliação e aprovação pelo PCP.
          </p>
        </div>
        <Button onClick={() => setModalNovo(true)}>
          <Plus size={16} /> Novo Inventário
        </Button>
      </div>

      {/* Tabela de Ordens */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
        ) : ordens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--texto-suave)' }}>
            <ClipboardCheck size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>Nenhuma ordem de inventário cadastrada ainda.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Armazém</th>
                  <th>Tipo / Descrição</th>
                  <th>Progresso Contagem</th>
                  <th>Acuracidade (IRA)</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordens.map((ordem) => {
                  const statusInfo = STATUS_MAP[ordem.status] || STATUS_MAP.aberto;
                  const pctProgresso = ordem.total_itens > 0
                    ? Math.round((ordem.itens_contados / ordem.total_itens) * 100)
                    : 0;

                  return (
                    <tr key={ordem.id}>
                      <td><b>{ordem.codigo}</b></td>
                      <td>{ordem.armazem_nome}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{ordem.descricao}</div>
                        <div style={{ fontSize: 11, color: 'var(--texto-suave)', textTransform: 'capitalize' }}>
                          Tipo: {ordem.tipo}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, background: '#e2e8f0', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pctProgresso}%`, background: '#0F766E', height: '100%' }} />
                          </div>
                          <span>{ordem.itens_contados}/{ordem.total_itens} ({pctProgresso}%)</span>
                        </div>
                      </td>
                      <td>
                        {ordem.status === 'concluido' ? (
                          <b style={{ color: Number(ordem.acuracidade_pct) >= 95 ? '#10b981' : '#f59e0b' }}>
                            {ordem.acuracidade_pct}%
                          </b>
                        ) : (
                          <span style={{ color: 'var(--texto-suave)' }}>Em andamento</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={statusInfo.tone}>{statusInfo.rotulo}</Badge>
                      </td>
                      <td>{formatarData(ordem.created_at)}</td>
                      <td>
                        <Button size="sm" variant="secondary" onClick={() => abrirDetalhes(ordem.id)}>
                          <Eye size={14} /> Detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Criar Inventário */}
      <Modal open={modalNovo} onClose={() => setModalNovo(false)} title="Criar Nova Ordem de Inventário">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="field-label">Armazém *</label>
            <Select value={formArmazem} onChange={(e) => setFormArmazem(e.target.value)}>
              {armazens.map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="field-label">Tipo de Inventário</label>
            <Select value={formTipo} onChange={(e) => setFormTipo(e.target.value)}>
              <option value="ciclico">Inventário Cíclico (Rotina Semanal/Mensal)</option>
              <option value="amostragem">Amostragem Curva ABC</option>
              <option value="geral">Balanço Geral de Armazém</option>
            </Select>
          </div>

          <div>
            <label className="field-label">Descrição / Observação</label>
            <Input
              value={formDescricao}
              onChange={(e) => setFormDescricao(e.target.value)}
              placeholder="Ex: Auditoria Semanal Linha Sala de Estar"
            />
          </div>

          <div>
            <label className="field-label">Filtrar por Categoria (Opcional - Vazio = Todos)</label>
            <Input
              value={formCategoria}
              onChange={(e) => setFormCategoria(e.target.value)}
              placeholder="Ex: Aparadores, Racks, Mesas"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button variant="secondary" onClick={() => setModalNovo(false)}>Cancelar</Button>
            <Button onClick={handleCriar}>Iniciar Ordem</Button>
          </div>
        </div>
      </Modal>

      {/* Modal Detalhes / Conciliação */}
      {detalheOrdem && (
        <Modal
          open={!!detalheOrdem}
          onClose={() => setDetalheOrdem(null)}
          title={`Inventário: ${detalheOrdem.codigo} (${detalheOrdem.armazem_nome})`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Status: </span>
                <Badge tone={STATUS_MAP[detalheOrdem.status]?.tone}>
                  {STATUS_MAP[detalheOrdem.status]?.rotulo}
                </Badge>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Contados: </span>
                <b>{detalheOrdem.itens_contados} / {detalheOrdem.total_itens}</b>
              </div>
              {detalheOrdem.acuracidade_pct !== null && (
                <div>
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Acuracidade (IRA): </span>
                  <b style={{ color: '#10b981' }}>{detalheOrdem.acuracidade_pct}%</b>
                </div>
              )}
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Descrição</th>
                    <th>Saldo Sistema</th>
                    <th>Contado</th>
                    <th>Divergência</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalheOrdem.itens || []).map((item) => {
                    const divergente = item.divergencia !== null && item.divergencia !== 0;
                    return (
                      <tr key={item.id} style={{ backgroundColor: divergente ? '#fef2f2' : 'transparent' }}>
                        <td><b>{item.sku}</b></td>
                        <td>{item.sku_descricao}</td>
                        <td>{formatarNumero(item.saldo_sistema_congelado)}</td>
                        <td>
                          {item.quantidade_contada !== null ? (
                            <b>{formatarNumero(item.quantidade_contada)}</b>
                          ) : (
                            <span style={{ color: 'var(--texto-suave)' }}>Pendente</span>
                          )}
                        </td>
                        <td>
                          {item.divergencia !== null ? (
                            <b style={{ color: item.divergencia === 0 ? '#10b981' : '#ef4444' }}>
                              {item.divergencia > 0 ? `+${item.divergencia}` : item.divergencia}
                            </b>
                          ) : '—'}
                        </td>
                        <td>
                          {item.quantidade_contada === null ? (
                            <Badge tone="neutral">Não contado</Badge>
                          ) : item.divergencia === 0 ? (
                            <Badge tone="success">Acurado</Badge>
                          ) : (
                            <Badge tone="danger">Divergência</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              {detalheOrdem.status !== 'concluido' && detalheOrdem.status !== 'cancelado' ? (
                <>
                  <Button variant="danger" size="sm" onClick={() => handleCancelar(detalheOrdem.id)}>
                    Cancelar Ordem
                  </Button>
                  <Button
                    onClick={handleFinalizar}
                    disabled={processandoAprovacao || detalheOrdem.itens_contados === 0}
                  >
                    {processandoAprovacao ? <Spinner size={16} /> : 'Aprovar & Conciliar no Ledger'}
                  </Button>
                </>
              ) : (
                <div style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
                  Ordem {detalheOrdem.status}. Finalizada em {formatarData(detalheOrdem.updated_at)}.
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
