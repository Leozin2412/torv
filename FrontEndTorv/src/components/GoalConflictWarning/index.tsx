import React from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { hasGoalConflict } from '../../utils/profileOptions';
import { styles } from './styles';

export const GoalConflictWarning: React.FC<{ goals: string[] }> = ({ goals }) => {
  if (!hasGoalConflict(goals)) return null;
  return (
    <View style={styles.container} accessibilityRole="alert">
      <AlertTriangle color={colors.accentIntermediate} size={18} />
      <Text style={styles.text}>
        Perder peso e ganhar massa ao mesmo tempo são metas opostas — recomendamos focar em um objetivo por vez.
      </Text>
    </View>
  );
};
