/**
 * Model: skus
 * Cadastro de variações de produtos (Produto Pai -> SKUs).
 *
 * No app móvel, "produto" = SKU bipado. As consultas enriquecidas
 * (join com produtos) expõem também os dados do Pai.
 */
const db = require('../config/db');

const CAMPOS_ENRIQUECIDOS = `
  s.*,
  p.nome AS produto_nome,
  p.marca AS produto_marca,
  COALESCE(p.categoria, s.categoria) AS categoria,
  p.categoria AS produto_categoria
`;

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM skus WHERE id = $1', [id]);
  return rows[0] || null;
}

/**
 * Lista todos os SKUs ativos (ou filtrados), enriquecidos com o Produto Pai.
 */
async function findBySkuEnriched(sku) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS_ENRIQUECIDOS}
     FROM skus s
     LEFT JOIN produtos p ON p.id = s.produto_id
     WHERE s.sku = $1 AND s.ativo = TRUE`,
    [sku]
  );
  return rows[0] || null;
}

async function list({ ativo = true, busca = null, limit = null } = {}) {
  const params = [ativo];
  let filtroBusca = '';
  if (busca) {
    params.push(`%${busca}%`);
    filtroBusca = `AND (s.descricao ILIKE $${params.length} OR s.sku ILIKE $${params.length} OR p.nome ILIKE $${params.length})`;
  }
  let clausulaLimit = '';
  if (limit) {
    params.push(limit);
    clausulaLimit = `LIMIT $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT ${CAMPOS_ENRIQUECIDOS}
     FROM skus s
     LEFT JOIN produtos p ON p.id = s.produto_id
     WHERE s.ativo = $1 ${filtroBusca}
     ORDER BY s.descricao ASC
     ${clausulaLimit}`,
    params
  );
  return rows;
}

async function create({
  produto_id,
  sku,
  descricao,
  volumesPorCamada = null,
  camadasMaximasPalete = null,
  quantidadeVolumes = null,
  fotoUrl = null,
  cor = null,
  material = null,
  codigoBarrasEan = null,
  custoMedio = null,
  precoVenda = null
}, client = db) {
  const { rows } = await client.query(
    `INSERT INTO skus
       (produto_id, sku, descricao, volumes_por_camada, camadas_maximas_palete,
        quantidade_volumes, foto_url, cor, material, codigo_barras_ean, custo_medio, preco_venda)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [produto_id, sku, descricao, volumesPorCamada, camadasMaximasPalete, quantidadeVolumes, fotoUrl, cor, material, codigoBarrasEan, custoMedio, precoVenda]
  );
  return rows[0];
}

async function update(id, {
  sku,
  descricao,
  volumesPorCamada,
  camadasMaximasPalete,
  quantidadeVolumes,
  fotoUrl,
  ativo,
  cor,
  material,
  codigoBarrasEan,
  custoMedio,
  precoVenda,
  categoria,
}) {
  const { rows } = await db.query(
    `UPDATE skus
     SET sku = COALESCE(NULLIF($2, ''), sku),
         descricao = COALESCE(NULLIF($3, ''), descricao),
         volumes_por_camada = COALESCE($4, volumes_por_camada),
         camadas_maximas_palete = COALESCE($5, camadas_maximas_palete),
         quantidade_volumes = COALESCE($6, quantidade_volumes),
         foto_url = COALESCE(NULLIF($7, ''), foto_url),
         ativo = COALESCE($8, ativo),
         cor = COALESCE(NULLIF($9, ''), cor),
         material = COALESCE(NULLIF($10, ''), material),
         codigo_barras_ean = COALESCE(NULLIF($11, ''), codigo_barras_ean),
         custo_medio = COALESCE($12, custo_medio),
         preco_venda = COALESCE($13, preco_venda),
         categoria = COALESCE(NULLIF($14, ''), categoria),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, sku, descricao, volumesPorCamada, camadasMaximasPalete, quantidadeVolumes, fotoUrl, ativo, cor, material, codigoBarrasEan, custoMedio, precoVenda, categoria]
  );
  return rows[0] || null;
}

module.exports = {
  findById,
  findBySkuEnriched,
  list,
  create,
  update,
};
