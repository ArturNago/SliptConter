const express = require('express');
const authRoutes = require('./authRoutes');
const produtosRoutes = require('./produtosRoutes');
const conferenciasRoutes = require('./conferenciasRoutes');
const movimentacoesRoutes = require('./movimentacoesRoutes');

const router = express.Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.use('/auth', authRoutes);
router.use('/produtos', produtosRoutes);
router.use('/conferencias', conferenciasRoutes);
router.use('/movimentacoes', movimentacoesRoutes);

module.exports = router;
