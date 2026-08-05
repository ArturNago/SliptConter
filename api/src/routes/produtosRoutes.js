const express = require('express');
const produtosController = require('../controllers/produtosController');
const { autenticar, exigirPapel } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);

router.get('/', produtosController.listar);
router.get('/sku/:sku', produtosController.buscarPorSku);
router.get('/:id/saldo', produtosController.saldo);
router.get('/:id/movimentacoes', produtosController.movimentacoes);

router.post('/', exigirPapel('gestor', 'admin'), produtosController.criar);
router.patch('/:id', exigirPapel('gestor', 'admin'), produtosController.atualizar);

module.exports = router;
