import React from 'react';
import { View, Text, TouchableOpacity, TouchableOpacityProps, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './styles';

interface SelectCardProps extends TouchableOpacityProps {
  title: string;
  description?: string;
  selected: boolean;
  titleColor?: string;
  useGradient?: boolean;
}

export const SelectCard: React.FC<SelectCardProps> = ({ title, description, selected, titleColor, useGradient, style, ...rest }) => {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardActive, useGradient && { backgroundColor: 'transparent', overflow: 'hidden' }, style]}
      activeOpacity={0.8}
      {...rest}
    >
      {useGradient && (
        <LinearGradient
          colors={['#1F3A15', '#121212']} // Slightly darker green to black
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
      )}
      <View style={styles.content}>
        <Text style={[styles.title, selected && styles.titleActive, titleColor ? { color: titleColor } : null]}>{title}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
};
