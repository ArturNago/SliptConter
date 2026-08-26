import React from 'react';
import { useAsyncData } from '../../hooks/useStock';
import { getMovimentacoes } from '../../services/stockService';
import { formatarData, formatarNumero } from '../../utils/formatters';
import { TrendingUp, TrendingDown, SlidersHorizontal } from 'lucide-react';

const TONE_MAP = { entrada: 'success', saida: 'danger', ajuste: 'warning' };
const ICON_MAP = { entrada: TrendingUp, saida: TrendingDown, ajuste: SlidersHorizontal };

export function RecentActivity() {
  const { data, loading } = useAsyncData(() => getMovimentacoes({ limit: 8 }), []);

  if (loading) return <p style={{ color: 'var(--texto-suave)', textAlign: 'center', padding: 20 }}>Carregando…</p>;
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: 'var(--texto-suave)' }}>
        <SlidersHorizontal size={28} style={{ marginBottom: 8, opacity: 0.6 }} />
        <p style={{ margin: 0, fontSize: 13 }}>Nenhuma movimentação recente.</p>
      </div>
    );
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((m, i) => {
        const Icon = ICON_MAP[m.tipo] || SlidersHorizontal;
        return (
          <li
            key={m.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'var(--vidro)',
              border: '1px solid var(--borda)',
              fontSize: 13,
              animation: `fadeSlideIn 0.3s ease ${i * 0.04}s both`,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--borda)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--vidro)')}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span
                className={`badge badge-${TONE_MAP[m.tipo] || 'neutral'}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Icon size={14} /> {m.tipo}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.produto_descricao || m.sku}
              </span>
            </span>
            <span style={{ color: 'var(--texto-suave)', whiteSpace: 'nowrap', fontSize: 12 }}>
              {formatarNumero(m.quantidade)} · {formatarData(m.created_at)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
