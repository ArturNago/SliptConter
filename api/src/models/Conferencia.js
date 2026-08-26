/**
 * Model: conferencias
 * Cada contagem realizada: imagem opcional, quantidade direta, origem (manual/IA),
 * status do dataset (usado pelo worker de treino em V1).
 */
const db = require('../config/db');

/**
 * @param {object} data
 * @param {import('pg').PoolClient} [client] cliente de transação opcional
 */
async function create(data, client = db) {
  const {
    skuId,
    armazemId,
    idOperador,
    urlImagemLocal,
    quantidadeContada,
    quantidadeSugeridaIa = null,
    quantidadeTotal,
    ajusteManual = 0,
    origem = 'manual',
    statusDataset = 'na',
    criadaOffline = false,
    caixasPorCamada = null,
    camadasConfirmadas = null,
    caixasSugeridasIa = null,
    deteccoesIa = null,
  } = data;

  const { rows } = await client.query(
    `INSERT INTO conferencias
        (sku_id, armazem_id, id_operador, url_imagem_local, quantidade_contada,
          quantidade_sugerida_ia, quantidade_total, ajuste_manual, origem,
          status_dataset, criada_offline, caixas_por_camada, camadas_confirmadas,
          caixas_sugeridas_ia, deteccoes_ia)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
    [
      skuId,
      armazemId,
      idOperador,
      urlImagemLocal,
      quantidadeContada,
      quantidadeSugeridaIa,
      quantidadeTotal,
      ajusteManual,
      origem,
      statusDataset,
      criadaOffline,
      caixasPorCamada,
      camadasConfirmadas,
      caixasSugeridasIa,
      deteccoesIa ? JSON.stringify(deteccoesIa) : null,
    ]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM conferencias WHERE id = $1', [id]);
  return rows[0] || null;
}

async function list({ skuId, limit = 50, offset = 0 } = {}) {
  if (skuId) {
    const { rows } = await db.query(
      `SELECT * FROM conferencias WHERE sku_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [skuId, limit, offset]
    );
    return rows;
  }
  const { rows } = await db.query(
    `SELECT * FROM conferencias ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

/**
 * Conferências ainda não utilizadas em um ciclo de treino (V1).
 */
async function listPendentesDeTreinamento(limite = 200) {
  const { rows } = await db.query(
    `SELECT * FROM conferencias WHERE status_dataset = 'pendente_treinamento'
     ORDER BY created_at ASC LIMIT $1`,
    [limite]
  );
  return rows;
}

async function marcarComoTreinado(ids) {
  if (!ids || ids.length === 0) return;
  await db.query(
    `UPDATE conferencias SET status_dataset = 'treinado' WHERE id = ANY($1::uuid[])`,
    [ids]
  );
}

module.exports = {
  create,
  findById,
  list,
  listPendentesDeTreinamento,
  marcarComoTreinado,
};
