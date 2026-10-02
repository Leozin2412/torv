import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.7)' },
  content: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 16, width: '100%', maxWidth: 420, alignSelf: 'center' },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22, lineHeight: 28 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  pointIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
});
