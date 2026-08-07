import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * Lista de SKUs com saldo total. Usa o endpoint agregado /produtos/saldos
 * (1 request) em vez de uma chamada de saldo por produto (anti-N+1).
 */
export default function useSaldoProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregarSaldos = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);
      const [listaProdutos, saldos] = await Promise.all([
        api.listarProdutos(),
        api.listarSaldosTotais(),
      ]);

      const saldoPorId = new Map(saldos.map((s) => [s.skuId, Number(s.saldoTotal)]));
      const comSaldo = listaProdutos.map((p) => ({
        ...p,
        saldoTotal: saldoPorId.get(p.id) || 0,
      }));

      setProdutos(comSaldo);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar saldos');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarSaldos();
  }, [carregarSaldos]);

  return { produtos, carregando, erro, recarregar: carregarSaldos };
}
