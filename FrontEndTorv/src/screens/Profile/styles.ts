import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
  },
  menuButton: {
    padding: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  // Profile Section
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.brand,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.brand,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  name: {
    fontSize: 24,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  username: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  usernameEditButton: {
    marginLeft: 8,
  },
  // Modals (Futuristic Design)
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.brand,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    padding: 24,
    overflow: 'hidden',
  },
  goalModalContent: {
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  goalModalPadded: {
    paddingHorizontal: 24,
  },
  goalScrollView: {
    maxHeight: 450,
    paddingHorizontal: 24,
  },
  goalSelectCard: {
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  modalFooter: {
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  futuristicButton: {
    marginTop: 16,
    borderRadius: radius.sm,
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  futuristicButtonGradient: {
    paddingVertical: 16,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  futuristicButtonText: {
    color: colors.background,
    fontFamily: fontFamily.extraBold,
    fontSize: 15,
    letterSpacing: 1,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
  },
  statLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  // Grid Cards
  gridContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  gridCard: {
    flex: 1,
    borderRadius: radius.lg,
  },
  gridCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  gridCardTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: fontFamily.semiBold,
    marginBottom: 8,
  },
  gridCardValue: {
    fontSize: 28,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    marginBottom: 4,
  },
  gridCardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  gridCardHighlight: {
    fontSize: 14,
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
    marginTop: 4,
  },
  // Sections
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleInline: {
    fontSize: 18,
    fontFamily: fontFamily.extraBold,
    color: colors.text,
  },
  editLink: {
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
  },
  // List Cards (Objetivo, Relógio, Histórico)
  listCard: {
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  listCardContent: {
    flex: 1,
  },
  listCardTitle: {
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    color: colors.text,
    marginBottom: 4,
  },
  listCardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listCardRight: {
    marginLeft: 16,
  },
  connectedText: {
    fontSize: 14,
    color: colors.brand,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.brand,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
  },
  addMealIcon: {
    marginRight: 8,
  },
  addMealText: {
    color: colors.brand,
    fontFamily: fontFamily.semiBold,
    fontSize: 16,
  },
});
