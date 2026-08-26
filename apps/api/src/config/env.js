/**
 * Carrega e centraliza as variáveis de ambiente usadas pela API.
 * Nenhum outro módulo deve ler `process.env` diretamente — sempre
 * importar deste arquivo, para manter um único ponto de verdade.
 */
require('dotenv').config();

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: A variável de ambiente JWT_SECRET não está configurada.');
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT, 10) || 3000,

  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',

  datasetPath: process.env.DATASET_PATH || './dataset',

  db: {
    user: process.env.POSTGRES_USER || 'tebarrot',
    password: process.env.POSTGRES_PASSWORD || 'tebarrot',
    database: process.env.POSTGRES_DB || 'tebarrot_estoque',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
  },

  iaWorker: {
    url: process.env.IA_WORKER_URL || 'http://localhost:8000',
    enabled: toBool(process.env.IA_WORKER_ENABLED, false),
  },

  sheets: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    sheetId: process.env.GOOGLE_SHEET_ID || '',
    syncEnabled: toBool(process.env.SHEETS_SYNC_ENABLED, false),
    syncIntervalMs: parseInt(process.env.SHEETS_SYNC_INTERVAL_MS, 10) || 30000,
  },

  cloudflareAccess: {
    // Camada extra de autenticação na borda (obrigatória na arquitetura
    // documentada). Fica desabilitada por padrão em desenvolvimento local,
    // pois nesse caso o acesso já é validado pelo próprio túnel/Cloudflare.
    enabled: toBool(process.env.CLOUDFLARE_ACCESS_ENABLED, false),
    teamDomain: process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || '', // ex: minhaempresa.cloudflareaccess.com
    audience: process.env.CLOUDFLARE_ACCESS_AUD || '',
  },
};
