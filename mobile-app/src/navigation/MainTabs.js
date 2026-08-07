import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import TabBarIcon from './TabBarIcon';

import DashboardScreen from '../screens/DashboardScreen';
import ArmazensScreen from '../screens/ArmazensScreen';
import ArmazemDetailScreen from '../screens/ArmazemDetailScreen';
import ProdutosScreen from '../screens/ProdutosScreen';
import ProdutoDetailScreen from '../screens/ProdutoDetailScreen';
import MaisScreen from '../screens/MaisScreen';
import SyncStatusScreen from '../screens/SyncStatusScreen';

const Tab = createBottomTabNavigator();
const ArmazensStack = createNativeStackNavigator();
const ProdutosStack = createNativeStackNavigator();
const MaisStack = createNativeStackNavigator();

function ArmazensNavigator() {
  return (
    <ArmazensStack.Navigator screenOptions={{ headerShown: false }}>
      <ArmazensStack.Screen name="ArmazensList" component={ArmazensScreen} />
      <ArmazensStack.Screen name="ArmazemDetail" component={ArmazemDetailScreen} />
    </ArmazensStack.Navigator>
  );
}

function ProdutosNavigator() {
  return (
    <ProdutosStack.Navigator screenOptions={{ headerShown: false }}>
      <ProdutosStack.Screen name="ProdutosList" component={ProdutosScreen} />
      <ProdutosStack.Screen name="ProdutoDetail" component={ProdutoDetailScreen} />
    </ProdutosStack.Navigator>
  );
}

function MaisNavigator() {
  return (
    <MaisStack.Navigator screenOptions={{ headerShown: false }}>
      <MaisStack.Screen name="MaisMenu" component={MaisScreen} />
      <MaisStack.Screen name="SyncStatus" component={SyncStatusScreen} options={{ headerShown: true, title: 'Sincronização' }} />
    </MaisStack.Navigator>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0F766E',
      }}
    >
      <Tab.Screen
        name="InicioTab"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ArmazensTab"
        component={ArmazensNavigator}
        options={{
          tabBarLabel: 'Armazéns',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="warehouse" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="ProdutosTab"
        component={ProdutosNavigator}
        options={{
          tabBarLabel: 'Produtos',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="package-variant-closed" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="MaisTab"
        component={MaisNavigator}
        options={{
          tabBarLabel: 'Mais',
          tabBarIcon: ({ color, size }) => <TabBarIcon name="menu" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
