import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 100,
  },
  // Top Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameText: {
    color: colors.text,
    fontSize: 32,
    fontFamily: fontFamily.extraBold,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceAlt,
  },
  avatarIcon: {
    position: 'absolute',
    top: 12,
    left: 12,
  },

  // Top Grid
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  streakCard: {
    width: '48%',
  },
  streakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  streakTitle: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
  },
  streakValue: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fontFamily.extraBold,
  },
  streakSub: {
    color: colors.brand,
    fontSize: 12,
    fontFamily: fontFamily.semiBold,
    marginTop: 4,
  },
  workoutCard: {
    width: '48%',
    borderColor: colors.brand,
  },
  workoutTitle: {
    color: colors.brand,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    marginBottom: 8,
  },
  workoutValue: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
    marginBottom: 8,
  },
  workoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutActionText: {
    color: colors.brand,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
    marginLeft: 4,
  },

  // Walk Card
  walkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  walkIconBlock: {
    marginRight: 16,
  },
  walkInfo: {
    flex: 1,
  },
  walkTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    marginBottom: 4,
  },
  walkStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  walkStat: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  watchText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 4,
  },

  // Main Calories Card
  caloriesSection: {
    borderRadius: radius.xl,
    padding: 20,
    marginBottom: 24,
  },
  caloriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  caloriesTitle: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
  caloriesLink: {
    color: colors.brand,
    fontSize: 12,
  },
  caloriesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  calorieBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 16,
    width: '48%',
  },
  calorieBoxTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  calorieBoxValue: {
    color: colors.text,
    fontSize: 24,
    fontFamily: fontFamily.extraBold,
  },
  calorieBoxValueGreen: {
    color: colors.brand,
    fontSize: 24,
    fontFamily: fontFamily.extraBold,
  },
  calorieBoxSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  remainingText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 12,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  retryText: {
    color: colors.brand,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },

  // Feed Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
  },
  sectionLink: {
    color: colors.brand,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },
  feedCard: {
    marginBottom: 24,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.brand,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedName: {
    color: colors.text,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
  feedTime: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  feedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 12,
    marginBottom: 16,
  },
  feedStatBlock: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: colors.surface,
  },
  feedStatText: {
    color: colors.brand,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
  },
  feedContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  feedContent: {
    color: colors.textMuted,
    fontSize: 14,
  },
  feedFooter: {
    flexDirection: 'row',
    gap: 16,
  },
  feedAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedActionText: {
    color: colors.textSecondary,
    fontSize: 12,
  },

  // Explorar Section
  exploreCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 16,
  },
  exploreFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  filterPillDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  filterText: {
    color: colors.background,
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    marginLeft: 4,
  },
  filterTextDark: {
    color: colors.text,
    fontFamily: fontFamily.semiBold,
    fontSize: 12,
    marginLeft: 4,
  },
  placeCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeTitle: {
    color: colors.text,
    fontSize: 14,
    fontFamily: fontFamily.semiBold,
    marginBottom: 4,
  },
  placeSub: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  placeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: colors.brand,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  placeButtonText: {
    color: colors.brand,
    fontSize: 12,
    fontFamily: fontFamily.semiBold,
    marginRight: 4,
  }
});
