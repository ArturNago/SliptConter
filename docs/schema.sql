-- ============================================================
-- Tebarrot - Conferência de Estoque
-- DDL completo do banco de dados PostgreSQL
--
-- Princípios:
--   - O saldo de um produto NUNCA é um campo sobrescrito: é sempre
--     SUM(quantidade) da tabela movimentacoes_estoque.
--   - Toda movimentação é imutável (ledger, apenas INSERT).
--   - A imagem em si nunca é armazenada no banco, apenas o caminho
--     do arquivo no volume local (url_imagem_local).
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome                VARCHAR(120) NOT NULL,
    username            VARCHAR(60) UNIQUE,          -- login tradicional
    senha               VARCHAR(255),                -- texto plano (ambiente interno)
    papel               VARCHAR(20) NOT NULL DEFAULT 'operador'
                            CHECK (papel IN ('operador', 'gestor', 'admin')),
    ativo               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios (username);

-- ------------------------------------------------------------
-- produtos
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- conferencias
-- Cada contagem realizada (1 foto = 1 pilha/palete)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conferencias (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id              UUID NOT NULL REFERENCES produtos (id),
    id_operador             UUID NOT NULL REFERENCES usuarios (id),
    url_imagem_local        VARCHAR(500) NOT NULL,   -- caminho relativo dentro de /dataset
    camadas_informadas      INTEGER NOT NULL CHECK (camadas_informadas >= 0),
    camadas_sugeridas_ia    INTEGER,                 -- preenchido em V1 quando o YOLOv8 sugerir
    quantidade_total        INTEGER NOT NULL CHECK (quantidade_total >= 0),
    ajuste_manual           INTEGER NOT NULL DEFAULT 0, -- soma dos +1/-1 aplicados na revisão
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

-- ------------------------------------------------------------
-- movimentacoes_estoque
-- Ledger imutável. O saldo é SEMPRE SUM(quantidade) por produto.
-- quantidade é assinada: positiva (entrada) ou negativa (saída/ajuste negativo).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id          UUID NOT NULL REFERENCES produtos (id),
    tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste')),
    quantidade          INTEGER NOT NULL, -- assinada; nunca sobrescrita, apenas INSERT
    id_operador         UUID NOT NULL REFERENCES usuarios (id),
    id_conferencia      UUID REFERENCES conferencias (id),
    observacao          VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes_estoque (produto_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_conferencia ON movimentacoes_estoque (id_conferencia);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_created_at ON movimentacoes_estoque (created_at);

-- ------------------------------------------------------------
-- sheets_sync_queue
-- Fila durável para a sincronização assíncrona com o Google Sheets.
-- Nunca bloqueia a resposta da API ao app; falhas são reenfileiradas.
-- ------------------------------------------------------------
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

COMMIT;
