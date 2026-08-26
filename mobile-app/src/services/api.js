/**
 * Cliente HTTP da API.
 *
 * A prioridade da URL é:
 *  1. Variável de ambiente EXPO_PUBLIC_API_URL (definida no .env do projeto).
 *  2. Se o app estiver rodando via Expo Go conectado ao servidor local
 *     (sessionId do expo-constants contém o hostname da máquina de dev),
 *     usa o IP da rede local para que o celular físico alcance a API.
 *  3. app.json → expo.extra.apiUrl
 *  4. Fallback: localhost (simulador).
 */

import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Callback registrado por App.js para reagir à expiração/invalidade da
 * sessão em runtime (recebemos 401 fora da tela de login). Permite que o
 * app redirecione para a tela de Login a partir de qualquer tela.
 */
let onSessaoExpirada = null;
function registrarOnSessaoExpirada(callback) {
  onSessaoExpirada = callback;
}

/**
 * Decodifica o payload de um JWT (sem validar assinatura — só leitura do
 * `exp`) para saber se a sessão salva ainda está dentro da validade.
 * Retorna true se o token estiver expirado ou não puder ser lido.
 */
function tokenExpirado(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    if (!payload.exp) return false; // sem expiração declarada: trata como válido
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true; // token corrompido: força re-login
  }
}

const TOKEN_KEY = '@tebarrot/token';
const USUARIO_KEY = '@tebarrot/usuario';

const DEV_MACHINE_IP = '192.168.1.200';
const DEV_MACHINE_HOSTNAME = 'DSK-TI';

function detectarIpLocal() {
  try {
    const sessionId = Constants.expoConfig?.extra?.expoGo?.releaseId || '';
    const hostname = Constants.deviceHostname || '';
    if (
      hostname.includes(DEV_MACHINE_HOSTNAME) ||
      sessionId.includes(DEV_MACHINE_HOSTNAME)
    ) {
      return `http://${DEV_MACHINE_IP}:3000`;
    }
  } catch {
    // expo-constants não disponível (ex.: teste unitário)
  }
  return null;
}

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  detectarIpLocal() ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:3000';

const http = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 20000,
});

http.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;

    // Sessão expirada/inválida: limpa o AsyncStorage e devolve o usuário ao
    // Login. A exceção é a própria rota de login (401 lá = credencial errada,
    // e não expiração — não queremos limpar e sim mostrar "usuário/senha inválidos").
    const ehRotaLogin = error.config?.url?.includes('/auth/login');
    if (status === 401 && !ehRotaLogin) {
      await encerrarSessao();
      if (onSessaoExpirada) onSessaoExpirada();
    }

    if (status === 403) {
      error.message = 'Apenas gestores podem alterar o catálogo';
    } else if (error.response?.data?.erro) {
      // A API responde sempre com a chave `erro` (com acento) — corrigido
      // aqui, pois antes lia `error` (sem acento) e descartava toda mensagem.
      error.message = error.response.data.erro;
    }
    return Promise.reject(error);
  }
);

async function salvarSessao(token, usuario) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
}

async function obterSessao() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const usuarioRaw = await AsyncStorage.getItem(USUARIO_KEY);
  return {
    token,
    usuario: usuarioRaw ? JSON.parse(usuarioRaw) : null,
  };
}

async function encerrarSessao() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USUARIO_KEY]);
}

// ---- Autenticação ----

async function login(username, senha) {
  const { data } = await http.post('/auth/login', { username, senha });
  await salvarSessao(data.token, data.usuario);
  return data;
}

// ---- Produtos ----

async function buscarProdutoPorSku(sku) {
  const { data } = await http.get(`/produtos/sku/${encodeURIComponent(sku)}`);
  return data;
}

async function listarProdutos(filtros = {}) {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const { data } = await http.get('/produtos', { params });
  return data;
}

/**
 * Saldo total de todos os SKUs em uma única chamada (anti-N+1).
 * Retorna [{ skuId, saldoTotal }].
 */
async function listarSaldosTotais() {
  const { data } = await http.get('/produtos/saldos');
  return data;
}

async function criarProduto(produto) {
  const { data } = await http.post('/produtos', produto);
  return data;
}

async function atualizarProduto(id, produto) {
  const { data } = await http.patch(`/produtos/${id}`, produto);
  return data;
}

async function listarArmazens() {
  const { data } = await http.get('/armazens');
  return data;
}

async function criarArmazem(armazem) {
  const { data } = await http.post('/armazens', armazem);
  return data;
}

async function atualizarArmazem(id, armazem) {
  const { data } = await http.patch(`/armazens/${id}`, armazem);
  return data;
}

async function buscarEstoqueArmazem(armazemId) {
  const { data } = await http.get(`/armazens/${armazemId}/estoque`);
  return data;
}

async function obterSaldoProduto(produtoId, armazemId) {
  const params = armazemId ? { armazemId } : {};
  const { data } = await http.get(`/produtos/${produtoId}/saldo`, { params });
  return data;
}

async function listarMovimentacoesProduto(produtoId, { limit = 20 } = {}) {
  const { data } = await http.get(`/produtos/${produtoId}/movimentacoes`, { params: { limit } });
  return data;
}

// ---- Conferências ----

