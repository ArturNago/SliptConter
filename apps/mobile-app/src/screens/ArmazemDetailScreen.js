import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import PrimaryButton from '../components/PrimaryButton';
import api from '../services/api';

function podeAdministrar(usuario) {
  return usuario?.papel === 'gestor' || usuario?.papel === 'admin';
}

export default function ArmazemDetailScreen({ route, navigation }) {
  const { armazem } = route.params;
  const [estoque, setEstoque] = useState([]);
  const [busca, setBusca] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [{ usuario: sessao }, itens] = await Promise.all([
        api.obterSessao(),
        api.buscarEstoqueArmazem(armazem.id),
      ]);
      setUsuario(sessao);
      setEstoque(itens);
    } catch (err) {
      Alert.alert('Erro ao carregar estoque', err?.response?.data?.erro || 'Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }, [armazem.id]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const filtrados = estoque.filter((item) => {
    const termo = busca.trim().toLowerCase();
    return !termo || item.descricao.toLowerCase().includes(termo) || item.sku.toLowerCase().includes(termo);
  });
  const totalItens = estoque.reduce((total, item) => total + Number(item.saldo || 0), 0);

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filtrados}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} tintColor="#0F766E" />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <Pressable onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>‹ Armazéns</Text></Pressable>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Text style={styles.eyebrow}>ESTOQUE ATUAL</Text>
                <Text style={styles.title}>{armazem.nome}</Text>
                <Text style={styles.subtitle}>{armazem.codigo || 'Local sem código'} · {totalItens} unidade{totalItens === 1 ? '' : 's'}</Text>
              </View>
              <View style={styles.headerIcon}><Text style={styles.headerIconText}>⌂</Text></View>
            </View>
            <PrimaryButton label="+ Lançar contagem" onPress={() => navigation.navigate('LancarContagem', { armazem })} />
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar por nome ou SKU" placeholderTextColor="#91A19D" style={styles.searchInput} />
              {busca ? <Pressable onPress={() => setBusca('')}><Text style={styles.clear}>×</Text></Pressable> : null}
            </View>
            <View style={styles.listHeader}><Text style={styles.sectionTitle}>Produtos</Text><Text style={styles.count}>{filtrados.length} item(ns)</Text></View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{busca ? 'Nenhum produto encontrado' : 'Catálogo vazio'}</Text>
            <Text style={styles.emptyText}>{busca ? 'Tente outro nome ou SKU.' : 'Cadastre produtos para acompanhar este armazém.'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={({ pressed }) => [styles.product, pressed && styles.pressed]} onPress={() => navigation.navigate('ProdutoDetail', { armazem, produto: item })}>
            <View style={[styles.stockDot, Number(item.saldo) > 0 ? styles.stockDotPositive : styles.stockDotEmpty]} />
            <View style={styles.productBody}>
              <Text style={styles.productName}>{item.descricao}</Text>
              <Text style={styles.productSku}>{item.sku}{item.categoria ? ` · ${item.categoria}` : ''}</Text>
              <Text style={styles.productHint}>Toque para ver detalhes</Text>
            </View>
            <View style={styles.stockValue}><Text style={[styles.stockNumber, Number(item.saldo) === 0 && styles.stockNumberEmpty]}>{item.saldo}</Text><Text style={styles.stockLabel}>un.</Text></View>
          </Pressable>
        )}
        ListFooterComponent={null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  content: { padding: 20, paddingBottom: 32, gap: 10 },
  back: { paddingVertical: 3, marginBottom: 18 },
  backText: { color: '#0F766E', fontSize: 15, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  headerText: { flex: 1 },
  eyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#12312D', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#71837F', fontSize: 14, marginTop: 5 },
  headerIcon: { backgroundColor: '#DDF4EE', width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { color: '#0F766E', fontSize: 29 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DFE9E6', paddingHorizontal: 13, marginTop: 16, minHeight: 52 },
  searchIcon: { color: '#0F766E', fontSize: 24, marginRight: 8 },
  searchInput: { flex: 1, color: '#173B35', fontSize: 15 },
  clear: { color: '#82938F', fontSize: 25, paddingHorizontal: 4 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, marginBottom: 3 },
  sectionTitle: { color: '#173B35', fontSize: 18, fontWeight: '800' },
  count: { color: '#82938F', fontSize: 13, alignSelf: 'center' },
  product: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E3ECE9' },
  pressed: { opacity: 0.75 },
  stockDot: { width: 9, height: 9, borderRadius: 5, marginRight: 12 },
  stockDotPositive: { backgroundColor: '#18A77C' },
  stockDotEmpty: { backgroundColor: '#D5DEDB' },
  productBody: { flex: 1 },
  productName: { color: '#173B35', fontSize: 15, fontWeight: '800' },
  productSku: { color: '#82938F', fontSize: 12, marginTop: 4 },
  productHint: { color: '#0F766E', fontSize: 11, marginTop: 4 },
  stockValue: { alignItems: 'flex-end', minWidth: 48 },
  stockNumber: { color: '#0F766E', fontSize: 22, fontWeight: '800' },
  stockNumberEmpty: { color: '#9AA9A5' },
  stockLabel: { color: '#82938F', fontSize: 11 },
  empty: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 26, alignItems: 'center', borderWidth: 1, borderColor: '#E3ECE9' },
  emptyTitle: { color: '#173B35', fontSize: 16, fontWeight: '800' },
  emptyText: { color: '#82938F', fontSize: 14, marginTop: 6, textAlign: 'center' },
});
