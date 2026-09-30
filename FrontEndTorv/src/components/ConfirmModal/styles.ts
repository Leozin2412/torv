import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  content: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 24, gap: 12 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20 },
  message: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
