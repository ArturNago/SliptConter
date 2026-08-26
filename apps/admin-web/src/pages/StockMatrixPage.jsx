import React, { useState, useEffect, useMemo } from 'react';
import { useEstoqueConsolidado, useArmazens } from '../hooks/useStock';
import { useMobile } from '../hooks/useMobile';
import { StockTable, StockFilter, StockAdjustModal } from '../components/stock';
import TransferModal from '../components/stock/TransferModal';
import { Button, Modal } from '../components/common';
import { useNotification } from '../contexts/NotificationContext';
import { ajusteManualEstoque, getRelatorioExportacao } from '../services/stockService';
import { gerarCSV, baixarArquivo, formatarNumero } from '../utils/formatters';
import { ArrowRightLeft, Layers, RefreshCw, Search, X, Package, Warehouse } from 'lucide-react';
import api from '../services/api';

export default function StockMatrixPage() {
  const isMobile = useMobile();
  const [modoVisao, setModoVisao] = useState('matriz'); // 'matriz' (4 barracões lado a lado) | 'consolidado'
  const [filtros, setFiltros] = useState({ busca: '', armazemId: '', categoria: '', apenasBaixo: 'false' });
  const [limiteAlerta, setLimiteAlerta] = useState(0);
  const [selecionado, setSelecionado] = useState(null);
  const [modalAjuste, setModalAjuste] = useState(false);
  const [modalTransferencia, setModalTransferencia] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const { sucesso, erro } = useNotification();

  // Dados da Matriz Comparativa (4 Barracões)
  const [matrizData, setMatrizData] = useState({ armazens: [], itens: [] });
  const [carregandoMatriz, setCarregandoMatriz] = useState(false);

  const { data: armazensList } = useArmazens();

  const query = useMemo(
    () => ({ ...filtros, limiteAlerta }),
    [filtros, limiteAlerta]
  );
  const { data, loading, recarregar } = useEstoqueConsolidado(query);

  const carregarMatriz = async () => {
    setCarregandoMatriz(true);
    try {
      const res = await api.get(`/armazens/matriz-comparativa?busca=${encodeURIComponent(filtros.busca || '')}&categoria=${encodeURIComponent(filtros.categoria || '')}`);
      setMatrizData(res.data || { armazens: [], itens: [] });
    } catch (e) {
      console.error('Erro ao carregar matriz comparativa:', e);
    } finally {
      setCarregandoMatriz(false);
    }
  };

  useEffect(() => {
    carregarMatriz();
  }, [filtros.busca, filtros.categoria]);

  const recarregarTudo = () => {
    recarregar();
    carregarMatriz();
  };

  const exportarCSV = async () => {
    try {
      const res = await getRelatorioExportacao({ ...query, tipo: 'estoque' });
      const colunas = [
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'descricao', rotulo: 'Descricao' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'volumes_por_camada', rotulo: 'VolCamada' },
        { chave: 'camadas_maximas_palete', rotulo: 'Camadas' },
        { chave: 'saldo', rotulo: 'Saldo' },
        { chave: 'custo_medio', rotulo: 'CustoMedio' },
        { chave: 'preco_venda', rotulo: 'PrecoVenda' },
        { chave: 'status', rotulo: 'Status' },
      ];
      baixarArquivo(gerarCSV(res.linhas, colunas), `estoque_${new Date().toISOString().slice(0, 10)}.csv`);
      sucesso('Relatório exportado com sucesso.');
    } catch (e) {
      erro('Falha ao exportar relatório.');
    }
  };

  const confirmarAjuste = async (payload) => {
    try {
      await ajusteManualEstoque(payload);
      sucesso('Ajuste manual registrado no ledger.');
      recarregarTudo();
    } catch (e) {
      erro(e.response?.data?.erro || 'Falha ao registrar ajuste.');
    }
  };

  const abrirTransferenciaPara = (item) => {
    setSelecionado(item);
    setModalTransferencia(true);
  };

  const abrirDetalhe = (item) => {
    setSelecionado(item);
    setDetalhe(true);
  };

  return (
    <div className="page-container" style={{ paddingBottom: 90 }}>
      {/* Barra de Ações Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800 }}>
            Matriz de Estoque
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--texto-suave)' }}>
            Saldo consolidado e distribuição nos 4 barracões físicos
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <Button
            variant="primary"
            style={{ flex: isMobile ? 1 : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => {
              setSelecionado(null);
              setModalTransferencia(true);
            }}
          >
            <ArrowRightLeft size={16} />
            <span>Transferir entre Barracões</span>
          </Button>
          {!isMobile && (
            <Button variant="ghost" onClick={exportarCSV}>
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Campo de Busca Rápida de SKU no Celular e PC */}
      <div style={{ marginBottom: 14, position: 'relative' }}>
        <input
          type="text"
          className="input"
          placeholder="Buscar SKU, Nome do móvel ou Cor..."
          value={filtros.busca || ''}
          onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
          style={{ width: '100%', paddingLeft: 38, paddingRight: filtros.busca ? 36 : 12, height: 44, fontSize: 14 }}
        />
        <Search
          size={18}
          color="var(--texto-suave)"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
        />
        {filtros.busca && (
          <button
            type="button"
            onClick={() => setFiltros({ ...filtros, busca: '' })}
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--texto-suave)',
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Alternância de Visão no Desktop */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            type="button"
            className={`btn ${modoVisao === 'matriz' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setModoVisao('matriz')}
          >
            <Layers size={14} />
            <span>Matriz dos 4 Barracões (Lado a Lado)</span>
          </button>
          <button
            type="button"
            className={`btn ${modoVisao === 'consolidado' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setModoVisao('consolidado')}
          >
            Visão Consolidada Tradicional
          </button>
        </div>
      )}

      {/* =========================================================
          MODO MOBILE: CARDS TOUCH POR SKU (FÁCIL LEITURA NO CELULAR)
          ========================================================= */}
      {isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {carregandoMatriz ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <RefreshCw size={24} className="spinner" color="var(--primario)" />
              <p style={{ marginTop: 8, color: 'var(--texto-suave)', fontSize: 13 }}>Carregando saldos dos armazéns...</p>
            </div>
          ) : matrizData.itens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--bg-elevado)', borderRadius: 16, border: '1px solid var(--borda)' }}>
              <Package size={36} color="var(--texto-suave)" />
              <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>Nenhum produto encontrado</div>
              <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 2 }}>Tente buscar por outro nome ou código.</div>
            </div>
          ) : (
            matrizData.itens.map((item) => {
              const saldoTotal = item.saldo_total ?? 0;
              const isZerado = saldoTotal === 0;
              const isNegativo = saldoTotal < 0;

              return (
                <div
                  key={item.sku_id}
                  className="mobile-card"
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: '1px solid var(--borda)',
                    background: 'var(--bg-elevado)',
                    boxShadow: 'var(--sombra)',
                  }}
                >
                  {/* Cabeçalho do Card: SKU + Saldo Total em Destaque */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, paddingRight: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--primario)' }}>
                        {item.sku}
                      </span>
                      <div style={{ fontSize: 13, color: 'var(--texto)', fontWeight: 600, marginTop: 2 }}>
                        {item.descricao}
                      </div>
                      {item.categoria && (
                        <div style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 2 }}>
                          {item.categoria}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 900,
                          color: isNegativo ? 'var(--perigo)' : isZerado ? '#f59e0b' : 'var(--sucesso)',
                          background: isNegativo
                            ? 'rgba(239,68,68,0.12)'
                            : isZerado
                            ? 'rgba(245,158,11,0.12)'
                            : 'rgba(16,185,129,0.12)',
                          padding: '4px 10px',
                          borderRadius: 10,
                          display: 'inline-block',
                        }}
                      >
                        {formatarNumero(saldoTotal)} un
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--texto-suave)', marginTop: 2, fontWeight: 700 }}>
                        Saldo Total
                      </div>
                    </div>
                  </div>

                  {/* Grade 2x2 dos 4 Barracões Físicos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
                    {matrizData.armazens.map((arm) => {
                      const saldoArm = item.saldos_por_armazem_id?.[arm.id] ?? 0;
                      const armZero = saldoArm === 0;
                      const armNeg = saldoArm < 0;

                      return (
                        <div
                          key={arm.id}
                          style={{
                            background: armNeg
                              ? 'rgba(239,68,68,0.08)'
                              : armZero
                              ? 'rgba(245,158,11,0.05)'
                              : 'var(--vidro)',
                            border: `1px solid ${armNeg ? 'var(--perigo)' : 'var(--borda)'}`,
                            borderRadius: 10,
                            padding: '6px 10px',
                          }}
                        >
                          <div style={{ fontSize: 10, color: 'var(--texto-suave)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {arm.nome}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: armNeg ? 'var(--perigo)' : armZero ? 'var(--texto-suave)' : 'var(--sucesso)',
                              marginTop: 2,
                            }}
                          >
                            {formatarNumero(saldoArm)} un
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Botão de Transferência Rápida */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontWeight: 700, padding: 8 }}
                      onClick={() => abrirTransferenciaPara(item)}
                    >
                      <ArrowRightLeft size={14} />
                      <span>Transferir entre Barracões</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '8px 12px', fontSize: 12 }}
                      onClick={() => abrirDetalhe(item)}
                    >
                      Detalhes
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* =========================================================
           MODO DESKTOP: TABELA COMPARATIVA DOS 4 BARRACÕES LADO A LADO
           ========================================================= */
        modoVisao === 'matriz' ? (
          <div className="table-responsive" style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--borda)', overflow: 'hidden' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--vidro)', borderBottom: '1px solid var(--borda)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>SKU</th>
                  <th style={{ textAlign: 'left', padding: '12px 14px' }}>Descrição</th>
                  {matrizData.armazens.map((arm) => (
                    <th key={arm.id} style={{ textAlign: 'center', padding: '12px 10px', fontSize: 12 }}>
                      📍 {arm.nome}
                      <div style={{ fontSize: 10, color: 'var(--texto-suave)', fontWeight: 600 }}>({arm.codigo || 'ARM'})</div>
                    </th>
                  ))}
                  <th style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 800 }}>Saldo Total</th>
                  <th style={{ textAlign: 'center', padding: '12px 14px' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregandoMatriz ? (
                  <tr>
                    <td colSpan={3 + matrizData.armazens.length} style={{ textAlign: 'center', padding: 40 }}>
                      <RefreshCw size={24} className="spinner" color="var(--primario)" />
                      <p style={{ marginTop: 8, color: 'var(--texto-suave)' }}>Carregando matriz dos 4 barracões...</p>
                    </td>
                  </tr>
                ) : matrizData.itens.length === 0 ? (
                  <tr>
                    <td colSpan={3 + matrizData.armazens.length} style={{ textAlign: 'center', padding: 30, color: 'var(--texto-suave)' }}>
                      Nenhum produto encontrado com os filtros informados.
                    </td>
                  </tr>
                ) : (
                  matrizData.itens.map((item) => (
                    <tr key={item.sku_id} style={{ borderBottom: '1px solid var(--borda)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--primario)' }}>
                        {item.sku}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13 }}>
                        {item.descricao}
                        {item.categoria && (
                          <div style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{item.categoria}</div>
                        )}
                      </td>
                      {matrizData.armazens.map((arm) => {
                        const saldoArm = item.saldos_por_armazem_id?.[arm.id] ?? 0;
                        const isZero = saldoArm === 0;
                        const isNegativo = saldoArm < 0;

                        return (
                          <td
                            key={arm.id}
                            style={{
                              textAlign: 'center',
                              padding: '12px 10px',
                              fontWeight: 700,
                              background: isNegativo
                                ? 'rgba(239,68,68,0.12)'
                                : isZero
                                ? 'rgba(245,158,11,0.06)'
                                : 'transparent',
                            }}
                          >
                            <span
                              style={{
                                color: isNegativo ? 'var(--perigo)' : isZero ? 'var(--texto-suave)' : 'var(--sucesso)',
                                fontSize: 14,
                              }}
                            >
                              {formatarNumero(saldoArm)} un
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ textAlign: 'center', padding: '12px 14px', fontWeight: 900, fontSize: 15, color: 'var(--texto)' }}>
                        {formatarNumero(item.saldo_total)} un
                      </td>
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 8px' }}
                          onClick={() => abrirTransferenciaPara(item)}
                        >
                          <ArrowRightLeft size={13} />
                          <span>Transferir</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <StockTable data={data} loading={loading} onRowClick={abrirDetalhe} />
        )
      )}

      {/* Modal de Transferência de Dupla Entrada */}
      <TransferModal
        open={modalTransferencia}
        onClose={() => setModalTransferencia(false)}
        skuInicial={selecionado}
        armazens={armazensList || matrizData.armazens || []}
        onSucesso={(msg) => {
          sucesso(msg);
          recarregarTudo();
        }}
      />

      <StockAdjustModal
        open={modalAjuste}
        onClose={() => setModalAjuste(false)}
        item={selecionado}
        onConfirm={confirmarAjuste}
      />

      <Modal
        open={!!detalhe}
        onClose={() => setDetalhe(false)}
        title={selecionado ? `Detalhe — ${selecionado.sku}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetalhe(false)}>Fechar</Button>
            <Button variant="secondary" onClick={() => { setDetalhe(false); setModalTransferencia(true); }}>
              Transferir entre Barracões
            </Button>
            <Button variant="primary" onClick={() => { setDetalhe(false); setModalAjuste(true); }}>
              Ajuste Manual
            </Button>
          </>
        }
      >
        {selecionado && (
          <div className="stat-row">
            <div className="stat-pill">Descrição<b>{selecionado.descricao}</b></div>
            <div className="stat-pill">Categoria<b>{selecionado.categoria || '—'}</b></div>
            <div className="stat-pill">Saldo Global<b>{formatarNumero(selecionado.saldo_total || selecionado.saldo)}</b></div>
            <div className="stat-pill">Vol/Camada<b>{selecionado.volumes_por_camada || '—'}</b></div>
            <div className="stat-pill">Camadas<b>{selecionado.camadas_maximas_palete || '—'}</b></div>
          </div>
        )}
        <p style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
          Toda movimentação entre barracões deve ser realizada via "Transferir" para evitar saldos negativos ou distorções.
        </p>
      </Modal>
    </div>
  );
}
