/**
 * Configuração do app Express — regras de negócio, autenticação e
 * orquestração dos serviços (doc, seção 2, camada Backend/API).
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const validarCloudflareAccess = require('./middlewares/cloudflareAccessMiddleware');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Camada extra de autenticação na borda do túnel (Cloudflare Access).
app.use(validarCloudflareAccess);

app.use('/api', routes);

app.get('/', (req, res) => {
  // Acessado quando alguém abre a URL raiz do túnel no navegador.
  // Os endpoints da API ficam todos sob /api — esta página existe só
  // para evitar o 404 bruto e dar uma orientação rápida.
  res.json({
    servico: 'Tebarrot API',
    versao: '3.0.0',
    api: {
      health: '/api/health',
      auth: {
        login: 'POST /api/auth/login',
      },
      produtos: {
        listar: 'GET /api/produtos',
        buscarPorSku: 'GET /api/produtos/sku/:sku',
        saldo: 'GET /api/produtos/:id/saldo',
      },
      conferencias: {
        criar: 'POST /api/conferencias  (multipart/form-data)',
        listar: 'GET /api/conferencias',
        sugestaoIa: 'POST /api/conferencias/sugestao-ia  (V1, opcional)',
      },
    },
  });
});

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use(errorHandler);

module.exports = app;
