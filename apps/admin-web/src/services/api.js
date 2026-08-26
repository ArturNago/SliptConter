/**
 * Cliente HTTP da API para o Painel Web Admin.
 * Base URL resolvida em build-time ou dinamicamente no navegador.
 */
import axios from 'axios';

function getBaseApiUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof __API_URL__ !== 'undefined' && __API_URL__ && !__API_URL__.includes('bemviverdecor')) {
    return __API_URL__;
  }
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    const port = window.location.port;
    // Se estiver rodando no Vite dev server (porta 5173)
    if (port === '5173') {
      return `http://${hostname}:3000`;
    }
    // Quando servido pelo container Nginx (porta 80, 8080, 8081 ou admin.puratienda.store), usa /api relativo
    return '';
  }
  return '';
}

const API_URL = getBaseApiUrl();

export const TOKEN_KEY = 'sliptconter_admin_token';

const http = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
});

http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    if (status === 401) {
      // Sessão expirada/inválida: limpa e recarrega para a tela de login.
      sessionStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ---- Métodos Auxiliares da API ----

async function login(username, senha) {
  const { data } = await http.post('/auth/login', { username, senha });
  return data;
}

async function listarProdutos(filtros = {}) {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const { data } = await http.get('/produtos', { params });
  return data;
}

async function listarArmazens() {
  const { data } = await http.get('/armazens');
  return data;
}

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

async function reprocessarNaoMapeados(armazemIds, naoMapeados) {
  const { data } = await http.post('/movimentacoes/reprocessar-nao-mapeados', { armazemIds, naoMapeados });
  return data;
}

async function importarVendas(formData) {
  const { data } = await http.post('/movimentacoes/importar-vendas', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

async function listarLotesVendas(filtros = {}) {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const { data } = await http.get('/movimentacoes/lotes-vendas', { params });
  return data;
}

async function buscarLoteVenda(id) {
  const { data } = await http.get(`/movimentacoes/lotes-vendas/${id}`);
  return data;
}

async function estornarLoteVenda(id) {
  const { data } = await http.post(`/movimentacoes/lotes-vendas/${id}/estornar`);
  return data;
}

async function obterIndicadoresPCP() {
  const { data } = await http.get('/pcp/indicadores');
  return data;
}

async function listarInventarios(filtros = {}) {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const { data } = await http.get('/inventarios', { params });
  return data;
}

async function buscarInventario(id, contagemCega = false) {
  const { data } = await http.get(`/inventarios/${id}${contagemCega ? '?contagemCega=true' : ''}`);
  return data;
}

async function criarInventario(payload) {
  const { data } = await http.post('/inventarios', payload);
  return data;
}

async function registrarContagemInventario(ordemId, skuId, quantidadeContada) {
  const { data } = await http.post(`/inventarios/${ordemId}/contagem`, { skuId, quantidadeContada });
  return data;
}

async function finalizarInventario(ordemId, itensAprovados = []) {
  const { data } = await http.post(`/inventarios/${ordemId}/finalizar`, { itensAprovados });
  return data;
}

async function cancelarInventario(ordemId) {
  const { data } = await http.post(`/inventarios/${ordemId}/cancelar`);
  return data;
}

// Anexa todas as funções utilitárias à instância do axios para permitir chamadas como api.listarProdutos()
Object.assign(http, {
  http,
  login,
  listarProdutos,
  listarArmazens,
  listarMapeamentos,
  criarMapeamento,
  atualizarMapeamento,
  removerMapeamento,
  reprocessarNaoMapeados,
  importarVendas,
  listarLotesVendas,
  buscarLoteVenda,
  estornarLoteVenda,
  obterIndicadoresPCP,
  listarInventarios,
  buscarInventario,
  criarInventario,
  registrarContagemInventario,
  finalizarInventario,
  cancelarInventario,
});

export default http;

export {
  login,
  listarProdutos,
  listarArmazens,
  listarMapeamentos,
  criarMapeamento,
  atualizarMapeamento,
  removerMapeamento,
  reprocessarNaoMapeados,
  importarVendas,
  listarLotesVendas,
  buscarLoteVenda,
  estornarLoteVenda,
  obterIndicadoresPCP,
  listarInventarios,
  buscarInventario,
  criarInventario,
  registrarContagemInventario,
  finalizarInventario,
  cancelarInventario,
};
