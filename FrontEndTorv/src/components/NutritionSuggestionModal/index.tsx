import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Alert } from 'react-native';
import { X, ArrowRight } from 'lucide-react-native';
import { Button } from '../Button';
import api from '../../services/api';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface Targets {
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionSuggestion {
  has_suggestion: boolean;
  current?: Targets;
  suggested?: Targets;
  warnings?: string[];
  changed?: string[];
}

const REASONS: Record<string, string> = {
  age: 'Você fez aniversário',
  weight_kg: 'Seu peso mudou',
  height_cm: 'Sua altura mudou',
  goals: 'Seu objetivo mudou',
  fitness_level: 'Seu nível físico mudou',
  gender: 'Seus dados mudaram',
};
const ALL_BASIS_KEYS = 6; // meta sem histórico: backend marca tudo como mudado

const ROWS: { label: string; key: keyof Targets; unit: string }[] = [
  { label: 'Calorias', key: 'daily_calories', unit: 'kcal' },
  { label: 'Proteína', key: 'protein_g', unit: 'g' },
  { label: 'Carboidrato', key: 'carbs_g', unit: 'g' },
  { label: 'Gordura', key: 'fat_g', unit: 'g' },
];

interface Props {
  suggestion: NutritionSuggestion | null;
  onClose: () => void;
  onResolved: (accepted: boolean) => void;
}

export const NutritionSuggestionModal: React.FC<Props> = ({ suggestion, onClose, onResolved }) => {
  const [loading, setLoading] = useState<'accept' | 'dismiss' | null>(null);
  const { current, suggested, changed = [], warnings = [] } = suggestion || {};
  const visible = !!suggestion?.has_suggestion && !!current && !!suggested;

  const reasons = changed.length >= ALL_BASIS_KEYS
    ? ['Calculamos uma meta personalizada com base no seu perfil']
    : [...new Set(changed.map((key) => REASONS[key]).filter(Boolean))];

  const resolve = async (accept: boolean) => {
    setLoading(accept ? 'accept' : 'dismiss');
    try {
      await api.post(`/diet/targets/suggestion/${accept ? 'accept' : 'dismiss'}`);
      onResolved(accept);
    } catch (error) {
      console.log('Failed to resolve nutrition suggestion', error);
      Alert.alert('Erro', 'Não foi possível atualizar sua meta.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Nova meta sugerida</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar sugestão de meta">
              <X color={colors.textSecondary} size={24} />
            </TouchableOpacity>
          </View>

          {reasons.map((reason) => (
            <Text key={reason} style={styles.reason}>• {reason}</Text>
          ))}

          {visible && ROWS.map(({ label, key, unit }) => (
            <View key={key} style={styles.row} accessibilityLabel={`${label}: de ${current![key]} para ${suggested![key]} ${unit}`}>
              <Text style={styles.rowLabel}>{label}</Text>
              <View style={styles.rowValues}>
                <Text style={styles.oldValue}>{current![key]}</Text>
                <ArrowRight color={colors.textSecondary} size={14} />
                <Text style={styles.newValue}>{suggested![key]} {unit}</Text>
              </View>
            </View>
          ))}

          {warnings.includes('GOAL_CONFLICT') && (
            <Text style={styles.warning}>
              Seus objetivos incluem perder peso e ganhar massa — a meta é uma média entre déficit e superávit. Focar em um objetivo por vez traz resultados mais previsíveis.
            </Text>
          )}

          <Button title="Aplicar nova meta" onPress={() => resolve(true)} loading={loading === 'accept'} disabled={loading !== null} />
          <Button title="Manter atual" outline onPress={() => resolve(false)} loading={loading === 'dismiss'} disabled={loading !== null} style={styles.secondaryButton} />
        </View>
      </View>
    </Modal>
  );
};
