import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import PrimaryButton from '../components/PrimaryButton';
import usePermissao from '../hooks/usePermissao';
import api from '../services/api';

export default function ProdutoDetailScreen({ route, navigation }) {
  const { produto: initialProduto, armazem } = route.params || {};
  const { isGestor } = usePermissao();
  
  const [produto, setProduto] = useState(initialProduto);
  const [saldos, setSaldos] = useState([]);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const carregarDados = useCallback(async () => {
    if (!produto?.id) return;
    setCarregando(true);
    try {
      const [saldoData, movData] = await Promise.all([
        api.obterSaldoProduto(produto.id),
        api.listarMovimentacoesProduto(produto.id, { limit: 15 }),
      ]);
      setSaldos(saldoData.porArmazem || []);
      setMovimentacoes(movData || []);
    } catch (err) {
      Alert.alert('Erro', err.message || 'Não foi possível carregar os detalhes do produto.');
    } finally {
      setCarregando(false);
    }
  }, [produto?.id]);

  useFocusEffect(
    useCallback(() => {
      carregarDados();
    }, [carregarDados])
  );

  async function handleDesativar() {
    Alert.alert(
      'Desativar produto',
      'Tem certeza que deseja desativar este produto? Ele não aparecerá mais para os operadores.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Desativar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.atualizarProduto(produto.id, { ativo: false });
              navigation.goBack();
            } catch (err) {
              Alert.alert('Erro', err.message || 'Não foi possível desativar o produto.');
            }
          }
        }
      ]
    );
  }

  function formatarData(dataISO) {
    if (!dataISO) return '';
    const date = new Date(dataISO);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (!produto) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.eyebrow}>{produto.categoria}</Text>
          <Text style={styles.title} numberOfLines={1}>{produto.descricao}</Text>
          <Text style={styles.sku}>SKU: {produto.sku}</Text>
        </View>
        
        {isGestor && produto.ativo && (
          <Pressable 
            style={styles.editButton}
            onPress={() => navigation.navigate('ProdutoForm', { produto })}
          >
            <MaterialCommunityIcons name="pencil" size={24} color="#0F766E" />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!produto.ativo && (
          <View style={styles.inativoAlert}>
            <MaterialCommunityIcons name="alert" size={20} color="#b91c1c" />
            <Text style={styles.inativoAlertText}>Produto inativo</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saldo por armazém</Text>
          {carregando ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#0F766E" />
          ) : saldos.length === 0 ? (
            <Text style={styles.emptyText}>Produto sem saldo nos armazéns.</Text>
          ) : (
            <View style={styles.card}>
              {saldos.map((s, index) => (
                <View key={s.armazemId} style={[styles.row, index < saldos.length - 1 && styles.borderBottom]}>
                  <Text style={styles.rowLabel}>{s.armazemNome}</Text>
                  <Text style={styles.rowValue}>{s.quantidade} un</Text>
                </View>
              ))}
              <View style={[styles.row, styles.totalRow]}>
                <Text style={styles.totalLabel}>TOTAL</Text>
                <Text style={styles.totalValue}>{saldos.reduce((acc, s) => acc + s.quantidade, 0)} un</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimas movimentações</Text>
          {carregando ? (
            <ActivityIndicator style={{ marginTop: 20 }} color="#0F766E" />
          ) : movimentacoes.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma movimentação recente.</Text>
          ) : (
            <View style={styles.card}>
              {movimentacoes.map((m, index) => (
                <View key={m.id} style={[styles.movRow, index < movimentacoes.length - 1 && styles.borderBottom]}>
                  <View style={styles.movInfo}>
                    <Text style={styles.movTipo}>
                      {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'saida' ? 'Saída' : 'Ajuste'}
                    </Text>
                    <Text style={styles.movData}>{formatarData(m.criadoEm)}</Text>
                  </View>
                  <View style={styles.movArmazem}>
                    <Text style={styles.movArmazemText} numberOfLines={1}>{m.armazem?.nome || 'Desconhecido'}</Text>
                  </View>
                  <Text style={[styles.movQtd, m.quantidade > 0 ? styles.movPositiva : m.quantidade < 0 ? styles.movNegativa : null]}>
                    {m.quantidade > 0 ? '+' : ''}{m.quantidade}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {isGestor && produto.ativo && (
          <Pressable style={styles.dangerButton} onPress={handleDesativar}>
            <Text style={styles.dangerButtonText}>Desativar produto</Text>
          </Pressable>
        )}
      </ScrollView>

      {produto.ativo && (
        <View style={styles.footer}>
          <PrimaryButton 
            label="Lançar contagem" 
            onPress={() => navigation.navigate('LancarContagem', { produto, armazem })}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitleContainer: { flex: 1 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: '#0F766E', textTransform: 'uppercase', marginBottom: 2 },
  title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  sku: { fontSize: 13, color: '#64748b', fontFamily: 'monospace', marginTop: 2 },
  editButton: { padding: 8, marginLeft: 8 },
  content: { padding: 24, paddingBottom: 40 },
  inativoAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, marginBottom: 24 },
  inativoAlertText: { color: '#b91c1c', fontWeight: '700', marginLeft: 8 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  rowLabel: { fontSize: 15, color: '#334155' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  totalRow: { backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#0F766E' },
  movRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  movInfo: { width: 80 },
  movTipo: { fontSize: 14, fontWeight: '600', color: '#334155' },
  movData: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  movArmazem: { flex: 1, paddingHorizontal: 12 },
  movArmazemText: { fontSize: 13, color: '#64748b' },
  movQtd: { fontSize: 16, fontWeight: '800', width: 50, textAlign: 'right' },
  movPositiva: { color: '#0F766E' },
  movNegativa: { color: '#b91c1c' },
  emptyText: { color: '#64748b', fontSize: 14, fontStyle: 'italic' },
  dangerButton: { padding: 16, alignItems: 'center', marginTop: 16 },
  dangerButtonText: { color: '#b91c1c', fontSize: 15, fontWeight: '700' },
  footer: { padding: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9' },
});
