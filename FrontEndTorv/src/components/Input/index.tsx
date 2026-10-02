import React, { useState } from 'react';
import { View, TextInput, Text, TextInputProps, TouchableOpacity } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, style, ...rest }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  // Senha oculta com texto: fonte do sistema, que desenha bolinhas. Na Sora o "•" da máscara é um quadrado.
  const masked = !!rest.secureTextEntry && !visible && !!rest.value;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View>
        <TextInput
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error ? { borderColor: colors.error } : null,
            rest.secureTextEntry ? styles.inputWithToggle : null,
            style,
            masked && styles.inputMasked,
          ]}
          placeholderTextColor={colors.textSecondary}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus && rest.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur && rest.onBlur(e);
          }}
          {...rest}
          secureTextEntry={rest.secureTextEntry && !visible}
        />
        {rest.secureTextEntry && (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setVisible((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          >
            {visible ? <EyeOff color={colors.textSecondary} size={20} /> : <Eye color={colors.textSecondary} size={20} />}
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};
