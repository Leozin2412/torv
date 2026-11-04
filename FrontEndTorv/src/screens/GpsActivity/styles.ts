import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme/tokens';

const TOUCH = 44;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 64 },
  centered: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 15, textAlign: 'center', marginTop: 64 },
  // Seta de voltar com alvo de 44 px; o padding alinha o traço da seta com o texto (20 px).
  header: { paddingHorizontal: 8, paddingTop: 8 },
  back: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 12 },

  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { flex: 1, color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 30 },
  pencil: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  when: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, fontVariant: ['tabular-nums'] },
  editActions: { flexDirection: 'row', gap: 8 },
  editButton: { flex: 1, width: undefined, marginTop: 0 },
  error: { color: colors.error, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
