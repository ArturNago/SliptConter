import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import ProductListItem from '../components/ProductListItem';
import EmptyState from '../components/EmptyState';
import usePermissao from '../hooks/usePermissao';
import useSaldoProdutos from '../hooks/useSaldoProdutos';

export default function ProdutosScreen({ navigation }) {
  const { isGestor } = usePermissao();
  const { produtos, carregando, erro, recarregar } = useSaldoProdutos();
  
  const [busca, setBusca] = useState('');
  const [filtroEstoque, setFiltroEstoque] = useState('todos'); // 'todos' | 'com_estoque' | 'zerados'

  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      // Filtro de texto
      const termo = busca.toLowerCase();
      const matchTexto = 
        p.descricao?.toLowerCase().includes(termo) || 
        p.sku?.toLowerCase().includes(termo) ||
        p.categoria?.toLowerCase().includes(termo);
      
      if (!matchTexto) return false;

      // Filtro de estoque
      if (filtroEstoque === 'com_estoque') return p.saldoTotal > 0;
      if (filtroEstoque === 'zerados') return p.saldoTotal <= 0;
      return true;
    });
  }, [produtos, busca, filtroEstoque]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader 
        title="Produtos" 
        subtitle="Gerencie o catálogo e consulte saldos"
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, SKU ou categoria..."
            placeholderTextColor="#94a3b8"
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <Pressable onPress={() => setBusca('')} style={styles.clearSearch}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#cbd5e1" />
            </Pressable>
          )}
        </View>
        
        <View style={styles.filterChips}>
          <Pressable 
            style={[styles.chip, filtroEstoque === 'todos' && styles.chipActive]}
            onPress={() => setFiltroEstoque('todos')}
          >
            <Text style={[styles.chipText, filtroEstoque === 'todos' && styles.chipTextActive]}>Todos</Text>
          </Pressable>
          <Pressable 
            style={[styles.chip, filtroEstoque === 'com_estoque' && styles.chipActive]}
            onPress={() => setFiltroEstoque('com_estoque')}
          >
            <Text style={[styles.chipText, filtroEstoque === 'com_estoque' && styles.chipTextActive]}>Com estoque</Text>
          </Pressable>
          <Pressable 
            style={[styles.chip, filtroEstoque === 'zerados' && styles.chipActive]}
            onPress={() => setFiltroEstoque('zerados')}
          >
            <Text style={[styles.chipText, filtroEstoque === 'zerados' && styles.chipTextActive]}>Zerados</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={produtosFiltrados}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={recarregar} tintColor="#0F766E" />}
        ListEmptyComponent={
          carregando ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#0F766E" />
            </View>
          ) : erro ? (
            <EmptyState 
              icon="alert-circle-outline" 
              title="Erro ao carregar" 
              message={erro} 
            />
          ) : (
            <EmptyState 
              icon="package-variant" 
              title={busca ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"} 
              message={busca ? "Tente alterar os filtros ou a busca" : "Cadastre seu primeiro produto usando o botão abaixo"} 
            />
          )
        }
        renderItem={({ item }) => (
          <ProductListItem 
            produto={item} 
            onPress={() => navigation.navigate('ProdutoDetail', { produto: item })}
            saldoComponent={
              <View style={[styles.saldoBadge, item.saldoTotal <= 0 && styles.saldoBadgeZerado]}>
                <Text style={[styles.saldoText, item.saldoTotal <= 0 && styles.saldoTextZerado]}>
                  {item.saldoTotal} un
                </Text>
              </View>
            }
          />
        )}
      />

      {isGestor && (
        <Pressable 
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          onPress={() => navigation.navigate('ProdutoForm')}
        >
          <MaterialCommunityIcons name="plus" size={28} color="#fff" />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  searchContainer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#0f172a',
    height: '100%',
  },
  clearSearch: {
    padding: 4,
  },
  filterChips: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#E1F4EF',
    borderColor: '#0F766E',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  chipTextActive: {
    color: '#0F766E',
  },
  listContent: {
    paddingVertical: 16,
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  saldoBadge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  saldoBadgeZerado: {
    backgroundColor: '#f1f5f9',
  },
  saldoText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  saldoTextZerado: {
    color: '#64748b',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F766E',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#0d655e',
  },
});
