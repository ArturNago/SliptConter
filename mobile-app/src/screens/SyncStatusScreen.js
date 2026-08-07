import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import PrimaryButton from '../components/PrimaryButton';
import EmptyState from '../components/EmptyState';
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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>OFFLINE</Text>
        <Text style={styles.title}>Sincronização</Text>
        <Text style={styles.subtitle}>
          {itens.length === 0 ? 'Tudo atualizado.' : `${itens.length} item(ns) na fila aguardando conexão`}
        </Text>
      </View>

      <FlatList
        data={itens}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          <EmptyState 
            icon="cloud-check" 
            title="Nenhum item pendente" 
            message="Todos os seus lançamentos já foram enviados para o servidor."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons name="sync-alert" size={24} color="#0F766E" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.itemSku}>SKU: {item.produto_sku || item.produto_id}</Text>
              <Text style={styles.itemDetalhe}>
                Qtde: {item.quantidade_contada} un · Tentativas: {item.tentativas}
              </Text>
              {item.ultimo_erro ? <Text style={styles.itemErro}>{item.ultimo_erro}</Text> : null}
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <PrimaryButton 
          label="Sincronizar agora" 
          onPress={sincronizarAgora} 
          loading={sincronizando} 
          disabled={itens.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  header: {
    padding: 24,
    paddingTop: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  eyebrow: { color: '#0F766E', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  title: { color: '#1e293b', fontSize: 24, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 4 },
  content: { padding: 24, paddingBottom: 40, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E1F4EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardBody: { flex: 1 },
  itemSku: { fontWeight: '700', color: '#1e293b', fontSize: 15 },
  itemDetalhe: { color: '#64748b', marginTop: 4, fontSize: 13 },
  itemErro: { color: '#b91c1c', marginTop: 6, fontSize: 13, fontWeight: '500' },
  footer: {
    padding: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
});
