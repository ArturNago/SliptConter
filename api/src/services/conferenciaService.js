/**
 * Criação e consulta de conferências.
 *
 * Fluxo (doc, seção 5.2):
 *   1. Bipar SKU -> produto já resolvido pelo controller.
 *   2. Captura da foto -> já salva em /dataset/inbound pelo uploadMiddleware.
 *   3. Contagem -> camadasInformadas (manual) e/ou camadasSugeridasIa (V1).
 *   4. Revisão -> ajusteManual (+1/-1) aplicado por cima do total calculado.
 *   5. Confirmação -> grava conferência + movimentação no mesmo commit.
 */
const db = require('../config/db');
const Produto = require('../models/Produto');
const Conferencia = require('../models/Conferencia');
const ledgerService = require('./ledgerService');

/**
 * @param {object} params
 * @param {string} params.produtoId
 * @param {string} params.idOperador
 * @param {string} params.urlImagemLocal caminho relativo dentro de /dataset
 * @param {number} params.camadasInformadas
 * @param {number} [params.camadasSugeridasIa] preenchido em V1
 * @param {number} [params.ajusteManual] soma dos +1/-1 na tela de revisão
 * @param {'manual'|'ia'} [params.origem]
 * @param {boolean} [params.criadaOffline] true quando sincronizado depois da fila do celular
 * @param {string} [params.tipoMovimentacao] 'entrada' | 'saida' | 'ajuste' (default 'entrada')
 */
async function registrarConferencia(params) {
  const {
    produtoId,
    idOperador,
    urlImagemLocal,
    camadasInformadas,
    camadasSugeridasIa,
    ajusteManual = 0,
    origem = 'manual',
    criadaOffline = false,
    tipoMovimentacao = 'entrada',
  } = params;

  const produto = await Produto.findById(produtoId);
  if (!produto) {
    const err = new Error('Produto não encontrado.');
    err.status = 404;
    err.expose = true;
    throw err;
  }

  const quantidadeTotal = camadasInformadas * produto.volumes_por_camada + ajusteManual;
  if (quantidadeTotal < 0) {
    const err = new Error('Quantidade total resultante não pode ser negativa.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  return db.withTransaction(async (client) => {
    const conferencia = await Conferencia.create(
      {
        produtoId,
        idOperador,
        urlImagemLocal,
        camadasInformadas,
        camadasSugeridasIa,
        quantidadeTotal,
        ajusteManual,
        origem,
        // Toda conferência entra como candidata a dataset de treino (V1);
        // o worker de treino promove para "treinado" após o fine-tuning.
        statusDataset: 'pendente_treinamento',
        criadaOffline,
      },
      client
    );

    const quantidadeAssinada = tipoMovimentacao === 'saida' ? -quantidadeTotal : quantidadeTotal;

    const movimentacao = await ledgerService.registrarMovimentacao(
      {
        produtoId,
        tipo: tipoMovimentacao,
        quantidade: quantidadeAssinada,
        idOperador,
        idConferencia: conferencia.id,
        observacao: `Conferência ${origem === 'ia' ? 'assistida por IA' : 'manual'}`,
      },
      client
    );

    return { conferencia, movimentacao };
  });
}

async function buscarPorId(id) {
  return Conferencia.findById(id);
}

async function listar(filtros) {
  return Conferencia.list(filtros);
}

module.exports = { registrarConferencia, buscarPorId, listar };
