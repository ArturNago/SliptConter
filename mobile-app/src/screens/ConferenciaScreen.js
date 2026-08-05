/**
 * Revisão da contagem (doc, seção 5.2, passos 4-6).
 *   - V0: operador informa manualmente o número de camadas.
 *   - V1: YOLOv8 sugere; operador confirma ou ajusta.
 * Botões grandes +1/-1 para ajuste manual (avarias, palete incompleto).
 * Confirmação: online -> API direto; offline -> fila SQLite local.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import CounterStepper from '../components/CounterStepper';
import PrimaryButton from '../components/PrimaryButton';
import api from '../services/api';
import localDb from '../services/localDb';

export default function ConferenciaScreen({ route, navigation }) {
  const { produto, imagemUri } = route.params;

  const [consultandoIA, setConsultandoIA] = useState(true);
  const [origem, setOrigem] = useState('manual');
  const [camadasSugeridasIa, setCamadasSugeridasIa] = useState(null);
  const [camadas, setCamadas] = useState(0);
  const [ajusteManual, setAjusteManual] = useState(0);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resultado = await api.solicitarSugestaoIA(imagemUri);
        if (resultado.disponivel) {
          setOrigem('ia');
          setCamadasSugeridasIa(resultado.camadas_sugeridas);
          setCamadas(resultado.camadas_sugeridas);
        }
      } catch {
        // IA indisponível (ex.: offline) — segue no fluxo manual normalmente.
      } finally {
        setConsultandoIA(false);
      }
    })();
  }, []);

  const subtotal = camadas * produto.volumes_por_camada;
  const total = Math.max(subtotal + ajusteManual, 0);

  async function confirmar() {
    setConfirmando(true);
    const dados = {
      imagemUri,
      produtoId: produto.id,
      produtoSku: produto.sku,
      camadasInformadas: camadas,
      camadasSugeridasIa,
      ajusteManual,
      origem,
      tipoMovimentacao: 'entrada',
    };

    try {
      await api.criarConferencia(dados);
      Alert.alert('Conferência registrada', `Total: ${total} volumes.`);
      navigation.popToTop();
    } catch (err) {
      // Sem rede/API indisponível -> grava na fila offline local.
      await localDb.inserirPendente(dados);
      Alert.alert(
        'Salvo offline',
        'Sem conexão com a API agora. A conferência foi salva no aparelho e será sincronizada automaticamente.'
      );
      navigation.popToTop();
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.sku}>{produto.sku}</Text>
      <Text style={styles.descricao}>{produto.descricao}</Text>

      <Image source={{ uri: imagemUri }} style={styles.foto} />

      {consultandoIA ? (
        <View style={styles.iaBox}>
          <ActivityIndicator />
          <Text style={styles.iaTexto}>Consultando sugestão de IA...</Text>
        </View>
      ) : origem === 'ia' ? (
        <Text style={styles.iaSugestao}>IA sugeriu {camadasSugeridasIa} camada(s) — confirme ou ajuste.</Text>
      ) : (
        <Text style={styles.iaSugestao}>Informe manualmente o número de camadas.</Text>
      )}

      <CounterStepper
        label="Camadas"
        value={camadas}
        onIncrement={() => setCamadas((v) => v + 1)}
        onDecrement={() => setCamadas((v) => Math.max(v - 1, 0))}
      />

      <Text style={styles.subtotal}>
        Subtotal: {camadas} × {produto.volumes_por_camada} = {subtotal} volumes
      </Text>

      <CounterStepper
        label="Ajuste manual (avarias, palete incompleto)"
        value={ajusteManual}
        onIncrement={() => setAjusteManual((v) => v + 1)}
        onDecrement={() => setAjusteManual((v) => v - 1)}
        min={-subtotal}
      />

      <Text style={styles.total}>Total: {total} volumes</Text>

      <PrimaryButton label="Confirmar conferência" onPress={confirmar} loading={confirmando} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 8, backgroundColor: '#F8FAFC' },
  sku: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  descricao: { fontSize: 14, color: '#64748B', marginBottom: 8 },
  foto: { width: '100%', height: 160, borderRadius: 12, backgroundColor: '#E2E8F0' },
  iaBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  iaTexto: { color: '#475569' },
  iaSugestao: { color: '#0369A1', marginVertical: 8, textAlign: 'center' },
  subtotal: { textAlign: 'center', color: '#334155', fontSize: 15 },
  total: { textAlign: 'center', fontSize: 24, fontWeight: '800', color: '#0F172A', marginVertical: 12 },
});
