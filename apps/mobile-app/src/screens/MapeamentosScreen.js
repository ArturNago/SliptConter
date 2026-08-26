import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Pressable, 
  ActivityIndicator, 
  Alert,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';
import ScreenHeader from '../components/ScreenHeader';

export default function MapeamentosScreen({ navigation }) {
  const [mapeamentos, setMapeamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');

  const carregarMapeamentos = async () => {
    try {
      setLoading(true);
      const data = await api.listarMapeamentos({ busca });
      setMapeamentos(data || []);
    } catch (error) {
      Alert.alert('Erro', error.message || 'Falha ao carregar mapeamentos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      carregarMapeamentos();
    }, [busca])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    carregarMapeamentos();
  };

  const handleExcluir = (id) => {
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja remover este mapeamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removerMapeamento(id);
              carregarMapeamentos();
            } catch (error) {
              Alert.alert('Erro', error.message || 'Falha ao excluir.');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.anuncioNome} numberOfLines={2}>
          {item.nome_anuncio}
        </Text>
        
        {!!item.variacao && (
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.variacao}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.skuRow}>
          <MaterialCommunityIcons name="barcode" size={16} color="#64748b" />
          <Text style={styles.skuText}>{item.sku?.sku || item.sku_id}</Text>
        </View>
      </View>
      
      <View style={styles.cardActions}>
        <Pressable 
          style={({pressed}) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          onPress={() => navigation.navigate('MapeamentoForm', { mapeamento: item })}
        >
          <MaterialCommunityIcons name="pencil-outline" size={20} color="#0F766E" />
        </Pressable>
        <Pressable 
          style={({pressed}) => [styles.actionButton, pressed && styles.actionButtonPressed]}
          onPress={() => handleExcluir(item.id)}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por anúncio ou SKU"
            value={busca}
            onChangeText={setBusca}
            returnKeyType="search"
          />
          {busca.length > 0 && (
            <Pressable onPress={() => setBusca('')} style={styles.clearButton}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          )}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0F766E" />
        </View>
      ) : (
        <FlatList
          data={mapeamentos}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="link-variant-off" size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nenhum mapeamento</Text>
              <Text style={styles.emptyText}>
                Toque no botão + para adicionar um novo mapeamento de anúncio.
              </Text>
            </View>
          }
        />
      )}

      <Pressable 
        style={({pressed}) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => navigation.navigate('MapeamentoForm')}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#334155',
  },
  clearButton: {
    padding: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  anuncioNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  badgeContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  badge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0369a1',
  },
  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skuText: {
    fontSize: 13,
    color: '#64748b',
    marginLeft: 6,
    fontWeight: '500',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  actionButtonPressed: {
    backgroundColor: '#e2e8f0',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPressed: {
    backgroundColor: '#0d655e',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
