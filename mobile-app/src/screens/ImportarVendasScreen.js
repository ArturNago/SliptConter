import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ActivityIndicator, 
  Alert,
  FlatList,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import api from '../services/api';
import ScreenHeader from '../components/ScreenHeader';

export default function ImportarVendasScreen({ navigation }) {
  const [arquivo, setArquivo] = useState(null);
  const [armazens, setArmazens] = useState([]);
  const [armazemIdSelecionado, setArmazemIdSelecionado] = useState(null);
  
  const [loadingArmazens, setLoadingArmazens] = useState(true);
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState(null);

  useFocusEffect(
    useCallback(() => {
      carregarArmazens();
    }, [])
  );

  const carregarArmazens = async () => {
    try {
      setLoadingArmazens(true);
      const data = await api.listarArmazens();
      setArmazens(data || []);
      if (data?.length > 0 && !armazemIdSelecionado) {
        setArmazemIdSelecionado(data[0].id);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar a lista de armazéns.');
    } finally {
      setLoadingArmazens(false);
    }
  };

  const selecionarArquivo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setArquivo(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Erro', 'Falha ao selecionar o arquivo.');
    }
  };

  const selecionarArmazem = (id) => {
    setArmazemIdSelecionado(id);
  };

  const handleImportar = async () => {
    if (!arquivo) return;
    if (!armazemIdSelecionado) {
      Alert.alert('Aviso', 'Selecione o armazém de saída.');
      return;
    }

    try {
      setImporting(true);
      const data = await api.importarVendas(arquivo.uri, arquivo.name, [armazemIdSelecionado]);
      setResultado(data);
    } catch (error) {
      Alert.alert('Erro', error.message || 'Falha na importação.');
    } finally {
      setImporting(false);
    }
  };

  const renderResultado = () => {
    if (!resultado) return null;
    
    const { processados = 0, naoMapeados = [], erros = [] } = resultado;
    
    return (
      <ScrollView style={styles.resultadoContainer}>
        <View style={styles.resumoCard}>
          <Text style={styles.resumoTitle}>Resultado da Importação</Text>
          <View style={styles.resumoItem}>
            <MaterialCommunityIcons name="check-circle-outline" size={20} color="#10b981" />
            <Text style={styles.resumoText}>{processados} pedidos processados</Text>
          </View>
          <View style={styles.resumoItem}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#f59e0b" />
            <Text style={styles.resumoText}>{naoMapeados.length} não mapeados</Text>
          </View>
          <View style={styles.resumoItem}>
            <MaterialCommunityIcons name="close-circle-outline" size={20} color="#ef4444" />
            <Text style={styles.resumoText}>{erros.length} erros</Text>
          </View>
        </View>

        {naoMapeados.length > 0 && (
          <View style={styles.naoMapeadosContainer}>
            <Text style={styles.sectionTitle}>Não Mapeados ({naoMapeados.length})</Text>
            {naoMapeados.map((item, idx) => (
              <View key={idx} style={styles.naoMapeadoCard}>
                <View style={styles.naoMapeadoInfo}>
                  <Text style={styles.anuncioNome} numberOfLines={2}>{item.nome_anuncio}</Text>
                  {!!item.variacao && (
                    <Text style={styles.anuncioVariacao}>Variação: {item.variacao}</Text>
                  )}
                </View>
                <Pressable
                  style={styles.mapearButton}
                  onPress={() => navigation.navigate('MapeamentoForm', { 
                    nome_anuncio: item.nome_anuncio, 
                    variacao: item.variacao 
                  })}
                >
                  <Text style={styles.mapearButtonText}>Cadastrar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {erros.length > 0 && (
          <View style={styles.errosContainer}>
            <Text style={styles.sectionTitle}>Erros ({erros.length})</Text>
            {erros.map((erro, idx) => (
              <View key={idx} style={styles.erroCard}>
                <Text style={styles.erroText}>{erro}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable 
          style={styles.resetButton}
          onPress={() => {
            setResultado(null);
            setArquivo(null);
            setArmazemIdsSelecionados([]);
          }}
        >
          <Text style={styles.resetButtonText}>Nova Importação</Text>
        </Pressable>
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  const isButtonDisabled = !arquivo || armazemIdsSelecionados.length === 0 || importing;

  if (resultado) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {renderResultado()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>1. Selecionar Arquivo</Text>
        <Pressable style={styles.uploadCard} onPress={selecionarArquivo}>
          <View style={styles.uploadIconContainer}>
            <MaterialCommunityIcons 
              name={arquivo ? "file-excel" : "upload"} 
              size={32} 
              color={arquivo ? "#10b981" : "#0F766E"} 
            />
          </View>
          <View style={styles.uploadInfo}>
            {arquivo ? (
              <>
                <Text style={styles.uploadTitle}>{arquivo.name}</Text>
                <Text style={styles.uploadSubtitle}>Toque para alterar o arquivo</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadTitle}>Selecionar Planilha .xlsx</Text>
                <Text style={styles.uploadSubtitle}>Toque para buscar no seu dispositivo</Text>
              </>
            )}
          </View>
        </Pressable>

        <Text style={styles.sectionTitle}>2. Selecionar Armazém de Saída</Text>
        <Text style={styles.sectionSubtitle}>
          Os pedidos darão baixa de estoque no armazém selecionado
        </Text>
        
        {loadingArmazens ? (
          <ActivityIndicator size="small" color="#0F766E" style={{ marginVertical: 20 }} />
        ) : (
          <View style={styles.armazensCard}>
            {armazens.map((armazem, idx) => {
              const isSelected = armazemIdSelecionado === armazem.id;
              return (
                <Pressable 
                  key={armazem.id}
                  style={[
                    styles.armazemItem,
                    idx !== armazens.length - 1 && styles.armazemItemBorder,
                    isSelected && { backgroundColor: '#f0fdfa' }
                  ]}
                  onPress={() => selecionarArmazem(armazem.id)}
                >
                  <MaterialCommunityIcons 
                    name={isSelected ? "radiobox-marked" : "radiobox-blank"} 
                    size={24} 
                    color={isSelected ? "#0F766E" : "#cbd5e1"} 
                  />
                  <Text style={[styles.armazemName, isSelected && { fontWeight: '700', color: '#0F766E' }]}>
                    {armazem.nome}
                  </Text>
                </Pressable>
              );
            })}
            {armazens.length === 0 && (
              <Text style={styles.emptyText}>Nenhum armazém encontrado.</Text>
            )}
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <Pressable 
          style={({pressed}) => [
            styles.importButton, 
            (!arquivo || !armazemIdSelecionado || importing) && styles.importButtonDisabled,
            pressed && (!arquivo || !armazemIdSelecionado || importing) && styles.importButtonPressed
          ]}
          onPress={handleImportar}
          disabled={!arquivo || !armazemIdSelecionado || importing}
        >
          {importing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importButtonText}>Importar Vendas</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    marginTop: -4,
  },
  uploadCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  uploadInfo: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  armazensCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  armazemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  armazemItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  armazemName: {
    fontSize: 15,
    color: '#334155',
    marginLeft: 12,
  },
  emptyText: {
    padding: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  importButton: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonPressed: {
    backgroundColor: '#0d655e',
  },
  importButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  // Resultado styles
  resultadoContainer: {
    padding: 20,
  },
  resumoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  resumoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  resumoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resumoText: {
    fontSize: 15,
    color: '#334155',
    marginLeft: 12,
    fontWeight: '500',
  },
  naoMapeadosContainer: {
    marginBottom: 20,
  },
  naoMapeadoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  naoMapeadoInfo: {
    flex: 1,
    marginRight: 12,
  },
  anuncioNome: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  anuncioVariacao: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  mapearButton: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  mapearButtonText: {
    color: '#0369a1',
    fontSize: 13,
    fontWeight: '600',
  },
  errosContainer: {
    marginBottom: 20,
  },
  erroCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  erroText: {
    color: '#991b1b',
    fontSize: 13,
  },
  resetButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  resetButtonText: {
    color: '#0F766E',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
