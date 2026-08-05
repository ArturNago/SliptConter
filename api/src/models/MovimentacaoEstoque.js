/**
 * Model: movimentacoes_estoque
 * Ledger imutável. Apenas INSERT — nunca UPDATE de quantidade.
 * O saldo de um produto é sempre SUM(quantidade).
 */
const db = require('../config/db');

/**
 * @param {object} data
 * @param {import('pg').PoolClient} [client] cliente de transação opcional
 */
async function create(data, client = db) {
  const { produtoId, tipo, quantidade, idOperador, idConferencia = null, observacao = null } = data;

  const { rows } = await client.query(
    `INSERT INTO movimentacoes_estoque
       (produto_id, tipo, quantidade, id_operador, id_conferencia, observacao)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [produtoId, tipo, quantidade, idOperador, idConferencia, observacao]
  );
  return rows[0];
}

/**
 * Saldo atual do produto = SUM(quantidade) de todas as movimentações.
 */
async function saldoPorProduto(produtoId) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(quantidade), 0)::int AS saldo
     FROM movimentacoes_estoque
     WHERE produto_id = $1`,
    [produtoId]
  );
  return rows[0].saldo;
}

async function listByProduto(produtoId, { limit = 100, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM movimentacoes_estoque
     WHERE produto_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [produtoId, limit, offset]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM movimentacoes_estoque WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { create, saldoPorProduto, listByProduto, findById };
