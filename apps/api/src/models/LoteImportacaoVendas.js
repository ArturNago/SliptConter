/**
 * Model: lotes_importacao_vendas
 * Controle e rastreabilidade de lotes de importação de vendas (planilhas).
 */
const db = require('../config/db');

async function create({ nome_arquivo, total_linhas, processados, nao_mapeados, erros, armazem_id, usuario_id }, client = db) {
  const { rows } = await client.query(
    `INSERT INTO lotes_importacao_vendas
       (nome_arquivo, total_linhas, processados, nao_mapeados, erros, armazem_id, usuario_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'concluido')
     RETURNING *`,
    [nome_arquivo, total_linhas, processados, nao_mapeados, erros, armazem_id, usuario_id]
  );
  return rows[0];
}

async function list({ limit = 50, offset = 0 } = {}) {
  const { rows } = await db.query(
    `SELECT l.*, a.nome AS armazem_nome, u.nome AS usuario_nome
     FROM lotes_importacao_vendas l
     JOIN armazens a ON a.id = l.armazem_id
     LEFT JOIN usuarios u ON u.id = l.usuario_id
     ORDER BY l.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function findById(id) {
  const { rows } = await db.query(
    `SELECT l.*, a.nome AS armazem_nome, u.nome AS usuario_nome
     FROM lotes_importacao_vendas l
     JOIN armazens a ON a.id = l.armazem_id
     LEFT JOIN usuarios u ON u.id = l.usuario_id
     WHERE l.id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Estorna um lote de importação de vendas:
 * Cria movimentações de estorno (+quantidade) no ledger para cada item processado
 * e marca os registros do lote como 'estornado'.
 */
async function estornar(loteId, usuarioId) {
  const ledgerService = require('../services/ledgerService');

  return db.withTransaction(async (client) => {
    const lote = await findById(loteId);
    if (!lote) {
      const err = new Error('Lote não encontrado.');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    if (lote.status === 'estornado') {
      const err = new Error('Este lote já foi estornado anteriormente.');
      err.status = 400;
      err.expose = true;
      throw err;
    }

    // Busca todos os pedidos do lote que geraram movimentação
    const { rows: pedidos } = await client.query(
      `SELECT p.*, m.quantidade AS qtd_original
       FROM pedidos_vendas_importados p
       JOIN movimentacoes_estoque m ON m.id = p.movimentacao_id
       WHERE p.lote_id = $1 AND p.status = 'processado'`,
      [loteId]
    );

    let estornadosCount = 0;
    for (const ped of pedidos) {
      if (ped.sku_id && ped.qtd_original) {
        // qtd_original é negativa (saída). O estorno deve ser positivo (reverte a saída).
        const qtdEstorno = Math.abs(ped.qtd_original);
        await ledgerService.registrarMovimentacao(
          {
            skuId: ped.sku_id,
            armazemId: ped.armazem_id,
            tipo: 'entrada',
            quantidade: qtdEstorno,
            idOperador: usuarioId,
            observacao: `Estorno de Venda ${ped.numero_pedido} (Lote ${lote.nome_arquivo})`.slice(0, 255),
          },
          client
        );
        estornadosCount++;
      }
    }

    // Atualiza status dos pedidos
    await client.query(
      `UPDATE pedidos_vendas_importados
       SET status = 'estornado'
       WHERE lote_id = $1 AND status = 'processado'`,
      [loteId]
    );

    // Atualiza status do lote
    const { rows: loteAtualizado } = await client.query(
      `UPDATE lotes_importacao_vendas
       SET status = 'estornado', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [loteId]
    );

    return {
      lote: loteAtualizado[0],
      pedidosEstornados: estornadosCount,
    };
  });
}

module.exports = {
  create,
  list,
  findById,
  estornar,
};
