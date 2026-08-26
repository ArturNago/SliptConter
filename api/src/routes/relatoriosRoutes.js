const express = require('express');
const router = express.Router();
const relatoriosController = require('../controllers/relatoriosController');

// Define route for generating PDF dashboard
router.get('/dashboard-estoque', relatoriosController.gerarDashboardEstoquePdf);

module.exports = router;
