/**
 * Hooks de dados do Painel Web usando fetch simples + estado local.
 * (Sem dependência de React Query para manter o bundle leve; re-fetch
 * explícito controlado pelas páginas.)
 */
import { useState, useEffect, useCallback } from 'react';
import * as stockService from '../services/stockService';

/**
 * Hook genérico para carregar dados de um serviço async.
 * Retorna { data, loading, error, recarregar }.
 */
export function useAsyncData(fetcher, deps = [], options = {}) {
  const [data, setData] = useState(options.initial ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const recarregar = useCallback(() => {
    let ativo = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => {
        if (ativo) setData(res);
      })
      .catch((err) => {
        if (ativo) setError(err?.response?.data?.erro || err.message || 'Erro ao carregar dados.');
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => recarregar(), [recarregar]);

  return { data, loading, error, recarregar };
}

export function useDashboardMetrics(params) {
  return useAsyncData(() => stockService.getDashboardMetrics(params), [JSON.stringify(params)]);
}

export function useEstoqueConsolidado(params) {
  return useAsyncData(() => stockService.getEstoqueConsolidado(params), [JSON.stringify(params)]);
}

export function useConferencias(params) {
  return useAsyncData(() => stockService.getConferencias(params), [JSON.stringify(params)]);
}

export function useMovimentacoes(params) {
  return useAsyncData(() => stockService.getMovimentacoes(params), [JSON.stringify(params)]);
}

export function useUsuarios() {
  return useAsyncData(() => stockService.getUsuarios(), []);
}

export function useArmazens() {
  return useAsyncData(() => stockService.getArmazens(), []);
}

export function useProdutos(params) {
  return useAsyncData(() => stockService.getProdutos(params), [JSON.stringify(params)]);
}
