-- Sem BEGIN/COMMIT: o runner envolve cada arquivo em uma transação única.
-- Roda antes da migration 013 (renomeia produtos->skus), então a tabela
-- `produtos` ainda possui a coluna `sku` neste ponto.
UPDATE produtos
SET ativo = FALSE, updated_at = now()
WHERE sku IN ('AGU-500ML-12', 'ARR-5KG-T1', 'FEI-1KG-P');
