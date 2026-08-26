/**
 * Serviço de consulta ao estoque e métricas administrativas.
 * Encapsula os endpoints /api/admin/* criados no backend.
 */
import http from './api';

// GET /api/admin/dashboard-metrics
export async function getDashboardMetrics(params = {}) {
  const { data } = await http.get('/admin/dashboard-metrics', { params });
  return data;
}

// GET /api/admin/estoque-consolidado
export async function getEstoqueConsolidado(params = {}) {
  const { data } = await http.get('/admin/estoque-consolidado', { params });
  return data;
}

// POST /api/admin/estoque/ajuste
export async function ajusteManualEstoque(payload) {
  const { data } = await http.post('/admin/estoque/ajuste', payload);
  return data;
}

// GET /api/admin/relatorios/exportar
export async function getRelatorioExportacao(params = {}) {
  const { data } = await http.get('/admin/relatorios/exportar', { params });
  return data;
}

// GET /api/armazens — usado nos filtros e no ajuste manual.
export async function getArmazens() {
  const { data } = await http.get('/armazens');
  return data;
}

// GET /api/conferencias — auditoria de conferências do galpão.
export async function getConferencias(params = {}) {
  const { data } = await http.get('/conferencias', { params });
  return data;
}

// GET /api/movimentacoes — ledger de movimentações.
export async function getMovimentacoes(params = {}) {
  const { data } = await http.get('/movimentacoes', { params });
  return data;
}

// GET /api/admin/usuarios — gestão de operadores.
export async function getUsuarios() {
  const { data } = await http.get('/admin/usuarios');
  return data;
}

// GET /api/produtos — cadastro de SKUs (master data).
export async function getProdutos(params = {}) {
  const { data } = await http.get('/produtos', { params });
  return data;
}
