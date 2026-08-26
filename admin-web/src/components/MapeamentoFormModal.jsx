import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, Spinner, Badge } from '../components/common';
import api from '../services/api';
import { Plus, Trash2, Layers } from 'lucide-react';

export default function MapeamentoFormModal({ open, onClose, mapeamento, onSaved }) {
  const isEditing = !!mapeamento?.id;
  const [formNome, setFormNome] = useState('');
  const [formVariacao, setFormVariacao] = useState('');
  const [formSkuErp, setFormSkuErp] = useState('');
  const [itensComponentes, setItensComponentes] = useState([]);
  
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
        
        if (Array.isArray(mapeamento.itens) && mapeamento.itens.length > 0) {
          setItensComponentes(mapeamento.itens.map((i) => ({
            sku_id: i.sku_id,
            sku: i.sku,
            nome: i.sku_descricao,
            quantidade: i.quantidade || 1,
          })));
        } else if (mapeamento.sku_id) {
          setItensComponentes([{
            sku_id: mapeamento.sku_id,
            sku: mapeamento.sku,
            nome: mapeamento.sku_descricao,
            quantidade: 1,
          }]);
        } else {
          setItensComponentes([]);
        }
      } else {
        setFormNome('');
        setFormVariacao('');
        setFormSkuErp('');
        setItensComponentes([]);
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

  const adicionarSkuAoKit = (sku) => {
    // Se já estiver na lista, apenas incrementa
    const index = itensComponentes.findIndex((i) => i.sku_id === sku.id);
    if (index >= 0) {
      const novaLista = [...itensComponentes];
      novaLista[index].quantidade += 1;
      setItensComponentes(novaLista);
    } else {
      setItensComponentes([
        ...itensComponentes,
        {
          sku_id: sku.id,
          sku: sku.sku,
          nome: sku.descricao || sku.nome,
          quantidade: 1,
        },
      ]);
    }
    setModalSkuOpen(false);
  };

  const alterarQuantidadeItem = (index, novaQtd) => {
    const q = Math.max(1, parseInt(novaQtd, 10) || 1);
    const novaLista = [...itensComponentes];
    novaLista[index].quantidade = q;
    setItensComponentes(novaLista);
  };

  const removerItem = (index) => {
    setItensComponentes(itensComponentes.filter((_, idx) => idx !== index));
  };

  const handleSalvar = async () => {
    setError(null);
    if (!formNome.trim() && !formSkuErp.trim()) {
      setError('Nome do anúncio ou SKU ERP é obrigatório.');
      return;
    }
    if (itensComponentes.length === 0) {
      setError('Adicione pelo menos um SKU do sistema como componente.');
      return;
    }

    const payload = {
      nome_anuncio: formNome.trim(),
      variacao: formVariacao.trim() || null,
      sku_erp: formSkuErp.trim() || null,
      sku_id: itensComponentes[0]?.sku_id,
      itens: itensComponentes.map((i) => ({
        sku_id: i.sku_id,
        quantidade: i.quantidade,
      })),
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
    <Modal open={open} onClose={onClose} title={isEditing ? 'Editar Mapeamento / Kit' : 'Novo Mapeamento / Kit'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="field-label">Nome do Anúncio (Marketplace) *</label>
          <input
            className="input"
            value={formNome}
            onChange={(e) => setFormNome(e.target.value)}
            placeholder="Ex: Kit 2 Mesas de Cabeceira Retrô"
          />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="field-label">Variação / Cor (Opcional)</label>
            <input
              className="input"
              value={formVariacao}
              onChange={(e) => setFormVariacao(e.target.value)}
              placeholder="Ex: Off White / Freijó"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="field-label">SKU ERP / Upseller (Opcional)</label>
            <input
              className="input"
              value={formSkuErp}
              onChange={(e) => setFormSkuErp(e.target.value)}
              placeholder="Código do anúncio no hub"
            />
          </div>
        </div>

        {/* Composição de Itens / Kit (BOM) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="field-label" style={{ margin: 0 }}>
              Estrutura de Produtos / Componentes ({itensComponentes.length})
            </label>
            <Button size="sm" variant="secondary" onClick={() => setModalSkuOpen(true)}>
              <Plus size={14} /> Adicionar SKU
            </Button>
          </div>

          {itensComponentes.length === 0 ? (
            <div style={{ padding: 16, border: '1px dashed #cbd5e1', borderRadius: 8, textAlign: 'center', color: 'var(--texto-suave)', fontSize: 13 }}>
              Nenhum SKU selecionado. Clique em "+ Adicionar SKU" para vincular produtos individuais ou kits.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {itensComponentes.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#f8fafc',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{item.nome}</div>
                    <div style={{ fontSize: 12, color: 'var(--texto-suave)' }}>SKU: <b>{item.sku}</b></div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Qtd:</span>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      style={{ width: 60, padding: '4px 8px', textAlign: 'center' }}
                      value={item.quantidade}
                      onChange={(e) => alterarQuantidadeItem(idx, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removerItem(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="field-error" style={{ display: 'block' }}>{error}</div>}

        <div className="actions-right" style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={saving}>
            {saving ? <Spinner size={16} /> : 'Salvar Mapeamento'}
          </Button>
        </div>
      </div>

      {/* Modal Selecionar SKU */}
      <Modal open={modalSkuOpen} onClose={() => setModalSkuOpen(false)} title="Selecionar SKU do Sistema" footer={null}>
        <div style={{ marginBottom: '12px' }}>
          <Input
            placeholder="Buscar por nome ou código SKU..."
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
                  onClick={() => adicionarSkuAoKit(sku)}
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
                  <div style={{ fontSize: '13px', color: '#64748b' }}>SKU: <b>{sku.sku}</b></div>
                </button>
              ))
            )}
          </div>
        )}
      </Modal>
    </Modal>
  );
}
