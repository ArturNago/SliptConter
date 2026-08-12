-- Adiciona a coluna sku_erp para mapear o SKU do Upseller (ERP) ao SKU interno (Tebarrot)
ALTER TABLE mapeamento_anuncios_sku
ADD COLUMN IF NOT EXISTS sku_erp VARCHAR(100);

-- Cria um índice único para garantir que cada SKU do ERP aponte para um único mapeamento
CREATE UNIQUE INDEX IF NOT EXISTS idx_mapeamento_sku_erp ON mapeamento_anuncios_sku (sku_erp);
