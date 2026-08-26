/**
 * Model: pedidos_vendas_importados
 * Registro atômico de cada linha de pedido importada com prevenção rígida de duplicidades.
 */
const db = require('../config/db');

async function create(data, client = db) {
  const {
    lote_id,
    numero_pedido,
    plataforma,
    data_pedido,
    sku_erp,
    nome_anuncio,
    variacao,
    quantidade,
    armazem_id,
    sku_id = null,
    movimentacao_id = null,
    status = 'processado',
    motivo_erro = null,
  } = data;

  const { rows } = await client.query(
    `INSERT INTO pedidos_vendas_importados
       (lote_id, numero_pedido, plataforma, data_pedido, sku_erp, nome_anuncio,
        variacao, quantidade, armazem_id, sku_id, movimentacao_id, status, motivo_erro)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      lote_id,
      numero_pedido,
      plataforma,
      data_pedido || null,
      sku_erp,
      nome_anuncio,
      variacao,
      quantidade,
      armazem_id,
      sku_id,
      movimentacao_id,
      status,
      motivo_erro,
    ]
  );
  return rows[0];
}

async function findByPedido(numero_pedido, sku_erp, armazem_id, client = db) {
  const { rows } = await client.query(
    `SELECT * FROM pedidos_vendas_importados
     WHERE numero_pedido = $1 AND sku_erp = $2 AND armazem_id = $3 AND status = 'processado'
     LIMIT 1`,
    [numero_pedido, sku_erp, armazem_id]
  );
  return rows[0] || null;
}

async function listByLote(lote_id, { limit = 100, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT p.*, s.sku, s.descricao AS sku_descricao
     FROM pedidos_vendas_importados p
     LEFT JOIN skus s ON s.id = p.sku_id
     WHERE p.lote_id = $1
     ORDER BY p.created_at ASC
     LIMIT $2 OFFSET $3`,
    [lote_id, limit, offset]
  );
  return rows;
}

module.exports = {
  create,
  findByPedido,
  listByLote,
};
