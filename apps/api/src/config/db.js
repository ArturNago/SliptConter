/**
 * Conexão com o PostgreSQL — fonte única da verdade do sistema.
 * Usa um pool de conexões `pg` simples (sem ORM), conforme definido
 * na documentação de arquitetura (query builder leve).
 */
const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  host: env.db.host,
  port: env.db.port,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] Erro inesperado no pool do PostgreSQL:', err);
});

/**
 * Executa uma query simples.
 * @param {string} text
 * @param {Array} params
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Executa um bloco de operações dentro de uma transação.
 * @param {(client: import('pg').PoolClient) => Promise<any>} callback
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
