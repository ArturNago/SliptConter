import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

/**
 * Botões grandes +1/-1 usados na tela de revisão para ajuste manual
 * (avarias, palete incompleto — doc, seção 5.2, passo 5).
 */
export default function CounterStepper({ label, value, onIncrement, onDecrement, min = 0 }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={[styles.stepButton, styles.decrement]}
          onPress={onDecrement}
          disabled={value <= min}
        >
          <Text style={styles.stepText}>−1</Text>
        </Pressable>

        <Text style={styles.value}>{value}</Text>

        <Pressable style={[styles.stepButton, styles.increment]} onPress={onIncrement}>
          <Text style={styles.stepText}>+1</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 16,
  },
  label: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  stepButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decrement: {
    backgroundColor: '#FEE2E2',
  },
  increment: {
    backgroundColor: '#DCFCE7',
  },
  stepText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
  },
  value: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0F172A',
    minWidth: 80,
    textAlign: 'center',
  },
});
