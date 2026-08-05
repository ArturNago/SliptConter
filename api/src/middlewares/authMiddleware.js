/**
 * Middleware de autenticação da API (sessão do operador).
 * Login é feito por crachá (QR) ou PIN — ver authController.js — e resulta
 * num JWT que o app mobile mantém salvo (sessão fica ativa no aparelho).
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token de autenticação ausente.' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.usuario = { id: payload.sub, nome: payload.nome, papel: payload.papel };
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/**
 * Restringe a rota a determinados papéis (ex.: gestor/admin).
 * @param  {...string} papeis
 */
function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario || !papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Acesso não autorizado para este papel.' });
    }
    return next();
  };
}

module.exports = { autenticar, exigirPapel };
