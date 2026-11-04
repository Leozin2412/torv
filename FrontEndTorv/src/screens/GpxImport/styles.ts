import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

const TOUCH = 44;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Seta de voltar com alvo de 44 px; o padding alinha o traço da seta com o texto (20 px).
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingTop: 8 },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },
  headerSub: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 12 },

  pickCard: { alignItems: 'center', gap: 8, paddingVertical: 28, marginBottom: 0 },
  pickTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 17, textAlign: 'center' },
  pickHint: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  // Tipo do arquivo ≠ tipo da rotina: contorno da marca, igual ao "changes" do WorkoutSummary.
  warning: { gap: 12, borderColor: colors.brand, marginBottom: 0 },
  warningText: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  segmented: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  segment: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.brandTint },
  segmentText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  segmentTextActive: { color: colors.brand },
});
