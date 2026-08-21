/**
 * Cliente HTTP da API para o Painel Web Admin.
 * Base URL resolvida em build-time via __API_URL__ (definido no vite.config.js
 * a partir de VITE_API_URL / fallback do túnel Cloudflare).
 *
 * Mantém o token JWT em sessionStorage e redireciona para o login em 401.
 */
import axios from 'axios';

const API_URL = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'https://bemviverdecor.com.br');

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

export default http;

// ---- Autenticação ----

async function login(username, senha) {
  const { data } = await http.post('/auth/login', { username, senha });
  return data;
}

// ---- Produtos ----

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

async function reprocessarNaoMapeados(armazemIds, naoMapeados) {
  const { data } = await http.post('/movimentacoes/reprocessar-nao-mapeados', { armazemIds, naoMapeados });
  return data;
}

// ---- Importação de Vendas ----

async function importarVendas(arquivoUri, nomeArquivo, armazemIds) {
  const form = new FormData();
  form.append('arquivo', {
    uri: arquivoUri,
    name: nomeArquivo,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  form.append('armazemIds', JSON.stringify(armazemIds));
  const { data } = await http.post('/movimentacoes/importar-vendas', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

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
};
