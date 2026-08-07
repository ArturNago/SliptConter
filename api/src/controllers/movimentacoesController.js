/**
 * Consulta de movimentações do ledger — usado para auditoria (quem, quando,
 * a partir de qual conferência/foto). Nunca permite alterar/apagar um
 * registro: o ledger é somente-leitura a partir daqui.
 */
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const ledgerService = require('../services/ledgerService');

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

module.exports = { listar, buscarPorId };
