import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

const TOUCH = 44;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 64 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 4 },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  routineName: { flex: 1, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, paddingRight: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },

  // Total numa faixa discreta; o cronômetro da fase (série/descanso) é o herói da tela.
  timers: { gap: 12 },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  phaseBox: {
    flexDirection: 'column',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 20,
  },
  // Descanso estourado: o bloco inteiro vira vermelho sólido, texto branco.
  timerBoxOverdue: { backgroundColor: colors.error, borderColor: colors.error },
  timerLabel: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  timerValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 28, fontVariant: ['tabular-nums'] },
  phaseValue: { fontSize: 72, lineHeight: 84, marginTop: 4, letterSpacing: -1 },
  timerTarget: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 15, marginTop: 2, fontVariant: ['tabular-nums'] },
  overdueText: { color: colors.text },

  exerciseCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, borderLeftWidth: 4, borderLeftColor: colors.brand },
  exerciseGroup: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 13 },
  exerciseName: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 30, marginTop: 4 },
  setInfo: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 16, marginTop: 10 },
  targets: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  target: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 15 },

  mainButton: { height: 64, marginTop: 0, paddingHorizontal: 16 },
  secondaryRow: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap' },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: TOUCH, paddingHorizontal: 12 },
  secondaryText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },

  upcoming: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, gap: 8 },
  upcomingTitle: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  upcomingItem: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
});
