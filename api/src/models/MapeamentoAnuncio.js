/**
 * Model: mapeamento_anuncios_sku
 * Conecta título de anúncio (marketplace) + variação ao SKU interno do sistema.
 */
const db = require('../config/db');

/**
 * Busca mapeamento exato por nome do anúncio + variação.
 * Usado durante a importação da planilha.
 */
async function findByAnuncio(nomeAnuncio, variacao = null) {
  const variacaoNorm = variacao?.trim() || null;
  const { rows } = await db.query(
    `SELECT m.*, s.sku, s.descricao AS sku_descricao
     FROM mapeamento_anuncios_sku m
     JOIN skus s ON s.id = m.sku_id
     WHERE m.ativo = TRUE
       AND m.nome_anuncio = $1
       AND COALESCE(m.variacao, '') = COALESCE($2, '')`,
    [nomeAnuncio.trim(), variacaoNorm]
  );
  return rows[0] || null;
}

/**
 * Busca mapeamento por SKU do ERP (Upseller).
 */
async function findBySkuErp(skuErp) {
  const { rows } = await db.query(
    `SELECT m.*, s.sku, s.descricao AS sku_descricao, p.nome AS produto_nome
     FROM mapeamento_anuncios_sku m
     JOIN skus s ON s.id = m.sku_id
     LEFT JOIN produtos p ON p.id = s.produto_id
     WHERE m.ativo = TRUE
       AND m.sku_erp = $1`,
    [skuErp]
  );
  return rows[0] || null;
}

async function list({ busca = null, limit = 100, offset = 0 } = {}) {
  const params = [];
  let filtroBusca = '';
  if (busca) {
    params.push(`%${busca}%`);
    filtroBusca = `AND (m.nome_anuncio ILIKE $${params.length} OR m.variacao ILIKE $${params.length} OR m.sku_erp ILIKE $${params.length} OR s.sku ILIKE $${params.length} OR s.descricao ILIKE $${params.length})`;
  }
  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT m.*, s.sku, s.descricao AS sku_descricao, p.nome AS produto_nome
     FROM mapeamento_anuncios_sku m
     JOIN skus s ON s.id = m.sku_id
     LEFT JOIN produtos p ON p.id = s.produto_id
     WHERE m.ativo = TRUE ${filtroBusca}
     ORDER BY m.nome_anuncio ASC, m.variacao ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function create({ nome_anuncio, variacao = null, sku_id, sku_erp = null }) {
  const { rows } = await db.query(
    `INSERT INTO mapeamento_anuncios_sku (nome_anuncio, variacao, sku_id, sku_erp)
     VALUES ($1, NULLIF(trim($2), ''), $3, NULLIF(trim($4), ''))
     RETURNING *`,
    [nome_anuncio.trim(), variacao || '', sku_id, sku_erp || '']
  );
  return rows[0];
}

async function update(id, { nome_anuncio, variacao, sku_id, sku_erp }) {
  const { rows } = await db.query(
    `UPDATE mapeamento_anuncios_sku
     SET nome_anuncio = COALESCE(NULLIF(trim($2), ''), nome_anuncio),
         variacao     = CASE WHEN $3::text IS NOT DISTINCT FROM NULL THEN variacao ELSE NULLIF(trim($3), '') END,
         sku_id       = COALESCE($4, sku_id),
         sku_erp      = CASE WHEN $5::text IS NOT DISTINCT FROM NULL THEN sku_erp ELSE NULLIF(trim($5), '') END,
         updated_at   = now()
     WHERE id = $1 AND ativo = TRUE
     RETURNING *`,
    [id, nome_anuncio, variacao, sku_id, sku_erp]
  );
  return rows[0] || null;
}

async function remove(id) {
  const { rows } = await db.query(
    `UPDATE mapeamento_anuncios_sku SET ativo = FALSE, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT m.*, s.sku, s.descricao AS sku_descricao
     FROM mapeamento_anuncios_sku m
     JOIN skus s ON s.id = m.sku_id
     WHERE m.id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { findByAnuncio, findBySkuErp, list, create, update, remove, findById };
