-- Sem BEGIN/COMMIT: o runner (migrations/run.js) envolve cada arquivo em
-- uma única transação.
CREATE TABLE IF NOT EXISTS mapeamento_anuncios_sku (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_anuncio TEXT NOT NULL,
    variacao     TEXT,
    sku_id       UUID NOT NULL REFERENCES skus(id),
    ativo        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único funcional: trata variacao NULL como '' para evitar duplicatas.
-- (UNIQUE constraint não suporta expressões; CREATE UNIQUE INDEX sim.)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mapeamento_anuncio_variacao
    ON mapeamento_anuncios_sku (nome_anuncio, COALESCE(variacao, ''));

CREATE INDEX IF NOT EXISTS idx_mapeamento_nome ON mapeamento_anuncios_sku (nome_anuncio);
CREATE INDEX IF NOT EXISTS idx_mapeamento_sku  ON mapeamento_anuncios_sku (sku_id);
