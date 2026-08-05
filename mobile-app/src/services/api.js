/**
 * Cliente HTTP da API — sempre falando com a URL do Cloudflare Tunnel
 * (ou da rede Tailscale, se essa for a alternativa escolhida).
 *
 * A sessão do operador (JWT) é mantida no AsyncStorage — dispositivos são
 * fixos/compartilhados no galpão, então não pedimos login a cada uso
 * (doc, seção 5.1).
 */
import axios from 'axios';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@tebarrot/token';
const USUARIO_KEY = '@tebarrot/usuario';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
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

async function obterSaldoProduto(produtoId) {
  const { data } = await http.get(`/produtos/${produtoId}/saldo`);
  return data;
}

// ---- Conferências ----

/**
 * @param {object} params
 * @param {string} params.imagemUri uri local do arquivo (expo-camera)
 * @param {string} params.produtoId
 * @param {number} params.camadasInformadas
 * @param {number} [params.camadasSugeridasIa]
 * @param {number} [params.ajusteManual]
 * @param {'manual'|'ia'} [params.origem]
 * @param {boolean} [params.criadaOffline]
 * @param {'entrada'|'saida'|'ajuste'} [params.tipoMovimentacao]
 */
async function criarConferencia(params) {
  const form = new FormData();
  form.append('imagem', {
    uri: params.imagemUri,
    name: 'foto.jpg',
    type: 'image/jpeg',
  });
  form.append('produtoId', params.produtoId);
  form.append('camadasInformadas', String(params.camadasInformadas));
  if (params.camadasSugeridasIa !== undefined && params.camadasSugeridasIa !== null) {
    form.append('camadasSugeridasIa', String(params.camadasSugeridasIa));
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

export default {
  API_URL,
  http,
  obterSessao,
  encerrarSessao,
  login,
  buscarProdutoPorSku,
  obterSaldoProduto,
  criarConferencia,
  solicitarSugestaoIA,
};
