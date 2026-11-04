import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  // Duas colunas; a última métrica, se sobrar sozinha, ocupa a linha inteira (flexGrow).
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: '45%', minWidth: 0, marginBottom: 0, paddingVertical: 14, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: radius.md },
  statLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12 },
  statValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, marginTop: 2, fontVariant: ['tabular-nums'] },
  statUnit: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12 },
  hint: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },

  // Parciais: Km | Tempo | Pace. O Km é mais estreito; "0,67 km" (sobra) cabe em 320 px.
  splits: { paddingVertical: 8, marginBottom: 0 },
  splitRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  splitRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  splitKm: { flex: 0.8 },
  splitHead: { flex: 1, color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 12 },
  splitCell: { flex: 1, color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 14, fontVariant: ['tabular-nums'] },
});
