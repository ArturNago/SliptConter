/**
 * Status da fila offline (doc, seção 5.3): permite ao operador ver quantos
 * itens estão pendentes e forçar uma nova tentativa de sincronização.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import PrimaryButton from '../components/PrimaryButton';
import localDb from '../services/localDb';
import syncQueue from '../services/syncQueue';

export default function SyncStatusScreen() {
  const [itens, setItens] = useState([]);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async () => {
    const pendentes = await localDb.listarPendentes();
    setItens(pendentes);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  useEffect(() => {
    const unsubscribe = syncQueue.onStatusChange((status) => {
      setSincronizando(status.sincronizando);
      if (!status.sincronizando) carregar();
    });
    return unsubscribe;
  }, [carregar]);

  async function sincronizarAgora() {
    setSincronizando(true);
    await syncQueue.flushQueue();
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titulo}>Fila de sincronização</Text>
      <Text style={styles.subtitulo}>
        {itens.length === 0 ? 'Nenhum item pendente.' : `${itens.length} item(ns) pendente(s)`}
      </Text>

      <FlatList
        data={itens}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemSku}>{item.produto_sku || item.produto_id}</Text>
            <Text style={styles.itemDetalhe}>
              Camadas: {item.camadas_informadas} • Tentativas: {item.tentativas}
            </Text>
            {item.ultimo_erro ? <Text style={styles.itemErro}>{item.ultimo_erro}</Text> : null}
          </View>
        )}
      />

      <PrimaryButton label="Sincronizar agora" onPress={sincronizarAgora} loading={sincronizando} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 12, backgroundColor: '#F8FAFC' },
  titulo: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  subtitulo: { color: '#64748B', marginBottom: 8 },
  item: { backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  itemSku: { fontWeight: '700', color: '#0F172A' },
  itemDetalhe: { color: '#475569', marginTop: 2 },
  itemErro: { color: '#B91C1C', marginTop: 4, fontSize: 12 },
});
