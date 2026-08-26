const app = require('./app');
const env = require('./config/env');
const sheetsSyncService = require('./services/sheetsSyncService');

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] Tebarrot API rodando na porta ${env.port} (ambiente: ${env.nodeEnv})`);
  sheetsSyncService.iniciar();
});

process.on('SIGTERM', () => {
  sheetsSyncService.parar();
  process.exit(0);
});
