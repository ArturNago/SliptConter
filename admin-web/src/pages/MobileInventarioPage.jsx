import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Plus,
  Minus,
  AlertTriangle,
  ScanBarcode,
} from 'lucide-react';
import api from '../services/api';
import BarcodeScannerModal from '../components/common/BarcodeScannerModal';
import { sound } from '../services/soundFeedback';

export default function MobileInventarioPage() {
  const [ordens, setOrdens] = useState([]);
  const [ordemAtiva, setOrdemAtiva] = useState(null);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('pendentes'); // 'pendentes' | 'contados' | 'todos'
  const [busca, setBusca] = useState('');
  const [scannerAberto, setScannerAberto] = useState(false);

  // Item selecionado para contagem rápida
  const [itemEditando, setItemEditando] = useState(null);
  const [qtdContada, setQtdContada] = useState(0);
  const [salvandoItem, setSalvandoItem] = useState(false);

  useEffect(() => {
    carregarOrdens();
  }, []);

  const carregarOrdens = async () => {
    setLoading(true);
    try {
      const [resAbertos, resEmContagem] = await Promise.all([
        api.listarInventarios({ status: 'aberto' }),
        api.listarInventarios({ status: 'em_contagem' }),
      ]);
      setOrdens([...(resAbertos || []), ...(resEmContagem || [])]);
    } catch (err) {
      console.error('Erro ao carregar ordens:', err);
    } finally {
      setLoading(false);
    }
  };

  const abrirOrdem = async (id) => {
    setLoading(true);
    try {
      // contagemCega = true garante que o operador não veja o saldo prévio do sistema
      const res = await api.buscarInventario(id, true);
      setOrdemAtiva(res);
      setItens(res.itens || []);
      sound.tocarSucesso();
    } catch (err) {
      sound.tocarErro();
      alert('Erro ao carregar itens da ordem.');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScan = (scannedCode) => {
    setScannerAberto(false);
    const code = String(scannedCode).trim().toLowerCase();
    const encontrado = itens.find(
      (it) =>
        it.sku.toLowerCase() === code ||
        (it.codigo_barras_ean && it.codigo_barras_ean.toLowerCase() === code)
    );

    if (encontrado) {
      sound.tocarSucesso();
      setItemEditando(encontrado);
      setQtdContada(encontrado.quantidade_contada !== null ? encontrado.quantidade_contada : 0);
    } else {
      sound.tocarErro();
      alert(`Código "${scannedCode}" não pertence a esta ordem de inventário.`);
    }
  };

  const salvarContagemItem = async () => {
    if (!itemEditando || !ordemAtiva) return;

    setSalvandoItem(true);
    try {
      await api.registrarContagemInventario(
        ordemAtiva.id,
        itemEditando.sku_id,
        qtdContada
      );

      setItens((prev) =>
        prev.map((it) =>
          it.id === itemEditando.id
            ? { ...it, quantidade_contada: qtdContada, contado_at: new Date().toISOString() }
            : it
        )
      );

      sound.tocarSucesso();
      setItemEditando(null);
    } catch (err) {
      sound.tocarErro();
      alert(err.response?.data?.erro || 'Erro ao registrar contagem.');
    } finally {
      setSalvandoItem(false);
    }
  };

  const itensFiltrados = itens.filter((it) => {
    const contado = it.quantidade_contada !== null;
    if (filtro === 'pendentes' && contado) return false;
    if (filtro === 'contados' && !contado) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return (
        it.sku.toLowerCase().includes(b) ||
        it.sku_descricao.toLowerCase().includes(b) ||
        (it.codigo_barras_ean || '').toLowerCase().includes(b)
      );
    }
    return true;
  });

  const totalContados = itens.filter((it) => it.quantidade_contada !== null).length;

  if (loading && !ordemAtiva) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <RefreshCw size={28} className="spinner" color="var(--primaria)" />
        <p style={{ marginTop: '12px', color: 'var(--texto-suave)' }}>Carregando ordens...</p>
      </div>
    );
  }

  // Visão 1: Lista de Ordens de Inventário Abertas
  if (!ordemAtiva) {
    return (
      <div className="mobile-contagem-container">
        <div className="mobile-top-card">
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--texto)' }}>
            Inventários Cíclicos
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--texto-suave)', margin: '2px 0 0 0' }}>
            Ordens de contagem cega do galpão
          </p>
        </div>

        {ordens.length === 0 ? (
          <div className="mobile-empty-state">
            <ClipboardCheck size={48} color="var(--texto-suave)" />
            <div style={{ fontWeight: 700, fontSize: '16px', marginTop: '12px' }}>
              Nenhuma ordem aberta
            </div>
            <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '4px' }}>
              O setor de PCP criará novas ordens de auditoria para os armazéns.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ordens.map((ordem) => (
              <div
                key={ordem.id}
                className="mobile-card mobile-clickable-card"
                onClick={() => abrirOrdem(ordem.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primaria)', fontSize: '15px' }}>
                      {ordem.codigo}
                    </span>
                    <span className="badge-tag-status">{ordem.status.replace('_', ' ')}</span>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '4px' }}>
                    {ordem.descricao}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                    📍 {ordem.armazem_nome}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--primaria)', fontWeight: 700, marginTop: '4px' }}>
                    Progresso: {ordem.itens_contados} de {ordem.total_itens} itens
                  </div>
                </div>
                <ChevronRight size={20} color="var(--texto-suave)" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Visão 2: Itens da Ordem em Modo Cego
  return (
    <div className="mobile-contagem-container">
      <div className="mobile-top-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setOrdemAtiva(null)}
          >
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{ordemAtiva.codigo}</h2>
            <p style={{ fontSize: '12px', color: 'var(--texto-suave)', margin: 0 }}>
              {ordemAtiva.armazem_nome} · Contagem Cega
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setScannerAberto(true)}
          >
            <ScanBarcode size={16} />
            <span>Bipar</span>
          </button>
        </div>

        {/* Barra de Progresso */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
            <span>Itens Contados no Galpão</span>
            <span style={{ color: 'var(--primaria)' }}>
              {totalContados} / {itens.length} ({itens.length > 0 ? Math.round((totalContados / itens.length) * 100) : 0}%)
            </span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${itens.length > 0 ? (totalContados / itens.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Busca & Filtros */}
      <div style={{ margin: '8px 0' }}>
        <input
          type="text"
          className="input"
          placeholder="Buscar SKU ou Código de Barras..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div className="filter-pill-tabs">
          {[
            { id: 'pendentes', label: 'Pendentes' },
            { id: 'contados', label: 'Já Contados' },
            { id: 'todos', label: 'Todos' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`filter-pill ${filtro === t.id ? 'active' : ''}`}
              onClick={() => setFiltro(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Itens Cega */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {itensFiltrados.map((item) => {
          const contado = item.quantidade_contada !== null;
          return (
            <div
              key={item.id}
              className="mobile-card mobile-item-count-card"
              onClick={() => {
                setItemEditando(item);
                setQtdContada(item.quantidade_contada !== null ? item.quantidade_contada : 0);
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--texto)' }}>
                  {item.sku}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                  {item.sku_descricao}
                </div>
                {item.codigo_barras_ean && (
                  <div style={{ fontSize: '11px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                    EAN: {item.codigo_barras_ean}
                  </div>
                )}
              </div>

              <div>
                {contado ? (
                  <div className="badge-item-contado">
                    <CheckCircle2 size={14} />
                    <span>{item.quantidade_contada} un</span>
                  </div>
                ) : (
                  <div className="badge-item-pendente">Contar</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Lançar Contagem Física */}
      {itemEditando && (
        <div className="modal-backdrop">
          <div className="modal-content mobile-modal-box">
            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px 0', textAlign: 'center' }}>
              Contagem Física
            </h3>
            <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--primaria)', fontWeight: 700 }}>
              SKU: {itemEditando.sku}
            </div>
            <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--texto-suave)', marginBottom: '16px' }}>
              {itemEditando.sku_descricao}
            </div>

            <div className="stepper-center-box">
              <button
                type="button"
                className="stepper-btn-large"
                onClick={() => setQtdContada((v) => Math.max(0, v - 1))}
              >
                <Minus size={24} />
              </button>
              <input
                type="number"
                className="stepper-input-large"
                value={qtdContada}
                onChange={(e) => setQtdContada(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
              <button
                type="button"
                className="stepper-btn-large"
                onClick={() => setQtdContada((v) => v + 1)}
              >
                <Plus size={24} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setItemEditando(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={salvarContagemItem}
                disabled={salvandoItem}
              >
                {salvandoItem ? <RefreshCw size={18} className="spinner" /> : 'Salvar Contagem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scanner de Código de Barras */}
      <BarcodeScannerModal
        open={scannerAberto}
        onClose={() => setScannerAberto(false)}
        onScan={handleBarcodeScan}
      />
    </div>
  );
}
