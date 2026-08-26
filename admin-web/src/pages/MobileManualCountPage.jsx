import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Edit3,
  Camera,
  Layers,
  Box,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Minus,
  Check,
} from 'lucide-react';
import api from '../services/api';
import FastProductSelector from '../components/contagem/FastProductSelector';
import { sound } from '../services/soundFeedback';

export default function MobileManualCountPage() {
  const navigate = useNavigate();

  const [armazens, setArmazens] = useState([]);
  const [produtos, setProdutos] = useState([]);

  const [armazemId, setArmazemId] = useState('');
  const [skuSelecionado, setSkuSelecionado] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [tipoMovimentacao, setTipoMovimentacao] = useState('entrada'); // 'entrada' | 'saida' | 'ajuste'
  const [observacao, setObservacao] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      const [resArmazens, resProdutos] = await Promise.all([
        api.get('/armazens'),
        api.get('/produtos?limit=200'),
      ]);
      const listaArmazens = Array.isArray(resArmazens.data) ? resArmazens.data : (Array.isArray(resArmazens) ? resArmazens : []);
      const listaProdutos = Array.isArray(resProdutos.data) ? resProdutos.data : (Array.isArray(resProdutos) ? resProdutos : []);

      setArmazens(listaArmazens);
      if (listaArmazens.length > 0 && !armazemId) {
        setArmazemId(listaArmazens[0].id);
      }
      setProdutos(listaProdutos);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const handleConfirmar = async (e) => {
    e.preventDefault();
    if (!skuSelecionado) {
      sound.tocarErro();
      setErro('Selecione um produto.');
      return;
    }
    if (!armazemId) {
      sound.tocarErro();
      setErro('Selecione um armazém.');
      return;
    }
    if (!quantidade || quantidade <= 0) {
      sound.tocarErro();
      setErro('A quantidade deve ser maior que zero.');
      return;
    }

    setSalvando(true);
    setErro(null);

    const dados = {
      skuId: skuSelecionado.id,
      armazemId,
      quantidadeContada: quantidade,
      origem: 'manual',
      tipoMovimentacao,
      observacao,
    };

    try {
      const form = new FormData();
      form.append('skuId', dados.skuId);
      form.append('armazemId', dados.armazemId);
      form.append('quantidadeContada', String(dados.quantidadeContada));
      form.append('origem', dados.origem);
      form.append('tipoMovimentacao', dados.tipoMovimentacao);
      if (observacao) form.append('observacao', observacao);

      await api.post('/conferencias', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      sound.tocarSucesso();
      const armazemObj = armazens.find((a) => a.id === armazemId);
      setSucesso(`Lançamento manual de ${quantidade} un de ${skuSelecionado.sku} registrado com sucesso em ${armazemObj?.nome || 'armazém'}!`);
      setSkuSelecionado(null);
      setQuantidade(1);
      setObservacao('');
    } catch (err) {
      sound.tocarErro();
      setErro(err.response?.data?.erro || 'Erro ao registrar conferência manual.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="mobile-contagem-container" style={{ paddingBottom: 90 }}>
      {/* Abas Superiores para Alternar entre IA e Manual */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
          onClick={() => navigate('/contagem')}
        >
          <Camera size={16} />
          <span>Contagem com IA</span>
        </button>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
        >
          <Edit3 size={16} />
          <span>Lançamento Manual</span>
        </button>
      </div>

      {erro && (
        <div className="mobile-alert mobile-alert-error" style={{ marginBottom: 14 }}>
          <AlertTriangle size={18} />
          <span>{erro}</span>
        </div>
      )}

      {sucesso && (
        <div className="mobile-alert mobile-alert-success" style={{ marginBottom: 14 }}>
          <CheckCircle2 size={18} />
          <span>{sucesso}</span>
        </div>
      )}

      <form onSubmit={handleConfirmar}>
        {/* 1. Armazém */}
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <MapPin size={18} color="var(--primario)" />
            <span style={{ fontWeight: 800, fontSize: 15 }}>1. Selecionar Armazém</span>
          </div>

          <select
            className="input select-mobile"
            value={armazemId}
            onChange={(e) => setArmazemId(e.target.value)}
          >
            {armazens.map((a) => (
              <option key={a.id} value={a.id}>
                📍 {a.nome} ({a.codigo || 'ARM'})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Produto (SKU) */}
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Box size={18} color="var(--primario)" />
            <span style={{ fontWeight: 800, fontSize: 15 }}>2. Selecionar Produto (SKU)</span>
          </div>

          <FastProductSelector
            produtos={produtos}
            skuSelecionado={skuSelecionado}
            onSelecionar={(p) => {
              setSkuSelecionado(p);
              sound.tocarSucesso();
            }}
            onLimpar={() => setSkuSelecionado(null)}
          />
        </div>

        {/* 3. Quantidade */}
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Layers size={18} color="var(--primario)" />
            <span style={{ fontWeight: 800, fontSize: 15 }}>3. Quantidade de Volumes</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="number"
              min="1"
              className="input"
              style={{ flex: 1, fontSize: 20, fontWeight: 800, textAlign: 'center', height: 48 }}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
            <div className="stepper-controls" style={{ gap: 4 }}>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => setQuantidade((v) => Math.max(1, v - 1))}
              >
                <Minus size={18} />
              </button>
              <button
                type="button"
                className="stepper-btn"
                onClick={() => setQuantidade((v) => v + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* Atalhos Rápidos de Quantidade */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {[+5, +10, +20, +50].map((delta) => (
              <button
                key={delta}
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ flex: 1, fontSize: 12, padding: '6px 0', fontWeight: 700 }}
                onClick={() => setQuantidade((v) => v + delta)}
              >
                +{delta}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Tipo de Movimentação */}
        <div className="mobile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15 }}>4. Tipo de Movimentação</span>
          </div>

          <div className="type-buttons-grid">
            {[
              { id: 'entrada', label: '📥 Entrada' },
              { id: 'saida', label: '📤 Saída' },
              { id: 'ajuste', label: '⚖️ Ajuste' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`type-btn ${tipoMovimentacao === t.id ? 'active' : ''}`}
                onClick={() => setTipoMovimentacao(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Observação */}
        <div className="mobile-card">
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>
            5. Observação (Opcional)
          </label>
          <input
            type="text"
            className="input"
            style={{ width: '100%', marginTop: 4 }}
            placeholder="Ex: Recebimento fornecedor, quebra, balanço..."
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </div>

        {/* Botão de Envio */}
        <button
          type="submit"
          className="btn-confirm-mobile"
          disabled={salvando || !skuSelecionado || quantidade <= 0}
        >
          {salvando ? (
            <RefreshCw size={20} className="spinner" />
          ) : (
            <>
              <span>Confirmar Lançamento ({quantidade} un)</span>
              <Check size={20} />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
