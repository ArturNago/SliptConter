import React from 'react';
import { Layers, Trash2, Plus, Package } from 'lucide-react';
import { sound } from '../../services/soundFeedback';

export default function MultiPileAccumulator({
  pilhas = [],
  onRemoverPilha,
  onAdicionarNovaPilha,
}) {
  if (pilhas.length === 0) return null;

  const totalPilhas = pilhas.reduce((acc, p) => acc + (p.quantidade || 0), 0);

  return (
    <div
      style={{
        background: 'var(--vidro)',
        border: '1px solid var(--borda)',
        borderRadius: '14px',
        padding: '14px',
        marginTop: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={18} color="var(--primario)" />
          <span style={{ fontWeight: 800, fontSize: '14px' }}>
            Pilhas Acumuladas ({pilhas.length})
          </span>
        </div>
        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primario)' }}>
          Total: {totalPilhas} un
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pilhas.map((p, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-elevado)',
              border: '1px solid var(--borda)',
              borderRadius: '10px',
              padding: '8px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {p.fotoPreview && (
                <img
                  src={p.fotoPreview}
                  alt={`Pilha ${idx + 1}`}
                  style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '6px' }}
                />
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px' }}>
                  Pilha #{idx + 1}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--texto-suave)' }}>
                  {p.caixasPorCamada} caixas × {p.profundidade} profundidade = <b>{p.quantidade} un</b>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="icon-btn"
              style={{ color: 'var(--perigo)' }}
              onClick={() => {
                sound.tocarSucesso();
                onRemoverPilha(idx);
              }}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ width: '100%', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        onClick={onAdicionarNovaPilha}
      >
        <Plus size={16} />
        <span>+ Fotografar Mais uma Pilha deste SKU</span>
      </button>
    </div>
  );
}
