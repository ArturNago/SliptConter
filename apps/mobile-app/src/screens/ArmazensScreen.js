import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import PrimaryButton from '../components/PrimaryButton';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import api from '../services/api';
import usePermissao from '../hooks/usePermissao';

export default function ArmazensScreen({ navigation }) {
  const [armazens, setArmazens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const { isGestor, usuario } = usePermissao();

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const lista = await api.listarArmazens();
      setArmazens(lista);
    } catch (err) {
      Alert.alert('Não foi possível carregar', err?.response?.data?.erro || 'Verifique a conexão com a API.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader 
        title={`Olá, ${usuario?.nome || 'Operador'}`} 
        eyebrow="Tebarrot Estoque" 
        subtitle="Escolha o armazém onde você vai trabalhar." 
      />

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Seus armazéns</Text>
        <Text style={styles.count}>{armazens.length} ativo{armazens.length === 1 ? '' : 's'}</Text>
      </View>

      <FlatList
        data={armazens}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={carregando} onRefresh={carregar} tintColor="#0F766E" />}
        contentContainerStyle={styles.content}
        ListEmptyComponent={
          !carregando && (
            <EmptyState 
              icon="warehouse" 
              title="Nenhum armazém disponível" 
              message="Cadastre um local para começar a controlar o estoque." 
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => navigation.navigate('ArmazemDetail', { armazem: item })}
          >
            <View style={styles.cardIcon}>
              <MaterialCommunityIcons name="warehouse" size={24} color="#0F766E" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.nome}</Text>
              <Text style={styles.cardCode}>{item.codigo || 'Sem código cadastrado'}</Text>
            </View>
            {isGestor && (
              <Pressable 
                style={styles.editButton}
                onPress={() => navigation.navigate('ArmazemForm', { armazem: item })}
                hitSlop={15}
              >
                <MaterialCommunityIcons name="pencil" size={22} color="#94a3b8" />
              </Pressable>
            )}
            <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" style={styles.chevron} />
          </Pressable>
        )}
      />

      {isGestor && (
        <View style={styles.footer}>
          <PrimaryButton
            label="+ Novo armazém"
            onPress={() => navigation.navigate('ArmazemForm')}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 24, 
    paddingBottom: 8 
  },
  sectionTitle: { color: '#1e293b', fontSize: 18, fontWeight: '800' },
  count: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  content: { padding: 24, paddingBottom: 100, gap: 12 },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.03, 
    shadowRadius: 10, 
    elevation: 2 
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
  cardIcon: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: '#E1F4EF', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 16 
  },
  cardBody: { flex: 1 },
  cardTitle: { color: '#1e293b', fontSize: 16, fontWeight: '700' },
  cardCode: { color: '#64748b', fontSize: 13, marginTop: 4, fontFamily: 'monospace' },
  editButton: { padding: 8 },
  chevron: { marginLeft: 4 },
  footer: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24, 
    backgroundColor: '#F4F7F6' 
  },
});
