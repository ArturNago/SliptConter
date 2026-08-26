-- Migration 017: colunas de contagem assistida por IA (detecção de caixas)
-- Estratégia híbrida: YOLOv12 detecta caixas da camada frontal (caixas_por_camada),
-- operador confirma número de camadas (camadas_confirmadas).
-- Total = caixas_por_camada * camadas_confirmadas.

ALTER TABLE conferencias
  ADD COLUMN IF NOT EXISTS caixas_por_camada INTEGER,
  ADD COLUMN IF NOT EXISTS camadas_confirmadas INTEGER,
  ADD COLUMN IF NOT EXISTS caixas_sugeridas_ia INTEGER,
  ADD COLUMN IF NOT EXISTS deteccoes_ia JSONB;

-- Índice para o worker de treino buscar conferências com detecções
CREATE INDEX IF NOT EXISTS idx_conferencias_deteccoes_ia
  ON conferencias (status_dataset)
  WHERE deteccoes_ia IS NOT NULL;
