/**
 * Fila offline de fotos/contagens (doc, seção 5.2 e 5.3).
 *
 * Quando o operador confirma uma contagem sem acesso à API, o registro
 * (incluindo o caminho local da foto) é gravado aqui, marcado como
 * "pendente de sincronização". O syncQueue.js esvazia essa fila quando a
 * API volta a responder.
 */
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'tebarrot.db';
let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

async function initDb() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS fila_conferencias (
      id TEXT PRIMARY KEY,
      produto_id TEXT NOT NULL,
      produto_sku TEXT,
      imagem_uri TEXT NOT NULL,
      camadas_informadas INTEGER NOT NULL,
      camadas_sugeridas_ia INTEGER,
      ajuste_manual INTEGER NOT NULL DEFAULT 0,
      origem TEXT NOT NULL DEFAULT 'manual',
      tipo_movimentacao TEXT NOT NULL DEFAULT 'entrada',
      status_envio TEXT NOT NULL DEFAULT 'pendente',
      tentativas INTEGER NOT NULL DEFAULT 0,
      ultimo_erro TEXT,
      criado_em TEXT NOT NULL
    );
  `);
  return db;
}

/**
 * @param {object} item ver services/api.js#criarConferencia para os campos
 */
async function inserirPendente(item) {
  const db = await getDb();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  await db.runAsync(
    `INSERT INTO fila_conferencias
      (id, produto_id, produto_sku, imagem_uri, camadas_informadas,
       camadas_sugeridas_ia, ajuste_manual, origem, tipo_movimentacao,
       status_envio, tentativas, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', 0, ?)`,
    [
      id,
      item.produtoId,
      item.produtoSku || null,
      item.imagemUri,
      item.camadasInformadas,
      item.camadasSugeridasIa ?? null,
      item.ajusteManual || 0,
      item.origem || 'manual',
      item.tipoMovimentacao || 'entrada',
      new Date().toISOString(),
    ]
  );

  return id;
}

async function listarPendentes() {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM fila_conferencias ORDER BY criado_em ASC`
  );
}

async function contarPendentes() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) as total FROM fila_conferencias`
  );
  return row?.total || 0;
}

async function removerPendente(id) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM fila_conferencias WHERE id = ?`, [id]);
}

async function marcarErro(id, mensagem) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE fila_conferencias
     SET status_envio = 'erro', tentativas = tentativas + 1, ultimo_erro = ?
     WHERE id = ?`,
    [mensagem, id]
  );
}

export default {
  initDb,
  inserirPendente,
  listarPendentes,
  contarPendentes,
  removerPendente,
  marcarErro,
};
