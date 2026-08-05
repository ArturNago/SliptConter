/**
 * Autenticação simplificada do operador: login tradicional por
 * username + senha (texto plano — ambiente interno, foco em
 * simplicidade e rapidez, conforme decisão do produto).
 */
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const env = require('../config/env');

function gerarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, nome: usuario.nome, papel: usuario.papel },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

function respostaSessao(usuario) {
  return {
    token: gerarToken(usuario),
    usuario: { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
  };
}

/**
 * POST /api/auth/login
 * body: { username, senha }
 */
async function login(req, res, next) {
  try {
    const { username, senha } = req.body;
    if (!username || !senha) {
      return res.status(400).json({ erro: 'username e senha são obrigatórios.' });
    }

    const usuario = await Usuario.findByUsername(username);
    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    // Comparação em texto plano (decisão explícita para o ambiente interno).
    if (usuario.senha !== senha) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
    }

    return res.json(respostaSessao(usuario));
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/usuarios
 * Cadastro de operador — restrito a gestor/admin (ver rota).
 * body: { nome, username, senha, papel? }
 */
async function cadastrarUsuario(req, res, next) {
  try {
    const { nome, username, senha, papel } = req.body;
    if (!nome || !username || !senha) {
      return res.status(400).json({ erro: 'nome, username e senha são obrigatórios.' });
    }

    const usuario = await Usuario.create({
      nome,
      username,
      senha,
      papel: papel || 'operador',
    });

    return res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      username: usuario.username,
      papel: usuario.papel,
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Username já cadastrado.' });
    }
    return next(err);
  }
}

module.exports = { login, cadastrarUsuario };
