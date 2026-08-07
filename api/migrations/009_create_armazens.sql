-- Sem BEGIN/COMMIT: o runner (migrations/run.js) envolve cada arquivo em
-- uma única transação. BEGIN/COMMIT aninhado comita prematuramente e
-- deixa o registro de schema_migrations fora de sincronia.
CREATE TABLE IF NOT EXISTS armazens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome        VARCHAR(120) NOT NULL,
    codigo      VARCHAR(30) UNIQUE,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_armazens_ativo ON armazens (ativo);

INSERT INTO armazens (nome, codigo)
VALUES ('Galpão Principal', 'PRINCIPAL')
ON CONFLICT (codigo) DO NOTHING;
