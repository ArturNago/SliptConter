/**
 * Handler central de erros. Deve ser o último middleware registrado em app.js.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[api] Erro não tratado:', err);

  if (err.name === 'MulterError') {
    return res.status(400).json({ erro: `Erro no upload da imagem: ${err.message}` });
  }

  const status = err.status || 500;
  return res.status(status).json({
    erro: err.expose ? err.message : 'Erro interno do servidor.',
  });
}

module.exports = errorHandler;
