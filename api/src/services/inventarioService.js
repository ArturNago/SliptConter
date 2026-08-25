/**
 * Service: inventarioService
 * Regras de negócio de Inventário Cíclico, Contagem Cega, Auditoria e Acuracidade (IRA %).
 */
const db = require('../config/db');
const OrdemInventario = require('../models/OrdemInventario');
const ledgerService = require('./ledgerService');

async function criarOrdem({ armazemId, tipo = 'ciclico', descricao, skuIds = [], categoria = null, usuarioId }) {
  if (!armazemId) {
    const err = new Error('Armazém é obrigatório para abrir um inventário.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  let finalSkuIds = [...skuIds];

  // Se não passou lista de SKUs, busca por categoria ou todos os SKUs ativos
  if (finalSkuIds.length === 0) {
    let sql = 'SELECT s.id FROM skus s LEFT JOIN produtos p ON p.id = s.produto_id WHERE s.ativo = TRUE';
    const params = [];
    if (categoria) {
      params.push(categoria);
      sql += ' AND (s.categoria = $1 OR p.categoria = $1)';
    }
    const res = await db.query(sql, params);
    finalSkuIds = res.rows.map((r) => r.id);
  }

  if (finalSkuIds.length === 0) {
    const err = new Error('Nenhum SKU encontrado para inventariar.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  // Gera código único ex: INV-20260824-001
  const hojeStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const countRes = await db.query(
    `SELECT COUNT(*)::int AS count FROM ordens_inventario WHERE codigo LIKE $1`,
    [`INV-${hojeStr}-%`]
  );
  const seq = String(countRes.rows[0].count + 1).padStart(3, '0');
  const codigo = `INV-${hojeStr}-${seq}`;

  return OrdemInventario.create({
    codigo,
    descricao: descricao || `Inventário ${tipo.toUpperCase()} - ${new Date().toLocaleDateString('pt-BR')}`,
    armazem_id: armazemId,
    tipo,
    criado_por: usuarioId,
    sku_ids: finalSkuIds,
  });
}

async function listarOrdens(filtros) {
  return OrdemInventario.list(filtros);
}

async function buscarOrdem(id, { incluirSaldo = true } = {}) {
  return OrdemInventario.findById(id, { incluirSaldo });
}

async function registrarContagem({ ordemId, skuId, quantidadeContada, usuarioId }) {
  const ordem = await OrdemInventario.findById(ordemId);
  if (!ordem) {
    const err = new Error('Ordem de inventário não encontrada.');
    err.status = 404;
    err.expose = true;
    throw err;
  }

  if (ordem.status === 'concluido' || ordem.status === 'cancelado') {
    const err = new Error(`Não é possível lançar contagem em uma ordem ${ordem.status}.`);
    err.status = 400;
    err.expose = true;
    throw err;
  }

  return OrdemInventario.registrarContagem({
    ordem_id: ordemId,
    sku_id: skuId,
    quantidade_contada: quantidadeContada,
    usuario_id: usuarioId,
  });
}

/**
 * Finaliza a ordem de inventário:
 *  - Valida se todos os itens foram contados
 *  - Calcula o IRA (Índice de Acuracidade de Inventário): % de itens sem divergência (divergencia == 0)
 *  - Registra movimentações de ajuste no ledger para cada item divergente
 *  - Marca a ordem como 'concluido'
 */
async function finalizarOrdem({ ordemId, usuarioId, itensAprovados = [] }) {
  return db.withTransaction(async (client) => {
    const ordem = await OrdemInventario.findById(ordemId, { incluirSaldo: true });
    if (!ordem) {
      const err = new Error('Ordem de inventário não encontrada.');
      err.status = 404;
      err.expose = true;
      throw err;
    }

    if (ordem.status === 'concluido' || ordem.status === 'cancelado') {
      const err = new Error(`Esta ordem já está ${ordem.status}.`);
      err.status = 400;
      err.expose = true;
      throw err;
    }

    let itensAcurados = 0;
    let ajustesRealizados = 0;

    for (const item of ordem.itens) {
      // Se não foi contado, considera não acurado
      if (item.quantidade_contada === null || item.quantidade_contada === undefined) {
        continue;
      }

      const divergencia = item.quantidade_contada - item.saldo_sistema_congelado;

      if (divergencia === 0) {
        itensAcurados++;
        await client.query(
          `UPDATE itens_ordem_inventario SET aprovado = TRUE WHERE id = $1`,
          [item.id]
        );
      } else {
        // Divergência identificada: gera movimentação de ajuste no ledger se aprovada
        const aprovadoConfig = itensAprovados.find((a) => a.itemId === item.id);
        const aprovarAjuste = aprovadoConfig ? aprovadoConfig.aprovado : true;
        const motivoAjuste = aprovadoConfig?.motivo || 'inventario_ciclico';

        if (aprovarAjuste) {
          const mov = await ledgerService.registrarMovimentacao(
            {
              skuId: item.sku_id,
              armazemId: ordem.armazem_id,
              tipo: 'ajuste',
              quantidade: divergencia, // delta (contado - saldo)
              idOperador: usuarioId,
              observacao: `Ajuste Inventário ${ordem.codigo} (contado: ${item.quantidade_contada}, anterior: ${item.saldo_sistema_congelado})`,
            },
            client
          );

          await client.query(
            `UPDATE movimentacoes_estoque
             SET motivo_ajuste = $1
             WHERE id = $2`,
            [motivoAjuste, mov.id]
          );

          await client.query(
            `UPDATE itens_ordem_inventario
             SET aprovado = TRUE,
                 motivo_ajuste = $1,
                 movimentacao_id = $2
             WHERE id = $3`,
            [motivoAjuste, mov.id, item.id]
          );

          ajustesRealizados++;
        } else {
          await client.query(
            `UPDATE itens_ordem_inventario SET aprovado = FALSE WHERE id = $1`,
            [item.id]
          );
        }
      }
    }

    const totalItens = ordem.itens.length;
    const acuracidadePct = totalItens > 0 ? ((itensAcurados / totalItens) * 100).toFixed(2) : 0;

    const { rows: ordemConcluida } = await client.query(
      `UPDATE ordens_inventario
       SET status = 'concluido',
           itens_acurados = $1,
           acuracidade_pct = $2,
           finalizado_por = $3,
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [itensAcurados, acuracidadePct, usuarioId, ordemId]
    );

    return {
      ordem: ordemConcluida[0],
      totalItens,
      itensAcurados,
      acuracidadePct: parseFloat(acuracidadePct),
      ajustesRealizados,
    };
  });
}

async function cancelarOrdem(ordemId) {
  const { rows } = await db.query(
    `UPDATE ordens_inventario SET status = 'cancelado', updated_at = now()
     WHERE id = $1 AND status != 'concluido'
     RETURNING *`,
    [ordemId]
  );
  if (!rows[0]) {
    const err = new Error('Ordem não encontrada ou já concluída.');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  return rows[0];
}

module.exports = {
  criarOrdem,
  listarOrdens,
  buscarOrdem,
  registrarContagem,
  finalizarOrdem,
  cancelarOrdem,
};
