const express = require('express');
const db = require('../config/db');
const authRoutes = require('./authRoutes');
const produtosRoutes = require('./produtosRoutes');
const conferenciasRoutes = require('./conferenciasRoutes');
const movimentacoesRoutes = require('./movimentacoesRoutes');
const armazensRoutes = require('./armazensRoutes');

const router = express.Router();

// Health profundo: confirma também a conectividade com o banco.
// O cloudflared/proxy usa este endpoint para saber se a origem está saudável.
router.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.json({ status: 'ok', db: 'ok' });
  } catch (err) {
    return res.status(503).json({ status: 'erro', db: 'indisponível' });
  }
});

router.use('/auth', authRoutes);
router.use('/produtos', produtosRoutes);
router.use('/conferencias', conferenciasRoutes);
router.use('/movimentacoes', movimentacoesRoutes);
router.use('/armazens', armazensRoutes);

module.exports = router;
