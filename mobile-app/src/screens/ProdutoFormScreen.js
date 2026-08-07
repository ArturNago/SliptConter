import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert, ScrollView, KeyboardAvoidingView, Platform, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import PrimaryButton from '../components/PrimaryButton';
import api from '../services/api';

function skuAutomatico() {
  return `PROD-${Date.now().toString(36).toUpperCase()}`;
}

export default function ProdutoFormScreen({ route, navigation }) {
  const produto = route.params?.produto;
  const [descricao, setDescricao] = useState(produto?.descricao || '');
  const [sku, setSku] = useState(produto?.sku || '');
  const [categoria, setCategoria] = useState(produto?.categoria || '');
  const [quantidadeVolumes, setQuantidadeVolumes] = useState(produto?.quantidade_volumes ? String(produto.quantidade_volumes) : '');
  const [fotoUri, setFotoUri] = useState(produto?.foto_url || null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (produto) {
      setDescricao(produto.descricao || '');
      setSku(produto.sku || '');
      setCategoria(produto.categoria || '');
      setQuantidadeVolumes(produto.quantidade_volumes ? String(produto.quantidade_volumes) : '');
      setFotoUri(produto.foto_url || null);
    }
  }, [produto]);

  async function escolherFoto() {
    const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão necessária', 'Permita acesso às fotos para escolher uma imagem do produto.');
      return;
    }
    const resultado = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!resultado.canceled) setFotoUri(resultado.assets[0].uri);
  }

  async function salvar() {
    if (!descricao.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome ou descrição do produto.');
      return;
    }
    setSalvando(true);
    try {
      const dados = {
        descricao: descricao.trim(),
        sku: sku.trim().toUpperCase() || skuAutomatico(),
        categoria: categoria.trim() || null,
        quantidadeVolumes: quantidadeVolumes ? parseInt(quantidadeVolumes, 10) : null,
        fotoUrl: fotoUri || null,
      };
      const salvo = produto ? await api.atualizarProduto(produto.id, dados) : await api.criarProduto(dados);
      Alert.alert('Produto salvo', `${salvo.descricao} está disponível no catálogo.`);
      if (route.params?.armazem && !produto) {
        navigation.navigate('LancarContagem', { armazem: route.params.armazem, produto: salvo });
      } else {
        navigation.goBack();
      }
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
          <Text style={styles.eyebrow}>CATÁLOGO</Text>
          <Text style={styles.title}>{produto ? 'Editar produto' : 'Novo produto'}</Text>
          <Text style={styles.subtitle}>Cadastre os dados essenciais. O SKU pode ser gerado automaticamente.</Text>
          <View style={styles.formCard}>
            <Text style={styles.label}>Nome ou descrição *</Text>
            <TextInput value={descricao} onChangeText={setDescricao} placeholder="Ex.: Mesa de jantar Oslo" placeholderTextColor="#9AA9A5" style={styles.input} autoFocus={!produto} />
            <Text style={styles.label}>SKU ou código de barras <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput value={sku} onChangeText={setSku} placeholder="Será gerado se ficar vazio" placeholderTextColor="#9AA9A5" style={styles.input} autoCapitalize="characters" />
            <Text style={styles.label}>Categoria <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput value={categoria} onChangeText={setCategoria} placeholder="Ex.: Sala de jantar" placeholderTextColor="#9AA9A5" style={styles.input} />
            <Text style={styles.label}>Quantidade de volumes <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput value={quantidadeVolumes} onChangeText={setQuantidadeVolumes} placeholder="Ex.: 2 caixas por produto" placeholderTextColor="#9AA9A5" style={styles.input} keyboardType="number-pad" />
            <Text style={styles.label}>Foto do produto <Text style={styles.optional}>(opcional)</Text></Text>
            {fotoUri ? <View style={styles.photoRow}><Image source={{ uri: fotoUri }} style={styles.photo} /><Pressable onPress={() => setFotoUri(null)}><Text style={styles.remove}>Remover</Text></Pressable></View> : null}
            <Pressable style={styles.photoButton} onPress={escolherFoto}><Text style={styles.photoIcon}>+</Text><Text style={styles.photoText}>{fotoUri ? 'Trocar foto' : 'Escolher da galeria'}</Text></Pressable>
          </View>
          <PrimaryButton label={produto ? 'Salvar alterações' : 'Cadastrar produto'} onPress={salvar} loading={salvando} disabled={!descricao.trim()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F6' },
  flex: { flex: 1 },
  content: { padding: 20, gap: 13 },
  back: { color: '#0F766E', fontSize: 15, fontWeight: '700', marginBottom: 8 },
  eyebrow: { color: '#0F766E', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#12312D', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#71837F', fontSize: 14, lineHeight: 20, marginTop: 3, marginBottom: 5 },
  formCard: { backgroundColor: '#FFFFFF', borderRadius: 17, padding: 17, borderWidth: 1, borderColor: '#E1EBE8', gap: 7 },
  label: { color: '#25463F', fontSize: 13, fontWeight: '800', marginTop: 6 },
  optional: { color: '#91A19D', fontWeight: '600' },
  input: { minHeight: 48, backgroundColor: '#F6F9F8', borderRadius: 12, borderWidth: 1, borderColor: '#DDE8E4', paddingHorizontal: 14, color: '#173B35', fontSize: 15, marginBottom: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  photo: { width: 68, height: 58, borderRadius: 10, backgroundColor: '#E7EFEC' },
  remove: { color: '#B45353', fontWeight: '700', fontSize: 13 },
  photoButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#A9C8C0', borderRadius: 12, padding: 12, marginTop: 3 },
  photoIcon: { color: '#0F766E', fontSize: 24, marginRight: 10 },
  photoText: { color: '#0F766E', fontSize: 13, fontWeight: '800' },
});
