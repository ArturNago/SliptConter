/**
 * Handler central de erros. Deve ser o último middleware registrado em app.js.
 *
 * Erros do Postgres são mapeados para mensagens úteis (o código original
 * vai junto no payload para facilitar o diagnóstico no suporte).
 */

// Códigos do Postgres que indicam problema de schema/dado — expostos ao app
// porque costumam significar "migration pendente" ou "contrato desalinhado".
const PG_ERROS_EXPOSTOS = {
  '22P02': 'Identificador inválido (UUID malformado ou campo ausente).',
  '23502': 'Dados obrigatórios ausentes ao gravar o registro.',
  '23503': 'Referência inválida: o registro relacionado não existe.',
  '23505': 'Registro duplicado (violação de unicidade).',
  '23514': 'Valor fora das regras de validação do banco.',
  '42703': 'Estrutura do banco desatualizada em relação à API (migration pendente?).',
  '42P01': 'Tabela não encontrada no banco (migration pendente?).',
};

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[api] Erro não tratado:', {
    rota: `${req.method} ${req.originalUrl}`,
    mensagem: err.message,
    codigo: err.code,
    stack: err.stack,
  });

  if (err.name === 'MulterError') {
    return res.status(400).json({ erro: `Erro no upload da imagem: ${err.message}` });
  }

  if (err.code && PG_ERROS_EXPOSTOS[err.code]) {
    // 22P02/23514 são erros de entrada do cliente; os demais indicam
    // problema do lado do servidor (schema/dado).
    const status = err.code === '22P02' || err.code === '23514' ? 400 : 500;
    return res.status(status).json({
      erro: PG_ERROS_EXPOSTOS[err.code],
      codigo: err.code,
    });
  }

  const status = err.status || 500;
  return res.status(status).json({
    erro: err.expose ? err.message : 'Erro interno do servidor.',
  });
}

module.exports = errorHandler;
