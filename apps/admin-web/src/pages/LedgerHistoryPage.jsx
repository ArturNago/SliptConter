import React, { useState, useMemo } from 'react';
import { useMovimentacoes } from '../hooks/useStock';
import { Table, Badge, Select, Input } from '../components/common';
import { formatarData, formatarNumero } from '../utils/formatters';
import ImportSalesModal from '../components/ImportSalesModal';

const TONE = { entrada: 'success', saida: 'danger', ajuste: 'warning' };

export default function LedgerHistoryPage() {
  const [tipo, setTipo] = useState('');
  const [busca, setBusca] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const query = useMemo(() => ({ limit: 500, tipo: tipo || undefined }), [tipo]);
  const { data, loading, mutate } = useMovimentacoes(query);

  const filtrado = useMemo(() => {
    if (!data) return [];
    if (!busca) return data;
    const b = busca.toLowerCase();
    return data.filter(
      (m) => (m.sku || '').toLowerCase().includes(b) || (m.produto_descricao || '').toLowerCase().includes(b)
    );
  }, [data, busca]);

  const columns = [
    { key: 'created_at', label: 'Data/Hora', render: (v) => formatarData(v) },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (v) => <Badge tone={TONE[v] || 'neutral'}>{v}</Badge>,
    },
    { key: 'sku', label: 'SKU' },
    { key: 'produto_descricao', label: 'Descrição' },
    { key: 'armazem_nome', label: 'Armazém' },
    { key: 'quantidade', label: 'Qtd', render: (v) => formatarNumero(v) },
    { key: 'observacao', label: 'Observação' },
  ];

  return (
    <div>
      <div className="mobile-stack" style={{ marginBottom: '20px' }}>
        <div className="filters" style={{ margin: 0 }}>
          <div className="field">
            <label className="field-label">Tipo</label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
            </Select>
          </div>
          <div className="field">
            <label className="field-label">Buscar SKU / Descrição</label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar…" />
          </div>
        </div>
        
        <button 
          className="btn btn-primary" 
          onClick={() => setIsImportModalOpen(true)}
        >
          Sincronizar Vendas (Planilha)
        </button>
      </div>

      <Table columns={columns} data={filtrado} loading={loading} />

      <ImportSalesModal 
        open={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => mutate()} // Refresh table data
      />
    </div>
  );
}
