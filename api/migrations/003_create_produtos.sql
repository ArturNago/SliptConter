CREATE TABLE IF NOT EXISTS produtos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                     VARCHAR(60) NOT NULL UNIQUE,
    descricao               VARCHAR(255) NOT NULL,
    volumes_por_camada      INTEGER NOT NULL CHECK (volumes_por_camada > 0),
    camadas_maximas_palete  INTEGER CHECK (camadas_maximas_palete IS NULL OR camadas_maximas_palete > 0),
    ativo                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos (sku);
