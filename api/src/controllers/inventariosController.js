/**
 * Controller: inventariosController
 * Endpoints REST para criação, consulta, contagem cega e fechamento de inventários.
 */
const inventarioService = require('../services/inventarioService');

async function criar(req, res, next) {
  try {
    const { armazemId, tipo, descricao, skuIds, categoria } = req.body;
    const ordem = await inventarioService.criarOrdem({
      armazemId,
      tipo,
      descricao,
      skuIds,
      categoria,
      usuarioId: req.usuario.id,
    });
    return res.status(201).json(ordem);
  } catch (err) {
    return next(err);
  }
}

async function listar(req, res, next) {
  try {
    const { armazemId, status, limit, offset } = req.query;
    const ordens = await inventarioService.listarOrdens({
      armazem_id: armazemId,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return res.json(ordens);
  } catch (err) {
    return next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const { id } = req.params;
    // Se a query param contagemCega for true (ex: app mobile de contagem), oculta o saldo do sistema
    const contagemCega = req.query.contagemCega === 'true';
    const ordem = await inventarioService.buscarOrdem(id, { incluirSaldo: !contagemCega });
    if (!ordem) {
      return res.status(404).json({ erro: 'Ordem de inventário não encontrada.' });
    }
    return res.json(ordem);
  } catch (err) {
    return next(err);
  }
}

async function registrarContagem(req, res, next) {
  try {
    const { id } = req.params;
    const { skuId, quantidadeContada } = req.body;
    if (!skuId || quantidadeContada === undefined) {
      return res.status(400).json({ erro: 'skuId e quantidadeContada são obrigatórios.' });
    }
    const item = await inventarioService.registrarContagem({
      ordemId: id,
      skuId,
      quantidadeContada: parseInt(quantidadeContada, 10),
      usuarioId: req.usuario.id,
    });
    return res.json(item);
  } catch (err) {
    return next(err);
  }
}

async function finalizar(req, res, next) {
  try {
    const { id } = req.params;
    const { itensAprovados } = req.body;
    const resultado = await inventarioService.finalizarOrdem({
      ordemId: id,
      usuarioId: req.usuario.id,
      itensAprovados,
    });
    return res.json(resultado);
  } catch (err) {
    return next(err);
  }
}

async function cancelar(req, res, next) {
  try {
    const { id } = req.params;
    const ordem = await inventarioService.cancelarOrdem(id);
    return res.json(ordem);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  criar,
  listar,
  buscarPorId,
  registrarContagem,
  finalizar,
  cancelar,
};
