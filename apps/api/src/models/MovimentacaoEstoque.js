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
  const {
    skuId,
    armazemId,
    tipo,
    quantidade,
    idOperador,
    idConferencia = null,
    observacao = null,
  } = data;

  const { rows } = await client.query(
    `INSERT INTO movimentacoes_estoque
       (sku_id, armazem_id, tipo, quantidade, id_operador, id_conferencia, observacao)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [skuId, armazemId, tipo, quantidade, idOperador, idConferencia, observacao]
  );
  return rows[0];
}

/**
 * Saldo atual do SKU = SUM(quantidade) de todas as movimentações.
 * Aceita um client de transação opcional (usado no cálculo do delta de ajuste
 * dentro da mesma transação da conferência).
 */
async function saldoPorSku(skuId, armazemId, client = db) {
  const params = [skuId];
  const filtroArmazem = armazemId ? `AND armazem_id = $${params.push(armazemId)}` : '';
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(quantidade), 0)::int AS saldo
     FROM movimentacoes_estoque
     WHERE sku_id = $1 ${filtroArmazem}`,
    params
  );
  return rows[0].saldo;
}

async function saldoAgrupadoPorArmazem(skuId) {
  const { rows } = await db.query(
    `SELECT a.id AS "armazemId", a.nome,
            COALESCE(SUM(m.quantidade), 0)::int AS saldo
     FROM armazens a
     LEFT JOIN movimentacoes_estoque m
       ON m.armazem_id = a.id AND m.sku_id = $1
     WHERE a.ativo = TRUE
     GROUP BY a.id
     ORDER BY a.nome ASC`,
    [skuId]
  );
  return rows;
}

/**
 * Saldo total de todos os SKUs ativos em uma única query agregada
 * (evita o N+1 de uma consulta de saldo por SKU no app).
 */
async function saldosTotaisPorSku() {
  const { rows } = await db.query(
    `SELECT s.id AS "skuId",
            COALESCE(SUM(m.quantidade), 0)::int AS "saldoTotal"
     FROM skus s
     LEFT JOIN movimentacoes_estoque m ON m.sku_id = s.id
     WHERE s.ativo = TRUE
     GROUP BY s.id`
  );
  return rows;
}

async function listBySku(skuId, { limit = 100, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT m.*,
            m.created_at AS "criadoEm",
            json_build_object('id', a.id, 'nome', a.nome) AS armazem
     FROM movimentacoes_estoque m
     LEFT JOIN armazens a ON a.id = m.armazem_id
     WHERE m.sku_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2 OFFSET $3`,
    [skuId, limit, offset]
  );
  return rows;
}

async function list({ skuId, produtoId, armazemId, limit = 100, offset = 0 } = {}) {
  const params = [];
  const filters = [];
  if (skuId) filters.push(`m.sku_id = $${params.push(skuId)}`);
  if (produtoId) filters.push(`s.produto_id = $${params.push(produtoId)}`);
  if (armazemId) filters.push(`m.armazem_id = $${params.push(armazemId)}`);
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT m.*, s.sku, s.descricao AS produto_descricao, p.nome AS produto_nome, a.nome AS armazem_nome
     FROM movimentacoes_estoque m
     JOIN skus s ON s.id = m.sku_id
     LEFT JOIN produtos p ON p.id = s.produto_id
     JOIN armazens a ON a.id = m.armazem_id
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY m.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM movimentacoes_estoque WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = {
  create,
  saldoPorSku,
  saldoAgrupadoPorArmazem,
  saldosTotaisPorSku,
  listBySku,
  list,
  findById,
};
