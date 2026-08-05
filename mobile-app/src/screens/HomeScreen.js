/**
 * Tela inicial: bipar SKU da etiqueta da pilha (doc, seção 5.2, passo 1) e
 * acompanhar o status geral da fila offline.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import PrimaryButton from '../components/PrimaryButton';
import api from '../services/api';
import localDb from '../services/localDb';

export default function HomeScreen({ navigation }) {
  const [permissao, solicitarPermissao] = useCameraPermissions();
  const [mostrarScanner, setMostrarScanner] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    api.obterSessao().then(({ usuario: u }) => setUsuario(u));
  }, []);

  useFocusEffect(
    useCallback(() => {
      localDb.contarPendentes().then(setPendentes);
    }, [])
  );

  async function abrirScanner() {
    if (!permissao?.granted) await solicitarPermissao();
    setMostrarScanner(true);
  }

  async function onSkuLido({ data }) {
    if (buscando) return;
    setBuscando(true);
    try {
      const produto = await api.buscarProdutoPorSku(data);
      setMostrarScanner(false);
      navigation.navigate('Captura', { produto });
    } catch (err) {
      Alert.alert('SKU não encontrado', `Nenhum produto cadastrado para o código "${data}".`);
    } finally {
      setBuscando(false);
    }
  }

  async function sair() {
    await api.encerrarSessao();
    navigation.replace('Login');
  }

  return (
    <SafeAreaView style={styles.container}>
      <View>
        <Text style={styles.saudacao}>Olá, {usuario?.nome || 'operador'}</Text>
        <Text style={styles.subtitulo}>Tebarrot — Conferência de Estoque</Text>
      </View>

      <View style={styles.acoes}>
        <PrimaryButton label="Bipar SKU da pilha" onPress={abrirScanner} />

        <PrimaryButton
          label={pendentes > 0 ? `Sincronização (${pendentes} pendente${pendentes > 1 ? 's' : ''})` : 'Sincronização (tudo ok)'}
          variant="secondary"
          onPress={() => navigation.navigate('SyncStatus')}
        />

        <PrimaryButton label="Sair" variant="danger" onPress={sair} />
      </View>

      <Modal visible={mostrarScanner} animationType="slide">
        <SafeAreaView style={styles.scannerContainer}>
          <Text style={styles.scannerTitulo}>Bipe a etiqueta do SKU</Text>
          {permissao?.granted && (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'code128', 'code39'] }}
              onBarcodeScanned={buscando ? undefined : onSkuLido}
            />
          )}
          <PrimaryButton label="Cancelar" variant="secondary" onPress={() => setMostrarScanner(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'space-between', backgroundColor: '#F8FAFC' },
  saudacao: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitulo: { fontSize: 14, color: '#64748B', marginTop: 4 },
  acoes: { gap: 14, marginBottom: 12 },
  scannerContainer: { flex: 1, backgroundColor: '#000', padding: 16, gap: 12 },
  scannerTitulo: { color: '#fff', fontSize: 18, textAlign: 'center' },
  camera: { flex: 1, borderRadius: 16, overflow: 'hidden' },
});
