import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

const TOUCH = 44;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  loading: { marginTop: 64 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  headerTitle: { flex: 1, color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 22 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginRight: -8 },
  exerciseName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, lineHeight: 22 },
  exerciseGroup: { color: colors.brand, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },
  iconButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },

  // Descanso quebra pra linha de baixo em telas estreitas (320 px).
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  field: { flexGrow: 1, flexBasis: 72 },
  restField: { flexBasis: 136 },
  fieldLabel: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 12, marginBottom: 6 },
  smallInput: {
    height: TOUCH,
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  stepper: {
    height: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },
  stepperButton: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, fontVariant: ['tabular-nums'] },

  // Séries como ficha de academia: rótulo discreto, carga grande à direita.
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, borderTopWidth: 1, borderTopColor: colors.border },
  setLabel: { flex: 1, color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
  weightInput: {
    width: 96,
    height: TOUCH,
    color: colors.text,
    fontFamily: fontFamily.extraBold,
    fontSize: 20,
    fontVariant: ['tabular-nums'],
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    textAlign: 'right',
  },
  kg: { width: 20, color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  setActions: { flexDirection: 'row', gap: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 },
  setActionButton: { minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 8 },
  setAction: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14 },
  disabled: { color: colors.textSecondary, opacity: 0.5 },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
    marginBottom: 16,
  },
  addText: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 15 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  deleteButton: { marginTop: 12 },
});
