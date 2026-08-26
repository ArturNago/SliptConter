const express = require('express');
const authController = require('../controllers/authController');
const { autenticar, exigirPapel } = require('../middlewares/authMiddleware');

const router = express.Router();

// Login tradicional — username + senha.
router.post('/login', authController.login);

// Cadastro de operador — restrito a gestor/admin.
router.post('/usuarios', autenticar, exigirPapel('gestor', 'admin'), authController.cadastrarUsuario);

module.exports = router;
