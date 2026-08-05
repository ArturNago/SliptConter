/**
 * Câmera + overlay-guia fixo, indicando ângulo/distância (doc, seção 5.2,
 * passo 3). Regra: 1 foto = 1 pilha.
 */
import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import OverlayGuide from '../components/OverlayGuide';
import PrimaryButton from '../components/PrimaryButton';

export default function CapturaScreen({ route, navigation }) {
  const { produto } = route.params;
  const [permissao, solicitarPermissao] = useCameraPermissions();
  const [capturando, setCapturando] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!permissao?.granted) solicitarPermissao();
  }, []);

  async function capturarFoto() {
    if (!cameraRef.current || capturando) return;
    setCapturando(true);
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      navigation.navigate('Conferencia', { produto, imagemUri: foto.uri });
    } catch (err) {
      Alert.alert('Erro na captura', 'Não foi possível capturar a foto. Tente novamente.');
    } finally {
      setCapturando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sku}>{produto.sku}</Text>
        <Text style={styles.descricao}>{produto.descricao}</Text>
      </View>

      <View style={styles.cameraBox}>
        {permissao?.granted ? (
          <CameraView ref={cameraRef} style={styles.camera}>
            <OverlayGuide />
          </CameraView>
        ) : (
          <Text style={styles.aviso}>Aguardando permissão da câmera...</Text>
        )}
      </View>

      <PrimaryButton label="Capturar foto" onPress={capturarFoto} loading={capturando} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16, backgroundColor: '#0F172A' },
  header: { alignItems: 'center' },
  sku: { color: '#22D3EE', fontSize: 18, fontWeight: '700' },
  descricao: { color: '#E2E8F0', fontSize: 14 },
  cameraBox: { flex: 1, borderRadius: 16, overflow: 'hidden' },
  camera: { flex: 1 },
  aviso: { color: '#fff', textAlign: 'center', marginTop: 24 },
});
