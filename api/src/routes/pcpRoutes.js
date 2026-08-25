/**
 * Rotas de Inteligência de PCP (/api/pcp)
 */
const express = require('express');
const router = express.Router();
const pcpController = require('../controllers/pcpController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware.autenticar);

router.get('/indicadores', pcpController.indicadores);

module.exports = router;
