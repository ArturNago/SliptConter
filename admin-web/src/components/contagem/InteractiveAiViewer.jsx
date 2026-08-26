import React, { useState, useRef } from 'react';
import { Sparkles, Trash2, Plus, Edit3, Eye, RefreshCw } from 'lucide-react';
import { sound } from '../../services/soundFeedback';

export default function InteractiveAiViewer({
  fotoUrl,
  caixas = [],
  confianca = 0,
  carregando = false,
  onAtualizarCaixas,
  onTirarOutraFoto,
}) {
  const [modoEdicao, setModoEdicao] = useState(false);
  const containerRef = useRef(null);

  // Manipulação de toque/clique na imagem para adicionar ou remover caixas
  const handleContainerClick = (e) => {
    if (!modoEdicao || carregando) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width);
    const clickY = ((e.clientY - rect.top) / rect.height);

    // Verifica se clicou dentro de alguma caixa existente para remover
    const indexClicado = caixas.findIndex((c) => {
      const xMin = c.x_center - c.width / 2;
      const xMax = c.x_center + c.width / 2;
      const yMin = c.y_center - c.height / 2;
      const yMax = c.y_center + c.height / 2;
      return clickX >= xMin && clickX <= xMax && clickY >= yMin && clickY <= yMax;
    });

    if (indexClicado >= 0) {
      // Remove a caixa clicada
      sound.tocarSucesso();
      const novasCaixas = caixas.filter((_, i) => i !== indexClicado);
      onAtualizarCaixas(novasCaixas);
    } else {
      // Adiciona uma nova caixa centrada no ponto clicado
      sound.tocarSucesso();
      const novaCaixa = {
        x_center: Math.max(0.1, Math.min(0.9, clickX)),
        y_center: Math.max(0.1, Math.min(0.9, clickY)),
        width: 0.18,
        height: 0.14,
        conf: 1.0,
        manual: true,
      };
      onAtualizarCaixas([...caixas, novaCaixa]);
    }
  };

  return (
    <div className="photo-preview-wrapper" style={{ position: 'relative' }}>
      {/* Controles de Modo Superior */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="ia-badge-success" style={{ fontWeight: 800 }}>
            <Sparkles size={14} />
            {caixas.length} {caixas.length === 1 ? 'caixa' : 'caixas'} na face
          </span>
          {confianca > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--texto-suave)' }}>
              ({Math.round(confianca * 100)}% precisão)
            </span>
          )}
        </div>

        <button
          type="button"
          className={`btn btn-sm ${modoEdicao ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 10px' }}
          onClick={() => setModoEdicao(!modoEdicao)}
        >
          {modoEdicao ? <CheckIcon size={14} /> : <Edit3 size={14} />}
          <span>{modoEdicao ? 'Concluir Toque' : 'Ajustar no Toque'}</span>
        </button>
      </div>

      {/* Container da Foto com SVG de Bounding Boxes */}
      <div
        ref={containerRef}
        className="photo-container-relative"
        onClick={handleContainerClick}
        style={{ cursor: modoEdicao ? 'crosshair' : 'default', border: modoEdicao ? '2px dashed #10b981' : 'none' }}
      >
        <img src={fotoUrl} alt="Pilha capturada" className="photo-img-element" />

        {/* SVG de Bounding Boxes Interativo */}
        <svg className="boxes-svg-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
          {caixas.map((c, i) => {
            const x = (c.x_center - c.width / 2) * 100;
            const y = (c.y_center - c.height / 2) * 100;
            const w = c.width * 100;
            const h = c.height * 100;
            const isManual = c.manual;

            return (
              <g key={i}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={isManual ? 'rgba(59, 130, 246, 0.22)' : 'rgba(16, 185, 129, 0.22)'}
                  stroke={isManual ? '#3b82f6' : '#10b981'}
                  strokeWidth="1.8"
                  rx="1.5"
                />
                {/* Badge com número da caixa */}
                <rect
                  x={x}
                  y={Math.max(0, y - 5)}
                  width="7"
                  height="5"
                  fill={isManual ? '#3b82f6' : '#10b981'}
                  rx="1"
                />
                <text
                  x={x + 3.5}
                  y={Math.max(0, y - 5) + 3.8}
                  fill="#fff"
                  fontSize="3.2"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {i + 1}
                </text>
              </g>
            );
          })}
        </svg>

        {carregando && (
          <div className="ia-loading-overlay">
            <RefreshCw size={28} className="spinner" color="#fff" />
            <span>Processando IA YOLOv12...</span>
          </div>
        )}

        {modoEdicao && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              right: 8,
              background: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '11px',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            👆 Toque numa caixa para <b>excluir</b> ou no espaço vazio para <b>adicionar</b>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--texto-suave)' }}>
          {caixas.length} caixas identificadas na face frontal
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ fontSize: '12px', padding: '2px 8px' }}
          onClick={onTirarOutraFoto}
        >
          Tirar Outra Foto
        </button>
      </div>
    </div>
  );
}

function CheckIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
