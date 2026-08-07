-- Sem BEGIN/COMMIT: o runner envolve cada arquivo em uma transação única.
ALTER TABLE produtos ALTER COLUMN volumes_por_camada DROP NOT NULL;
ALTER TABLE produtos DROP CONSTRAINT IF EXISTS produtos_volumes_por_camada_check;
ALTER TABLE produtos ADD CONSTRAINT produtos_volumes_por_camada_check
  CHECK (volumes_por_camada IS NULL OR volumes_por_camada > 0);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS quantidade_volumes INTEGER
  CHECK (quantidade_volumes IS NULL OR quantidade_volumes > 0);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(60);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500);

ALTER TABLE conferencias RENAME COLUMN camadas_informadas TO quantidade_contada;
ALTER TABLE conferencias RENAME COLUMN camadas_sugeridas_ia TO quantidade_sugerida_ia;
ALTER TABLE conferencias ALTER COLUMN url_imagem_local DROP NOT NULL;
