const express = require('express');
const armazensController = require('../controllers/armazensController');
const { autenticar, exigirPapel } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(autenticar);
router.get('/', armazensController.listar);
router.get('/matriz-comparativa', armazensController.matrizComparativa);
router.get('/:id/estoque', armazensController.estoque);
router.post('/transferencia', armazensController.transferir);
router.post('/', exigirPapel('gestor', 'admin'), armazensController.criar);
router.patch('/:id', exigirPapel('gestor', 'admin'), armazensController.atualizar);

module.exports = router;
