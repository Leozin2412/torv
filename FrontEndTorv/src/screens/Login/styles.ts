import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: colors.textSecondary,
  },
  registerLink: {
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
    marginLeft: 4,
  },
  // Landing Layout
  landingContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  imageWrapper: {
    flex: 1.5,
    width: '100%',
  },
  landingImage: {
    width: '100%',
    height: '100%',
  },
  landingContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  landingTitle: {
    fontSize: 32,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    marginBottom: 8,
  },
  landingSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 24,
    marginTop: 16,
  },
  backButtonText: {
    color: colors.brand,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
});
