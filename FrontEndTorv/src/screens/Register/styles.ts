import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  progressSegment: {
    height: 4,
    flex: 1,
    backgroundColor: colors.border,
    marginHorizontal: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: colors.brand,
  },
  // Header Text
  title: {
    fontSize: 28,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginTop: 16,
  },
  formContainer: {
    flex: 1,
  },
  // Gender Buttons
  genderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 32,
  },
  genderButton: {
    width: 180,
    height: 180,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonActiveMale: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  genderButtonActiveFemale: {
    borderColor: colors.brand,
    backgroundColor: colors.surfaceAlt,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
  },
});
