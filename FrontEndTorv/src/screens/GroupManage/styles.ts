import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

// Seções em cards (mesmo Card do app). O código de convite é o único destaque: grande, verde, com
// espaço entre as letras para ler em voz alta ou digitar sem erro.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 48 },
  centered: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 4 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },
  card: { marginBottom: 16 },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 17, marginBottom: 12 },
  subTitle: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14, marginTop: 16, marginBottom: 4 },

  code: {
    paddingVertical: 14,
    marginBottom: 4,
    textAlign: 'center',
    color: colors.brand,
    fontFamily: fontFamily.extraBold,
    fontSize: 30,
    letterSpacing: 6,
    fontVariant: ['tabular-nums'],
    borderRadius: radius.sm,
    backgroundColor: colors.brandTint,
    overflow: 'hidden',
  },

  personRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingVertical: 4 },
  personBody: { flex: 1, minWidth: 0 },
  personName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  personUser: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 1 },
  rowActions: { flexDirection: 'row' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  you: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13, paddingHorizontal: 8 },

  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  ok: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, marginBottom: 16 },
});
