import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    marginTop: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentIntermediate,
    backgroundColor: colors.surface,
  },
  text: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});
