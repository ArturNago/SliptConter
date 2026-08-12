/**
 * Rotas administrativas do Painel Web.
 * Prefixo montado em /api/admin (ver routes/index.js).
 * Todas protegidas por JWT + RBAC (admin ou gestor).
 */
const express = require('express');
const adminController = require('../controllers/adminController');
const { autenticar, exigirPapel } = require('../middlewares/authMiddleware');

const router = express.Router();

// Qualquer rota administrativa exige autenticação e papel admin/gestor.
router.use(autenticar);
router.use(exigirPapel('admin', 'gestor'));

// Métricas do dashboard executivo.
router.get('/dashboard-metrics', adminController.dashboardMetrics);

// Matriz completa de estoque (filtros via query string).
router.get('/estoque-consolidado', adminController.estoqueConsolidado);

// Ajuste manual de estoque (ledger imutável).
router.post('/estoque/ajuste', adminController.ajusteManual);

// Exportação de relatórios (estoque ou movimentações).
router.get('/relatorios/exportar', adminController.exportarRelatorio);

// Gestão de operadores/crachás.
router.get('/usuarios', adminController.listarUsuarios);
router.post('/usuarios', adminController.criarUsuario);
router.patch('/usuarios/:id', adminController.atualizarUsuario);

module.exports = router;
