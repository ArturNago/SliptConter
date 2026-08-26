import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabBarIcon({ name, color, size }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
