/**
 * CRUD de mapeamentos anúncio → SKU.
 * Permite ao operador/gestor conectar títulos de anúncios do marketplace
 * aos SKUs internos do sistema para viabilizar a importação automática de saídas.
 */
const MapeamentoAnuncio = require('../models/MapeamentoAnuncio');

async function listar(req, res, next) {
  try {
    const { busca, limit, offset } = req.query;
    const lista = await MapeamentoAnuncio.list({
      busca,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return res.json(lista);
  } catch (err) {
    return next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const item = await MapeamentoAnuncio.findById(req.params.id);
    if (!item) return res.status(404).json({ erro: 'Mapeamento não encontrado.' });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
}

async function criar(req, res, next) {
  try {
    const { nome_anuncio, variacao, sku_id, sku_erp, itens } = req.body;
    if (!nome_anuncio && !sku_erp) {
      return res.status(400).json({ erro: 'nome_anuncio ou sku_erp é obrigatório.' });
    }
    if (!sku_id && (!Array.isArray(itens) || itens.length === 0)) {
      return res.status(400).json({ erro: 'Informe o SKU principal ou a lista de componentes.' });
    }
    const novo = await MapeamentoAnuncio.create({ nome_anuncio, variacao, sku_id, sku_erp, itens });
    return res.status(201).json(novo);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um mapeamento para este anúncio / SKU ERP.' });
    }
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const { nome_anuncio, variacao, sku_id, sku_erp, itens } = req.body;
    const atualizado = await MapeamentoAnuncio.update(req.params.id, { nome_anuncio, variacao, sku_id, sku_erp, itens });
    if (!atualizado) return res.status(404).json({ erro: 'Mapeamento não encontrado.' });
    return res.json(atualizado);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um mapeamento para este anúncio / SKU ERP.' });
    }
    return next(err);
  }
}

async function remover(req, res, next) {
  try {
    const removido = await MapeamentoAnuncio.remove(req.params.id);
    if (!removido) return res.status(404).json({ erro: 'Mapeamento não encontrado.' });
    return res.json({ mensagem: 'Mapeamento removido com sucesso.' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
