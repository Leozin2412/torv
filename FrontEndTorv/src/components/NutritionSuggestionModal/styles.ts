import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  content: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20 },
  reason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  rowValues: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  oldValue: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, textDecorationLine: 'line-through' },
  newValue: { color: colors.brand, fontFamily: fontFamily.extraBold, fontSize: 16 },
  warning: {
    color: colors.accentIntermediate,
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  secondaryButton: { marginTop: 4 },
});
