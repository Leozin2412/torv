import React from 'react';
import { View, ViewStyle } from 'react-native';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color = colors.brand, style }) => {
  // Ensure progress is between 0 and 1
  const safeProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.fill,
          { width: `${safeProgress * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
};
