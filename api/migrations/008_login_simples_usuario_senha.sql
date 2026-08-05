-- ============================================================
-- Simplifica a autenticação: remove crachá (QR) e PIN, substitui
-- por login tradicional de username + senha.
--
-- ATENÇÃO: `senha` fica em texto plano (decisão explícita para
-- acelerar o ambiente interno). Se este sistema um dia for exposto
-- fora da rede/túnel controlado, trocar para bcrypt/argon2 antes.
-- ============================================================

ALTER TABLE usuarios
  DROP COLUMN IF EXISTS codigo_crachao,
  DROP COLUMN IF EXISTS pin_hash;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS username VARCHAR(60) UNIQUE,
  ADD COLUMN IF NOT EXISTS senha    VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios (username);

-- Usuário administrador padrão para testar imediatamente.
-- Login: Artur / Senha: 9241
INSERT INTO usuarios (nome, username, senha, papel, ativo)
VALUES ('Artur', 'Artur', '9241', 'admin', TRUE)
ON CONFLICT (username) DO UPDATE
  SET senha = EXCLUDED.senha,
      papel = EXCLUDED.papel,
      ativo = TRUE;
