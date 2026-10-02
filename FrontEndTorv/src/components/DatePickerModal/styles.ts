import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

const CELL_HEIGHT = 44;

export const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.7)' },
  content: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14, marginBottom: 8 },
  year: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  selectedLabel: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 28, marginTop: 4, marginBottom: 16 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  navButton: { paddingVertical: 8 },
  // Em 320px o rótulo mais longo ("Novembro de 2000", ~163px + chevron) só cabe se cada seta ocupar 22px na linha.
  // A caixa mantém 38px de toque (16 de padding + ícone 22): margem -12 do lado da borda avança sobre o padding
  // de 20px do card, e margem -4 do lado do rótulo só invade o respiro transparente do ícone (~8px). 38 - 12 - 4 = 22.
  navPrev: { paddingLeft: 16, marginLeft: -12, marginRight: -4 },
  navNext: { paddingRight: 16, marginRight: -12, marginLeft: -4 },
  modeToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, flexShrink: 1 },
  monthLabel: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, flexShrink: 1 },
  // Altura fixa (cabeçalho + 6 semanas) pra o card não mudar de tamanho entre meses nem entre dias/meses/anos, e as setas não pularem.
  grid: { flexDirection: 'row', flexWrap: 'wrap', height: 7 * CELL_HEIGHT },
  cell: { width: `${100 / 7}%`, height: CELL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  monthCell: { width: `${100 / 3}%`, height: (7 * CELL_HEIGHT) / 4, alignItems: 'center', justifyContent: 'center' },
  monthPill: { minWidth: 72, height: 38, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  day: { width: '100%', maxWidth: 38, aspectRatio: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dayToday: { borderWidth: 1, borderColor: colors.brand },
  daySelected: { backgroundColor: colors.brand },
  dayText: { color: colors.text, fontFamily: fontFamily.regular, fontSize: 15 },
  dayTextSelected: { color: colors.background, fontFamily: fontFamily.extraBold },
  dayTextDisabled: { color: colors.textSecondary },
  disabled: { opacity: 0.3 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  actionButton: { flex: 1, width: undefined, marginTop: 0 },
});
