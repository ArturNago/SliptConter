/**
 * Consulta de movimentações do ledger — usado para auditoria (quem, quando,
 * a partir de qual conferência/foto). Nunca permite alterar/apagar um
 * registro: o ledger é somente-leitura a partir daqui.
 */
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const MapeamentoAnuncio = require('../models/MapeamentoAnuncio');
const ledgerService = require('../services/ledgerService');
const db = require('../config/db');

/**
 * GET /api/movimentacoes
 * Filtros opcionais: ?skuId=, ?produtoId= (Pai), ?armazemId=, ?limit=, ?offset=
 */
async function listar(req, res, next) {
  try {
    const { skuId, produtoId, armazemId, limit, offset } = req.query;
    const movimentacoes = await ledgerService.listar({
      skuId,
      produtoId,
      armazemId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return res.json(movimentacoes);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/movimentacoes/:id
 */
async function buscarPorId(req, res, next) {
  try {
    const movimentacao = await MovimentacaoEstoque.findById(req.params.id);
    if (!movimentacao) {
      return res.status(404).json({ erro: 'Movimentação não encontrada.' });
    }
    return res.json(movimentacao);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/movimentacoes/reprocessar-nao-mapeados
 * Recebe a lista de itens não mapeados e tenta processá-los novamente
 * usando os mapeamentos já cadastrados (idempotente).
 */
async function reprocessarNaoMapeados(req, res, next) {
  try {
    const { armazemIds, naoMapeados } = req.body;

    if (!Array.isArray(armazemIds) || armazemIds.length === 0) {
      return res.status(400).json({ erro: 'armazemIds deve ser um array de UUIDs.' });
    }
    if (!Array.isArray(naoMapeados) || naoMapeados.length === 0) {
      return res.status(400).json({ erro: 'naoMapeados deve ser um array não vazio.' });
    }

    const processados = [];
    const naoMapeadosRestantes = [];
    const erros = [];

    for (const item of naoMapeados) {
      const numeroPedido = String(item.numeroPedido || '').trim();
      const nomeAnuncio = String(item.nomeAnuncio || '').trim();
      const skuErp = String(item.skuErp || '').trim();
      const qtdVendida = parseInt(item.qtdVendida, 10);
      const variacao = item.variacao ? String(item.variacao).trim() : null;

      if (!skuErp || isNaN(qtdVendida) || qtdVendida <= 0) {
        erros.push({ ...item, motivo: 'Dados inválidos (SKU vazio ou quantidade inválida).' });
        continue;
      }

      let mapeamento = await MapeamentoAnuncio.findBySkuErp(skuErp);

      if (!mapeamento && nomeAnuncio) {
        mapeamento = await MapeamentoAnuncio.findByAnuncio(nomeAnuncio, variacao);
      }

      if (!mapeamento) {
        naoMapeadosRestantes.push(item);
        continue;
      }

      for (const armazemId of armazemIds) {
        try {
          const dupCheck = await db.query(
            `SELECT 1 FROM movimentacoes_estoque
             WHERE sku_id = $1 AND armazem_id = $2 AND tipo = 'saida' AND quantidade = $3
               AND observacao LIKE $4
             LIMIT 1`,
            [mapeamento.sku_id, armazemId, -(qtdVendida), `Venda ${numeroPedido} -%`]
          );

          if (dupCheck.rows.length > 0) {
            continue;
          }

          const movimentacao = await ledgerService.registrarMovimentacao({
            skuId: mapeamento.sku_id,
            armazemId,
            tipo: 'saida',
            quantidade: -(qtdVendida),
            idOperador: req.usuario?.id || null,
            observacao: `Venda ${numeroPedido} - Upseller`.slice(0, 255),
          });

          processados.push({
            numeroPedido,
            nomeAnuncio,
            variacao,
            sku: mapeamento.sku,
            skuDescricao: mapeamento.sku_descricao,
            qtdVendida,
            armazemId,
            movimentacaoId: movimentacao.id,
          });
        } catch (errMov) {
          erros.push({
            numeroPedido,
            nomeAnuncio,
            skuErp,
            armazemId,
            motivo: errMov.message,
          });
        }
      }
    }

    return res.json({
      processados,
      naoMapeados: naoMapeadosRestantes,
      erros,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, buscarPorId, reprocessarNaoMapeados };
