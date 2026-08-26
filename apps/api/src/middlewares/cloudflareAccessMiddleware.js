/**
 * Middleware opcional que valida o header `Cf-Access-Jwt-Assertion`
 * injetado pelo Cloudflare Access na borda do túnel.
 *
 * Só é ativado quando `CLOUDFLARE_ACCESS_ENABLED=true`. Isso permite rodar
 * a mesma API em desenvolvimento local (sem Cloudflare) e em produção
 * (com Cloudflare Access obrigatório na frente do túnel), sem duplicar
 * código.
 */
const env = require('../config/env');
const { verifyAccessToken } = require('../config/cloudflare');

async function validarCloudflareAccess(req, res, next) {
  if (!env.cloudflareAccess.enabled) {
    return next();
  }

  const token = req.headers['cf-access-jwt-assertion'];
  if (!token) {
    return res.status(401).json({ erro: 'Requisição sem autenticação do Cloudflare Access.' });
  }

  try {
    await verifyAccessToken(token);
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Falha ao validar autenticação do Cloudflare Access.' });
  }
}

module.exports = validarCloudflareAccess;
