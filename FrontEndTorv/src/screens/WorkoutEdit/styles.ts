import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

// Uma série por card: nome em cima, tempo e carga lado a lado (cabem em 320 px com 2 campos de ~118 px).
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 48 },
  centered: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  name: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, lineHeight: 26 },
  note: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 4, marginBottom: 16 },

  setCard: { marginBottom: 12, paddingVertical: 8 },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setLabel: { flex: 1, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 20 },
  remove: { width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center' },

  fields: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  field: { flex: 1 },
  fieldLabel: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 13, marginBottom: 6 },
  input: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },

  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
