import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Layers,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Box,
  MapPin,
  Package,
  Check,
  Edit3,
} from 'lucide-react';
import api from '../services/api';
import { salvarConferenciaOffline } from '../services/offlineQueue';
import FastProductSelector from '../components/contagem/FastProductSelector';
import InteractiveAiViewer from '../components/contagem/InteractiveAiViewer';
import WarehouseTipsCard from '../components/contagem/WarehouseTipsCard';
import { comprimirImagem } from '../utils/imageCompressor';
import { sound } from '../services/soundFeedback';

export default function MobileContagemPage() {
  const navigate = useNavigate();

  // Etapa atual do fluxo guiado por IA (1 a 6)
  // 1: Tire a foto
  // 2: X Caixas reconhecidas
  // 3: Selecione o produto
  // 4: Entrada ou saída de estoque
  // 5: Selecione o armazém
  // 6: Concluir
  const [etapa, setEtapa] = useState(1);

  const [armazens, setArmazens] = useState([]);
  const [produtos, setProdutos] = useState([]);

  // Estado dos Dados da Contagem
  const [fotoBlob, setFotoBlob] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [analisandoIa, setAnalisandoIa] = useState(false);
  const [resultadoIa, setResultadoIa] = useState(null);
  const [caixasDetectadas, setCaixasDetectadas] = useState([]);

  const [caixasPorCamada, setCaixasPorCamada] = useState(1);
  const [profundidade, setProfundidade] = useState(1);

  const [skuSelecionado, setSkuSelecionado] = useState(null);
  const [tipoMovimentacao, setTipoMovimentacao] = useState('entrada'); // 'entrada' | 'saida' | 'ajuste'
  const [armazemId, setArmazemId] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  const carregarDadosIniciais = async () => {
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
      console.error('Erro ao carregar dados iniciais:', err);
    }
  };

  // ---- 1. TIRE A FOTO ----
  const handleTirarFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErro(null);
    setSucesso(null);
    setAnalisandoIa(true);
    setEtapa(2); // Avança imediatamente para a tela de visualização/análise

    try {
      const fotoOtimizada = await comprimirImagem(file, 1280, 0.85);
      setFotoBlob(fotoOtimizada);
      const previewUrl = URL.createObjectURL(fotoOtimizada);
      setFotoPreview(previewUrl);

      // Dispara análise no modelo YOLOv12
      await analisarComIA(fotoOtimizada);
    } catch (err) {
      setFotoBlob(file);
      setFotoPreview(URL.createObjectURL(file));
      await analisarComIA(file);
    }
  };

  // ---- 2. X CAIXAS RECONHECIDAS ----
  const analisarComIA = async (arquivo) => {
    setAnalisandoIa(true);
    setResultadoIa(null);
    setCaixasDetectadas([]);

    try {
      const form = new FormData();
      form.append('imagem', arquivo);

      const res = await api.post('/conferencias/sugestao-ia', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.disponivel) {
        setResultadoIa(res.data);
        const boxes = res.data.caixas || [];
        setCaixasDetectadas(boxes);
        setCaixasPorCamada(boxes.length > 0 ? boxes.length : res.data.caixasPorCamada || 1);
        sound.tocarSucesso();
      } else {
        setResultadoIa({ disponivel: false, caixas: [] });
        setCaixasDetectadas([]);
      }
    } catch (err) {
      console.warn('IA indisponível, permitindo contagem manual:', err.message);
      setResultadoIa({ disponivel: false, caixas: [] });
      setCaixasDetectadas([]);
    } finally {
      setAnalisandoIa(false);
    }
  };

  const handleAtualizarCaixas = (novasCaixas) => {
    setCaixasDetectadas(novasCaixas);
    setCaixasPorCamada(Math.max(1, novasCaixas.length));
  };

  // Quantidade Total da Pilha
  const totalCalculado = caixasPorCamada * profundidade;

  // ---- 6. CONCLUIR LANÇAMENTO ----
  const concluirLançamento = async () => {
    if (!skuSelecionado) {
      sound.tocarErro();
      setErro('Selecione um produto.');
      setEtapa(3);
      return;
    }
    if (!armazemId) {
      sound.tocarErro();
      setErro('Selecione um armazém.');
      setEtapa(5);
      return;
    }
    if (totalCalculado <= 0) {
      sound.tocarErro();
      setErro('Quantidade deve ser maior que zero.');
      return;
    }

    setSalvando(true);
    setErro(null);

    const dados = {
      skuId: skuSelecionado.id,
      armazemId,
      quantidadeContada: totalCalculado,
      caixasPorCamada,
      camadasConfirmadas: profundidade,
      caixasSugeridasIa: resultadoIa?.caixasPorCamada || null,
      deteccoesIa: caixasDetectadas.length > 0 ? caixasDetectadas : null,
      origem: 'ia',
      tipoMovimentacao,
      fotoBlob,
    };

    try {
      const form = new FormData();
      if (fotoBlob) form.append('imagem', fotoBlob, 'foto.jpg');
      form.append('skuId', dados.skuId);
      form.append('armazemId', dados.armazemId);
      form.append('quantidadeContada', String(dados.quantidadeContada));
      if (dados.caixasPorCamada) form.append('caixasPorCamada', String(dados.caixasPorCamada));
      if (dados.camadasConfirmadas) form.append('camadasConfirmadas', String(dados.camadasConfirmadas));
      if (dados.caixasSugeridasIa) form.append('caixasSugeridasIa', String(dados.caixasSugeridasIa));
      if (dados.deteccoesIa) form.append('deteccoesIa', JSON.stringify(dados.deteccoesIa));
      form.append('origem', dados.origem);
      form.append('tipoMovimentacao', dados.tipoMovimentacao);

      await api.post('/conferencias', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      sound.tocarSucesso();
      const armazemObj = armazens.find((a) => a.id === armazemId);
      setSucesso(`Sucesso! ${totalCalculado} unidades de ${skuSelecionado.sku} lançadas no ${armazemObj?.nome || 'armazém'}.`);
    } catch (err) {
      if (!window.navigator.onLine || !err.response) {
        await salvarConferenciaOffline(dados);
        sound.tocarSucesso();
        setSucesso(`Salvo offline! Sincronizará automaticamente assim que houver conexão.`);
      } else {
        sound.tocarErro();
        setErro(err.response?.data?.erro || 'Erro ao registrar conferência.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const reiniciarFluxo = () => {
    setFotoBlob(null);
    setFotoPreview(null);
    setResultadoIa(null);
    setCaixasDetectadas([]);
    setCaixasPorCamada(1);
    setProfundidade(1);
    setSkuSelecionado(null);
    setSucesso(null);
    setErro(null);
    setEtapa(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const armazemAtual = armazens.find((a) => a.id === armazemId);

  return (
    <div className="mobile-contagem-container" style={{ paddingBottom: 90 }}>
      {/* Abas Superiores para Alternar entre IA e Manual */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}
        >
          <Camera size={16} />
          <span>Contagem com IA</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13 }}
          onClick={() => navigate('/contagem-manual')}
        >
          <Edit3 size={16} />
          <span>Lançamento Manual</span>
        </button>
      </div>

      {/* Barra de Progresso dos 6 Passos */}
      <div style={{ background: 'var(--bg-elevado)', borderRadius: 14, padding: '10px 14px', marginBottom: 14, border: '1px solid var(--borda)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--primario)' }}>
            Passo {etapa} de 6
          </span>
          <span style={{ fontSize: 11, color: 'var(--texto-suave)', fontWeight: 600 }}>
            {etapa === 1 && '1. Tirar Foto'}
            {etapa === 2 && '2. Reconhecimento IA'}
            {etapa === 3 && '3. Selecionar Produto'}
            {etapa === 4 && '4. Tipo Movimentação'}
            {etapa === 5 && '5. Armazém'}
            {etapa === 6 && '6. Concluir'}
          </span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--borda)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${(etapa / 6) * 100}%`,
              height: '100%',
              background: 'var(--primario)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {erro && (
        <div className="mobile-alert mobile-alert-error" style={{ marginBottom: 14 }}>
          <AlertTriangle size={18} />
          <span>{erro}</span>
        </div>
      )}

      {/* TELA DE SUCESSO FINAL */}
      {sucesso ? (
        <div className="mobile-card" style={{ textAlign: 'center', padding: 24 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              background: 'rgba(16,185,129,0.15)',
              color: 'var(--sucesso)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <CheckCircle2 size={36} />
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--texto)' }}>
            Lançamento Concluído!
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--texto-suave)' }}>
            {sucesso}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, fontSize: 15, fontWeight: 700 }}
            onClick={reiniciarFluxo}
          >
            <Camera size={18} />
            <span>📸 Tirar Outra Foto (Nova Contagem)</span>
          </button>
        </div>
      ) : (
        <>
          {/* =========================================================
              PASSO 1: TIRE A FOTO
              ========================================================= */}
          {etapa === 1 && (
            <div>
              <WarehouseTipsCard />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleTirarFoto}
              />

              <div
                className="mobile-card"
                style={{
                  textAlign: 'center',
                  padding: '30px 16px',
                  background: 'linear-gradient(180deg, var(--bg-elevado), var(--vidro))',
                  border: '2px dashed var(--primario)',
                  borderRadius: 20,
                  cursor: 'pointer',
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <div
                  style={{
                    width: 74,
                    height: 74,
                    borderRadius: 37,
                    background: 'var(--primario)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    boxShadow: '0 8px 24px rgba(15,118,110,0.4)',
                  }}
                >
                  <Camera size={38} color="#fff" />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
                  1. Tirar Foto da Pilha
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--texto-suave)', lineHeight: 1.4 }}>
                  Toque para abrir a câmera do celular e enquadrar a face frontal da pilha de caixas
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 20, width: '100%', height: 48, fontSize: 15, fontWeight: 800 }}
                >
                  📸 Abrir Câmera Agora
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              PASSO 2: X CAIXAS RECONHECIDAS PELA IA
              ========================================================= */}
          {etapa === 2 && (
            <div className="mobile-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={18} color="var(--primario)" />
                  <span style={{ fontWeight: 800, fontSize: 16 }}>2. Caixas Reconhecidas</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: 11 }}
                >
                  Tirar Outra Foto
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleTirarFoto}
              />

              <InteractiveAiViewer
                fotoUrl={fotoPreview}
                caixas={caixasDetectadas}
                confianca={resultadoIa?.confianca || 0}
                carregando={analisandoIa}
                onAtualizarCaixas={handleAtualizarCaixas}
                onTirarOutraFoto={() => fileInputRef.current?.click()}
              />

              {/* Controles de Volumes & Profundidade */}
              <div style={{ marginTop: 14, background: 'var(--vidro)', border: '1px solid var(--borda)', borderRadius: 14, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--texto)' }}>
                      {caixasPorCamada} caixas na face
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                      Multiplicador de filas para trás (Profundidade):
                    </div>
                  </div>
                  <div className="stepper-controls">
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => setProfundidade((v) => Math.max(1, v - 1))}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="stepper-value">{profundidade}</span>
                    <button
                      type="button"
                      className="stepper-btn"
                      onClick={() => setProfundidade((v) => v + 1)}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--borda)' }}>
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Total da Pilha: </span>
                  <b style={{ fontSize: 16, color: 'var(--sucesso)' }}>{totalCalculado} caixas</b>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEtapa(1)}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
                  onClick={() => {
                    sound.tocarSucesso();
                    setEtapa(3);
                  }}
                  disabled={analisandoIa}
                >
                  <span>3. Selecionar Produto</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              PASSO 3: SELECIONE O PRODUTO
              ========================================================= */}
          {etapa === 3 && (
            <div className="mobile-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Box size={18} color="var(--primario)" />
                <span style={{ fontWeight: 800, fontSize: 16 }}>3. Selecione o Produto (SKU)</span>
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

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEtapa(2)}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
                  onClick={() => {
                    if (!skuSelecionado) {
                      sound.tocarErro();
                      setErro('Por favor, selecione um produto para continuar.');
                      return;
                    }
                    setErro(null);
                    sound.tocarSucesso();
                    setEtapa(4);
                  }}
                  disabled={!skuSelecionado}
                >
                  <span>4. Tipo Movimentação</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              PASSO 4: ENTRADA OU SAÍDA DE ESTOQUE
              ========================================================= */}
          {etapa === 4 && (
            <div className="mobile-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Layers size={18} color="var(--primario)" />
                <span style={{ fontWeight: 800, fontSize: 16 }}>4. Entrada ou Saída de Estoque?</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { id: 'entrada', label: '📥 Entrada de Estoque', desc: 'Recebimento de carretas, produção ou devoluções' },
                  { id: 'saida', label: '📤 Saída de Estoque', desc: 'Expedição para clientes ou faturamento' },
                  { id: 'ajuste', label: '⚖️ Ajuste / Balanço', desc: 'Correção de inventário físico' },
                ].map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setTipoMovimentacao(t.id);
                      sound.tocarSucesso();
                    }}
                    style={{
                      border: `2px solid ${tipoMovimentacao === t.id ? 'var(--primario)' : 'var(--borda)'}`,
                      background: tipoMovimentacao === t.id ? 'rgba(15,118,110,0.1)' : 'var(--bg-elevado)',
                      borderRadius: 14,
                      padding: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--texto)' }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 2 }}>{t.desc}</div>
                    </div>
                    {tipoMovimentacao === t.id && (
                      <Check size={20} color="var(--primario)" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEtapa(3)}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
                  onClick={() => {
                    sound.tocarSucesso();
                    setEtapa(5);
                  }}
                >
                  <span>5. Selecionar Armazém</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              PASSO 5: SELECIONE O ARMAZÉM
              ========================================================= */}
          {etapa === 5 && (
            <div className="mobile-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <MapPin size={18} color="var(--primario)" />
                <span style={{ fontWeight: 800, fontSize: 16 }}>5. Selecione o Armazém</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {armazens.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      setArmazemId(a.id);
                      sound.tocarSucesso();
                    }}
                    style={{
                      border: `2px solid ${armazemId === a.id ? 'var(--primario)' : 'var(--borda)'}`,
                      background: armazemId === a.id ? 'rgba(15,118,110,0.1)' : 'var(--bg-elevado)',
                      borderRadius: 14,
                      padding: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--texto)' }}>
                        📍 {a.nome}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 2 }}>
                        Código: <b>{a.codigo || 'ARM'}</b>
                      </div>
                    </div>
                    {armazemId === a.id && (
                      <Check size={20} color="var(--primario)" style={{ flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEtapa(4)}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 700 }}
                  onClick={() => {
                    if (!armazemId) {
                      sound.tocarErro();
                      setErro('Selecione um armazém.');
                      return;
                    }
                    setErro(null);
                    sound.tocarSucesso();
                    setEtapa(6);
                  }}
                >
                  <span>6. Revisar & Concluir</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* =========================================================
              PASSO 6: REVISAR & CONCLUIR
              ========================================================= */}
          {etapa === 6 && (
            <div className="mobile-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <CheckCircle2 size={18} color="var(--primario)" />
                <span style={{ fontWeight: 800, fontSize: 16 }}>6. Confirmar Lançamento no Estoque</span>
              </div>

              {/* Resumo da Operação */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(15,118,110,0.15), rgba(15,118,110,0.03))',
                  border: '1px solid rgba(15,118,110,0.3)',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--primario)', fontWeight: 800, textTransform: 'uppercase' }}>
                  Resumo da Contagem com IA
                </div>

                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--texto)', margin: '8px 0 4px' }}>
                  {totalCalculado} caixas
                </div>
                <div style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 12 }}>
                  Operação: <b>{tipoMovimentacao === 'entrada' ? '📥 Entrada' : tipoMovimentacao === 'saida' ? '📤 Saída' : '⚖️ Ajuste'}</b>
                </div>

                <div style={{ borderTop: '1px solid var(--borda)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div>📦 <b>Produto:</b> {skuSelecionado?.sku} ({skuSelecionado?.descricao})</div>
                  <div>📍 <b>Armazém:</b> {armazemAtual?.nome} ({armazemAtual?.codigo})</div>
                  <div>🤖 <b>Reconhecimento IA:</b> {caixasPorCamada} caixas × {profundidade} camadas</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  onClick={() => setEtapa(5)}
                  disabled={salvando}
                >
                  <ArrowLeft size={16} /> Voltar
                </button>
                <button
                  type="button"
                  className="btn-confirm-mobile"
                  style={{ flex: 2, margin: 0 }}
                  onClick={concluirLançamento}
                  disabled={salvando}
                >
                  {salvando ? (
                    <RefreshCw size={20} className="spinner" />
                  ) : (
                    <>
                      <span>✅ Concluir Lançamento</span>
                      <Check size={20} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
