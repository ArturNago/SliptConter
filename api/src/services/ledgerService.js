/**
 * Regras do ledger de movimentações de estoque.
 *
 * Princípio central da arquitetura: o saldo NUNCA é um campo sobrescrito.
 * Toda alteração de saldo é um novo registro imutável em
 * movimentacoes_estoque, e o saldo é sempre recalculado via SUM(quantidade).
 */
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const SheetsSyncQueue = require('../models/SheetsSyncQueue');

const TIPOS_VALIDOS = ['entrada', 'saida', 'ajuste'];

/**
 * Registra uma movimentação e enfileira a sincronização assíncrona com o
 * Google Sheets. Deve ser chamado dentro da mesma transação da conferência
 * que a originou, quando houver uma.
 *
 * @param {object} params
 * @param {string} params.produtoId
 * @param {'entrada'|'saida'|'ajuste'} params.tipo
 * @param {number} params.quantidade quantidade assinada (positiva ou negativa)
 * @param {string} params.idOperador
 * @param {string} [params.idConferencia]
 * @param {string} [params.observacao]
 * @param {import('pg').PoolClient} [client] cliente de transação
 */
async function registrarMovimentacao(params, client) {
  const { tipo, quantidade } = params;

  if (!TIPOS_VALIDOS.includes(tipo)) {
    const err = new Error(`Tipo de movimentação inválido: ${tipo}`);
    err.status = 400;
    err.expose = true;
    throw err;
  }
  if (!Number.isInteger(quantidade) || quantidade === 0) {
    const err = new Error('Quantidade da movimentação deve ser um inteiro diferente de zero.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const movimentacao = await MovimentacaoEstoque.create(params, client);

  // Enfileira sync com Sheets — nunca bloqueia a resposta ao app.
  await SheetsSyncQueue.enqueue(movimentacao.id, client);

  return movimentacao;
}

/**
 * Retorna o saldo atual de um produto (SUM de todas as movimentações).
 */
async function obterSaldo(produtoId) {
  return MovimentacaoEstoque.saldoPorProduto(produtoId);
}

/**
 * Histórico de movimentações de um produto (para auditoria).
 */
async function historico(produtoId, paginacao) {
  return MovimentacaoEstoque.listByProduto(produtoId, paginacao);
}

module.exports = { registrarMovimentacao, obterSaldo, historico };
