import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  Alert, 
  ActivityIndicator,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import api from '../services/api';

export default function MapeamentoFormScreen({ route, navigation }) {
  const mapeamento = route.params?.mapeamento;
  const isEditing = !!mapeamento?.id;
  const initialNomeAnuncio = mapeamento?.nome_anuncio || route.params?.nome_anuncio || '';
  const initialVariacao = mapeamento?.variacao || route.params?.variacao || '';

  const [nomeAnuncio, setNomeAnuncio] = useState(initialNomeAnuncio);
  const [variacao, setVariacao] = useState(initialVariacao);
  const [skuSelecionado, setSkuSelecionado] = useState(mapeamento?.sku || null);

  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [buscaSku, setBuscaSku] = useState('');
  const [skus, setSkus] = useState([]);
  const [loadingSkus, setLoadingSkus] = useState(false);

  useEffect(() => {
    if (modalVisible) {
      buscarSkus();
    }
  }, [modalVisible, buscaSku]);

  const buscarSkus = async () => {
    try {
      setLoadingSkus(true);
      const data = await api.listarProdutos({ busca: buscaSku });
      setSkus(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingSkus(false);
    }
  };

  const handleSalvar = async () => {
    if (!nomeAnuncio.trim()) {
      Alert.alert('Atenção', 'O nome do anúncio é obrigatório.');
      return;
    }
    if (!skuSelecionado) {
      Alert.alert('Atenção', 'Selecione um SKU para o mapeamento.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        nome_anuncio: nomeAnuncio.trim(),
        variacao: variacao.trim() || null,
        sku_id: skuSelecionado.id
      };

      if (isEditing) {
        await api.atualizarMapeamento(mapeamento.id, payload);
      } else {
        await api.criarMapeamento(payload);
      }
      
      Alert.alert('Sucesso', 'Mapeamento salvo com sucesso.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Erro', error.message || 'Falha ao salvar o mapeamento.');
    } finally {
      setSaving(false);
    }
  };

  const selecionarSku = (sku) => {
    setSkuSelecionado(sku);
    setModalVisible(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Nome do Anúncio *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={nomeAnuncio}
            onChangeText={setNomeAnuncio}
            placeholder="Ex: Camiseta Básica Algodão"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Variação / Cor (Opcional)</Text>
          <TextInput
            style={styles.input}
            value={variacao}
            onChangeText={setVariacao}
            placeholder="Ex: Branco, M"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>SKU do Sistema *</Text>
          <Pressable 
            style={styles.skuSelector}
            onPress={() => setModalVisible(true)}
          >
            {skuSelecionado ? (
              <View style={styles.skuSelectedInfo}>
                <Text style={styles.skuSelectedName}>{skuSelecionado.nome}</Text>
                <Text style={styles.skuSelectedCode}>{skuSelecionado.sku}</Text>
              </View>
            ) : (
              <Text style={styles.skuSelectorPlaceholder}>Toque para selecionar um SKU...</Text>
            )}
            <MaterialCommunityIcons name="chevron-down" size={24} color="#94a3b8" />
          </Pressable>
        </View>

        <Pressable 
          style={({pressed}) => [styles.saveButton, (pressed || saving) && styles.saveButtonPressed]}
          onPress={handleSalvar}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar Mapeamento</Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Selecionar SKU</Text>
            <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#64748b" />
            </Pressable>
          </View>
          
          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome ou código..."
                value={buscaSku}
                onChangeText={setBuscaSku}
              />
            </View>
          </View>

          {loadingSkus && skus.length === 0 ? (
            <ActivityIndicator size="large" color="#0F766E" style={styles.modalLoader} />
          ) : (
            <FlatList
              data={skus}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <Pressable 
                  style={styles.skuItem}
                  onPress={() => selecionarSku(item)}
                >
                  <Text style={styles.skuItemName}>{item.nome}</Text>
                  <Text style={styles.skuItemCode}>SKU: {item.sku}</Text>
                </Pressable>
              )}
              contentContainerStyle={styles.skuList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhum SKU encontrado.</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  content: {
    padding: 16,
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  skuSelector: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  skuSelectorPlaceholder: {
    fontSize: 16,
    color: '#94a3b8',
  },
  skuSelectedInfo: {
    flex: 1,
  },
  skuSelectedName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
  },
  skuSelectedCode: {
    fontSize: 13,
    color: '#64748b',
  },
  saveButton: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonPressed: {
    backgroundColor: '#0d655e',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Modal styles
  modalSafe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
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
  },
  skuList: {
    padding: 16,
  },
  skuItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  skuItemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 4,
  },
  skuItemCode: {
    fontSize: 13,
    color: '#64748b',
  },
  modalLoader: {
    marginTop: 40,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
  }
});
