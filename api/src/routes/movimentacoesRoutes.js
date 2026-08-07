const express = require('express');
const movimentacoesController = require('../controllers/movimentacoesController');
const { autenticar } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.get('/', movimentacoesController.listar);
router.get('/:id', movimentacoesController.buscarPorId);

module.exports = router;
