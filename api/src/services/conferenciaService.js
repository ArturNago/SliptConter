/**
 * Criação e consulta de conferências.
 *
 * Fluxo (doc, seção 5.2):
 *   1. Bipar SKU -> produto já resolvido pelo controller.
 *   2. Captura da foto -> já salva em /dataset/inbound pelo uploadMiddleware.
 *   3. Contagem -> quantidadeContada (unidades diretas).
 *   4. Revisão -> ajusteManual aplicado por cima da quantidade contada.
 *   5. Confirmação -> grava conferência + movimentação no mesmo commit.
 */
const db = require('../config/db');
const Sku = require('../models/Sku');
const Armazem = require('../models/Armazem');
const Conferencia = require('../models/Conferencia');
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const ledgerService = require('./ledgerService');

/**
 * @param {object} params
 * @param {string} params.skuId id do SKU conferido (o que o app chama de "produto")
 * @param {string} params.idOperador
 * @param {string} params.urlImagemLocal caminho relativo dentro de /dataset
 * @param {number} params.quantidadeContada
 * @param {number} [params.quantidadeSugeridaIa] preenchido em V1
 * @param {number} [params.ajusteManual] soma dos +1/-1 na tela de revisão
 * @param {'manual'|'ia'} [params.origem]
 * @param {boolean} [params.criadaOffline] true quando sincronizado depois da fila do celular
 * @param {string} [params.tipoMovimentacao] 'entrada' | 'saida' | 'ajuste' (default 'entrada')
 */
async function registrarConferencia(params) {
  const {
    armazemId,
    idOperador,
    urlImagemLocal,
    quantidadeContada,
    quantidadeSugeridaIa,
    ajusteManual = 0,
    origem = 'manual',
    criadaOffline = false,
    tipoMovimentacao = 'entrada',
  } = params;

  // O controller já resolve skuId (aceitando o legado "produtoId" como alias).
  const skuId = params.skuId;

  const sku = skuId ? await Sku.findById(skuId) : null;
  if (!sku) {
    const err = new Error('Produto não encontrado.');
    err.status = 404;
    err.expose = true;
    throw err;
  }

  if (!armazemId) {
    const err = new Error('Armazém é obrigatório.');
    err.status = 400;
    err.expose = true;
    throw err;
  }
  const armazem = await Armazem.findById(armazemId);
  if (!armazem || !armazem.ativo) {
    const err = new Error('Armazém não encontrado ou inativo.');
    err.status = 404;
    err.expose = true;
    throw err;
  }
  if (!Number.isInteger(quantidadeContada) || quantidadeContada < 0) {
    const err = new Error('Quantidade contada deve ser um inteiro maior ou igual a zero.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  const quantidadeTotal = quantidadeContada + ajusteManual;
  if (quantidadeTotal < 0) {
    const err = new Error('Quantidade total resultante não pode ser negativa.');
    err.status = 400;
    err.expose = true;
    throw err;
  }

  return db.withTransaction(async (client) => {
    const conferencia = await Conferencia.create(
      {
        skuId,
        armazemId,
        idOperador,
        urlImagemLocal,
        quantidadeContada,
        quantidadeSugeridaIa,
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

    // Semântica do tipo de movimentação:
    //   entrada -> soma a quantidade contada
    //   saida   -> subtrai a quantidade contada
    //   ajuste  -> a contagem É o saldo real; o ledger recebe o delta
    //              (contado - saldo atual), que pode ser positivo ou negativo.
    let quantidadeAssinada;
    let observacao = `Conferência ${origem === 'ia' ? 'assistida por IA' : 'manual'}`;
    if (tipoMovimentacao === 'saida') {
      quantidadeAssinada = -quantidadeTotal;
    } else if (tipoMovimentacao === 'ajuste') {
      const saldoAtual = await MovimentacaoEstoque.saldoPorSku(skuId, armazemId, client);
      quantidadeAssinada = quantidadeTotal - saldoAtual;
      observacao = `Ajuste de inventário (contado ${quantidadeTotal}, sistema ${saldoAtual})`;
    } else {
      quantidadeAssinada = quantidadeTotal;
    }

    // O ledger só recebe deltas não-zero (nunca grava movimentação com
    // quantidade 0). Uma contagem que não altera saldo — ex.: conferiu e
    // estava zerado, ou ajuste sem divergência — fica registrada apenas
    // como conferência (evidência da contagem).
    let movimentacao = null;
    if (quantidadeAssinada !== 0) {
      movimentacao = await ledgerService.registrarMovimentacao(
        {
          skuId,
          armazemId,
          tipo: tipoMovimentacao,
          quantidade: quantidadeAssinada,
          idOperador,
          idConferencia: conferencia.id,
          observacao,
        },
        client
      );
    }

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
