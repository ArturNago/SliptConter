/**
 * Runner simples de migrations.
 * Executa em ordem alfabética todos os arquivos .sql desta pasta que ainda
 * não estejam registrados na tabela de controle `schema_migrations`.
 *
 * Uso: `npm run migrate` (dentro do container `api` ou localmente com
 * as variáveis de ambiente do Postgres configuradas).
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'tebarrot',
  password: process.env.POSTGRES_PASSWORD || 'tebarrot',
  database: process.env.POSTGRES_DB || 'tebarrot_estoque',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
});

async function ensureControlTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations() {
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(rows.map((r) => r.filename));
}

async function run() {
  await ensureControlTable();
  const applied = await getAppliedMigrations();

  const files = fs
    .readdirSync(__dirname)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] já aplicado: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`[migrate] aplicando: ${file}`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[migrate] falhou em ${file}:`, err.message);
      process.exitCode = 1;
      break;
    } finally {
      client.release();
    }
  }

  await pool.end();
}

run();
