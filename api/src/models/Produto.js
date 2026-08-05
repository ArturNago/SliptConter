/**
 * Model: produtos
 * SKU, descrição e regras de empilhamento usadas na conferência.
 */
const db = require('../config/db');

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM produtos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findBySku(sku) {
  const { rows } = await db.query(
    'SELECT * FROM produtos WHERE sku = $1 AND ativo = TRUE',
    [sku]
  );
  return rows[0] || null;
}

async function list({ ativo = true } = {}) {
  const { rows } = await db.query(
    'SELECT * FROM produtos WHERE ativo = $1 ORDER BY descricao ASC',
    [ativo]
  );
  return rows;
}

async function create({ sku, descricao, volumesPorCamada, camadasMaximasPalete = null }) {
  const { rows } = await db.query(
    `INSERT INTO produtos (sku, descricao, volumes_por_camada, camadas_maximas_palete)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sku, descricao, volumesPorCamada, camadasMaximasPalete]
  );
  return rows[0];
}

async function update(id, { descricao, volumesPorCamada, camadasMaximasPalete, ativo }) {
  const { rows } = await db.query(
    `UPDATE produtos
     SET descricao = COALESCE($2, descricao),
         volumes_por_camada = COALESCE($3, volumes_por_camada),
         camadas_maximas_palete = COALESCE($4, camadas_maximas_palete),
         ativo = COALESCE($5, ativo),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, descricao, volumesPorCamada, camadasMaximasPalete, ativo]
  );
  return rows[0] || null;
}

module.exports = { findById, findBySku, list, create, update };
