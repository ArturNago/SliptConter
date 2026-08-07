/**
 * Sincronização offline -> online (doc, seção 5.3).
 *
 * Verifica conectividade em background; ao detectar acesso à API (via
 * túnel), esvazia a fila do SQLite automaticamente, na ordem em que foi
 * criada. Itens sincronizados com sucesso são removidos da fila; falhas
 * mantêm o item para nova tentativa.
 */
import NetInfo from '@react-native-community/netinfo';
import localDb from './localDb';
import api from './api';

let unsubscribeNetInfo = null;
let sincronizando = false;
let listeners = [];
let armazemPadraoCache = null;

/**
 * Itens legados da fila (anteriores ao multi-armazém) foram migrados com
 * armazem_id=''. Quando encontramos um deles, resolvemos o primeiro armazém
 * ativo da API uma única vez e reutilizamos em cache no processo.
 */
async function resolverArmazemPadrao() {
  if (armazemPadraoCache) return armazemPadraoCache;
  const armazens = await api.listarArmazens();
  if (!armazens || armazens.length === 0) {
    throw new Error('Nenhum armazém ativo disponível para itens legados da fila.');
  }
  armazemPadraoCache = armazens[0].id;
  return armazemPadraoCache;
}

function notificarListeners(status) {
  listeners.forEach((cb) => cb(status));
}

function onStatusChange(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter((cb) => cb !== callback);
  };
}

/**
 * Tenta sincronizar todos os itens pendentes, um a um, na ordem de criação.
 * Silenciosamente ignora erros de rede (a fila permanece intacta para a
 * próxima tentativa) — o operador nunca é bloqueado por isso.
 */
async function flushQueue() {
  if (sincronizando) return;
  sincronizando = true;
  notificarListeners({ sincronizando: true });

  try {
    const pendentes = await localDb.listarPendentes();

    for (const item of pendentes) {
      try {
        const armazemId = item.armazem_id || await resolverArmazemPadrao();
        await api.criarConferencia({
          imagemUri: item.imagem_uri,
          skuId: item.produto_id, // coluna histórica; hoje guarda o id do SKU
          armazemId,
          quantidadeContada: item.quantidade_contada,
          quantidadeSugeridaIa: item.quantidade_sugerida_ia,
          ajusteManual: item.ajuste_manual,
          origem: item.origem,
          criadaOffline: true,
          tipoMovimentacao: item.tipo_movimentacao,
        });
        await localDb.removerPendente(item.id);
      } catch (err) {
        const status = err?.response?.status;

        // Sessão expirada/inválida (401): NÃO marca a fila como erro e NÃO
        // descarta o item. O operador pode ter feito contagens offline
        // legítimas — interrompemos e preservamos tudo para depois do login.
        if (status === 401) {
          break;
        }

        const mensagem = err?.response?.data?.erro || err.message || 'Erro desconhecido';
        await localDb.marcarErro(item.id, mensagem);
        // Erro de rede (sem resposta da API): interrompe o lote para tentar de
        // novo na próxima janela de conectividade, preservando a ordem.
        // Erro definitivo (4xx — dado inválido/expirado): NÃO bloqueia a fila;
        // o item fica marcado com erro e o lote segue para o próximo.
        const erroDefinitivo = status >= 400 && status < 500;
        if (!erroDefinitivo) {
          break;
        }
      }
    }
  } finally {
    sincronizando = false;
    const restantes = await localDb.contarPendentes();
    notificarListeners({ sincronizando: false, pendentes: restantes });
  }
}

/**
 * Inicia o listener de conectividade. Chamar uma vez na inicialização do app.
 */
function iniciar() {
  if (unsubscribeNetInfo) return;

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushQueue().catch(() => {});
    }
  });
}

function parar() {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
}

export default { iniciar, parar, flushQueue, onStatusChange };
