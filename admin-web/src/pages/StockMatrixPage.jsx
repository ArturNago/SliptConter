import React, { useState, useEffect, useMemo } from 'react';
import { useEstoqueConsolidado } from '../hooks/useStock';
import { StockTable, StockFilter, StockAdjustModal } from '../components/stock';
import { Button, Modal } from '../components/common';
import { useNotification } from '../contexts/NotificationContext';
import { ajusteManualEstoque, getRelatorioExportacao } from '../services/stockService';
import { gerarCSV, baixarArquivo, formatarNumero } from '../utils/formatters';

export default function StockMatrixPage() {
  const [filtros, setFiltros] = useState({ busca: '', armazemId: '', categoria: '', apenasBaixo: 'false' });
  const [limiteAlerta, setLimiteAlerta] = useState(0);
  const [selecionado, setSelecionado] = useState(null);
  const [modalAjuste, setModalAjuste] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const { sucesso, erro } = useNotification();

  const query = useMemo(
    () => ({ ...filtros, limiteAlerta }),
    [filtros, limiteAlerta]
  );
  const { data, loading, recarregar } = useEstoqueConsolidado(query);

  // Redeploy leve ao digitar (debounce simples).
  useEffect(() => {
    const t = setTimeout(() => recarregar(), 250);
    return () => clearTimeout(t);
  }, [query, recarregar]);

  const exportarCSV = async () => {
    try {
      const res = await getRelatorioExportacao({ ...query, tipo: 'estoque' });
      const colunas = [
        { chave: 'sku', rotulo: 'SKU' },
        { chave: 'descricao', rotulo: 'Descricao' },
        { chave: 'categoria', rotulo: 'Categoria' },
        { chave: 'volumes_por_camada', rotulo: 'VolCamada' },
        { chave: 'camadas_maximas_palete', rotulo: 'Camadas' },
        { chave: 'saldo', rotulo: 'Saldo' },
        { chave: 'custo_medio', rotulo: 'CustoMedio' },
        { chave: 'preco_venda', rotulo: 'PrecoVenda' },
        { chave: 'status', rotulo: 'Status' },
      ];
      baixarArquivo(gerarCSV(res.linhas, colunas), `estoque_${new Date().toISOString().slice(0, 10)}.csv`);
      sucesso('Relatório exportado com sucesso.');
    } catch (e) {
      erro('Falha ao exportar relatório.');
    }
  };

  const confirmarAjuste = async (payload) => {
    try {
      await ajusteManualEstoque(payload);
      sucesso('Ajuste manual registrado no ledger.');
      recarregar();
    } catch (e) {
      erro(e.response?.data?.erro || 'Falha ao registrar ajuste.');
    }
  };

  const abrirDetalhe = (item) => {
    setSelecionado(item);
    setDetalhe(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <StockFilter filtros={filtros} onChange={setFiltros} limiteAlerta={limiteAlerta} onLimiteChange={setLimiteAlerta} />
        <Button variant="ghost" onClick={exportarCSV}>Exportar CSV</Button>
      </div>

      <StockTable data={data} loading={loading} onRowClick={abrirDetalhe} />

      <StockAdjustModal
        open={modalAjuste}
        onClose={() => setModalAjuste(false)}
        item={selecionado}
        onConfirm={confirmarAjuste}
      />

      <Modal
        open={!!detalhe}
        onClose={() => setDetalhe(false)}
        title={selecionado ? `Detalhe — ${selecionado.sku}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetalhe(false)}>Fechar</Button>
            <Button variant="primary" onClick={() => { setDetalhe(false); setModalAjuste(true); }}>
              Ajuste Manual
            </Button>
          </>
        }
      >
        {selecionado && (
          <div className="stat-row">
            <div className="stat-pill">Descrição<b>{selecionado.descricao}</b></div>
            <div className="stat-pill">Categoria<b>{selecionado.categoria || '—'}</b></div>
            <div className="stat-pill">Saldo<b>{formatarNumero(selecionado.saldo)}</b></div>
            <div className="stat-pill">Custo Médio<b>{selecionado.custo_medio || '—'}</b></div>
            <div className="stat-pill">Preço Venda<b>{selecionado.preco_venda || '—'}</b></div>
            <div className="stat-pill">EAN<b>{selecionado.codigo_barras_ean || '—'}</b></div>
            <div className="stat-pill">Vol/Camada<b>{selecionado.volumes_por_camada || '—'}</b></div>
            <div className="stat-pill">Camadas<b>{selecionado.camadas_maximas_palete || '—'}</b></div>
          </div>
        )}
        <p style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
          O saldo é derivado do ledger imutável (SUM de movimentações). Use "Ajuste Manual" para corrigir quebras, perdas ou inventário.
        </p>
      </Modal>
    </div>
  );
}
