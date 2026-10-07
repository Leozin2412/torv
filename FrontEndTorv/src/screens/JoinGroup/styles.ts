import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },

  body: { paddingHorizontal: 20, paddingTop: 8 },
  loading: { marginTop: 16 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 16 },

  // Prévia do grupo: a capa e o nome aparecem antes de qualquer compromisso.
  preview: { marginTop: 24 },
  name: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 30, marginTop: 16 },
  meta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 4 },
});
