import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, ArrowRight, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { sound } from '../../services/soundFeedback';

export default function TransferModal({
  open,
  onClose,
  skuInicial = null,
  armazens = [],
  onSucesso,
}) {
  const [skuId, setSkuId] = useState(skuInicial?.sku_id || skuInicial?.id || '');
  const [armazemOrigemId, setArmazemOrigemId] = useState('');
  const [armazemDestinoId, setArmazemDestinoId] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [saldoOrigem, setSaldoOrigem] = useState(null);
  const [saldoDestino, setSaldoDestino] = useState(null);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (open && skuInicial) {
      setSkuId(skuInicial.sku_id || skuInicial.id);
      if (armazens.length >= 2) {
        setArmazemOrigemId(armazens[0].id);
        setArmazemDestinoId(armazens[1].id);
      }
      setQuantidade(1);
      setObservacao('');
      setErro(null);
    }
  }, [open, skuInicial, armazens]);

  // Atualiza os saldos de origem e destino em tempo real
  useEffect(() => {
    if (skuId && armazemOrigemId) {
      api.get(`/produtos/${skuId}/saldo?armazemId=${armazemOrigemId}`)
        .then((res) => setSaldoOrigem(res.data?.saldo ?? 0))
        .catch(() => setSaldoOrigem(0));
    }
    if (skuId && armazemDestinoId) {
      api.get(`/produtos/${skuId}/saldo?armazemId=${armazemDestinoId}`)
        .then((res) => setSaldoDestino(res.data?.saldo ?? 0))
        .catch(() => setSaldoDestino(0));
    }
  }, [skuId, armazemOrigemId, armazemDestinoId]);

  if (!open) return null;

  const handleTransferir = async (e) => {
    e.preventDefault();
    if (!skuId || !armazemOrigemId || !armazemDestinoId || !quantidade) {
      sound.tocarErro();
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    if (armazemOrigemId === armazemDestinoId) {
      sound.tocarErro();
      setErro('O armazém de origem e destino devem ser diferentes.');
      return;
    }
    if (saldoOrigem !== null && quantidade > saldoOrigem) {
      sound.tocarErro();
      setErro(`Saldo insuficiente no armazém de origem. Disponível: ${saldoOrigem} un.`);
      return;
    }

    setLoading(true);
    setErro(null);

    try {
      const res = await api.post('/armazens/transferencia', {
        skuId,
        armazemOrigemId,
        armazemDestinoId,
        quantidade: parseInt(quantidade, 10),
        observacao,
      });

      sound.tocarSucesso();
      if (onSucesso) onSucesso(res.data?.mensagem || 'Transferência concluída!');
      onClose();
    } catch (err) {
      sound.tocarErro();
      setErro(err.response?.data?.erro || 'Erro ao realizar transferência.');
    } finally {
      setLoading(false);
    }
  };

  const origemNome = armazens.find((a) => a.id === armazemOrigemId)?.nome || 'Origem';
  const destinoNome = armazens.find((a) => a.id === armazemDestinoId)?.nome || 'Destino';

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: 480, width: '92%', borderRadius: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              background: 'rgba(15, 118, 110, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primario)',
            }}
          >
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Transferência entre Barracões</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--texto-suave)' }}>
              Movimentação segura de dupla entrada com trava anti-negativação
            </p>
          </div>
        </div>

        {erro && (
          <div className="mobile-alert mobile-alert-error" style={{ marginBottom: 12 }}>
            <AlertTriangle size={16} />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleTransferir}>
          {/* Produto Selecionado */}
          <div style={{ background: 'var(--vidro)', border: '1px solid var(--borda)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primario)' }}>
              {skuInicial?.sku || 'SKU'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 2 }}>
              {skuInicial?.descricao}
            </div>
          </div>

          {/* Seleção de Origem e Destino */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>
                Barracão Origem (Saída)
              </label>
              <select
                className="input"
                style={{ width: '100%', marginTop: 4 }}
                value={armazemOrigemId}
                onChange={(e) => setArmazemOrigemId(e.target.value)}
              >
                {armazens.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, marginTop: 4, color: saldoOrigem !== null && saldoOrigem < quantidade ? 'var(--perigo)' : 'var(--texto-suave)', fontWeight: 600 }}>
                Saldo atual: <b>{saldoOrigem ?? '...'} un</b>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>
                Barracão Destino (Entrada)
              </label>
              <select
                className="input"
                style={{ width: '100%', marginTop: 4 }}
                value={armazemDestinoId}
                onChange={(e) => setArmazemDestinoId(e.target.value)}
              >
                {armazens.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, marginTop: 4, color: 'var(--texto-suave)', fontWeight: 600 }}>
                Saldo atual: <b>{saldoDestino ?? '...'} un</b>
              </div>
            </div>
          </div>

          {/* Quantidade a Transferir */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>
              Quantidade de Volumes a Transferir
            </label>
            <input
              type="number"
              min="1"
              max={saldoOrigem || 99999}
              className="input"
              style={{ width: '100%', marginTop: 4, fontSize: 18, fontWeight: 800 }}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))}
            />
          </div>

          {/* Simulação Visual do Saldo Pós-Transferência */}
          {saldoOrigem !== null && saldoDestino !== null && (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(15,118,110,0.1), rgba(15,118,110,0.02))',
                border: '1px solid rgba(15,118,110,0.3)',
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--primario)', marginBottom: 4 }}>
                Simulação de Saldos Pós-Transferência:
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--texto)' }}>
                <span>{origemNome}: <b>{saldoOrigem} ➔ {saldoOrigem - quantidade} un</b></span>
                <span>{destinoNome}: <b>{saldoDestino} ➔ {saldoDestino + quantidade} un</b></span>
              </div>
            </div>
          )}

          {/* Observação / Motivo */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>
              Observação / Placa do Veículo (Opcional)
            </label>
            <input
              type="text"
              className="input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Ex: Abastecimento de expedição, caminhão X..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              disabled={loading || (saldoOrigem !== null && quantidade > saldoOrigem)}
            >
              {loading ? (
                <RefreshCw size={18} className="spinner" />
              ) : (
                <>
                  <ArrowRightLeft size={16} />
                  <span>Confirmar Transferência</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
