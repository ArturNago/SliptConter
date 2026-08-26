-- Migration 019: Suporte a Kits e Composição de Produtos (BOM - Bill of Materials)
-- Permite que 1 anúncio ou SKU_ERP dê baixa em múltiplos SKUs ou quantidades multiplicadas (ex: Kit 2 Mesas, Mesa + 4 Cadeiras)

CREATE TABLE IF NOT EXISTS mapeamento_anuncio_itens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapeamento_id   UUID NOT NULL REFERENCES mapeamento_anuncios_sku(id) ON DELETE CASCADE,
    sku_id          UUID NOT NULL REFERENCES skus(id),
    quantidade      INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(mapeamento_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_map_itens_mapeamento ON mapeamento_anuncio_itens (mapeamento_id);
CREATE INDEX IF NOT EXISTS idx_map_itens_sku ON mapeamento_anuncio_itens (sku_id);

-- Migração automática dos dados existentes: cada mapeamento existente vira 1 item na nova tabela
INSERT INTO mapeamento_anuncio_itens (mapeamento_id, sku_id, quantidade)
SELECT id, sku_id, 1
FROM mapeamento_anuncios_sku
WHERE sku_id IS NOT NULL
ON CONFLICT (mapeamento_id, sku_id) DO NOTHING;
