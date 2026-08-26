import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Overlay-guia fixo exibido sobre o preview da câmera, indicando
 * ângulo/distância padronizados para a foto (doc, seção 5.2 — "1 foto = 1
 * pilha"). O enquadramento consistente também é o que viabiliza a
 * heurística de geração de labels em ia-worker/training/build_dataset.py.
 */
export default function OverlayGuide() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.frame} />
      <Text style={styles.dica}>
        Alinhe a pilha inteira dentro do quadro, de frente, a ~1,5m de distância
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '70%',
    height: '80%',
    borderWidth: 3,
    borderColor: '#22D3EE',
    borderRadius: 12,
  },
  dica: {
    position: 'absolute',
    bottom: 24,
    color: '#fff',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: 'center',
    marginHorizontal: 24,
  },
});
