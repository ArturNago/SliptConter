/**
 * Cliente HTTP para o worker de IA (V1 — sugestão de contagem de camadas).
 *
 * Fica completamente desligado em V0 (IA_WORKER_ENABLED=false); o app
 * mobile funciona normalmente com contagem manual quando isso ocorre.
 */
const fs = require('fs');
const env = require('../config/env');

/**
 * Envia a imagem da pilha para o worker de IA e retorna o número de
 * camadas sugerido pelo YOLOv8.
 *
 * @param {string} absoluteImagePath caminho absoluto do arquivo já salvo
 * @returns {Promise<{ camadasSugeridas: number, confianca: number } | null>}
 *   retorna null quando a IA está desabilitada ou indisponível — o
 *   controller deve tratar isso caindo para o fluxo manual.
 */
async function sugerirContagem(absoluteImagePath) {
  if (!env.iaWorker.enabled) return null;

  try {
    const form = new FormData();
    const buffer = fs.readFileSync(absoluteImagePath);
    form.append('imagem', new Blob([buffer]), 'foto.jpg');

    const response = await fetch(`${env.iaWorker.url}/predict`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      console.warn(`[iaClient] worker respondeu ${response.status}`);
      return null;
    }

    const data = await response.json();
    return {
      camadasSugeridas: data.camadas_sugeridas,
      confianca: data.confianca,
    };
  } catch (err) {
    console.warn('[iaClient] falha ao consultar worker de IA, seguindo em modo manual:', err.message);
    return null;
  }
}

/**
 * Verifica disponibilidade do worker (usado por health checks).
 */
async function estaDisponivel() {
  if (!env.iaWorker.enabled) return false;
  try {
    const response = await fetch(`${env.iaWorker.url}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { sugerirContagem, estaDisponivel };
