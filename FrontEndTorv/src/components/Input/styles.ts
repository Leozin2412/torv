import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    color: colors.textMuted,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 16,
    fontFamily: fontFamily.regular,
  },
  inputFocused: {
    borderColor: colors.brand,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
});
