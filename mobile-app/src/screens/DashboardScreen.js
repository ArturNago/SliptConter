import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import ScreenHeader from '../components/ScreenHeader';
import useSaldoProdutos from '../hooks/useSaldoProdutos';
import api from '../services/api';

export default function DashboardScreen({ navigation }) {
  const [armazens, setArmazens] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregandoDados, setCarregandoDados] = useState(false);
  const { produtos, carregando: carregandoProdutos, recarregar: recarregarProdutos } = useSaldoProdutos();

  const carregar = useCallback(async () => {
    setCarregandoDados(true);
    try {
      const [listaArmazens, listaMovimentacoes] = await Promise.all([
        api.listarArmazens(),
        api.listarMovimentacoes({ limit: 10 }),
      ]);
      setArmazens(listaArmazens);
      setMovimentacoes(listaMovimentacoes);
    } catch (err) {
      Alert.alert('Dashboard indisponível', err?.response?.data?.erro || 'Não foi possível carregar os indicadores.');
    } finally {
      setCarregandoDados(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
      recarregarProdutos();
    }, [carregar, recarregarProdutos])
  );

  const carregando = carregandoDados || carregandoProdutos;
  const semEstoque = produtos.filter((item) => item.saldoTotal <= 0 && item.ativo);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader 
        title="Dashboard"
        eyebrow="VISÃO GERAL"
        subtitle="Um resumo rápido da operação."
      />

      <FlatList
        data={semEstoque}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={() => { carregar(); recarregarProdutos(); }} tintColor="#0F766E" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.metrics}>
              <Metric value={produtos.filter(p => p.ativo).length} label="Produtos ativos" />
              <Metric value={armazens.length} label="Armazéns ativos" />
              <Metric value={semEstoque.length} label="Sem estoque" accent />
            </View>
            <Text style={styles.sectionTitle}>Sem estoque</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Tudo abastecido</Text>
            <Text style={styles.emptyText}>Nenhum produto ativo está com estoque zerado.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable 
            style={({ pressed }) => [styles.zeroItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate('ProdutosTab', { screen: 'ProdutoDetail', params: { produto: item } })}
          >
            <View style={styles.zeroDot} />
            <View style={styles.zeroBody}>
              <Text style={styles.itemName}>{item.descricao}</Text>
              <Text style={styles.itemSku}>{item.sku}</Text>
            </View>
            <Text style={styles.zeroValue}>0 un.</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={styles.feed}>
            <Text style={styles.sectionTitle}>Últimas movimentações</Text>
            {movimentacoes.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma movimentação registrada ainda.</Text>
            ) : (
              movimentacoes.map((item) => (
                <View style={styles.feedItem} key={item.id}>
                  <View style={[styles.feedBadge, item.quantidade < 0 ? styles.feedOut : styles.feedIn]}>
                    <Text style={styles.feedBadgeText}>{item.quantidade < 0 ? '-' : '+'}</Text>
                  </View>
                  <View style={styles.feedBody}>
                    <Text style={styles.itemName}>{item.produto_descricao || item.sku}</Text>
                    <Text style={styles.itemSku}>{item.armazem_nome} · {item.tipo}</Text>
                  </View>
                  <Text style={[styles.feedQuantity, item.quantidade < 0 && styles.feedQuantityOut]}>
                    {item.quantidade > 0 ? '+' : ''}{item.quantidade}
                  </Text>
                </View>
              ))
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Metric({ value, label, accent }) {
  return (
    <View style={[styles.metric, accent && styles.metricAccent]}>
      <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  content: { padding: 24, paddingBottom: 40 },
  metrics: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  metric: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  metricAccent: { backgroundColor: '#FFF7ED', borderColor: '#FFEDD5' },
  metricValue: { color: '#0F766E', fontSize: 24, fontWeight: '800' },
  metricValueAccent: { color: '#C2410C' },
  metricLabel: { color: '#64748B', fontSize: 12, lineHeight: 16, marginTop: 4, fontWeight: '500' },
  sectionTitle: { color: '#1E293B', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  zeroItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  pressed: { opacity: 0.7 },
  zeroDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 12 },
  zeroBody: { flex: 1 },
  itemName: { color: '#1E293B', fontSize: 15, fontWeight: '700' },
  itemSku: { color: '#64748B', fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  zeroValue: { color: '#C2410C', fontWeight: '800', fontSize: 14 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 24, alignItems: 'center' },
  emptyTitle: { color: '#1E293B', fontWeight: '700', fontSize: 15 },
  emptyText: { color: '#64748B', fontSize: 14, marginTop: 4 },
  feed: { marginTop: 32, gap: 8 },
  feedItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  feedBadge: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  feedIn: { backgroundColor: '#DDF4EE' },
  feedOut: { backgroundColor: '#FEE2E2' },
  feedBadgeText: { color: '#0F766E', fontSize: 20, fontWeight: '800' },
  feedBody: { flex: 1 },
  feedQuantity: { color: '#0F766E', fontSize: 16, fontWeight: '800' },
  feedQuantityOut: { color: '#EF4444' },
});
