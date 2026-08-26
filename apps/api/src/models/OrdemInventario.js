/**
 * Model: ordens_inventario & itens_ordem_inventario
 * Rotinas de Inventário Cíclico e Contagem Cega para auditoria PCP.
 */
const db = require('../config/db');

async function create({ codigo, descricao, armazem_id, tipo = 'ciclico', criado_por, sku_ids = [] }, client = db) {
  // 1. Cria a Ordem de Inventário
  const { rows } = await client.query(
    `INSERT INTO ordens_inventario
       (codigo, descricao, armazem_id, tipo, criado_por, status, total_itens)
     VALUES ($1, $2, $3, $4, $5, 'aberto', $6)
     RETURNING *`,
    [codigo, descricao, armazem_id, tipo, criado_por, sku_ids.length]
  );
  const ordem = rows[0];

  // 2. Congela o saldo atual de cada SKU no armazém
  for (const skuId of sku_ids) {
    const saldoRes = await client.query(
      `SELECT COALESCE(SUM(quantidade), 0)::int AS saldo
       FROM movimentacoes_estoque
       WHERE sku_id = $1 AND armazem_id = $2`,
      [skuId, armazem_id]
    );
    const saldoCongelado = saldoRes.rows[0].saldo;

    await client.query(
      `INSERT INTO itens_ordem_inventario
         (ordem_id, sku_id, saldo_sistema_congelado)
       VALUES ($1, $2, $3)`,
      [ordem.id, skuId, saldoCongelado]
    );
  }

  return ordem;
}

async function list({ armazem_id, status, limit = 50, offset = 0 } = {}) {
  const params = [];
  const filters = [];
  if (armazem_id) filters.push(`o.armazem_id = $${params.push(armazem_id)}`);
  if (status) filters.push(`o.status = $${params.push(status)}`);
  params.push(limit, offset);

  const { rows } = await db.query(
    `SELECT o.*, a.nome AS armazem_nome, u.nome AS criado_por_nome, f.nome AS finalizado_por_nome
     FROM ordens_inventario o
     JOIN armazens a ON a.id = o.armazem_id
     LEFT JOIN usuarios u ON u.id = o.criado_por
     LEFT JOIN usuarios f ON f.id = o.finalizado_por
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY o.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function findById(id, { incluirSaldo = true } = {}) {
  const { rows: ordens } = await db.query(
    `SELECT o.*, a.nome AS armazem_nome, u.nome AS criado_por_nome, f.nome AS finalizado_por_nome
     FROM ordens_inventario o
     JOIN armazens a ON a.id = o.armazem_id
     LEFT JOIN usuarios u ON u.id = o.criado_por
     LEFT JOIN usuarios f ON f.id = o.finalizado_por
     WHERE o.id = $1`,
    [id]
  );
  if (!ordens[0]) return null;

  const ordem = ordens[0];

  // Se incluirSaldo for false (app do operador em contagem cega), oculta saldo_sistema_congelado e divergencia
  const selectSaldo = incluirSaldo
    ? 'i.saldo_sistema_congelado, i.divergencia, i.aprovado, i.motivo_ajuste, i.movimentacao_id,'
    : '';

  const { rows: itens } = await db.query(
    `SELECT i.id, i.ordem_id, i.sku_id, i.quantidade_contada, i.contado_at,
            ${selectSaldo}
            s.sku, s.descricao AS sku_descricao, s.codigo_barras_ean,
            p.nome AS produto_nome,
            u.nome AS contado_por_nome
     FROM itens_ordem_inventario i
     JOIN skus s ON s.id = i.sku_id
     LEFT JOIN produtos p ON p.id = s.produto_id
     LEFT JOIN usuarios u ON u.id = i.contado_por
     WHERE i.ordem_id = $1
     ORDER BY s.sku ASC`,
    [id]
  );

  ordem.itens = itens;
  return ordem;
}

async function registrarContagem({ ordem_id, sku_id, quantidade_contada, usuario_id }) {
  return db.withTransaction(async (client) => {
    // 1. Busca o item para calcular a divergência
    const { rows: itens } = await client.query(
      `SELECT * FROM itens_ordem_inventario
       WHERE ordem_id = $1 AND sku_id = $2`,
      [ordem_id, sku_id]
    );

    if (!itens[0]) {
      const err = new Error('Item não pertence a esta ordem de inventário.');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    const item = itens[0];
    const qtdContada = parseInt(quantidade_contada, 10);
    const divergencia = qtdContada - item.saldo_sistema_congelado;

    const { rows: updated } = await client.query(
      `UPDATE itens_ordem_inventario
       SET quantidade_contada = $1,
           divergencia = $2,
           contado_por = $3,
           contado_at = now()
       WHERE id = $4
       RETURNING *`,
      [qtdContada, divergencia, usuario_id, item.id]
    );

    // Atualiza contadores na ordem
    await client.query(
      `UPDATE ordens_inventario
       SET status = 'em_contagem',
           itens_contados = (SELECT COUNT(*)::int FROM itens_ordem_inventario WHERE ordem_id = $1 AND quantidade_contada IS NOT NULL),
           updated_at = now()
       WHERE id = $1`,
      [ordem_id]
    );

    return updated[0];
  });
}

module.exports = {
  create,
  list,
  findById,
  registrarContagem,
};
