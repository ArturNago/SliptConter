CREATE TABLE IF NOT EXISTS usuarios (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                VARCHAR(120) NOT NULL,
    codigo_crachao      VARCHAR(120) UNIQUE,
    pin_hash            VARCHAR(255) NOT NULL,
    papel               VARCHAR(20) NOT NULL DEFAULT 'operador'
                            CHECK (papel IN ('operador', 'gestor', 'admin')),
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_codigo_crachao ON usuarios (codigo_crachao);