/**
 * @param {object} params
 * @param {string} params.imagemUri uri local do arquivo (expo-camera)
 * @param {string} params.skuId id do SKU (aceita o legado `produtoId` — itens
 *                 antigos da fila offline ainda usam esse nome)
 * @param {string} params.armazemId
 * @param {number} params.quantidadeContada
 * @param {number} [params.quantidadeSugeridaIa]
 * @param {number} [params.ajusteManual]
 * @param {'manual'|'ia'} [params.origem]
 * @param {boolean} [params.criadaOffline]
 * @param {'entrada'|'saida'|'ajuste'} [params.tipoMovimentacao]
 * @param {number} [params.caixasPorCamada] caixas detectadas na camada frontal (V1)
 * @param {number} [params.camadasConfirmadas] camadas confirmadas pelo operador (V1)
 * @param {number} [params.caixasSugeridasIa] caixas sugeridas pela IA (V1)
 * @param {Array} [params.deteccoesIa] bounding boxes normalizadas da IA (V1)
 */
async function criarConferencia(params) {
  const skuId = params.skuId || params.produtoId;
  if (!skuId) {
    const err = new Error('Produto (SKU) é obrigatório para a conferência.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (!params.armazemId) {
    const err = new Error('Armazém é obrigatório para a conferência.');
    err.code = 'VALIDATION';
    throw err;
  }
  const form = new FormData();
  if (params.imagemUri) {
    form.append('imagem', {
      uri: params.imagemUri,
      name: 'foto.jpg',
      type: 'image/jpeg',
    });
  }
  form.append('skuId', skuId);
  form.append('armazemId', params.armazemId);
  form.append('quantidadeContada', String(params.quantidadeContada));
  if (params.quantidadeSugeridaIa !== undefined && params.quantidadeSugeridaIa !== null) {
    form.append('quantidadeSugeridaIa', String(params.quantidadeSugeridaIa));
  }
  if (params.caixasPorCamada !== undefined && params.caixasPorCamada !== null) {
    form.append('caixasPorCamada', String(params.caixasPorCamada));
  }
  if (params.camadasConfirmadas !== undefined && params.camadasConfirmadas !== null) {
    form.append('camadasConfirmadas', String(params.camadasConfirmadas));
  }
  if (params.caixasSugeridasIa !== undefined && params.caixasSugeridasIa !== null) {
    form.append('caixasSugeridasIa', String(params.caixasSugeridasIa));
  }
  if (params.deteccoesIa) {
    form.append('deteccoesIa', JSON.stringify(params.deteccoesIa));
  }
  form.append('ajusteManual', String(params.ajusteManual || 0));
  form.append('origem', params.origem || 'manual');
  form.append('criadaOffline', String(!!params.criadaOffline));
  form.append('tipoMovimentacao', params.tipoMovimentacao || 'entrada');

  const { data } = await http.post('/conferencias', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * Só é chamado em V1. Se a IA estiver desligada, a API retorna
 * `{ disponivel: false }` e o app segue no fluxo manual normalmente.
 */
async function solicitarSugestaoIA(imagemUri) {
  const form = new FormData();
  form.append('imagem', { uri: imagemUri, name: 'foto.jpg', type: 'image/jpeg' });

  const { data } = await http.post('/conferencias/sugestao-ia', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

async function listarMovimentacoes(filtros = {}) {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const { data } = await http.get('/movimentacoes', { params });
  return data;
}

// ---- Mapeamentos de Anúncios ----

async function listarMapeamentos(filtros = {}) {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const { data } = await http.get('/mapeamentos', { params });
  return data;
}

async function criarMapeamento(payload) {
  const { data } = await http.post('/mapeamentos', payload);
  return data;
}

async function atualizarMapeamento(id, payload) {
  const { data } = await http.put(`/mapeamentos/${id}`, payload);
  return data;
}

async function removerMapeamento(id) {
  const { data } = await http.delete(`/mapeamentos/${id}`);
  return data;
}

async function importarVendas(arquivoUri, nomeArquivo, armazemIds) {
  const form = new FormData();
  form.append('arquivo', {
    uri: arquivoUri,
    name: nomeArquivo,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (Array.isArray(armazemIds) && armazemIds.length > 0) {
    form.append('armazemId', armazemIds[0]);
    form.append('armazemIds', JSON.stringify(armazemIds));
  }
  const { data } = await http.post('/movimentacoes/importar-vendas', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

async function listarInventarios(filtros = {}) {
  const { data } = await http.get('/inventarios', { params: filtros });
  return data;
}

async function buscarInventario(id, contagemCega = true) {
  const { data } = await http.get(`/inventarios/${id}`, { params: { contagemCega } });
  return data;
}

async function registrarContagemInventario(ordemId, skuId, quantidadeContada) {
  const { data } = await http.post(`/inventarios/${ordemId}/contagem`, { skuId, quantidadeContada });
  return data;
}

async function obterIndicadoresPCP(dias = 30) {
  const { data } = await http.get('/pcp/indicadores', { params: { dias } });
  return data;
}

export default {
  API_URL,
  http,
  obterSessao,
  encerrarSessao,
  tokenExpirado,
  registrarOnSessaoExpirada,
  login,
  listarProdutos,
  listarSaldosTotais,
  buscarProdutoPorSku,
  criarProduto,
  atualizarProduto,
  listarArmazens,
  criarArmazem,
  atualizarArmazem,
  buscarEstoqueArmazem,
  obterSaldoProduto,
  listarMovimentacoesProduto,
  criarConferencia,
  listarMovimentacoes,
  solicitarSugestaoIA,
  listarMapeamentos,
  criarMapeamento,
  atualizarMapeamento,
  removerMapeamento,
  importarVendas,
  listarInventarios,
  buscarInventario,
  registrarContagemInventario,
  obterIndicadoresPCP,
};
