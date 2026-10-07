import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

// Mesmos rótulos e campos do Input e do RoutineEditor, para o formulário parecer do mesmo app.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 48 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  // A capa inteira é o botão; o selo no canto diz o que ela faz.
  coverButton: { marginBottom: 16 },
  coverBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(18, 18, 18, 0.78)',
  },
  coverBadgeText: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 13 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, marginBottom: 8 },
  switchText: { flex: 1 },
  label: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 14 },
  hint: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, marginTop: 2, marginBottom: 8 },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  dateLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
  dateValue: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16 },

  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginTop: 8 },
});
