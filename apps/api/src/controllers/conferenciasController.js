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
 *   imagem            (arquivo, opcional)
 *   skuId             (string, obrigatório — aceita o legado "produtoId" como alias)
 *   armazemId         (string, obrigatório)
 *   quantidadeContada (int, obrigatório)
 *   quantidadeSugeridaIa (int, opcional — preenchido em V1)
 *   ajusteManual       (int, opcional, default 0)
 *   origem             ('manual' | 'ia', opcional, default 'manual')
 *   criadaOffline      (boolean, opcional — item veio da fila do celular)
 *   tipoMovimentacao   ('entrada' | 'saida' | 'ajuste', opcional, default 'entrada')
 *   caixasPorCamada    (int, opcional — caixas detectadas na camada frontal, V1)
 *   camadasConfirmadas (int, opcional — camadas confirmadas pelo operador, V1)
 *   caixasSugeridasIa  (int, opcional — caixas sugeridas pela IA, V1)
 *   deteccoesIa        (JSON string, opcional — bounding boxes normalizadas, V1)
 */
async function criar(req, res, next) {
  try {
    const {
      skuId: skuIdBody,
      produtoId,
      armazemId,
      quantidadeContada,
      quantidadeSugeridaIa,
      ajusteManual,
      origem,
      criadaOffline,
      tipoMovimentacao,
      caixasPorCamada,
      camadasConfirmadas,
      caixasSugeridasIa,
      deteccoesIa,
    } = req.body;

    const skuId = skuIdBody || produtoId;
    if (produtoId && !skuIdBody) {
      // eslint-disable-next-line no-console
      console.warn('[conferenciasController] campo "produtoId" está deprecado; o app deve enviar "skuId".');
    }

    if (!skuId || !armazemId || quantidadeContada === undefined) {
      return res.status(400).json({ erro: 'skuId, armazemId e quantidadeContada são obrigatórios.' });
    }

    const urlImagemLocal = req.file ? caminhoRelativo(req.file.path) : null;

    let deteccoesIaParsed = null;
    if (deteccoesIa) {
      try {
        deteccoesIaParsed = typeof deteccoesIa === 'string' ? JSON.parse(deteccoesIa) : deteccoesIa;
      } catch {
        console.warn('[conferenciasController] deteccoesIa inválido, ignorando.');
      }
    }

    const { conferencia, movimentacao } = await conferenciaService.registrarConferencia({
      skuId,
      armazemId,
      idOperador: req.usuario.id,
      urlImagemLocal,
      quantidadeContada: parseInt(quantidadeContada, 10),
      quantidadeSugeridaIa: quantidadeSugeridaIa ? parseInt(quantidadeSugeridaIa, 10) : null,
      ajusteManual: ajusteManual ? parseInt(ajusteManual, 10) : 0,
      origem: origem === 'ia' ? 'ia' : 'manual',
      criadaOffline: criadaOffline === 'true' || criadaOffline === true,
      tipoMovimentacao: tipoMovimentacao || 'entrada',
      caixasPorCamada: caixasPorCamada ? parseInt(caixasPorCamada, 10) : null,
      camadasConfirmadas: camadasConfirmadas ? parseInt(camadasConfirmadas, 10) : null,
      caixasSugeridasIa: caixasSugeridasIa ? parseInt(caixasSugeridasIa, 10) : null,
      deteccoesIa: deteccoesIaParsed,
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
 * Filtro opcional: ?skuId=<uuid> (aceita o legado ?produtoId= como alias).
 */
async function listar(req, res, next) {
  try {
    const { skuId: skuIdQuery, produtoId, limit, offset } = req.query;
    const conferencias = await conferenciaService.listar({
      skuId: skuIdQuery || produtoId,
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
