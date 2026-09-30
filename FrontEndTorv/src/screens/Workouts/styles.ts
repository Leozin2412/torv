import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 120 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 32, marginBottom: 20 },
  loading: { marginTop: 32 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, marginBottom: 16 },

  suggestionCard: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  suggestionTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  suggestionReason: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 4, marginLeft: 26 },
  bannerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  bannerButton: { flex: 1 },

  routineCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, marginBottom: 12 },
  routineCardNext: { borderColor: colors.brand },
  routineInfo: { flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nextTag: { color: colors.background, backgroundColor: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  defaultTag: { color: colors.textSecondary, borderColor: colors.border, borderWidth: 1, fontFamily: fontFamily.semiBold, fontSize: 11, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: 'hidden' },
  routineName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22, marginTop: 6 },
  routineMeta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    marginTop: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  newText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 16 },
});
