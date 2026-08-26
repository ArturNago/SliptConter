import React, { useState, useEffect } from 'react';
import { listarLotesVendas, buscarLoteVenda, estornarLoteVenda } from '../services/api';
import { Card, Button, Spinner, Badge, Modal } from '../components/common';
import { formatarNumero, formatarData } from '../utils/formatters';
import ImportSalesModal from '../components/ImportSalesModal';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  XCircle,
} from 'lucide-react';

const STATUS_LOTE = {
  concluido: { rotulo: 'Processado', tone: 'success' },
  estornado: { rotulo: 'Estornado', tone: 'danger' },
};

export default function VendasConciliacaoPage() {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalImportOpen, setModalImportOpen] = useState(false);
  const [detalheLote, setDetalheLote] = useState(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);
  const [estornando, setEstornando] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await listarLotesVendas();
      setLotes(data || []);
    } catch (err) {
      console.error('Erro ao carregar lotes de vendas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirDetalhe = async (id) => {
    setLoadingDetalhe(true);
    try {
      const res = await buscarLoteVenda(id);
      setDetalheLote(res);
    } catch (err) {
      alert('Erro ao carregar pedidos do lote.');
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const handleEstornar = async (loteId) => {
    if (!window.confirm('ATENÇÃO: Deseja realmente estornar este lote? Todas as baixas de estoque deste arquivo serão revertidas no ledger.')) {
      return;
    }

    setEstornando(true);
    try {
      const res = await estornarLoteVenda(loteId);
      alert(res.mensagem || 'Lote estornado com sucesso.');
      setDetalheLote(null);
      carregar();
    } catch (err) {
      alert(err.response?.data?.erro || 'Erro ao estornar lote.');
    } finally {
      setEstornando(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Conciliação de Vendas & Lotes de Importação</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--texto-suave)', fontSize: 13 }}>
            Histórico auditável de importações Upseller/Marketplaces, prevenção de duplicidade e estorno seguro de lotes.
          </p>
        </div>
        <Button onClick={() => setModalImportOpen(true)}>
          <UploadCloud size={16} /> Importar Planilha de Vendas
        </Button>
      </div>

      {/* Tabela de Lotes */}
      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spinner /></div>
        ) : lotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--texto-suave)' }}>
            <FileSpreadsheet size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p>Nenhum lote de vendas importado ainda.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Data Importação</th>
                  <th>Arquivo</th>
                  <th>Armazém Saída</th>
                  <th>Total Linhas</th>
                  <th>Baixas Realizadas</th>
                  <th>Não Mapeados</th>
                  <th>Erros</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => {
                  const statusInfo = STATUS_LOTE[lote.status] || STATUS_LOTE.concluido;
                  return (
                    <tr key={lote.id}>
                      <td>{formatarData(lote.created_at)}</td>
                      <td><b>{lote.nome_arquivo}</b></td>
                      <td>{lote.armazem_nome}</td>
                      <td>{formatarNumero(lote.total_linhas)}</td>
                      <td>
                        <b style={{ color: '#10b981' }}>{formatarNumero(lote.processados)}</b>
                      </td>
                      <td>
                        {lote.nao_mapeados > 0 ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{lote.nao_mapeados}</span>
                        ) : '0'}
                      </td>
                      <td>
                        {lote.erros > 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>{lote.erros}</span>
                        ) : '0'}
                      </td>
                      <td>
                        <Badge tone={statusInfo.tone}>{statusInfo.rotulo}</Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="sm" variant="secondary" onClick={() => abrirDetalhe(lote.id)}>
                            <Eye size={14} /> Detalhes
                          </Button>
                          {lote.status !== 'estornado' && (
                            <Button size="sm" variant="danger" onClick={() => handleEstornar(lote.id)}>
                              <RotateCcw size={14} /> Estornar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Importação */}
      <ImportSalesModal
        open={modalImportOpen}
        onClose={() => setModalImportOpen(false)}
        onImportSuccess={() => carregar()}
      />

      {/* Modal de Detalhes do Lote */}
      {detalheLote && (
        <Modal
          open={!!detalheLote}
          onClose={() => setDetalheLote(null)}
          title={`Detalhes do Lote: ${detalheLote.lote?.nome_arquivo}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Armazém: </span>
                <b>{detalheLote.lote?.armazem_nome}</b>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Processados: </span>
                <b style={{ color: '#10b981' }}>{detalheLote.lote?.processados}</b>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Status: </span>
                <Badge tone={STATUS_LOTE[detalheLote.lote?.status]?.tone}>
                  {STATUS_LOTE[detalheLote.lote?.status]?.rotulo}
                </Badge>
              </div>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Nº Pedido</th>
                    <th>Plataforma</th>
                    <th>SKU ERP</th>
                    <th>SKU Sistema</th>
                    <th>Qtd</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(detalheLote.pedidos || []).map((ped) => (
                    <tr key={ped.id}>
                      <td><b>{ped.numero_pedido}</b></td>
                      <td>{ped.plataforma}</td>
                      <td>{ped.sku_erp}</td>
                      <td>{ped.sku || '—'}</td>
                      <td>{ped.quantidade}</td>
                      <td>
                        <Badge tone={ped.status === 'processado' ? 'success' : ped.status === 'estornado' ? 'danger' : 'warning'}>
                          {ped.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setDetalheLote(null)}>Fechar</Button>
              {detalheLote.lote?.status !== 'estornado' && (
                <Button variant="danger" onClick={() => handleEstornar(detalheLote.lote?.id)} disabled={estornando}>
                  {estornando ? <Spinner size={16} /> : 'Estornar Este Lote'}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
