/**
 * Sincronização assíncrona com o Google Sheets (espelho de leitura).
 *
 * Roda em background, depois que a API já respondeu ao app (doc, seção 5.5).
 * Falhas ficam reenfileiradas com retry; o Postgres continua sendo a fonte
 * da verdade mesmo se o Sheets estiver temporariamente indisponível.
 */
const env = require('../config/env');
const { getSheetDoc } = require('../config/sheets');
const SheetsSyncQueue = require('../models/SheetsSyncQueue');
const MovimentacaoEstoque = require('../models/MovimentacaoEstoque');
const Produto = require('../models/Produto');
const ledgerService = require('./ledgerService');

const SHEET_TITLE = 'Estoque';
const HEADERS = ['sku', 'descricao', 'saldo_atual', 'ultima_movimentacao'];

let intervalHandle = null;

async function getOrCreateSheet(doc) {
  let sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) {
    sheet = await doc.addSheet({ title: SHEET_TITLE, headerValues: HEADERS });
  }
  return sheet;
}

/**
 * Atualiza (ou cria) a linha do SKU correspondente com o saldo mais recente.
 */
async function atualizarLinhaDoProduto(produto) {
  const doc = await getSheetDoc();
  const sheet = await getOrCreateSheet(doc);
  const rows = await sheet.getRows();

  const saldo = await ledgerService.obterSaldo(produto.id);
  const linhaExistente = rows.find((r) => r.get('sku') === produto.sku);

  if (linhaExistente) {
    linhaExistente.set('descricao', produto.descricao);
    linhaExistente.set('saldo_atual', String(saldo));
    linhaExistente.set('ultima_movimentacao', new Date().toISOString());
    await linhaExistente.save();
  } else {
    await sheet.addRow({
      sku: produto.sku,
      descricao: produto.descricao,
      saldo_atual: String(saldo),
      ultima_movimentacao: new Date().toISOString(),
    });
  }
}

/**
 * Processa um lote da fila. Cada item vira uma tentativa isolada — falha em
 * um item nunca impede o processamento dos demais.
 */
async function processarFila() {
  if (!env.sheets.syncEnabled) return;

  const pendentes = await SheetsSyncQueue.listPendentes(50);

  for (const item of pendentes) {
    try {
      await SheetsSyncQueue.marcarProcessando(item.id);

      const movimentacao = await MovimentacaoEstoque.findById(item.id_movimentacao);
      if (!movimentacao) {
        await SheetsSyncQueue.marcarSincronizado(item.id); // nada a fazer
        continue;
      }

      const produto = await Produto.findById(movimentacao.produto_id);
      if (!produto) {
        await SheetsSyncQueue.marcarSincronizado(item.id);
        continue;
      }

      await atualizarLinhaDoProduto(produto);
      await SheetsSyncQueue.marcarSincronizado(item.id);
    } catch (err) {
      console.error(`[sheetsSync] falha ao sincronizar item ${item.id}:`, err.message);
      await SheetsSyncQueue.marcarErro(item.id, err.message);
    }
  }
}

/**
 * Inicia o job periódico. Idempotente — chamadas repetidas não duplicam o timer.
 */
function iniciar() {
  if (!env.sheets.syncEnabled) {
    console.log('[sheetsSync] desabilitado via SHEETS_SYNC_ENABLED=false');
    return;
  }
  if (intervalHandle) return;

  console.log(`[sheetsSync] iniciado, intervalo de ${env.sheets.syncIntervalMs}ms`);
  intervalHandle = setInterval(() => {
    processarFila().catch((err) => console.error('[sheetsSync] erro no ciclo:', err));
  }, env.sheets.syncIntervalMs);
}

function parar() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { iniciar, parar, processarFila };
