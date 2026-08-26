import React, { useState, useEffect, useMemo } from 'react';
import { useProdutos } from '../hooks/useStock';
import { Table, Button, Modal, Input } from '../components/common';
import { useNotification } from '../contexts/NotificationContext';
import http from '../services/api';
import { formatarMoeda } from '../utils/formatters';

export default function ProductsPage() {
  const { data, loading, recarregar } = useProdutos({});
  const { sucesso, erro } = useNotification();
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);

  const filtrado = useMemo(() => {
    if (!data) return [];
    if (!busca) return data;
    const b = busca.toLowerCase();
    return data.filter(
      (p) => (p.sku || '').toLowerCase().includes(b) || (p.descricao || '').toLowerCase().includes(b)
    );
  }, [data, busca]);

  const abrirNovo = () => {
    setEditando({
      sku: '', descricao: '', volumesPorCamada: '', camadasMaximasPalete: '',
      codigoBarrasEan: '', custoMedio: '', precoVenda: '', ativo: true,
    });
    setModalAberto(true);
  };

  const abrirEdicao = (p) => {
    setEditando({ ...p });
    setModalAberto(true);
  };

  const salvar = async () => {
    try {
      const payload = {
        sku: editando.sku,
        descricao: editando.descricao,
        volumesPorCamada: editando.volumesPorCamada ? Number(editando.volumesPorCamada) : null,
        camadasMaximasPalete: editando.camadasMaximasPalete ? Number(editando.camadasMaximasPalete) : null,
        codigoBarrasEan: editando.codigoBarrasEan || null,
        custoMedio: editando.custoMedio ? Number(editando.custoMedio) : null,
        precoVenda: editando.precoVenda ? Number(editando.precoVenda) : null,
        ativo: editando.ativo,
      };
      if (editando.id) {
        await http.patch(`/produtos/${editando.id}`, payload);
      } else {
        await http.post('/produtos', payload);
      }
      sucesso('SKU salvo com sucesso.');
      setModalAberto(false);
      recarregar();
    } catch (e) {
      erro(e.response?.data?.erro || 'Falha ao salvar SKU.');
    }
  };

  const columns = [
    { key: 'sku', label: 'SKU', style: { fontWeight: 600 } },
    { key: 'descricao', label: 'Descrição' },
    { key: 'volumes_por_camada', label: 'Vol/Camada' },
    { key: 'camadas_maximas_palete', label: 'Camadas' },
    { key: 'custo_medio', label: 'Custo', render: (v) => formatarMoeda(v) },
    { key: 'preco_venda', label: 'Preço', render: (v) => formatarMoeda(v) },
    { key: 'ativo', label: 'Ativo', render: (v) => (v ? 'Sim' : 'Não') },
    {
      key: 'acoes',
      label: 'Ações',
      render: (_, row) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirEdicao(row); }}>
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="mobile-stack" style={{ marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Buscar SKU / Descrição…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Button variant="primary" onClick={abrirNovo}>Novo SKU</Button>
      </div>

      <Table columns={columns} data={filtrado} loading={loading} />

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando?.id ? 'Editar SKU' : 'Novo SKU'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button variant="primary" onClick={salvar}>Salvar</Button>
          </>
        }
      >
        {editando && (
          <>
            <Input label="SKU" value={editando.sku} onChange={(e) => setEditando({ ...editando, sku: e.target.value })} disabled={!!editando.id} />
            <Input label="Descrição" value={editando.descricao} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} />
            <div className="form-row">
              <Input label="Volumes/Camada" type="number" value={editando.volumesPorCamada} onChange={(e) => setEditando({ ...editando, volumesPorCamada: e.target.value })} />
              <Input label="Camadas Máx." type="number" value={editando.camadasMaximasPalete} onChange={(e) => setEditando({ ...editando, camadasMaximasPalete: e.target.value })} />
            </div>
            <Input label="Código EAN" value={editando.codigoBarrasEan} onChange={(e) => setEditando({ ...editando, codigoBarrasEan: e.target.value })} />
            <div className="form-row">
              <Input label="Custo Médio" type="number" step="0.01" value={editando.custoMedio} onChange={(e) => setEditando({ ...editando, custoMedio: e.target.value })} />
              <Input label="Preço Venda" type="number" step="0.01" value={editando.precoVenda} onChange={(e) => setEditando({ ...editando, precoVenda: e.target.value })} />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
