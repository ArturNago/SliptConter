CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id          UUID NOT NULL REFERENCES produtos (id),
    tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
    quantidade          INTEGER NOT NULL,
    id_operador         UUID NOT NULL REFERENCES usuarios (id),
    id_conferencia      UUID REFERENCES conferencias (id),
    observacao          VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes_estoque (produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_conferencia ON movimentacoes_estoque (id_conferencia);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_created_at ON movimentacoes_estoque (created_at);
