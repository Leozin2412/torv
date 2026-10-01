import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

const TOUCH = 44;

export const historyStyles = StyleSheet.create({
  container: { flex: 1 },
  padded: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  loading: { marginTop: 32 },
  footer: { marginVertical: 16 },

  // Mesmo chip do ExercisePicker (grupo muscular).
  chipsScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -20, marginBottom: 4 },
  chipsRow: { gap: 8, paddingHorizontal: 20 },
  chip: {
    minHeight: TOUCH,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  chipText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  chipTextActive: { color: colors.brand },

  dayTitle: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13, marginTop: 16, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  itemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  itemMeta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },

  centered: { alignItems: 'center', gap: 12, marginTop: 32 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 28, marginTop: 8 },
  message: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, textAlign: 'center' },
});
