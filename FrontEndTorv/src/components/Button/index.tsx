import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { styles } from './styles';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  outline?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ title, outline, loading, style, ...rest }) => {
  return (
    <TouchableOpacity
      style={[styles.button, outline && styles.buttonOutline, style]}
      activeOpacity={0.8}
      disabled={loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={outline ? '#8CC63F' : '#121212'} />
      ) : (
        <Text style={[styles.text, outline && styles.textOutline]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
