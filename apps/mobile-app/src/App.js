import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';

import LoginScreen from './screens/LoginScreen';
import LancarContagemScreen from './screens/LancarContagemScreen';
import ContagemIAReviewScreen from './screens/ContagemIAReviewScreen';
import ProdutoFormScreen from './screens/ProdutoFormScreen';
import ArmazemFormScreen from './screens/ArmazemFormScreen';
import InventarioContagemScreen from './screens/InventarioContagemScreen';
import MainTabs from './navigation/MainTabs';

import localDb from './services/localDb';
import syncQueue from './services/syncQueue';
import api from './services/api';

const Stack = createNativeStackNavigator();
const navigationRef = React.createRef();

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [rotaInicial, setRotaInicial] = useState('Login');

  useEffect(() => {
    // Sempre que a sessão expirar em runtime (401 fora do login), voltamos
    // ao Login a partir de qualquer tela.
    api.registrarOnSessaoExpirada(() => {
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    });

    (async () => {
      await localDb.initDb();
      syncQueue.iniciar();

      const { token } = await api.obterSessao();
      // Valida a validade do JWT salvo: se expirou, descarta e vai ao Login.
      // Antes o app só checava "a string existe?", pulando o Login com token
      // morto e tomando 401 em todas as telas (o "bloqueio" relatado).
      const tokenValido = token && !api.tokenExpirado(token);
      if (token && !tokenValido) {
        await api.encerrarSessao();
      }
      setRotaInicial(tokenValido ? 'Armazens' : 'Login');
      setPronto(true);
    })();

    return () => syncQueue.parar();
  }, []);

  if (!pronto) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName={rotaInicial} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Armazens" component={MainTabs} />
          <Stack.Screen name="LancarContagem" component={LancarContagemScreen} />
          <Stack.Screen name="ContagemIAReview" component={ContagemIAReviewScreen} />
          <Stack.Screen name="InventarioContagem" component={InventarioContagemScreen} />
          <Stack.Screen name="ProdutoForm" component={ProdutoFormScreen} />
          <Stack.Screen name="ArmazemForm" component={ArmazemFormScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
