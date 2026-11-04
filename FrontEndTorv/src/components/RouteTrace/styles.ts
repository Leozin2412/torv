import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  box: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, overflow: 'hidden' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12, marginRight: 8 },
});
