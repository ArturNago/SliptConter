/**
 * Login tradicional: usuário e senha.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import PrimaryButton from '../components/PrimaryButton';
import api from '../services/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    if (!username.trim() || !senha) {
      Alert.alert('Campos obrigatórios', 'Informe usuário e senha.');
      return;
    }

    setCarregando(true);
    try {
      await api.login(username.trim(), senha);
      navigation.replace('Home');
    } catch (err) {
      if (!err.response) {
        // Sem resposta do servidor: problema de rede/túnel, não de credencial.
        Alert.alert(
          'Sem conexão com o servidor',
          'Não foi possível alcançar a API. Verifique sua internet ou tente novamente em alguns segundos.'
        );
      } else if (err.response.status === 401) {
        Alert.alert('Falha no login', 'Usuário ou senha inválidos.');
      } else {
        Alert.alert('Erro inesperado', err.response.data?.erro || 'Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.form}
      >
        <View>
          <Text style={styles.titulo}>Tebarrot Estoque</Text>
          <Text style={styles.subtitulo}>Entre com seu usuário</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Usuário"
          placeholderTextColor="#94A3B8"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor="#94A3B8"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={entrar}
        />

        <PrimaryButton
          label="Entrar"
          onPress={entrar}
          loading={carregando}
          disabled={!username.trim() || !senha}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  form: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  titulo: { fontSize: 26, fontWeight: '700', textAlign: 'center', color: '#0F172A' },
  subtitulo: { fontSize: 16, textAlign: 'center', color: '#475569', marginTop: 4 },
  input: {
    fontSize: 18,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    color: '#0F172A',
  },
});
