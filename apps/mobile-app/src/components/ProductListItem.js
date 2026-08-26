import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ProductListItem({ produto, onPress, saldoComponent }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.pressed,
        !produto.ativo && styles.inativo,
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.nome} numberOfLines={1}>
          {produto.descricao}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.sku}>SKU: {produto.sku}</Text>
          <View style={styles.dot} />
          <Text style={styles.categoria}>{produto.categoria}</Text>
        </View>
      </View>

      {saldoComponent ? (
        saldoComponent
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginHorizontal: 24,
  },
  pressed: {
    opacity: 0.7,
  },
  inativo: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  nome: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sku: {
    fontSize: 13,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 8,
  },
  categoria: {
    fontSize: 13,
    color: '#64748b',
  },
});
