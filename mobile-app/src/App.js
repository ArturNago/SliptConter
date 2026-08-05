import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import CapturaScreen from './screens/CapturaScreen';
import ConferenciaScreen from './screens/ConferenciaScreen';
import SyncStatusScreen from './screens/SyncStatusScreen';

import localDb from './services/localDb';
import syncQueue from './services/syncQueue';
import api from './services/api';

const Stack = createNativeStackNavigator();

export default function App() {
  const [pronto, setPronto] = useState(false);
  const [rotaInicial, setRotaInicial] = useState('Login');

  useEffect(() => {
    (async () => {
      await localDb.initDb();
      syncQueue.iniciar();

      const { token } = await api.obterSessao();
      setRotaInicial(token ? 'Home' : 'Login');
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
      <NavigationContainer>
        <Stack.Navigator initialRouteName={rotaInicial} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Captura" component={CapturaScreen} />
          <Stack.Screen name="Conferencia" component={ConferenciaScreen} options={{ headerShown: true, title: 'Revisão' }} />
          <Stack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ headerShown: true, title: 'Sincronização' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
