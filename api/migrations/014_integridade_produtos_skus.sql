-- 014: integridade e performance do modelo Produtos Pai / SKUs
-- (sem BEGIN/COMMIT: o runner de migrations já envolve cada arquivo em
--  uma única transação — ver migrations/run.js)

-- Índice para a FK skus.produto_id (JOINs e filtros por Pai)
CREATE INDEX IF NOT EXISTS idx_skus_produto ON skus (produto_id);

-- Nome do Produto Pai único: garante o find-or-create do cadastro
-- (POST /api/produtos) sem duplicar Pais em requisições concorrentes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_nome_unique ON produtos (nome);
