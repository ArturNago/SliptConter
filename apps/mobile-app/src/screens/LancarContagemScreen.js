import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Pressable, Alert, Modal, Image, ScrollView } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import CounterStepper from '../components/CounterStepper';
import PrimaryButton from '../components/PrimaryButton';
import usePermissao from '../hooks/usePermissao';
import api from '../services/api';
import localDb from '../services/localDb';

const TIPOS = [
  { value: 'entrada', label: 'Entrada', hint: 'Adicionar ao estoque' },
  { value: 'saida', label: 'Saída', hint: 'Remover do estoque' },
  { value: 'ajuste', label: 'Ajuste', hint: 'Definir o saldo real (contagem de inventário)' },
];

export default function LancarContagemScreen({ route, navigation }) {
  const { armazem } = route.params;
  const { isGestor } = usePermissao();
  const [resultados, setResultados] = useState([]);
  const [produto, setProduto] = useState(route.params.produto || null);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('entrada');
  const [quantidade, setQuantidade] = useState(1);
  const [imagemUri, setImagemUri] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const [cameraMode, setCameraMode] = useState('foto');
  const [buscandoSku, setBuscandoSku] = useState(false);
  const [permissao, solicitarPermissao] = useCameraPermissions();
  const [analisandoIa, setAnalisandoIa] = useState(false);
  const cameraRef = useRef(null);

  // Busca server-side com debounce: evita baixar o catálogo inteiro.
  useEffect(() => {
    let ativo = true;
    const termo = busca.trim();
    setBuscando(true);
    const handle = setTimeout(() => {
      api.listarProdutos({ busca: termo, limit: 8 })
        .then((lista) => { if (ativo) setResultados(lista); })
        .catch(() => { if (ativo) setResultados([]); })
        .finally(() => { if (ativo) setBuscando(false); });
    }, 350);
    return () => { ativo = false; clearTimeout(handle); };
  }, [busca]);

  useEffect(() => {
    if (route.params?.produto) setProduto(route.params.produto);
  }, [route.params?.produto]);

  async function abrirCamera(mode) {
    if (mode === 'foto' && !produto) {
      Alert.alert('Selecione um produto', 'Selecione ou bipe um produto antes de fotografar a pilha.');
      return;
    }
    if (!permissao?.granted) {
      const resultado = await solicitarPermissao();
      if (!resultado.granted) {
        Alert.alert('Permissão necessária', 'Permita o uso da câmera para continuar.');
        return;
      }
    }
    setCameraMode(mode);
    setCameraAberta(true);
  }

  async function onBarcodeScanned({ data }) {
    if (buscandoSku) return;
    setBuscandoSku(true);
    try {
      const encontrado = await api.buscarProdutoPorSku(data);
      setProduto(encontrado);
      setBusca('');
      setCameraAberta(false);
    } catch {
      Alert.alert('Produto não encontrado', `Nenhum produto cadastrado para o código "${data}".`);
    } finally {
      setBuscandoSku(false);
    }
  }

  async function tirarFoto() {
    if (!cameraRef.current) return;
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.75 });
      setImagemUri(foto.uri);
      setCameraAberta(false);

      // V1: chama IA para sugestão de contagem após capturar foto
      await analisarComIA(foto.uri);
    } catch {
      Alert.alert('Erro na foto', 'Não foi possível capturar a foto.');
    }
  }

  async function analisarComIA(uri) {
    setAnalisandoIa(true);
    try {
      const sugestao = await api.solicitarSugestaoIA(uri);

      if (sugestao?.disponivel) {
        // Navega para tela de revisão com dados da IA
        navigation.navigate('ContagemIAReview', {
          imagemUri: uri,
          caixas: sugestao.caixas || [],
          caixasPorCamada: sugestao.caixasPorCamada || 0,
          confianca: sugestao.confianca || 0,
          skuId: produto?.id,
          armazemId: armazem.id,
          produto,
          volumesPorCamada: produto?.volumesPorCamada,
          camadasMaximasPalete: produto?.camadasMaximasPalete,
          tipoMovimentacao: tipo,
        });
      }
      // Se disponivel:false, permanece no fluxo manual (sem erro)
    } catch {
      // IA indisponível: segue no fluxo manual silenciosamente
    } finally {
      setAnalisandoIa(false);
    }
  }

  async function confirmar() {
    if (!produto) {
      Alert.alert('Escolha um produto', 'Selecione um produto antes de confirmar.');
      return;
    }
    if (quantidade < 1) {
      Alert.alert('Quantidade inválida', 'Informe pelo menos uma unidade.');
      return;
    }

    setConfirmando(true);
    const dados = {
      imagemUri,
      skuId: produto.id,
      produtoSku: produto.sku,
      armazemId: armazem.id,
      quantidadeContada: quantidade,
      quantidadeSugeridaIa: null,
      ajusteManual: 0,
      origem: 'manual',
      tipoMovimentacao: tipo,
    };

    try {
      await api.criarConferencia(dados);
      Alert.alert('Estoque atualizado', `${quantidade} unidade${quantidade === 1 ? '' : 's'} registrada${quantidade === 1 ? '' : 's'} em ${armazem.nome}.`);
      navigation.goBack();
    } catch (err) {
      if (err.response) {
        Alert.alert('Não foi possível registrar', err.response.data?.erro || 'Revise os dados e tente novamente.');
      } else {
        await localDb.inserirPendente(dados);
        Alert.alert('Salvo offline', 'Sem conexão agora. O lançamento foi salvo e será sincronizado automaticamente.');
        navigation.goBack();
      }
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => navigation.goBack()} style={styles.back}><Text style={styles.backText}>‹ {armazem.nome}</Text></Pressable>
        <Text style={styles.eyebrow}>LANÇAMENTO MANUAL</Text>
        <Text style={styles.title}>Atualizar estoque</Text>
        <Text style={styles.subtitle}>Registre uma entrada, saída ou ajuste direto em unidades.</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>1. Produto</Text><Text style={styles.required}>Obrigatório</Text></View>
          {produto ? (
            <View style={styles.selectedProduct}>
              <View style={styles.selectedDot} />
              <View style={styles.selectedBody}><Text style={styles.selectedName}>{produto.descricao}</Text><Text style={styles.selectedSku}>{produto.sku}</Text></View>
              <Pressable onPress={() => setProduto(null)}><Text style={styles.change}>Trocar</Text></Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.searchRow}>
                <TextInput value={busca} onChangeText={setBusca} placeholder="Buscar nome ou SKU" placeholderTextColor="#91A19D" style={styles.searchInput} />
                <Pressable style={styles.scanButton} onPress={() => abrirCamera('sku')}><Text style={styles.scanText}>Bipar</Text></Pressable>
              </View>
              {buscando ? <Text style={styles.helper}>Buscando produtos...</Text> : null}
              {!buscando && resultados.length === 0 ? <Text style={styles.helper}>Nenhum produto encontrado.</Text> : null}
              <FlatList data={resultados} scrollEnabled={false} keyExtractor={(item) => item.id} renderItem={({ item }) => (
                <Pressable style={styles.productOption} onPress={() => setProduto(item)}><View style={styles.optionDot} /><View><Text style={styles.optionName}>{item.descricao}</Text><Text style={styles.optionSku}>{item.sku}</Text></View></Pressable>
              )} />
              {isGestor && (
                <Pressable style={styles.registerLink} onPress={() => navigation.navigate('ProdutoForm', { armazem })}>
                  <Text style={styles.registerText}>+ Cadastrar produto agora</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>2. Tipo de operação</Text></View>
          <View style={styles.segmented}>
            {TIPOS.map((item) => <Pressable key={item.value} style={[styles.segment, tipo === item.value && styles.segmentActive]} onPress={() => setTipo(item.value)}><Text style={[styles.segmentLabel, tipo === item.value && styles.segmentLabelActive]}>{item.label}</Text></Pressable>)}
          </View>
          <Text style={styles.operationHint}>{TIPOS.find((item) => item.value === tipo)?.hint}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>3. Quantidade</Text><Text style={styles.unit}>unidades</Text></View>
          <CounterStepper label="Use os botões para ajustar" value={quantidade} onIncrement={() => setQuantidade((value) => value + 1)} onDecrement={() => setQuantidade((value) => Math.max(value - 1, 1))} min={1} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>4. Evidência</Text><Text style={styles.optional}>Opcional</Text></View>
          {analisandoIa ? (
            <View style={styles.analyzingContainer}>
              <Text style={styles.analyzingText}>Analisando imagem com IA...</Text>
            </View>
          ) : imagemUri ? (
            <View style={styles.photoPreview}><Image source={{ uri: imagemUri }} style={styles.photo} /><Pressable onPress={() => setImagemUri(null)}><Text style={styles.removePhoto}>Remover foto</Text></Pressable></View>
          ) : (
            <Pressable style={styles.photoButton} onPress={() => abrirCamera('foto')}><Text style={styles.photoIcon}>+</Text><View><Text style={styles.photoTitle}>Adicionar foto</Text><Text style={styles.photoHint}>Ajuda na auditoria do lançamento</Text></View></Pressable>
          )}
        </View>

        <View style={styles.summary}><Text style={styles.summaryLabel}>{tipo === 'saida' ? 'Removendo do' : tipo === 'ajuste' ? 'Definindo saldo em' : 'Adicionando ao'} armazém</Text><Text style={styles.summaryValue}>{quantidade} unidade{quantidade === 1 ? '' : 's'}</Text><Text style={styles.summaryWarehouse}>{armazem.nome}</Text></View>
        <PrimaryButton label="Confirmar lançamento" onPress={confirmar} loading={confirmando} disabled={!produto} />
      </ScrollView>

      <Modal visible={cameraAberta} animationType="slide" onRequestClose={() => setCameraAberta(false)}>
        <View style={styles.cameraModal}>
          <Text style={styles.cameraTitle}>{cameraMode === 'sku' ? 'Bipe o código do produto' : 'Fotografe o produto'}</Text>
          <CameraView ref={cameraRef} style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128', 'code39'] }} onBarcodeScanned={cameraMode === 'sku' && !buscandoSku ? onBarcodeScanned : undefined} />
          <View style={styles.cameraActions}>{cameraMode === 'foto' ? <PrimaryButton label="Capturar foto" onPress={tirarFoto} /> : null}<PrimaryButton label="Cancelar" variant="secondary" onPress={() => setCameraAberta(false)} /></View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  content: { padding: 20, paddingBottom: 32, gap: 13 },
  back: { paddingVertical: 3, marginBottom: 3 },
  backText: { color: '#0F766E', fontSize: 15, fontWeight: '700' },
  eyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 4 },
  title: { color: '#12312D', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#71837F', fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 8 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#E1EBE8' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#173B35', fontSize: 16, fontWeight: '800' },
  required: { color: '#0F766E', fontSize: 11, fontWeight: '700' },
  optional: { color: '#91A19D', fontSize: 11, fontWeight: '700' },
  unit: { color: '#82938F', fontSize: 12 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#F5F8F7', borderRadius: 12, borderWidth: 1, borderColor: '#E0EAE7', paddingHorizontal: 13, color: '#173B35', minHeight: 48 },
  scanButton: { backgroundColor: '#DDF4EE', borderRadius: 12, minWidth: 62, alignItems: 'center', justifyContent: 'center' },
  scanText: { color: '#0F766E', fontWeight: '800', fontSize: 13 },
  helper: { color: '#82938F', fontSize: 13, paddingVertical: 14 },
  productOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF3F1' },
  optionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#A6C8BF', marginRight: 10 },
  optionName: { color: '#25463F', fontSize: 14, fontWeight: '700' },
  optionSku: { color: '#91A19D', fontSize: 12, marginTop: 2 },
  registerLink: { paddingVertical: 13 },
  registerText: { color: '#0F766E', fontSize: 13, fontWeight: '800' },
  selectedProduct: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF9F6', borderRadius: 12, padding: 12 },
  selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#18A77C', marginRight: 10 },
  selectedBody: { flex: 1 },
  selectedName: { color: '#173B35', fontWeight: '800', fontSize: 14 },
  selectedSku: { color: '#71837F', fontSize: 12, marginTop: 3 },
  change: { color: '#0F766E', fontWeight: '800', fontSize: 12 },
  segmented: { flexDirection: 'row', backgroundColor: '#F1F5F3', borderRadius: 12, padding: 3 },
  segment: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  segmentActive: { backgroundColor: '#0F766E' },
  segmentLabel: { color: '#6F817D', fontSize: 12, fontWeight: '800' },
  segmentLabelActive: { color: '#FFFFFF' },
  operationHint: { color: '#82938F', fontSize: 12, textAlign: 'center', marginTop: 8 },
  photoButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#A9C8C0', borderRadius: 12, padding: 12 },
  photoIcon: { color: '#0F766E', fontSize: 25, marginRight: 12 },
  photoTitle: { color: '#25463F', fontWeight: '800', fontSize: 14 },
  photoHint: { color: '#82938F', fontSize: 12, marginTop: 3 },
  photoPreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 76, height: 60, borderRadius: 10, backgroundColor: '#E7EFEC' },
  removePhoto: { color: '#B45353', fontSize: 13, fontWeight: '700' },
  summary: { backgroundColor: '#173B35', borderRadius: 17, padding: 17, alignItems: 'center' },
  summaryLabel: { color: '#B9D4CD', fontSize: 12, fontWeight: '700' },
  summaryValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 5 },
  summaryWarehouse: { color: '#B9D4CD', fontSize: 13, marginTop: 4 },
  cameraModal: { flex: 1, backgroundColor: '#102520', padding: 16, gap: 14 },
  cameraTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  camera: { flex: 1, borderRadius: 18, overflow: 'hidden' },
  cameraActions: { gap: 10 },
  analyzingContainer: {
    backgroundColor: '#EFF9F6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  analyzingText: { color: '#0F766E', fontSize: 14, fontWeight: '700' },
});
