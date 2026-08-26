-- Migration 021: Adição de motivo_ajuste e lote_id em movimentacoes_estoque
ALTER TABLE movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS motivo_ajuste VARCHAR(50) DEFAULT 'operacao_padrao',
  ADD COLUMN IF NOT EXISTS lote_id UUID REFERENCES lotes_importacao_vendas(id);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_motivo ON movimentacoes_estoque (motivo_ajuste);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_lote ON movimentacoes_estoque (lote_id);
