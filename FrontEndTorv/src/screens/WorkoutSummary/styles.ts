import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 64 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 15, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48, gap: 12 },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  heroTitle: { color: colors.brand, fontFamily: fontFamily.extraBold, fontSize: 22 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  statValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2, textAlign: 'center' },
  groupName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, marginBottom: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderTopWidth: 1, borderTopColor: colors.border },
  setLabel: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
  setValue: { width: 56, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
  restValue: { width: 116, color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  // Mesmo vermelho da sessão, em negrito pra não depender só da cor.
  overdue: { color: colors.error, fontFamily: fontFamily.semiBold },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'center' },
});
