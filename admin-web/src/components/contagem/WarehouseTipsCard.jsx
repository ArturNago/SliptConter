import React, { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Check, ShieldAlert } from 'lucide-react';

export default function WarehouseTipsCard() {
  const [expandido, setExpandido] = useState(false);

  return (
    <div
      style={{
        background: 'rgba(15, 118, 110, 0.08)',
        border: '1px solid rgba(15, 118, 110, 0.25)',
        borderRadius: '12px',
        padding: '10px 14px',
        margin: '6px 0',
      }}
    >
      <div
        onClick={() => setExpandido(!expandido)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lightbulb size={16} color="var(--primario)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primario)' }}>
            Dicas para uma contagem precisa com IA
          </span>
        </div>
        {expandido ? <ChevronUp size={16} color="var(--primario)" /> : <ChevronDown size={16} color="var(--primario)" />}
      </div>

      {expandido && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--texto-suave)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Check size={14} color="var(--sucesso)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span><b>Distância ideal:</b> Fique a 2 a 3 metros da pilha, com iluminação uniforme.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Check size={14} color="var(--sucesso)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span><b>Enquadramento frontal:</b> Mostre toda a face frontal da pilha, da base ao topo.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <ShieldAlert size={14} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
            <span><b>Ajuste por toque:</b> Se alguma caixa estiver oculta, toque na imagem para adicioná-la manualmente.</span>
          </div>
        </div>
      )}
    </div>
  );
}
