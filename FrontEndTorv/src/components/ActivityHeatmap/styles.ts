import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme/tokens';

export const CELL = 12;
export const GAP = 3;
const MONTH_ROW = 16;
// Nível 0 = sem atividade; 1, 2 e 3+ atividades no dia vão do verde escuro até a cor da marca.
export const LEVEL_COLORS = [colors.surfaceAlt, '#3F6B22', colors.brandDark, colors.brand];

export const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  weekdays: { marginTop: MONTH_ROW, marginRight: 6 },
  weekday: { height: CELL, marginBottom: GAP, fontSize: 10, lineHeight: CELL, color: colors.textSecondary, fontFamily: fontFamily.regular },
  months: { height: MONTH_ROW },
  month: { position: 'absolute', top: 0, fontSize: 11, color: colors.textSecondary, fontFamily: fontFamily.regular },
  // pointerEvents no estilo (a prop está depreciada): o toque cai no Pressable que envolve a grade.
  grid: { flexDirection: 'row', pointerEvents: 'none' },
  week: { marginRight: GAP },
  cell: { width: CELL, height: CELL, borderRadius: 3, marginBottom: GAP },
  cellSelected: { borderWidth: 1.5, borderColor: colors.text },
  footer: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  selected: { color: colors.textMuted, fontSize: 12, fontFamily: fontFamily.regular, flexShrink: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { color: colors.textSecondary, fontSize: 10, fontFamily: fontFamily.regular, marginHorizontal: 2 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
});
