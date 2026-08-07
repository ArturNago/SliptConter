const db = require('../config/db');

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM armazens WHERE id = $1', [id]);
  return rows[0] || null;
}

async function list({ ativo } = {}) {
  const params = [];
  const filters = [];

  if (ativo !== undefined) {
    params.push(ativo);
    filters.push(`ativo = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM armazens ${where} ORDER BY ativo DESC, nome ASC`,
    params
  );
  return rows;
}

async function create({ nome, codigo = null }) {
  const { rows } = await db.query(
    `INSERT INTO armazens (nome, codigo)
     VALUES ($1, NULLIF($2, ''))
     RETURNING *`,
    [nome, codigo]
  );
  return rows[0];
}

async function update(id, { nome, codigo, ativo }) {
  const { rows } = await db.query(
    `UPDATE armazens
     SET nome = COALESCE(NULLIF($2, ''), nome),
         codigo = CASE WHEN $3::text IS NULL THEN codigo ELSE NULLIF($3, '') END,
         ativo = COALESCE($4, ativo),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, nome, codigo, ativo]
  );
  return rows[0] || null;
}

/**
 * Estoque do armazém: uma linha por SKU ativo, com o saldo calculado
 * a partir do ledger (movimentacoes_estoque.sku_id).
 * O app consome: id, sku, descricao, categoria, saldo (+ dados do Pai).
 */
async function estoque(id) {
  const { rows } = await db.query(
    `SELECT s.*,
            p.nome AS produto_nome,
            p.marca AS produto_marca,
            COALESCE(p.categoria, s.categoria) AS categoria,
            COALESCE(SUM(m.quantidade), 0)::int AS saldo
     FROM skus s
     LEFT JOIN produtos p ON p.id = s.produto_id
     LEFT JOIN movimentacoes_estoque m
       ON m.sku_id = s.id AND m.armazem_id = $1
     WHERE s.ativo = TRUE
     GROUP BY s.id, p.id
     ORDER BY s.descricao ASC`,
    [id]
  );
  return rows;
}

module.exports = { findById, list, create, update, estoque };
