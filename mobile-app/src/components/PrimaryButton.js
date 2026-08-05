import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';

/**
 * Botão grande, pensado para uso com luvas/operadores em pé no galpão.
 */
export default function PrimaryButton({ label, onPress, disabled, loading, variant = 'primary' }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#0F172A',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  },
  secondary: {
    backgroundColor: '#334155',
  },
  danger: {
    backgroundColor: '#B91C1C',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
