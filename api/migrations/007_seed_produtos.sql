-- ============================================================
-- Seed de Master Data (V0)
-- Cadastra os produtos reais do galpão para que o fluxo de
-- leitura de etiquetas (bipar SKU) funcione imediatamente.
--
-- volumes_por_camada  = quantos volumes (caixas/sacos/fardos) formam
--                       UMA camada da pilha fotografada.
-- camadas_maximas_palete = limite físico de empilhamento (auditoria).
-- ============================================================

INSERT INTO produtos (sku, descricao, volumes_por_camada, camadas_maximas_palete)
VALUES
  ('AGU-500ML-12', 'Água Mineral 500ml - Fardo c/ 12 unidades', 10, 8),
  ('ARR-5KG-T1',   'Arroz Tipo 1 - Saco 5kg',                    8, 10),
  ('FEI-1KG-P',    'Feijão Carioca - Saco 1kg',                 12, 8)
ON CONFLICT (sku) DO NOTHING;
