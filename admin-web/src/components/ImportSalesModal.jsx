import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, Badge, Spinner } from './common';
import api from '../services/api';

export default function ImportSalesModal({ open, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [armazens, setArmazens] = useState([]);
  const [selectedArmazem, setSelectedArmazem] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setError(null);
      api.get('/armazens')
        .then((res) => {
          setArmazens(res.data);
          if (res.data.length > 0) {
             setSelectedArmazem(res.data[0].id);
          }
        })
        .catch(() => setError('Erro ao carregar armazéns.'));
    }
  }, [open]);

  const handleImport = async () => {
    if (!file) {
      setError('Por favor, selecione a planilha de vendas (.xlsx).');
      return;
    }
    if (!selectedArmazem) {
      setError('Por favor, selecione um armazém.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('armazemIds', JSON.stringify([selectedArmazem]));

    try {
      const res = await api.post('/movimentacoes/importar-vendas', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      setError(err.response?.data?.erro || 'Erro ao processar a planilha.');
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;
    const { resumo, erros, naoMapeados } = result;
    return (
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <h4>Resultado da Sincronização</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0' }}>
          <li>Total de vendas lidas: <strong>{resumo.totalLinhas}</strong></li>
          <li>Sucesso (Baixas efetuadas): <strong><Badge tone="success">{resumo.processados}</Badge></strong></li>
          <li>SKUs não mapeados: <strong><Badge tone="warning">{resumo.naoMapeados}</Badge></strong></li>
          <li>Erros gerais: <strong><Badge tone="danger">{resumo.erros}</Badge></strong></li>
        </ul>
        
        {naoMapeados.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <p style={{ fontSize: '14px', color: '#666' }}>O sistema ignorou SKUs não mapeados. Atualize sua planilha mestre para incluí-los no futuro.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Sincronizar Vendas (Planilha Upseller)"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Fechar
          </Button>
          {!result && (
            <Button onClick={handleImport} disabled={loading || !file}>
              {loading ? <Spinner size={16} /> : 'Processar Planilha'}
            </Button>
          )}
        </>
      }
    >
      {!result ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <p style={{ fontSize: '14px', color: '#555' }}>
            Selecione a planilha de pedidos diários exportada do Upseller. 
            O sistema mapeará os SKUs e dará baixa automaticamente no estoque do armazém selecionado.
          </p>
          
          <div className="field">
            <label className="field-label">Armazém de Saída</label>
            <Select 
               value={selectedArmazem} 
               onChange={(e) => setSelectedArmazem(e.target.value)}
               disabled={loading}
            >
              {armazens.map(a => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
            </Select>
          </div>

          <div className="field">
            <label className="field-label">Planilha (.xlsx)</label>
            <input 
              type="file" 
              accept=".xlsx" 
              onChange={(e) => setFile(e.target.files[0])} 
              className="input"
              disabled={loading}
            />
          </div>

          {error && <div className="field-error" style={{ display: 'block' }}>{error}</div>}
        </div>
      ) : (
        renderResult()
      )}
    </Modal>
  );
}
