import React, { useState, useMemo } from 'react';
import { Search, X, Check, Package, Sparkles, Filter } from 'lucide-react';
import { sound } from '../../services/soundFeedback';

export default function FastProductSelector({
  produtos = [],
  skuSelecionado = null,
  onSelecionar,
  onLimpar,
}) {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todos');

  // Extrai categorias dinâmicas dos produtos cadastrados
  const categorias = useMemo(() => {
    const cats = new Set();
    produtos.forEach((p) => {
      if (p.categoria) {
        cats.add(p.categoria.trim());
      } else if (p.produto_categoria) {
        cats.add(p.produto_categoria.trim());
      } else {
        // Tenta inferir pelo início do nome (ex: "Penteadeira", "Mesa", "Rack", "Cabeceira")
        const primeiroNome = (p.descricao || '').split(' ')[0];
        if (primeiroNome && primeiroNome.length > 3) {
          cats.add(primeiroNome.toUpperCase());
        }
      }
    });
    return Array.from(cats).slice(0, 8);
  }, [produtos]);

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const termo = busca.toLowerCase().trim();
      const matchBusca =
        !termo ||
        p.sku.toLowerCase().includes(termo) ||
        (p.descricao || '').toLowerCase().includes(termo) ||
        (p.cor || '').toLowerCase().includes(termo);

      if (!matchBusca) return false;

      if (filtroCategoria !== 'todos') {
        const catProd = (p.categoria || p.produto_categoria || (p.descricao || '').split(' ')[0] || '').toUpperCase();
        return catProd.includes(filtroCategoria);
      }

      return true;
    });
  }, [produtos, busca, filtroCategoria]);

  if (skuSelecionado) {
    return (
      <div className="sku-selected-box">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, fontSize: '16px', color: 'var(--primario)' }}>
              {skuSelecionado.sku}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(15,118,110,0.15)', color: 'var(--primario)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
              Selecionado
            </span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--texto)', fontWeight: 600, marginTop: '2px' }}>
            {skuSelecionado.descricao}
          </div>
          {(skuSelecionado.volumesPorCamada || skuSelecionado.camadasMaximasPalete) && (
            <div style={{ fontSize: '11px', color: 'var(--texto-suave)', marginTop: '2px' }}>
              Padrão: {skuSelecionado.volumesPorCamada || 1} cx/camada · {skuSelecionado.camadasMaximasPalete || 1} camadas
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            sound.tocarSucesso();
            onLimpar();
          }}
          style={{ whiteSpace: 'nowrap', fontWeight: 700 }}
        >
          Trocar SKU
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Campo de Busca Rápida com Auto-Complete */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className="input"
          placeholder="Digitar código do SKU, Nome do móvel ou Cor..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ paddingLeft: '38px', paddingRight: busca ? '38px' : '12px', fontSize: '14px' }}
        />
        <Search
          size={18}
          color="var(--texto-suave)"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--texto-suave)',
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Chips de Categorias para Filtro Rápido */}
      {categorias.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 0', margin: '4px 0' }}>
          <button
            type="button"
            className={`filter-pill ${filtroCategoria === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroCategoria('todos')}
            style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap', borderRadius: '14px' }}
          >
            Todos ({produtos.length})
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`filter-pill ${filtroCategoria === cat ? 'active' : ''}`}
              onClick={() => setFiltroCategoria(cat)}
              style={{ padding: '4px 10px', fontSize: '11px', whiteSpace: 'nowrap', borderRadius: '14px' }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Lista de Produtos Encontrados com Cards Tácteis */}
      <div className="sku-quick-list" style={{ maxHeight: '220px', marginTop: '6px' }}>
        {produtosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 10px', color: 'var(--texto-suave)', fontSize: '13px' }}>
            Nenhum produto encontrado com "{busca}".
          </div>
        ) : (
          produtosFiltrados.slice(0, 10).map((p) => (
            <div
              key={p.id}
              className="sku-quick-item"
              onClick={() => {
                sound.tocarSucesso();
                onSelecionar(p);
              }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div>
                <div style={{ fontWeight: 800, color: 'var(--texto)', fontSize: '14px' }}>
                  {p.sku}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--texto-suave)', marginTop: '2px' }}>
                  {p.descricao}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--primario)', fontWeight: 700 }}>
                Selecionar ➔
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
