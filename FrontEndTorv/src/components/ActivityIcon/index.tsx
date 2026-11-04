import React from 'react';
import { Dumbbell, Footprints, Activity } from 'lucide-react-native';

// Ícone de cada tipo de atividade (Histórico, Perfil, perfil de membro, resumo de GPS).
export function ActivityIcon({ type, color, size = 20 }: { type: string; color: string; size?: number }) {
  if (type === 'STRENGTH') return <Dumbbell color={color} size={size} />;
  if (type === 'WALK') return <Footprints color={color} size={size} />;
  return <Activity color={color} size={size} />;
}
