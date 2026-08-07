import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import ScreenHeader from '../components/ScreenHeader';
import usePermissao from '../hooks/usePermissao';
import localDb from '../services/localDb';
import api from '../services/api';

export default function MaisScreen({ navigation }) {
  const { usuario } = usePermissao();
  const [pendentes, setPendentes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      localDb.contarPendentes().then(count => {
        if (isMounted) setPendentes(count);
      });
      return () => { isMounted = false; };
    }, [])
  );

  async function handleSair() {
    await api.encerrarSessao();
    navigation.replace('Login');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader 
        title="Mais" 
        subtitle="Configurações e conta"
      />
      
      <View style={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account" size={32} color="#0F766E" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{usuario?.nome || 'Operador'}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{usuario?.papel || 'operador'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuGroup}>
          <Pressable 
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}
            onPress={() => navigation.navigate('SyncStatus')}
          >
            <View style={styles.menuItemIcon}>
              <MaterialCommunityIcons name="sync" size={24} color="#64748b" />
            </View>
            <Text style={styles.menuItemLabel}>Sincronização offline</Text>
            {pendentes > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendentes}</Text>
              </View>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
            )}
          </Pressable>

          <Pressable 
            style={({ pressed }) => [styles.menuItem, pressed && styles.pressed, styles.menuItemSair]}
            onPress={handleSair}
          >
            <View style={[styles.menuItemIcon, styles.menuItemIconSair]}>
              <MaterialCommunityIcons name="logout" size={24} color="#ef4444" />
            </View>
            <Text style={[styles.menuItemLabel, styles.menuItemLabelSair]}>Sair da conta</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F7F6',
  },
  content: {
    padding: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E1F4EF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DDF4EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F766E',
    textTransform: 'uppercase',
  },
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pressed: {
    backgroundColor: '#f8fafc',
  },
  menuItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  badge: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  menuItemSair: {
    borderBottomWidth: 0,
  },
  menuItemIconSair: {
    backgroundColor: '#fef2f2',
  },
  menuItemLabelSair: {
    color: '#ef4444',
  },
});
