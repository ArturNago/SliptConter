/**
 * Bootstrap do primeiro usuário admin (V0).
 *
 * NOTA: desde a migration 008, a própria migration já semeia o usuário
 * admin/123 automaticamente. Este script fica como alternativa manual
 * (ex.: recriar o admin em outro ambiente sem rodar as migrations).
 *
 * Uso (de dentro do container api, com a rede Docker ativa):
 *   docker compose exec api node scripts/bootstrap_admin.js
 *
 * Ou do host, com as variáveis POSTGRES_* apontando para localhost:5433:
 *   node scripts/bootstrap_admin.js
 *
 * O script é idempotente: se o usuário já existir, não duplica.
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || 'tebarrot',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
});

// Valores padrão para o primeiro admin (troque a senha após o primeiro login).
const ADMIN = {
  nome: 'Artur',
  username: 'Artur',
  senha: '9241',
  papel: 'admin',
};

async function main() {
  const { rows } = await pool.query(
    'SELECT id FROM usuarios WHERE username = $1',
    [ADMIN.username]
  );

  if (rows.length > 0) {
    console.log('[bootstrap] usuário admin já existe, nada a fazer.');
    await pool.end();
    return;
  }

  await pool.query(
    `INSERT INTO usuarios (nome, username, senha, papel)
     VALUES ($1, $2, $3, $4)`,
    [ADMIN.nome, ADMIN.username, ADMIN.senha, ADMIN.papel]
  );

  console.log('[bootstrap] usuário admin criado.');
  console.log(`[bootstrap] username: ${ADMIN.username} | senha inicial: ${ADMIN.senha}`);
  await pool.end();
}

main().catch((err) => {
  console.error('[bootstrap] erro:', err.message);
  process.exit(1);
});
