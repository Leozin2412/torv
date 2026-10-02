import { Platform, StyleSheet } from 'react-native';
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
  inputWithToggle: {
    paddingRight: 48,
  },
  // Nome explícito: no web o react-native-web traduz 'System' para a pilha de fontes do sistema
  // (undefined seria ignorado e a Sora continuaria).
  inputMasked: {
    fontFamily: Platform.select({ android: 'sans-serif', default: 'System' }),
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
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
