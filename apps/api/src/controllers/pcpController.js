/**
 * Controller: pcpController
 * Endpoints REST de Inteligência e Indicadores de PCP.
 */
const pcpService = require('../services/pcpService');

async function indicadores(req, res, next) {
  try {
    const dias = parseInt(req.query.dias, 10) || 30;
    const dados = await pcpService.obterIndicadoresPCP({ diasAnalise: dias });
    return res.json(dados);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  indicadores,
};
