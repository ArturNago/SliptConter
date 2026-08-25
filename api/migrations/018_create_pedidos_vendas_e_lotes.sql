-- Migration 018: Gestão de Lotes de Importação de Vendas e Idempotência Rigorosa
CREATE TABLE IF NOT EXISTS lotes_importacao_vendas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo    VARCHAR(255) NOT NULL,
    total_linhas    INTEGER NOT NULL DEFAULT 0,
    processados     INTEGER NOT NULL DEFAULT 0,
    nao_mapeados    INTEGER NOT NULL DEFAULT 0,
    erros           INTEGER NOT NULL DEFAULT 0,
    armazem_id      UUID NOT NULL REFERENCES armazens(id),
    usuario_id      UUID REFERENCES usuarios(id),
    status          VARCHAR(30) NOT NULL DEFAULT 'concluido', -- 'concluido', 'estornado'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedidos_vendas_importados (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lote_id         UUID NOT NULL REFERENCES lotes_importacao_vendas(id) ON DELETE CASCADE,
    numero_pedido   VARCHAR(100) NOT NULL,
    plataforma      VARCHAR(50),
    data_pedido     TIMESTAMPTZ,
    sku_erp         VARCHAR(100) NOT NULL,
    nome_anuncio    TEXT,
    variacao        TEXT,
    quantidade      INTEGER NOT NULL,
    armazem_id      UUID NOT NULL REFERENCES armazens(id),
    sku_id          UUID REFERENCES skus(id),
    movimentacao_id UUID REFERENCES movimentacoes_estoque(id),
    status          VARCHAR(30) NOT NULL DEFAULT 'processado', -- 'processado', 'nao_mapeado', 'erro', 'estornado'
    motivo_erro     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante que o mesmo pedido + SKU_ERP + Armazém não seja baixado duas vezes (idempotência)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_vendas_unico 
    ON pedidos_vendas_importados (numero_pedido, sku_erp, armazem_id)
    WHERE status = 'processado';

CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_lote ON pedidos_vendas_importados (lote_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_sku ON pedidos_vendas_importados (sku_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendas_pedido ON pedidos_vendas_importados (numero_pedido);
