/**
 * Rotas de Inventários Cíclicos e Contagem Cega (/api/inventarios)
 */
const express = require('express');
const router = express.Router();
const inventariosController = require('../controllers/inventariosController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware.autenticar);

router.post('/', inventariosController.criar);
router.get('/', inventariosController.listar);
router.get('/:id', inventariosController.buscarPorId);
router.post('/:id/contagem', inventariosController.registrarContagem);
router.post('/:id/finalizar', inventariosController.finalizar);
router.post('/:id/cancelar', inventariosController.cancelar);

module.exports = router;
