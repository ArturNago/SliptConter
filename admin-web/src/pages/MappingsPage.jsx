import React, { useState, useEffect } from 'react';
import { Button, Input, Spinner } from '../components/common';
import MapeamentoFormModal from '../components/MapeamentoFormModal';
import api from '../services/api';

export default function MappingsPage() {
  const [busca, setBusca] = useState('');
  const [mapeamentos, setMapeamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    carregar();
  }, [busca]);

  const carregar = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = busca ? { busca } : {};
      const data = await api.listarMapeamentos(params);
      setMapeamentos(data || []);
    } catch (err) {
      setError(err.response?.data?.erro || 'Erro ao carregar mapeamentos.');
    } finally {
      setLoading(false);
    }
  };

  const abrirNovo = () => {
    setEditando(null);
    setModalOpen(true);
  };

  const abrirEdicao = (item) => {
    setEditando(item);
    setModalOpen(true);
  };

  const handleRemover = async (id) => {
    if (!window.confirm('Deseja remover este mapeamento?')) return;
    try {
      await api.removerMapeamento(id);
      carregar();
    } catch (err) {
      setError(err.response?.data?.erro || 'Erro ao remover mapeamento.');
    }
  };

  const columns = [
    { key: 'nome_anuncio', label: 'Nome do Anúncio' },
    { key: 'variacao', label: 'Variação', render: (v) => v || '-' },
    { key: 'sku_erp', label: 'SKU ERP', render: (v) => v || '-' },
    { key: 'sku', label: 'SKU Sistema' },
    { key: 'sku_descricao', label: 'Descrição' },
    {
      key: 'acoes',
      label: 'Ações',
      render: (_, row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={() => abrirEdicao(row)}>
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => handleRemover(row.id)}>
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mobile-stack" style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Mapeamentos de Anúncios</h2>
        <Button onClick={abrirNovo}>Novo mapeamento</Button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Input
          label="Buscar"
          placeholder="Nome do anúncio, SKU ERP ou SKU sistema..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {error && <div style={{ color: 'var(--perigo)', marginBottom: '12px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--borda)' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mapeamentos.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--texto-suave)' }}>
                    Nenhum mapeamento encontrado.
                  </td>
                </tr>
              ) : (
                mapeamentos.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--borda)' }}>
                    {columns.map((c) => (
                      <td key={c.key} style={{ padding: '12px' }}>
                        {c.render ? c.render(row[c.key], row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <MapeamentoFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        mapeamento={editando}
        onSaved={carregar}
      />
    </div>
  );
}
