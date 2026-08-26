import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import CounterStepper from '../components/CounterStepper';
import PrimaryButton from '../components/PrimaryButton';

export default function InventarioContagemScreen({ navigation, route }) {
  const [ordens, setOrdens] = useState([]);
  const [ordemSelecionada, setOrdemSelecionada] = useState(null);
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Filtros de contagem
  const [filtro, setFiltro] = useState('pendentes'); // 'todos' | 'pendentes' | 'contados'
  const [busca, setBusca] = useState('');

  // Item em edição de contagem
  const [itemEditando, setItemEditando] = useState(null);
  const [qtdDigitada, setQtdDigitada] = useState(0);

  // Câmera / Scanner
  const [cameraAberta, setCameraAberta] = useState(false);
  const [permissao, solicitarPermissao] = useCameraPermissions();
  const [escaneando, setEscaneando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      carregarOrdens();
    }, [])
  );

  const carregarOrdens = async () => {
    setLoading(true);
    try {
      const lista = await api.listarInventarios({ status: 'aberto' });
      const listaEmContagem = await api.listarInventarios({ status: 'em_contagem' });
      const unificadas = [...(lista || []), ...(listaEmContagem || [])];
      setOrdens(unificadas);
      if (route.params?.ordemId) {
        abrirOrdem(route.params.ordemId);
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar as ordens de inventário.');
    } finally {
      setLoading(false);
    }
  };

  const abrirOrdem = async (id) => {
    setLoading(true);
    try {
      // contagemCega = true garante que o operador não veja o saldo prévio do sistema
      const res = await api.buscarInventario(id, true);
      setOrdemSelecionada(res);
      setItens(res.itens || []);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os itens da ordem.');
    } finally {
      setLoading(false);
    }
  };

  const abrirCamera = async () => {
    if (!permissao?.granted) {
      const res = await solicitarPermissao();
      if (!res.granted) {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera para escanear.');
        return;
      }
    }
    setCameraAberta(true);
  };

  const onBarcodeScanned = ({ data }) => {
    if (escaneando) return;
    setEscaneando(true);

    const b = String(data).trim().toLowerCase();
    const encontrado = itens.find(
      (i) =>
        (i.sku || '').toLowerCase() === b ||
        (i.codigo_barras_ean || '').toLowerCase() === b
    );

    if (encontrado) {
      setCameraAberta(false);
      abrirModalContagem(encontrado);
    } else {
      Alert.alert('Item não encontrado', `O código "${data}" não faz parte desta ordem de inventário.`);
    }

    setTimeout(() => setEscaneando(false), 1500);
  };

  const abrirModalContagem = (item) => {
    setItemEditando(item);
    setQtdDigitada(item.quantidade_contada !== null ? item.quantidade_contada : 0);
  };

  const salvarContagem = async () => {
    if (!itemEditando || !ordemSelecionada) return;

    setSalvando(true);
    try {
      await api.registrarContagemInventario(
        ordemSelecionada.id,
        itemEditando.sku_id,
        qtdDigitada
      );

      // Atualiza estado local
      setItens((prev) =>
        prev.map((it) =>
          it.id === itemEditando.id
            ? { ...it, quantidade_contada: qtdDigitada, contado_at: new Date().toISOString() }
            : it
        )
      );

      setItemEditando(null);
    } catch (err) {
      Alert.alert('Erro ao salvar', err.response?.data?.erro || 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const itensFiltrados = itens.filter((it) => {
    const contado = it.quantidade_contada !== null;
    if (filtro === 'pendentes' && contado) return false;
    if (filtro === 'contados' && !contado) return false;
    if (busca) {
      const b = busca.toLowerCase();
      return (
        it.sku.toLowerCase().includes(b) ||
        it.sku_descricao.toLowerCase().includes(b) ||
        (it.codigo_barras_ean || '').toLowerCase().includes(b)
      );
    }
    return true;
  });

  const totalContados = itens.filter((it) => it.quantidade_contada !== null).length;

  // Tela 1: Selecionar Ordem de Inventário
  if (!ordemSelecionada) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#0F766E" />
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>Inventários Cíclicos</Text>
            <Text style={styles.headerSubtitle}>Ordens de Contagem Cega (PCP)</Text>
          </View>
        </View>

        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator size="large" color="#0F766E" style={{ marginTop: 40 }} />
          ) : ordens.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Nenhuma ordem aberta</Text>
              <Text style={styles.emptySubtitle}>
                O setor de PCP criará novas ordens de contagem para o galpão.
              </Text>
            </View>
          ) : (
            <FlatList
              data={ordens}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={({ item }) => (
                <Pressable style={styles.ordemCard} onPress={() => abrirOrdem(item.id)}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.ordemHeader}>
                      <Text style={styles.ordemCodigo}>{item.codigo}</Text>
                      <View style={styles.tagStatus}>
                        <Text style={styles.tagStatusText}>{item.status.replace('_', ' ')}</Text>
                      </View>
                    </View>
                    <Text style={styles.ordemDescricao}>{item.descricao}</Text>
                    <Text style={styles.ordemArmazem}>📍 Armazém: {item.armazem_nome}</Text>
                    <Text style={styles.ordemMeta}>
                      📦 Progresso: {item.itens_contados} de {item.total_itens} itens
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#0F766E" />
                </Pressable>
              )}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Tela 2: Contagem Cega da Ordem Selecionada
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => setOrdemSelecionada(null)} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#0F766E" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{ordemSelecionada.codigo}</Text>
          <Text style={styles.headerSubtitle}>
            {ordemSelecionada.armazem_nome} · Contagem Cega
          </Text>
        </View>
        <Pressable style={styles.scanHeaderButton} onPress={abrirCamera}>
          <MaterialCommunityIcons name="barcode-scan" size={22} color="#fff" />
          <Text style={styles.scanHeaderText}>Bipar</Text>
        </Pressable>
      </View>

      {/* Progresso Card */}
      <View style={styles.progressCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.progressLabel}>Itens Contados no Galpão</Text>
          <Text style={styles.progressValue}>
            {totalContados} / {itens.length}
          </Text>
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${itens.length > 0 ? (totalContados / itens.length) * 100 : 0}%` },
            ]}
          />
        </View>
      </View>

      {/* Barra de Busca & Filtros */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar SKU ou Código de Barras..."
          placeholderTextColor="#94a3b8"
          value={busca}
          onChangeText={setBusca}
        />
        <View style={styles.filterTabs}>
          {[
            { id: 'pendentes', label: 'Pendentes' },
            { id: 'contados', label: 'Já Contados' },
            { id: 'todos', label: 'Todos' },
          ].map((tab) => (
            <Pressable
              key={tab.id}
              style={[styles.filterTab, filtro === tab.id && styles.filterTabActive]}
              onPress={() => setFiltro(tab.id)}
            >
              <Text style={[styles.filterTabText, filtro === tab.id && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Lista de Itens */}
      <FlatList
        data={itensFiltrados}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => {
          const contado = item.quantidade_contada !== null;
          return (
            <Pressable style={styles.itemCard} onPress={() => abrirModalContagem(item)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemSku}>{item.sku}</Text>
                <Text style={styles.itemDescricao}>{item.sku_descricao}</Text>
                {!!item.codigo_barras_ean && (
                  <Text style={styles.itemEan}>EAN: {item.codigo_barras_ean}</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                {contado ? (
                  <View style={styles.badgeContado}>
                    <MaterialCommunityIcons name="check" size={14} color="#10b981" />
                    <Text style={styles.badgeContadoText}>{item.quantidade_contada} un</Text>
                  </View>
                ) : (
                  <View style={styles.badgePendente}>
                    <Text style={styles.badgePendenteText}>Contar</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Modal Lançar Contagem Física */}
      {itemEditando && (
        <Modal
          visible={!!itemEditando}
          transparent
          animationType="fade"
          onRequestClose={() => setItemEditando(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBody}>
              <Text style={styles.modalTitle}>Informar Contagem Física</Text>
              <Text style={styles.modalSubtitle}>{itemEditando.sku_descricao}</Text>
              <Text style={styles.modalSku}>SKU: {itemEditando.sku}</Text>

              <View style={{ marginVertical: 20 }}>
                <CounterStepper
                  label="Quantidade Física Contada"
                  value={qtdDigitada}
                  onIncrement={() => setQtdDigitada((v) => v + 1)}
                  onDecrement={() => setQtdDigitada((v) => Math.max(0, v - 1))}
                  min={0}
                />
              </View>

              <View style={{ gap: 10 }}>
                <PrimaryButton
                  label="Salvar Contagem"
                  onPress={salvarContagem}
                  loading={salvando}
                />
                <PrimaryButton
                  label="Cancelar"
                  variant="secondary"
                  onPress={() => setItemEditando(null)}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal Câmera Scanner */}
      <Modal
        visible={cameraAberta}
        animationType="slide"
        onRequestClose={() => setCameraAberta(false)}
      >
        <View style={styles.cameraModal}>
          <Text style={styles.cameraTitle}>Aponte para o código de barras ou SKU</Text>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'code128', 'code39'],
            }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={{ padding: 16 }}>
            <PrimaryButton
              label="Fechar Câmera"
              variant="secondary"
              onPress={() => setCameraAberta(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: { marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  headerSubtitle: { fontSize: 13, color: '#64748b' },
  scanHeaderButton: {
    backgroundColor: '#0F766E',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  scanHeaderText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  content: { flex: 1 },
  progressCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  progressLabel: { fontSize: 13, fontWeight: '600', color: '#334155' },
  progressValue: { fontSize: 14, fontWeight: '800', color: '#0F766E' },
  progressBarBg: { height: 8, backgroundColor: '#f1f5f9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#0F766E' },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  filterTabs: { flexDirection: 'row', gap: 8, marginTop: 10 },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
  },
  filterTabActive: { backgroundColor: '#0F766E' },
  filterTabText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  filterTabTextActive: { color: '#fff' },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  itemSku: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
  itemDescricao: { fontSize: 13, color: '#475569', marginTop: 2 },
  itemEan: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  badgeContado: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  badgeContadoText: { color: '#10b981', fontWeight: '800', fontSize: 13 },
  badgePendente: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgePendenteText: { color: '#0F766E', fontWeight: '700', fontSize: 13 },
  ordemCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  ordemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ordemCodigo: { fontSize: 16, fontWeight: '800', color: '#0F766E' },
  tagStatus: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  tagStatusText: { color: '#92400e', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  ordemDescricao: { fontSize: 14, fontWeight: '600', color: '#1e293b', marginTop: 4 },
  ordemArmazem: { fontSize: 12, color: '#64748b', marginTop: 4 },
  ordemMeta: { fontSize: 12, color: '#0F766E', fontWeight: '600', marginTop: 2 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBody: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', textAlign: 'center' },
  modalSubtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 4 },
  modalSku: { fontSize: 14, fontWeight: '700', color: '#0F766E', textAlign: 'center', marginTop: 2 },
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 50,
    paddingBottom: 16,
  },
  camera: { flex: 1 },
});
