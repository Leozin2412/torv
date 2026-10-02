import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 64 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 15, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 32, paddingBottom: 48, gap: 12 },
  // Seta de voltar (modo histórico): alvo de 44 px; o padding alinha o traço da seta com o texto (20 px).
  header: { paddingHorizontal: 8, paddingTop: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scrollUnderHeader: { paddingTop: 8 },
  hero: { alignItems: 'center', gap: 8, marginBottom: 8 },
  heroTitle: { color: colors.brand, fontFamily: fontFamily.extraBold, fontSize: 22 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 6, alignItems: 'center' },
  statValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2, textAlign: 'center' },
  groupName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, marginBottom: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40, borderTopWidth: 1, borderTopColor: colors.border },
  // Rótulo e carga empilhados: em 320 px não cabe "Série 1 · 62,5 kg" ao lado da duração e do descanso.
  setLabelBox: { flex: 1, paddingVertical: 6 },
  setLabel: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14 },
  setWeight: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 13, marginTop: 1, fontVariant: ['tabular-nums'] },
  setValue: { width: 56, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
  restValue: { width: 116, color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  // Mesmo vermelho da sessão, em negrito pra não depender só da cor.
  overdue: { color: colors.error, fontFamily: fontFamily.semiBold },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, textAlign: 'center' },

  changes: { gap: 10, borderWidth: 1, borderColor: colors.brand },
  changesTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16 },
  changeItem: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  changesOk: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14 },
  changesNote: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
});
