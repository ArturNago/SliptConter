/**
 * Consulta de movimentações do ledger — usado para auditoria (quem, quando,
 * a partir de qual conferência/foto). Nunca permite alterar/apagar um
 * registro: o ledger é somente-leitura a partir daqui.
 */
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');

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

module.exports = { buscarPorId };
