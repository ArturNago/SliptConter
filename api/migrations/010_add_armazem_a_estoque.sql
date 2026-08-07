-- Sem BEGIN/COMMIT: o runner envolve cada arquivo em uma transação única.
ALTER TABLE movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS armazem_id UUID REFERENCES armazens (id);
ALTER TABLE conferencias
  ADD COLUMN IF NOT EXISTS armazem_id UUID REFERENCES armazens (id);

UPDATE movimentacoes_estoque
SET armazem_id = (SELECT id FROM armazens WHERE codigo = 'PRINCIPAL')
WHERE armazem_id IS NULL;

UPDATE conferencias
SET armazem_id = (SELECT id FROM armazens WHERE codigo = 'PRINCIPAL')
WHERE armazem_id IS NULL;

ALTER TABLE movimentacoes_estoque ALTER COLUMN armazem_id SET NOT NULL;
ALTER TABLE conferencias ALTER COLUMN armazem_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_armazem ON movimentacoes_estoque (armazem_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto_armazem
  ON movimentacoes_estoque (produto_id, armazem_id);
CREATE INDEX IF NOT EXISTS idx_conferencias_armazem ON conferencias (armazem_id);
