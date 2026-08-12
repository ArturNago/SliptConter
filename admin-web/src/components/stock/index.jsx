import React, { useState } from 'react';
import { Table, Badge, Button, Modal, Input, Select } from '../common';
import { useArmazens } from '../../hooks/useStock';
import { formatarNumero, formatarMoeda } from '../../utils/formatters';

const STATUS = {
  normal: { tone: 'success', label: 'Normal' },
  baixo: { tone: 'warning', label: 'Baixo' },
  zerado: { tone: 'danger', label: 'Zerado' },
};

export function StockTable({ data, loading, onRowClick }) {
  const columns = [
    { key: 'sku', label: 'SKU', style: { fontWeight: 600 } },
    { key: 'descricao', label: 'Descrição' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'volumes_por_camada', label: 'Vol/Camada' },
    { key: 'camadas_maximas_palete', label: 'Camadas' },
    { key: 'saldo', label: 'Saldo', render: (v) => formatarNumero(v) },
    {
      key: 'custo_medio',
      label: 'Custo Médio',
      render: (v) => formatarMoeda(v),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v, row) => {
        const s = STATUS[row.status] || STATUS.normal;
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
  ];
  return <Table columns={columns} data={data} loading={loading} onRowClick={onRowClick} />;
}

export function StockFilter({ filtros, onChange, limiteAlerta, onLimiteChange }) {
  const { data: armazens } = useArmazens();
  return (
    <div className="filters">
      <div className="field">
        <label className="field-label">Buscar (SKU / Descrição / EAN)</label>
        <input
          className="input"
          placeholder="Digite para buscar…"
          value={filtros.busca || ''}
          onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field-label">Armazém</label>
        <select
          className="input select"
          value={filtros.armazemId || ''}
          onChange={(e) => onChange({ ...filtros, armazemId: e.target.value })}
        >
          <option value="">Todos</option>
          {armazens?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="field-label">Categoria</label>
        <input
          className="input"
          placeholder="Categoria…"
          value={filtros.categoria || ''}
          onChange={(e) => onChange({ ...filtros, categoria: e.target.value })}
        />
      </div>
      <div className="field">
        <label className="field-label">Limite de Alerta</label>
        <input
          className="input"
          type="number"
          value={limiteAlerta}
          onChange={(e) => onLimiteChange(Number(e.target.value))}
          style={{ width: 120 }}
        />
      </div>
      <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
        <input
          type="checkbox"
          checked={filtros.apenasBaixo === 'true'}
          onChange={(e) => onChange({ ...filtros, apenasBaixo: e.target.checked ? 'true' : 'false' })}
        />
        Apenas estoque baixo
      </label>
    </div>
  );
}

export function StockAdjustModal({ open, onClose, item, onConfirm }) {
  const [quantidadeAjuste, setQuantidadeAjuste] = useState('');
  const [motivo, setMotivo] = useState('inventario');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const { data: armazens } = useArmazens();

  if (!item) return null;

  const confirmar = async () => {
    setSalvando(true);
    try {
      await onConfirm({
        skuId: item.id,
        armazemId: armazens?.[0]?.id,
        quantidadeAjuste: Number(quantidadeAjuste),
        motivo,
        observacao,
      });
      setQuantidadeAjuste('');
      setObservacao('');
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ajuste Manual — ${item.sku}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmar} disabled={salvando || !quantidadeAjuste}>
            Registrar Ajuste
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--texto-suave)', marginTop: 0 }}>
        {item.descricao} · Saldo atual: <b>{formatarNumero(item.saldo)}</b>
      </p>
      <Input
        label="Quantidade do ajuste (positiva = entrada, negativa = saída)"
        type="number"
        value={quantidadeAjuste}
        onChange={(e) => setQuantidadeAjuste(e.target.value)}
        placeholder="Ex.: 10 ou -5"
      />
      <Select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
        <option value="inventario">Inventário geral</option>
        <option value="quebra">Quebra / Avaria</option>
        <option value="perda">Perda</option>
        <option value="devolucao">Devolução</option>
        <option value="outro">Outro</option>
      </Select>
      <Input
        label="Observação"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        placeholder="Detalhes (opcional)"
      />
    </Modal>
  );
}
