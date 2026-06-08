import React, { useState } from 'react';
import { View, TextInput, Text, TextInputProps } from 'react-native';
import { styles } from './styles';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...rest }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          isFocused && styles.inputFocused,
          error ? { borderColor: '#FF453A' } : null,
          style,
        ]}
        placeholderTextColor="#8E8E93"
        onFocus={(e) => {
          setIsFocused(true);
          rest.onFocus && rest.onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          rest.onBlur && rest.onBlur(e);
        }}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};
