/**
 * Controller: importacaoVendasController
 * Importação de saídas de estoque a partir de planilhas de vendas com idempotência,
 * gestão de lotes e suporte a kits (BOM).
 */
const vendasImportService = require('../services/vendasImportService');
const LoteImportacaoVendas = require('../models/LoteImportacaoVendas');
const PedidoVendaImportado = require('../models/PedidoVendaImportado');

async function importar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Arquivo de vendas (.xlsx ou .csv) é obrigatório.' });
    }

    // Trata armazemId (pode vir como string única ou como array legado de 1 elemento)
    let armazemId = req.body.armazemId;
    if (!armazemId && req.body.armazemIds) {
      try {
        const parsed = typeof req.body.armazemIds === 'string'
          ? JSON.parse(req.body.armazemIds)
          : req.body.armazemIds;
        armazemId = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch {
        armazemId = req.body.armazemIds;
      }
    }

    if (!armazemId) {
      return res.status(400).json({ erro: 'Selecione o armazém de saída.' });
    }

    const resultado = await vendasImportService.processarArquivoVendas({
      fileBuffer: req.file.buffer,
      nomeArquivo: req.file.originalname,
      armazemId,
      usuarioId: req.usuario.id,
    });

    return res.json(resultado);
  } catch (err) {
    return next(err);
  }
}

async function listarLotes(req, res, next) {
  try {
    const { limit, offset } = req.query;
    const lotes = await LoteImportacaoVendas.list({
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
    return res.json(lotes);
  } catch (err) {
    return next(err);
  }
}

async function buscarLote(req, res, next) {
  try {
    const { id } = req.params;
    const lote = await LoteImportacaoVendas.findById(id);
    if (!lote) {
      return res.status(404).json({ erro: 'Lote não encontrado.' });
    }
    const pedidos = await PedidoVendaImportado.listByLote(id, { limit: 500 });
    return res.json({ lote, pedidos });
  } catch (err) {
    return next(err);
  }
}

async function estornarLote(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await LoteImportacaoVendas.estornar(id, req.usuario.id);
    return res.json({
      mensagem: 'Lote de vendas estornado com sucesso no estoque.',
      ...resultado,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  importar,
  listarLotes,
  buscarLote,
  estornarLote,
};
