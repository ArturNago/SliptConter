import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '../components/PrimaryButton';
import api from '../services/api';

export default function ArmazemFormScreen({ route, navigation }) {
  const armazem = route.params?.armazem;
  const [nome, setNome] = useState(armazem?.nome || '');
  const [codigo, setCodigo] = useState(armazem?.codigo || '');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (armazem) {
      setNome(armazem.nome || '');
      setCodigo(armazem.codigo || '');
    }
  }, [armazem]);

  async function salvar() {
    if (!nome.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do armazém.');
      return;
    }
    setSalvando(true);
    try {
      const dados = { nome: nome.trim(), codigo: codigo.trim().toUpperCase() || null };
      const salvo = armazem ? await api.atualizarArmazem(armazem.id, dados) : await api.criarArmazem(dados);
      Alert.alert('Armazém salvo', `${salvo.nome} está pronto para uso.`);
      navigation.goBack();
    } catch (err) {
      Alert.alert('Não foi possível salvar', err?.response?.data?.erro || 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Voltar</Text></Pressable>
          <Text style={styles.eyebrow}>CONFIGURAÇÃO</Text>
          <Text style={styles.title}>{armazem ? 'Editar armazém' : 'Novo armazém'}</Text>
          <Text style={styles.subtitle}>Use um nome que a equipe reconheça facilmente no galpão.</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Nome do armazém *</Text>
            <TextInput value={nome} onChangeText={setNome} placeholder="Ex.: Galpão Principal" placeholderTextColor="#9AA9A5" style={styles.input} autoFocus={!armazem} />
            <Text style={styles.label}>Código interno <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput value={codigo} onChangeText={setCodigo} placeholder="Ex.: PRINCIPAL" placeholderTextColor="#9AA9A5" style={styles.input} autoCapitalize="characters" maxLength={30} />
            <Text style={styles.hint}>O código ajuda a identificar o armazém em relatórios e integrações.</Text>
          </View>
          <PrimaryButton label={armazem ? 'Salvar alterações' : 'Criar armazém'} onPress={salvar} loading={salvando} disabled={!nome.trim()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  flex: { flex: 1 },
  content: { padding: 20, gap: 14 },
  back: { color: '#0F766E', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  eyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#12312D', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#71837F', fontSize: 14, lineHeight: 20, marginTop: 3, marginBottom: 5 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 17, borderWidth: 1, borderColor: '#E1EBE8', gap: 8 },
  label: { color: '#25463F', fontSize: 13, fontWeight: '800', marginTop: 5 },
  optional: { color: '#91A19D', fontWeight: '600' },
  input: { minHeight: 50, backgroundColor: '#F6F9F8', borderRadius: 12, borderWidth: 1, borderColor: '#DDE8E4', paddingHorizontal: 14, color: '#173B35', fontSize: 16, marginBottom: 7 },
  hint: { color: '#82938F', fontSize: 12, lineHeight: 18 },
});
