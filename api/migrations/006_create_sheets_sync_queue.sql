CREATE TABLE IF NOT EXISTS sheets_sync_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_movimentacao     UUID NOT NULL REFERENCES movimentacoes_estoque (id),
    status              VARCHAR(20) NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'processando', 'sincronizado', 'erro')),
    tentativas          INTEGER NOT NULL DEFAULT 0,
    ultimo_erro         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sheets_sync_status ON sheets_sync_queue (status);
