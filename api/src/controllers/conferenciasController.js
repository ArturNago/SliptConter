/**
 * Endpoint principal do fluxo de conferência (doc, seção 5.2 e 5.3).
 * Recebe a foto (1 foto = 1 pilha) + contagem e grava conferência +
 * movimentação no ledger, atomicamente.
 *
 * Também aceita itens que vieram da fila offline do celular
 * (`criadaOffline: true`), sincronizados quando o app recupera acesso à API.
 */
const path = require('path');
const conferenciaService = require('../services/conferenciaService');
const iaClient = require('../services/iaClient');
const env = require('../config/env');
const { caminhoRelativo } = require('../middlewares/uploadMiddleware');

/**
 * POST /api/conferencias
 * multipart/form-data:
 *   imagem            (arquivo, obrigatório)
 *   produtoId          (string, obrigatório)
 *   camadasInformadas  (int, obrigatório)
 *   camadasSugeridasIa (int, opcional — preenchido em V1)
 *   ajusteManual       (int, opcional, default 0)
 *   origem             ('manual' | 'ia', opcional, default 'manual')
 *   criadaOffline      (boolean, opcional — item veio da fila do SQLite local)
 *   tipoMovimentacao   ('entrada' | 'saida' | 'ajuste', opcional, default 'entrada')
 */
async function criar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Imagem da pilha é obrigatória.' });
    }

    const {
      produtoId,
      camadasInformadas,
      camadasSugeridasIa,
      ajusteManual,
      origem,
      criadaOffline,
      tipoMovimentacao,
    } = req.body;

    if (!produtoId || camadasInformadas === undefined) {
      return res.status(400).json({ erro: 'produtoId e camadasInformadas são obrigatórios.' });
    }

    const urlImagemLocal = caminhoRelativo(req.file.path);

    const { conferencia, movimentacao } = await conferenciaService.registrarConferencia({
      produtoId,
      idOperador: req.usuario.id,
      urlImagemLocal,
      camadasInformadas: parseInt(camadasInformadas, 10),
      camadasSugeridasIa: camadasSugeridasIa ? parseInt(camadasSugeridasIa, 10) : null,
      ajusteManual: ajusteManual ? parseInt(ajusteManual, 10) : 0,
      origem: origem === 'ia' ? 'ia' : 'manual',
      criadaOffline: criadaOffline === 'true' || criadaOffline === true,
      tipoMovimentacao: tipoMovimentacao || 'entrada',
    });

    return res.status(201).json({ conferencia, movimentacao });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/conferencias/sugestao-ia
 * multipart/form-data: imagem (arquivo)
 *
 * Usado somente em V1: envia a foto ao worker de IA e retorna o número de
 * camadas sugerido, para o operador confirmar/ajustar na tela de revisão.
 * Se a IA estiver desabilitada/indisponível, retorna disponivel=false e o
 * app segue no fluxo manual normalmente.
 */
async function sugestaoIA(req, res, next) {
  try {
    if (!env.iaWorker.enabled) {
      return res.json({ disponivel: false });
    }
    if (!req.file) {
      return res.status(400).json({ erro: 'Imagem é obrigatória.' });
    }

    const sugestao = await iaClient.sugerirContagem(path.resolve(req.file.path));
    if (!sugestao) {
      return res.json({ disponivel: false });
    }

    return res.json({ disponivel: true, ...sugestao });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/conferencias
 */
async function listar(req, res, next) {
  try {
    const { produtoId, limit, offset } = req.query;
    const conferencias = await conferenciaService.listar({
      produtoId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return res.json(conferencias);
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/conferencias/:id
 */
async function buscarPorId(req, res, next) {
  try {
    const conferencia = await conferenciaService.buscarPorId(req.params.id);
    if (!conferencia) {
      return res.status(404).json({ erro: 'Conferência não encontrada.' });
    }
    return res.json(conferencia);
  } catch (err) {
    return next(err);
  }
}

module.exports = { criar, sugestaoIA, listar, buscarPorId };
