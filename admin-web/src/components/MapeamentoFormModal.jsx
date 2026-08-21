import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, Spinner } from '../components/common';
import api from '../services/api';

export default function MapeamentoFormModal({ open, onClose, mapeamento, onSaved }) {
  const isEditing = !!mapeamento?.id;
  const [formNome, setFormNome] = useState('');
  const [formVariacao, setFormVariacao] = useState('');
  const [formSkuErp, setFormSkuErp] = useState('');
  const [formSkuId, setFormSkuId] = useState('');
  const [formSkuSelecionado, setFormSkuSelecionado] = useState(null);
  const [modalSkuOpen, setModalSkuOpen] = useState(false);
  const [skus, setSkus] = useState([]);
  const [loadingSkus, setLoadingSkus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [buscaSku, setBuscaSku] = useState('');

  useEffect(() => {
    if (open) {
      if (mapeamento) {
        setFormNome(mapeamento.nome_anuncio || '');
        setFormVariacao(mapeamento.variacao || '');
        setFormSkuErp(mapeamento.sku_erp || '');
        setFormSkuId(mapeamento.sku_id || '');
        setFormSkuSelecionado({ id: mapeamento.sku_id, sku: mapeamento.sku, nome: mapeamento.sku_descricao });
      } else {
        setFormNome('');
        setFormVariacao('');
        setFormSkuErp('');
        setFormSkuId('');
        setFormSkuSelecionado(null);
      }
      setError(null);
    }
  }, [open, mapeamento]);

  useEffect(() => {
    if (modalSkuOpen) {
      buscarSkus();
    }
  }, [modalSkuOpen, buscaSku]);

  const buscarSkus = async () => {
    try {
      setLoadingSkus(true);
      const params = buscaSku ? { busca: buscaSku, limit: 50 } : { limit: 50 };
      const data = await api.listarProdutos(params);
      setSkus(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSkus(false);
    }
  };

  const selecionarSku = (sku) => {
    setFormSkuSelecionado(sku);
    setFormSkuId(sku.id);
    setModalSkuOpen(false);
  };

  const handleSalvar = async () => {
    setError(null);
    if (!formNome.trim()) {
      setError('Nome do anúncio é obrigatório.');
      return;
    }
    if (!formSkuId) {
      setError('Selecione um SKU do sistema.');
      return;
    }

    const payload = {
      nome_anuncio: formNome.trim(),
      variacao: formVariacao.trim() || null,
      sku_id: formSkuId,
      sku_erp: formSkuErp.trim() || null,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await api.atualizarMapeamento(mapeamento.id, payload);
      } else {
        await api.criarMapeamento(payload);
      }
      onClose();
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.response?.data?.erro || 'Erro ao salvar mapeamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar Mapeamento' : 'Novo Mapeamento'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="field-label">Nome do Anúncio *</label>
          <input
            className="input"
            value={formNome}
            onChange={(e) => setFormNome(e.target.value)}
            placeholder="Ex: Camiseta Básica Algodão"
          />
        </div>
        <div>
          <label className="field-label">Variação / Cor (Opcional)</label>
          <input
            className="input"
            value={formVariacao}
            onChange={(e) => setFormVariacao(e.target.value)}
            placeholder="Ex: Branco, M"
          />
        </div>
        <div>
          <label className="field-label">SKU ERP (Opcional)</label>
          <input
            className="input"
            value={formSkuErp}
            onChange={(e) => setFormSkuErp(e.target.value)}
            placeholder="Código do marketplace/Upseller"
          />
        </div>
        <div>
          <label className="field-label">SKU do Sistema *</label>
          <button
            type="button"
            className="input"
            onClick={() => setModalSkuOpen(true)}
            style={{ textAlign: 'left', cursor: 'pointer', background: '#fff' }}
          >
            {formSkuSelecionado ? `${formSkuSelecionado.nome} (${formSkuSelecionado.sku})` : 'Selecionar SKU...'}
          </button>
        </div>
        {error && <div className="field-error" style={{ display: 'block' }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? <Spinner size={16} /> : 'Salvar'}
          </Button>
        </div>
      </div>

      <Modal open={modalSkuOpen} onClose={() => setModalSkuOpen(false)} title="Selecionar SKU" footer={null}>
        <div style={{ marginBottom: '12px' }}>
          <Input
            placeholder="Buscar por nome ou código..."
            value={buscaSku}
            onChange={(e) => setBuscaSku(e.target.value)}
          />
        </div>
        {loadingSkus && skus.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px' }}>
            <Spinner />
          </div>
        ) : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {skus.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                Nenhum SKU encontrado.
              </div>
            ) : (
              skus.map((sku) => (
                <button
                  key={sku.id}
                  onClick={() => selecionarSku(sku)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px',
                    border: 'none',
                    borderBottom: '1px solid #e2e8f0',
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 500, color: '#1e293b' }}>{sku.descricao || sku.nome}</div>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>SKU: {sku.sku}</div>
                </button>
              ))
            )}
          </div>
        )}
      </Modal>
    </Modal>
  );
}
