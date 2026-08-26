/**
 * Integração com Cloudflare Access.
 *
 * O túnel `cloudflared` expõe a API sem IP público. O Cloudflare Access
 * fica na frente do túnel e injeta o header `Cf-Access-Jwt-Assertion` em
 * toda requisição autenticada na borda. Este módulo valida esse JWT
 * (assinatura via JWKS do time Cloudflare) para garantir que a requisição
 * realmente passou pela autenticação, e não apenas conhece a URL do túnel.
 *
 * Quando `cloudflareAccess.enabled` é falso (ex.: desenvolvimento local,
 * ou quando se optou pela alternativa Tailscale), a verificação é
 * simplesmente ignorada.
 */
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const env = require('./env');

let client = null;

function getClient() {
  if (!client) {
    client = jwksClient({
      jwksUri: `https://${env.cloudflareAccess.teamDomain}/cdn-cgi/access/certs`,
      cache: true,
      cacheMaxAge: 60 * 60 * 1000,
    });
  }
  return client;
}

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    getClient().getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

/**
 * Verifica o token `Cf-Access-Jwt-Assertion` de uma requisição.
 * @param {string} token
 * @returns {Promise<object>} payload decodificado
 */
async function verifyAccessToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Token do Cloudflare Access inválido (sem kid).');
  }

  const publicKey = await getSigningKey(decoded.header);

  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    audience: env.cloudflareAccess.audience || undefined,
  });
}

module.exports = { verifyAccessToken };
