import React, { useState, useEffect } from 'react';
import { Modal, Button, Select, Badge, Spinner } from './common';
import api from '../services/api';
import MapeamentoFormModal from './MapeamentoFormModal';

export default function ImportSalesModal({ open, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [armazens, setArmazens] = useState([]);
  const [selectedArmazem, setSelectedArmazem] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [mappingItem, setMappingItem] = useState(null);
  const [reprocessLoading, setReprocessLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setResult(null);
      setError(null);
      setMappingItem(null);
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

  const handleDownloadErros = () => {
    if (!result?.arquivoErrosBase64) return;
    try {
      const byteCharacters = atob(result.arquivoErrosBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendas_nao_sincronizadas_${new Date().toISOString().slice(0,10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao baixar planilha de erros:', e);
      alert('Erro ao baixar a planilha. Tente novamente.');
    }
  };

  const handleReprocessar = async () => {
    if (!result?.naoMapeados || result.naoMapeados.length === 0) return;
    setReprocessLoading(true);
    setError(null);
    try {
      const res = await api.reprocessarNaoMapeados([selectedArmazem], result.naoMapeados);
      setResult((prev) => {
        const novosProcessados = [...(prev.processados || []), ...(res.processados || [])];
        const novasMovimentacoes = (res.processados || []).reduce((acc, p) => {
          acc[p.movimentacaoId] = p;
          return acc;
        }, {});
        return {
          ...prev,
          resumo: {
            ...prev.resumo,
            processados: prev.resumo.processados + (res.processados || []).length,
            naoMapeados: (res.naoMapeados || []).length,
            erros: prev.resumo.erros + (res.erros || []).length,
          },
          processados: novosProcessados,
          naoMapeados: res.naoMapeados || [],
          erros: [...(prev.erros || []), ...(res.erros || [])],
        };
      });
    } catch (err) {
      setError(err.response?.data?.erro || 'Erro ao reprocessar itens pendentes.');
    } finally {
      setReprocessLoading(false);
    }
  };

  const handleMappingSaved = async () => {
    setMappingItem(null);
    await handleReprocessar();
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
          <div style={{ marginTop: '15px' }}>
            <h5 style={{ margin: '0 0 8px 0' }}>SKUs não mapeados</h5>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
              {naoMapeados.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.nomeAnuncio || 'Sem nome'}</div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      SKU ERP: {item.skuErp} {item.variacao ? `• Var: ${item.variacao}` : ''} • Qtd: {item.qtdVendida}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setMappingItem(item)}>
                    Mapear agora
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(naoMapeados.length > 0 || erros.length > 0) && (
          <div style={{ marginTop: '15px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button onClick={handleDownloadErros} disabled={!result?.arquivoErrosBase64}>
              Baixar planilha de não sincronizados (.xlsx)
            </Button>
            <Button variant="secondary" onClick={handleReprocessar} disabled={reprocessLoading || naoMapeados.length === 0}>
              {reprocessLoading ? <Spinner size={16} /> : 'Reprocessar pendentes'}
            </Button>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px', width: '100%' }}>
              {naoMapeados.length > 0 && erros.length > 0
                ? 'A planilha contém abas separadas para erros e SKUs não mapeados.'
                : naoMapeados.length > 0
                  ? 'A planilha contém os SKUs não mapeados para você atualizar a planilha mestre.'
                  : 'A planilha contém os detalhes dos erros ocorridos.'}
            </p>
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
          <Button variant="secondary" onClick={onClose} disabled={loading || reprocessLoading}>
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

      {mappingItem && (
        <MapeamentoFormModal
          open={!!mappingItem}
          onClose={() => setMappingItem(null)}
          mapeamento={{
            nome_anuncio: mappingItem.nomeAnuncio,
            sku_erp: mappingItem.skuErp,
            variacao: mappingItem.variacao || null,
          }}
          onSaved={handleMappingSaved}
        />
      )}
    </Modal>
  );
}
