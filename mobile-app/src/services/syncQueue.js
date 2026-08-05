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
        await api.criarConferencia({
          imagemUri: item.imagem_uri,
          produtoId: item.produto_id,
          camadasInformadas: item.camadas_informadas,
          camadasSugeridasIa: item.camadas_sugeridas_ia,
          ajusteManual: item.ajuste_manual,
          origem: item.origem,
          criadaOffline: true,
          tipoMovimentacao: item.tipo_movimentacao,
        });
        await localDb.removerPendente(item.id);
      } catch (err) {
        const mensagem = err?.response?.data?.erro || err.message || 'Erro desconhecido';
        await localDb.marcarErro(item.id, mensagem);
        // Interrompe o lote nesta falha para preservar a ordem de criação;
        // a próxima chamada de flushQueue (nova conectividade) tenta de novo.
        break;
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
