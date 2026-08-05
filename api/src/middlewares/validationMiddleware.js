/**
 * Validação simples de payloads de entrada, sem dependência de uma
 * biblioteca externa de schema — mantém o middleware leve e explícito.
 *
 * @param {(body: object) => string[]} regras função que recebe o body e
 *   retorna uma lista de mensagens de erro (vazia se válido).
 */
function validar(regras) {
  return (req, res, next) => {
    const erros = regras(req.body || {});
    if (erros && erros.length > 0) {
      return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros });
    }
    return next();
  };
}

module.exports = { validar };
