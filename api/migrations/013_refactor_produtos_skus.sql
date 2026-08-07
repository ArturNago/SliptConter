-- 013: refatoração produto(Pai) x SKU(variação)
-- Sem BEGIN/COMMIT: o runner (migrations/run.js) envolve cada arquivo em
-- uma única transação. BEGIN/COMMIT aninhado no arquivo comita
-- prematuramente e pode deixar schema_migrations fora de sincronia.
--
-- A migration é idempotente: em bancos já migrados (onde `produtos` já é o
-- Pai) os blocos DO não fazem nada; em fresh installs renomeia a tabela
-- antiga de `produtos` (que ainda tem a coluna `sku`) para `skus`.

-- 1. Renomeia a tabela de produtos (antiga) para skus — só se ainda tiver
--    a coluna `sku` (fresh install que acabou de rodar a migration 003).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'produtos' AND column_name = 'sku') THEN
    ALTER TABLE produtos RENAME TO skus;
  END IF;
END $$;

-- 2. Renomeia as colunas FK nas tabelas dependentes — só se ainda existirem
--    com o nome antigo (informações_schema verifica coluna por coluna).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'conferencias' AND column_name = 'produto_id') THEN
    ALTER TABLE conferencias RENAME COLUMN produto_id TO sku_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema()
               AND table_name = 'movimentacoes_estoque' AND column_name = 'produto_id') THEN
    ALTER TABLE movimentacoes_estoque RENAME COLUMN produto_id TO sku_id;
  END IF;
END $$;

-- Atualiza os índices associados para manter a padronização (se existirem).
ALTER INDEX IF EXISTS idx_produtos_sku RENAME TO idx_skus_sku;
ALTER INDEX IF EXISTS idx_conferencias_produto RENAME TO idx_conferencias_sku;
ALTER INDEX IF EXISTS idx_movimentacoes_produto RENAME TO idx_movimentacoes_sku;

-- 3. Cria a nova tabela de produtos ( Produtos Pai ) — no-op se já existir.
CREATE TABLE IF NOT EXISTS produtos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                    VARCHAR(255) NOT NULL,
    marca                   VARCHAR(100),
    categoria               VARCHAR(100),
    peso_kg                 DECIMAL(10,3),
    dimensoes               VARCHAR(100),
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Link SKU -> Produto Pai. O ADD COLUMN com IF NOT EXISTS evita erro
--    se já houver sido aplicado.
ALTER TABLE skus ADD COLUMN IF NOT EXISTS produto_id UUID REFERENCES produtos(id);

-- 5. Colunas extras de SKUs (dados da planilha). IF NOT EXISTS idempotente.
ALTER TABLE skus
  ADD COLUMN IF NOT EXISTS cor VARCHAR(100),
  ADD COLUMN IF NOT EXISTS material VARCHAR(100),
  ADD COLUMN IF NOT EXISTS codigo_barras_ean VARCHAR(50),
  ADD COLUMN IF NOT EXISTS custo_medio DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS preco_venda DECIMAL(10,2);

-- Down-migration (rollback manual): reverter renames e dropar a tabela Pai.
--   ALTER TABLE skus RENAME TO produtos_legacy;
--   ALTER TABLE conferencias RENAME COLUMN sku_id TO produto_id;
--   ALTER TABLE movimentacoes_estoque RENAME COLUMN sku_id TO produto_id;
--   DROP TABLE produtos;
-- (não automatizado: 013 é destrutiva; faça pg_dump antes de migrar.)
