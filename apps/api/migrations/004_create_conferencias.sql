CREATE TABLE IF NOT EXISTS conferencias (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id              UUID NOT NULL REFERENCES produtos (id),
    id_operador             UUID NOT NULL REFERENCES usuarios (id),
    url_imagem_local        VARCHAR(500) NOT NULL,
    camadas_informadas      INTEGER NOT NULL CHECK (camadas_informadas >= 0),
    camadas_sugeridas_ia    INTEGER,
    quantidade_total        INTEGER NOT NULL CHECK (quantidade_total >= 0),
    ajuste_manual           INTEGER NOT NULL DEFAULT 0,
    origem                  VARCHAR(20) NOT NULL DEFAULT 'manual'
                                CHECK (origem IN ('manual', 'ia')),
    status_dataset          VARCHAR(30) NOT NULL DEFAULT 'na'
                                CHECK (status_dataset IN ('na', 'pendente_treinamento', 'treinado')),
    criada_offline          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conferencias_produto ON conferencias (produto_id);
CREATE INDEX IF NOT EXISTS idx_conferencias_operador ON conferencias (id_operador);
CREATE INDEX IF NOT EXISTS idx_conferencias_status_dataset ON conferencias (status_dataset);
