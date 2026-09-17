import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
  },
  dateSelector: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    marginBottom: 0,
  },
  dateItemActive: {
    borderColor: colors.brand,
  },
  dateDay: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  dateNumber: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fontFamily.semiBold,
  },
  mainCaloriesCard: {
    padding: 20,
    marginBottom: 16,
  },
  caloriesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  caloriesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editTargetButton: {
    marginLeft: 8,
  },
  mainCaloriesTitle: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
  mainCaloriesValue: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fontFamily.extraBold,
  },
  mainCaloriesGoal: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
  mainCaloriesBar: {
    height: 12,
  },
  valueOverGoal: {
    color: colors.error,
  },
  macrosContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  macroCard: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    marginBottom: 0,
  },
  macroTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  macroValue: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fontFamily.semiBold,
    marginBottom: 8,
  },
  macroGoal: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    marginBottom: 16,
  },
  mealCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
  },
  mealEmptyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  mealInfo: {
    flex: 1,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mealName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    marginBottom: 4,
  },
  mealMacros: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  mealCalories: {
    color: colors.brand,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
  dateLoadingIndicator: {
    marginTop: 20,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.brand,
    borderWidth: 1,
    padding: 16,
    borderRadius: radius.sm,
    marginTop: 8,
    marginBottom: 32,
  },
  addMealIcon: {
    marginRight: 8,
  },
  addMealText: {
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formRowItem: {
    flex: 1,
  },
  formError: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: 24,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModalContent: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 24,
  },
  deleteModalText: {
    color: colors.textMuted,
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalButton: {
    flex: 1,
    width: undefined,
    marginTop: 0,
  },
});
