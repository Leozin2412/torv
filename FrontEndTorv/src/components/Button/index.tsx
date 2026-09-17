import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  outline?: boolean;
  danger?: boolean;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ title, outline, danger, loading, style, ...rest }) => {
  const isOutlineDanger = outline && danger;
  const isSolidDanger = danger && !outline;

  let spinnerColor = colors.background;
  if (isOutlineDanger) spinnerColor = colors.error;
  else if (isSolidDanger) spinnerColor = colors.text;
  else if (outline) spinnerColor = colors.brand;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        outline && styles.buttonOutline,
        isOutlineDanger && styles.buttonOutlineDanger,
        isSolidDanger && styles.buttonSolidDanger,
        style,
      ]}
      activeOpacity={0.8}
      disabled={loading}
      accessibilityRole="button"
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <Text
          style={[
            styles.text,
            outline && styles.textOutline,
            isOutlineDanger && styles.textOutlineDanger,
            isSolidDanger && styles.textSolidDanger,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
