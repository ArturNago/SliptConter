-- Migration 020: Módulo de Inventário Cíclico e Contagem Cega para Auditoria PCP
CREATE TABLE IF NOT EXISTS ordens_inventario (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(50) NOT NULL UNIQUE,
    descricao           VARCHAR(255),
    armazem_id          UUID NOT NULL REFERENCES armazens(id),
    status              VARCHAR(30) NOT NULL DEFAULT 'aberto', -- 'aberto', 'em_contagem', 'concluido', 'cancelado'
    tipo                VARCHAR(30) NOT NULL DEFAULT 'ciclico', -- 'ciclico', 'geral', 'amostragem'
    criado_por          UUID REFERENCES usuarios(id),
    finalizado_por      UUID REFERENCES usuarios(id),
    total_itens         INTEGER NOT NULL DEFAULT 0,
    itens_contados      INTEGER NOT NULL DEFAULT 0,
    itens_acurados      INTEGER NOT NULL DEFAULT 0,
    acuracidade_pct     DECIMAL(5,2) DEFAULT 0.00, -- IRA (Índice de Acuracidade de Inventário)
    observacao          TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS itens_ordem_inventario (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_id                    UUID NOT NULL REFERENCES ordens_inventario(id) ON DELETE CASCADE,
    sku_id                      UUID NOT NULL REFERENCES skus(id),
    saldo_sistema_congelado     INTEGER NOT NULL DEFAULT 0, -- Saldo registrado no momento da abertura
    quantidade_contada          INTEGER,                    -- Informado pelo operador (contagem cega)
    divergencia                 INTEGER,                    -- quantidade_contada - saldo_sistema_congelado
    aprovado                    BOOLEAN,                    -- NULL = pendente, TRUE = aprovado, FALSE = rejeitado/recontagem
    motivo_ajuste               VARCHAR(50),                -- 'inventario', 'avaria', 'quebra', etc.
    movimentacao_id             UUID REFERENCES movimentacoes_estoque(id),
    contado_por                 UUID REFERENCES usuarios(id),
    contado_at                  TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(ordem_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_ordens_inv_armazem ON ordens_inventario (armazem_id);
CREATE INDEX IF NOT EXISTS idx_ordens_inv_status ON ordens_inventario (status);
CREATE INDEX IF NOT EXISTS idx_itens_inv_ordem ON itens_ordem_inventario (ordem_id);
CREATE INDEX IF NOT EXISTS idx_itens_inv_sku ON itens_ordem_inventario (sku_id);
