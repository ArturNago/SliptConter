/**
 * Model: conferencias
 * Cada contagem realizada: imagem, camadas informadas, origem (manual/IA),
 * status do dataset (usado pelo worker de treino em V1).
 */
const db = require('../config/db');

/**
 * @param {object} data
 * @param {import('pg').PoolClient} [client] cliente de transação opcional
 */
async function create(data, client = db) {
  const {
    produtoId,
    idOperador,
    urlImagemLocal,
    camadasInformadas,
    camadasSugeridasIa = null,
    quantidadeTotal,
    ajusteManual = 0,
    origem = 'manual',
    statusDataset = 'na',
    criadaOffline = false,
  } = data;

  const { rows } = await client.query(
    `INSERT INTO conferencias
       (produto_id, id_operador, url_imagem_local, camadas_informadas,
        camadas_sugeridas_ia, quantidade_total, ajuste_manual, origem,
        status_dataset, criada_offline)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      produtoId,
      idOperador,
      urlImagemLocal,
      camadasInformadas,
      camadasSugeridasIa,
      quantidadeTotal,
      ajusteManual,
      origem,
      statusDataset,
      criadaOffline,
    ]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await db.query('SELECT * FROM conferencias WHERE id = $1', [id]);
  return rows[0] || null;
}

async function list({ produtoId, limit = 50, offset = 0 } = {}) {
  if (produtoId) {
    const { rows } = await db.query(
      `SELECT * FROM conferencias WHERE produto_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [produtoId, limit, offset]
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
