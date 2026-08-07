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
 * @param {string} params.skuId id do SKU (variação) movimentado
 * @param {string} params.armazemId
 * @param {'entrada'|'saida'|'ajuste'} params.tipo
 * @param {number} params.quantidade quantidade assinada (positiva ou negativa)
 * @param {string} params.idOperador
 * @param {string} [params.idConferencia]
 * @param {string} [params.observacao]
 * @param {import('pg').PoolClient} [client] cliente de transação
 */
/**
 * Registra uma movimentação e enfileira a sincronização assíncrona com o
 * Google Sheets. Deve ser chamado dentro da mesma transação da conferência
 * que a originou, quando houver.
 *
 * @param {object} params
 * @param {string} params.skuId id do SKU (variação) movimentado
 * @param {string} params.armazemId
 * @param {'entrada'|'saida'|'ajuste'} params.tipo
 * @param {number} params.quantidade quantidade assinada (positiva ou negativa)
 * @param {string} params.idOperador
 * @param {string} [params.idConferencia]
 * @param {string} [params.observacao]
 * @param {import('pg').PoolClient} [client] cliente de transação
 */
async function registrarMovimentacao(params, client) {
  const { tipo, quantidade, armazemId, skuId } = params;

  if (!skuId) {
    const err = new Error('SKU é obrigatório para registrar a movimentação.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

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
  if (!armazemId) {
    const err = new Error('Armazém é obrigatório para registrar a movimentação.');
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
 * Retorna o saldo atual de um SKU (SUM de todas as movimentações).
 */
async function obterSaldo(skuId, armazemId) {
  return MovimentacaoEstoque.saldoPorSku(skuId, armazemId);
}

async function obterSaldoPorArmazem(skuId) {
  return MovimentacaoEstoque.saldoAgrupadoPorArmazem(skuId);
}

/**
 * Saldo total de todos os SKUs ativos em uma única query (anti-N+1).
 */
async function obterSaldosTotais() {
  return MovimentacaoEstoque.saldosTotaisPorSku();
}

/**
 * Histórico de movimentações de um SKU (para auditoria).
 */
async function historico(skuId, paginacao) {
  return MovimentacaoEstoque.listBySku(skuId, paginacao);
}

async function listar(filtros) {
  return MovimentacaoEstoque.list(filtros);
}

module.exports = { registrarMovimentacao, obterSaldo, obterSaldoPorArmazem, obterSaldosTotais, historico, listar };
