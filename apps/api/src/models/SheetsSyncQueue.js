/**
 * Model: sheets_sync_queue
 * Fila durável de sincronização assíncrona com o Google Sheets.
 */
const db = require('../config/db');

async function enqueue(idMovimentacao, client = db) {
  const { rows } = await client.query(
    `INSERT INTO sheets_sync_queue (id_movimentacao, status)
     VALUES ($1, 'pendente')
     RETURNING *`,
    [idMovimentacao]
  );
  return rows[0];
}

async function listPendentes(limite = 50) {
  const { rows } = await db.query(
    `SELECT * FROM sheets_sync_queue
     WHERE status IN ('pendente', 'erro')
     ORDER BY created_at ASC
     LIMIT $1`,
    [limite]
  );
  return rows;
}

async function marcarProcessando(id) {
  await db.query(
    `UPDATE sheets_sync_queue SET status = 'processando', updated_at = now() WHERE id = $1`,
    [id]
  );
}

async function marcarSincronizado(id) {
  await db.query(
    `UPDATE sheets_sync_queue SET status = 'sincronizado', updated_at = now() WHERE id = $1`,
    [id]
  );
}

async function marcarErro(id, mensagemErro) {
  await db.query(
    `UPDATE sheets_sync_queue
     SET status = 'erro', tentativas = tentativas + 1, ultimo_erro = $2, updated_at = now()
     WHERE id = $1`,
    [id, mensagemErro]
  );
}

module.exports = {
  enqueue,
  listPendentes,
  marcarProcessando,
  marcarSincronizado,
  marcarErro,
};
