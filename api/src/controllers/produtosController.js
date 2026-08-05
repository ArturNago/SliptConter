/**
 * Consulta/cadastro de produtos e suas regras de empilhamento
 * (`volumes_por_camada`), usadas no fluxo de conferência (doc, seção 5.2).
 */
const Produto = require('../models/Produto');
const ledgerService = require('../services/ledgerService');

/**
 * GET /api/produtos
 */
async function listar(req, res, next) {
  try {
    const produtos = await Produto.list({ ativo: true });
    return res.json(produtos);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/sku/:sku
 * Usado imediatamente após bipar o SKU da etiqueta da pilha.
 */
async function buscarPorSku(req, res, next) {
  try {
    const produto = await Produto.findBySku(req.params.sku);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado para este SKU.' });
    }
    return res.json(produto);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/:id/saldo
 */
async function saldo(req, res, next) {
  try {
    const produto = await Produto.findById(req.params.id);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    const saldoAtual = await ledgerService.obterSaldo(produto.id);
    return res.json({ produtoId: produto.id, sku: produto.sku, saldo: saldoAtual });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/produtos/:id/movimentacoes
 */
async function movimentacoes(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const historico = await ledgerService.historico(req.params.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return res.json(historico);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/produtos
 * Cadastro/Master Data inicial (doc, roadmap item 3). Restrito a gestor/admin.
 */
async function criar(req, res, next) {
  try {
    const { sku, descricao, volumesPorCamada, camadasMaximasPalete } = req.body;
    if (!sku || !descricao || !volumesPorCamada) {
      return res.status(400).json({ erro: 'sku, descricao e volumesPorCamada são obrigatórios.' });
    }

    const produto = await Produto.create({
      sku,
      descricao,
      volumesPorCamada: parseInt(volumesPorCamada, 10),
      camadasMaximasPalete: camadasMaximasPalete ? parseInt(camadasMaximasPalete, 10) : null,
    });

    return res.status(201).json(produto);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'SKU já cadastrado.' });
    }
    return next(err);
  }
}

/**
 * PATCH /api/produtos/:id
 */
async function atualizar(req, res, next) {
  try {
    const produto = await Produto.update(req.params.id, req.body);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }
    return res.json(produto);
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, buscarPorSku, saldo, movimentacoes, criar, atualizar };
