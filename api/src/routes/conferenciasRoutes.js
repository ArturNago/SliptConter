const express = require('express');
const conferenciasController = require('../controllers/conferenciasController');
const { autenticar } = require('../middlewares/authMiddleware');
const { upload } = require('../middlewares/uploadMiddleware');

const router = express.Router();

router.use(autenticar);

router.get('/', conferenciasController.listar);
router.get('/:id', conferenciasController.buscarPorId);
router.post('/', upload.single('imagem'), conferenciasController.criar);
router.post('/sugestao-ia', upload.single('imagem'), conferenciasController.sugestaoIA);

module.exports = router;
