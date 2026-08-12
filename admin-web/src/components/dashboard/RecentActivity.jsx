import React from 'react';
import { useAsyncData } from '../../hooks/useStock';
import { getMovimentacoes } from '../../services/stockService';
import { formatarData, formatarNumero } from '../../utils/formatters';

export function RecentActivity() {
  const { data, loading } = useAsyncData(() => getMovimentacoes({ limit: 8 }), []);
  const toneMap = { entrada: 'success', saida: 'danger', ajuste: 'warning' };

  if (loading) return <p style={{ color: 'var(--texto-suave)' }}>Carregando…</p>;
  if (!data || data.length === 0) return <p style={{ color: 'var(--texto-suave)' }}>Nenhuma movimentação recente.</p>;

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((m) => (
        <li key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>
            <span className={`badge badge-${toneMap[m.tipo] || 'neutral'}`} style={{ marginRight: 8 }}>
              {m.tipo}
            </span>
            {m.produto_descricao || m.sku}
          </span>
          <span style={{ color: 'var(--texto-suave)' }}>
            {formatarNumero(m.quantidade)} · {formatarData(m.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
