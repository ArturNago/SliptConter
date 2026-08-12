const express = require('express');
const mapeamentosController = require('../controllers/mapeamentosController');
const { autenticar } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.get('/', mapeamentosController.listar);
router.get('/:id', mapeamentosController.buscarPorId);
router.post('/', mapeamentosController.criar);
router.put('/:id', mapeamentosController.atualizar);
router.delete('/:id', mapeamentosController.remover);

module.exports = router;
