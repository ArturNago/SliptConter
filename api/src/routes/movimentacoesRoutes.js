const express = require('express');
const multer = require('multer');
const movimentacoesController = require('../controllers/movimentacoesController');
const importacaoVendasController = require('../controllers/importacaoVendasController');
const { autenticar } = require('../middlewares/authMiddleware');

// Upload em memória — não salva o xlsx em disco.
const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream',
    ].includes(file.mimetype) || file.originalname.endsWith('.xlsx');
    ok ? cb(null, true) : cb(new Error('Apenas arquivos .xlsx são aceitos.'));
  },
});

const router = express.Router();

router.use(autenticar);

router.post('/importar-vendas', uploadXlsx.single('arquivo'), importacaoVendasController.importar);
router.post('/reprocessar-nao-mapeados', movimentacoesController.reprocessarNaoMapeados);
router.get('/', movimentacoesController.listar);
router.get('/:id', movimentacoesController.buscarPorId);

module.exports = router;
