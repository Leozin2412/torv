import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  infoText: {
    color: colors.brand,
    textAlign: 'center',
    marginBottom: 12,
  },
  resendButton: {
    alignSelf: 'center',
    marginTop: 24,
    padding: 4,
  },
  resendText: {
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
  },
  resendTextDisabled: {
    color: colors.textSecondary,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 24,
  },
  backButtonText: {
    color: colors.brand,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
});
