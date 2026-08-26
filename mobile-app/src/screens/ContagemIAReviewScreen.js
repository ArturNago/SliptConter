import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CounterStepper from '../components/CounterStepper';
import PrimaryButton from '../components/PrimaryButton';
import DetectionOverlay from '../components/DetectionOverlay';
import api from '../services/api';
import localDb from '../services/localDb';

/**
 * Tela de revisão da contagem assistida por IA (V1).
 *
 * Exibe a foto com as caixas detectadas em overlay, permite ao operador
 * confirmar/ajustar o número de caixas por camada e o número de camadas.
 * Total = caixasNaCamada × camadas.
 */
export default function ContagemIAReviewScreen({ route, navigation }) {
  const {
    imagemUri,
    caixas = [],
    caixasPorCamada = 1,
    confianca = 0,
    skuId,
    armazemId,
    produto,
    volumesPorCamada,
    camadasMaximasPalete,
    tipoMovimentacao,
  } = route.params;

  const [caixasNaCamada, setCaixasNaCamada] = useState(caixasPorCamada || 1);
  const [camadas, setCamadas] = useState(camadasMaximasPalete || 1);
  const [largura, setLargura] = useState(0);
  const [altura, setAltura] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [imagemLayout, setImagemLayout] = useState(false);

  const total = caixasNaCamada * camadas;
  const desvioVolumes = volumesPorCamada && Math.abs(caixasNaCamada - volumesPorCamada) > 2;
  const confiancaBaixa = confianca > 0 && confianca < 0.5;

  useEffect(() => {
    if (caixasPorCamada) {
      setCaixasNaCamada(caixasPorCamada);
    }
  }, [caixasPorCamada]);

  useEffect(() => {
    if (camadasMaximasPalete) {
      setCamadas(camadasMaximasPalete);
    }
  }, [camadasMaximasPalete]);

  function onImagemLayout(event) {
    const { width, height } = event.nativeEvent.layout;
    setLargura(width);
    setAltura(height);
    setImagemLayout(true);
  }

  async function confirmar() {
    if (!skuId) {
      Alert.alert('Erro', 'Produto (SKU) não identificado nesta conferência.');
      return;
    }

    setConfirmando(true);
    const dados = {
      imagemUri,
      skuId,
      produtoSku: produto?.sku,
      armazemId,
      quantidadeContada: total,
      quantidadeSugeridaIa: (caixasPorCamada || 0) * camadas,
      caixasPorCamada: caixasNaCamada,
      camadasConfirmadas: camadas,
      caixasSugeridasIa: caixasPorCamada,
      deteccoesIa: caixas,
      ajusteManual: (caixasNaCamada - (caixasPorCamada || 0)) * camadas,
      origem: 'ia',
      tipoMovimentacao: tipoMovimentacao || 'entrada',
    };

    try {
      await api.criarConferencia(dados);
      Alert.alert('Estoque atualizado', `${total} unidades registradas com sucesso (IA).`);
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
        <Text style={styles.eyebrow}>REVISÃO COM IA</Text>
        <Text style={styles.title}>Confirmar contagem</Text>
        {produto && (
          <Text style={styles.subtitle}>{produto.descricao} ({produto.sku})</Text>
        )}

        <View style={styles.photoContainer}>
          <Image
            source={{ uri: imagemUri }}
            style={styles.photo}
            resizeMode="cover"
            onLayout={onImagemLayout}
          />
          {imagemLayout && (
            <DetectionOverlay caixas={caixas} largura={largura} altura={altura} />
          )}
        </View>

        {confiancaBaixa && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ⚠️ Confiança baixa ({Math.round(confianca * 100)}%). Verifique e ajuste as caixas se necessário.
            </Text>
          </View>
        )}

        {desvioVolumes && (
          <View style={styles.warning}>
            <Text style={styles.warningText}>
              ℹ️ Caixas detectadas ({caixasNaCamada}) diferente do cadastro ({volumesPorCamada} un/camada).
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>1. Caixas na Camada Frontal</Text>
            {confianca > 0 && (
              <Text style={styles.infoConfianca}>IA: {Math.round(confianca * 100)}% conf.</Text>
            )}
          </View>
          <CounterStepper
            label="Ajuste se a IA omitiu ou adicionou caixas"
            value={caixasNaCamada}
            onIncrement={() => setCaixasNaCamada((v) => v + 1)}
            onDecrement={() => setCaixasNaCamada((v) => Math.max(v - 1, 1))}
            min={1}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>2. Número de Camadas (Pilha)</Text>
            <Text style={styles.hint}>Profundidade / Altura</Text>
          </View>
          <CounterStepper
            label="Camadas na pilha"
            value={camadas}
            onIncrement={() => setCamadas((v) => v + 1)}
            onDecrement={() => setCamadas((v) => Math.max(v - 1, 1))}
            min={1}
          />
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total Calculado</Text>
          <Text style={styles.summaryFormula}>
            {caixasNaCamada} caixas × {camadas} camadas
          </Text>
          <Text style={styles.summaryValue}>{total} unidades</Text>
        </View>

        <PrimaryButton label="Confirmar contagem" onPress={confirmar} loading={confirmando} />
        <PrimaryButton label="Voltar ao modo manual" variant="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  eyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginTop: 4 },
  title: { color: '#12312D', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#475569', fontSize: 14, fontWeight: '600', marginTop: -8, marginBottom: 4 },
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#173B35',
    borderRadius: 14,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  warning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  infoConfianca: { color: '#0F766E', fontSize: 12, fontWeight: '700' },
  section: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 15, borderWidth: 1, borderColor: '#E1EBE8' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: '#173B35', fontSize: 15, fontWeight: '800' },
  hint: { color: '#91A19D', fontSize: 11 },
  summary: { backgroundColor: '#173B35', borderRadius: 17, padding: 16, alignItems: 'center' },
  summaryLabel: { color: '#B9D4CD', fontSize: 12, fontWeight: '700' },
  summaryFormula: { color: '#B9D4CD', fontSize: 13, marginTop: 2 },
  summaryValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 4 },
});
