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
    const { nome_anuncio, variacao, sku_id } = req.body;
    if (!nome_anuncio || !sku_id) {
      return res.status(400).json({ erro: 'nome_anuncio e sku_id são obrigatórios.' });
    }
    const novo = await MapeamentoAnuncio.create({ nome_anuncio, variacao, sku_id });
    return res.status(201).json(novo);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um mapeamento para este anúncio + variação.' });
    }
    return next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const { nome_anuncio, variacao, sku_id } = req.body;
    const atualizado = await MapeamentoAnuncio.update(req.params.id, { nome_anuncio, variacao, sku_id });
    if (!atualizado) return res.status(404).json({ erro: 'Mapeamento não encontrado.' });
    return res.json(atualizado);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe um mapeamento para este anúncio + variação.' });
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
