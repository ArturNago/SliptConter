/**
 * Gerenciador de fila offline no navegador (IndexedDB) para o Web App Mobile.
 *
 * Se o operador perder sinal de Wi-Fi no galpão, as fotos e contagens
 * são armazenadas com segurança no IndexedDB e sincronizadas automaticamente
 * assim que o navegador detectar conexão online.
 */

const DB_NAME = 'tebarrot_pwa_db';
const DB_VERSION = 1;
const STORE_NAME = 'fila_conferencias';

function abrirDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function salvarConferenciaOffline(dados) {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      ...dados,
      criadoEm: new Date().toISOString(),
    };
    const req = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listarConferenciasOffline() {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function removerConferenciaOffline(id) {
  const db = await abrirDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function sincronizarFilaOffline(apiClient) {
  const itens = await listarConferenciasOffline();
  if (itens.length === 0) return { sincronizados: 0 };

  let sincronizados = 0;
  for (const item of itens) {
    try {
      const form = new FormData();
      if (item.fotoBlob) {
        form.append('imagem', item.fotoBlob, 'foto.jpg');
      }
      form.append('skuId', item.skuId);
      form.append('armazemId', item.armazemId);
      form.append('quantidadeContada', String(item.quantidadeContada));
      if (item.caixasPorCamada) form.append('caixasPorCamada', String(item.caixasPorCamada));
      if (item.camadasConfirmadas) form.append('camadasConfirmadas', String(item.camadasConfirmadas));
      if (item.caixasSugeridasIa) form.append('caixasSugeridasIa', String(item.caixasSugeridasIa));
      if (item.deteccoesIa) form.append('deteccoesIa', JSON.stringify(item.deteccoesIa));
      form.append('ajusteManual', String(item.ajusteManual || 0));
      form.append('origem', item.origem || 'ia');
      form.append('criadaOffline', 'true');
      form.append('tipoMovimentacao', item.tipoMovimentacao || 'entrada');

      await apiClient.post('/conferencias', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await removerConferenciaOffline(item.id);
      sincronizados++;
    } catch (err) {
      console.warn('[offlineQueue] Falha ao sincronizar item:', err);
      break;
    }
  }

  return { sincronizados, restantes: itens.length - sincronizados };
}
