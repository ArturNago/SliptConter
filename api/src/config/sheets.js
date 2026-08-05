/**
 * Cliente do Google Sheets (espelho de leitura para a gestão).
 *
 * Usa autenticação via Service Account. Nunca é a fonte da verdade —
 * apenas recebe atualizações vindas do PostgreSQL, de forma assíncrona.
 */
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const env = require('./env');

let cachedDoc = null;

/**
 * Retorna a instância autenticada do documento (planilha), com cache
 * em memória para evitar reautenticar em toda chamada.
 */
async function getSheetDoc() {
  if (!env.sheets.sheetId || !env.sheets.serviceAccountEmail || !env.sheets.privateKey) {
    throw new Error(
      'Credenciais do Google Sheets não configuradas (GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).'
    );
  }

  if (cachedDoc) return cachedDoc;

  const jwtClient = new JWT({
    email: env.sheets.serviceAccountEmail,
    key: env.sheets.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(env.sheets.sheetId, jwtClient);
  await doc.loadInfo();

  cachedDoc = doc;
  return doc;
}

function resetCache() {
  cachedDoc = null;
}

module.exports = { getSheetDoc, resetCache };
