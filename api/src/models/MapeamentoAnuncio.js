/**
 * Model: mapeamento_anuncios_sku
 * Conecta título de anúncio (marketplace) + variação / SKU_ERP aos SKUs internos do sistema.
 * Suporta produtos simples e KITS / BOM (múltiplos itens com quantidades multiplicadas).
 */
const db = require('../config/db');

async function getItensMapeamento(mapeamentoId, client = db) {
  try {
    const { rows } = await client.query(
      `SELECT i.id, i.sku_id, i.quantidade, s.sku, s.descricao AS sku_descricao, s.custo_medio
       FROM mapeamento_anuncio_itens i
       JOIN skus s ON s.id = i.sku_id
       WHERE i.mapeamento_id = $1
       ORDER BY i.created_at ASC`,
      [mapeamentoId]
    );
    return rows;
  } catch {
    // Caso a tabela ainda não exista em tempo de boot antes de migrar
    return [];
  }
}

/**
 * Busca mapeamento exato por nome do anúncio + variação.
 */
async function findByAnuncio(nomeAnuncio, variacao = null, client = db) {
  const variacaoNorm = variacao?.trim() || null;
  const { rows } = await client.query(
    `SELECT m.*, s.sku, s.descricao AS sku_descricao
     FROM mapeamento_anuncios_sku m
     LEFT JOIN skus s ON s.id = m.sku_id
     WHERE m.ativo = TRUE
       AND m.nome_anuncio = $1
       AND COALESCE(m.variacao, '') = COALESCE($2, '')`,
    [nomeAnuncio.trim(), variacaoNorm]
  );
  if (!rows[0]) return null;

  const item = rows[0];
  const itens = await getItensMapeamento(item.id, client);
  item.itens = itens.length > 0 ? itens : (item.sku_id ? [{ sku_id: item.sku_id, sku: item.sku, sku_descricao: item.sku_descricao, quantidade: 1 }] : []);
  return item;
}

/**
 * Busca mapeamento por SKU do ERP (Upseller).
 */
async function findBySkuErp(skuErp, client = db) {
  const { rows } = await client.query(
    `SELECT m.*, s.sku, s.descricao AS sku_descricao, p.nome AS produto_nome
     FROM mapeamento_anuncios_sku m
     LEFT JOIN skus s ON s.id = m.sku_id
     LEFT JOIN produtos p ON p.id = s.produto_id
     WHERE m.ativo = TRUE
       AND m.sku_erp = $1`,
    [skuErp]
  );
  if (!rows[0]) return null;

  const item = rows[0];
  const itens = await getItensMapeamento(item.id, client);
  item.itens = itens.length > 0 ? itens : (item.sku_id ? [{ sku_id: item.sku_id, sku: item.sku, sku_descricao: item.sku_descricao, quantidade: 1 }] : []);
  return item;
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
    `SELECT m.*, s.sku, s.descricao AS sku_descricao, p.nome AS produto_nome,
            (SELECT COUNT(*)::int FROM mapeamento_anuncio_itens mi WHERE mi.mapeamento_id = m.id) AS total_componentes
     FROM mapeamento_anuncios_sku m
     LEFT JOIN skus s ON s.id = m.sku_id
     LEFT JOIN produtos p ON p.id = s.produto_id
     WHERE m.ativo = TRUE ${filtroBusca}
     ORDER BY m.nome_anuncio ASC, m.variacao ASC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return rows;
}

async function create({ nome_anuncio, variacao = null, sku_id = null, sku_erp = null, itens = [] }) {
  return db.withTransaction(async (client) => {
    const mainSkuId = sku_id || (itens.length > 0 ? itens[0].sku_id : null);
    const { rows } = await client.query(
      `INSERT INTO mapeamento_anuncios_sku (nome_anuncio, variacao, sku_id, sku_erp)
       VALUES ($1, NULLIF(trim($2), ''), $3, NULLIF(trim($4), ''))
       RETURNING *`,
      [nome_anuncio.trim(), variacao || '', mainSkuId, sku_erp || '']
    );
    const mapeamento = rows[0];

    // Se informou lista de componentes (Kits)
    if (Array.isArray(itens) && itens.length > 0) {
      for (const it of itens) {
        if (it.sku_id && it.quantidade > 0) {
          await client.query(
            `INSERT INTO mapeamento_anuncio_itens (mapeamento_id, sku_id, quantidade)
             VALUES ($1, $2, $3)
             ON CONFLICT (mapeamento_id, sku_id) DO UPDATE SET quantidade = EXCLUDED.quantidade`,
            [mapeamento.id, it.sku_id, parseInt(it.quantidade, 10)]
          );
        }
      }
    } else if (mainSkuId) {
      await client.query(
        `INSERT INTO mapeamento_anuncio_itens (mapeamento_id, sku_id, quantidade)
         VALUES ($1, $2, 1)
         ON CONFLICT (mapeamento_id, sku_id) DO NOTHING`,
        [mapeamento.id, mainSkuId]
      );
    }

    return mapeamento;
  });
}

async function update(id, { nome_anuncio, variacao, sku_id, sku_erp, itens }) {
  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
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

    if (!rows[0]) return null;

    if (Array.isArray(itens)) {
      await client.query('DELETE FROM mapeamento_anuncio_itens WHERE mapeamento_id = $1', [id]);
      for (const it of itens) {
        if (it.sku_id && it.quantidade > 0) {
          await client.query(
            `INSERT INTO mapeamento_anuncio_itens (mapeamento_id, sku_id, quantidade)
             VALUES ($1, $2, $3)
             ON CONFLICT (mapeamento_id, sku_id) DO UPDATE SET quantidade = EXCLUDED.quantidade`,
            [id, it.sku_id, parseInt(it.quantidade, 10)]
          );
        }
      }
    }

    return rows[0];
  });
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
     LEFT JOIN skus s ON s.id = m.sku_id
     WHERE m.id = $1`,
    [id]
  );
  if (!rows[0]) return null;

  const item = rows[0];
  item.itens = await getItensMapeamento(id);
  return item;
}

module.exports = {
  findByAnuncio,
  findBySkuErp,
  list,
  create,
  update,
  remove,
  findById,
  getItensMapeamento,
};
