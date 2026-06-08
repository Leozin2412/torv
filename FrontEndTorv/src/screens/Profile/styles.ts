import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingHorizontal: 20,
    paddingTop: 48,
  },
  scrollContainer: {
    paddingBottom: 40,
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
    fontWeight: 'bold',
    color: '#FFF',
  },
  menuButton: {
    padding: 10,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
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
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#8CC63F',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#8CC63F',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#121212',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  username: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 2,
  },
  // Modals (Futuristic Design)
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#8CC63F',
    shadowColor: '#8CC63F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    padding: 24,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
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
    borderRadius: 12,
    shadowColor: '#8CC63F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  futuristicButtonGradient: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  futuristicButtonText: {
    color: '#121212',
    fontWeight: '900',
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
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 14,
    color: '#8E8E93',
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
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
  },
  gridCardTitle: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  gridCardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  gridCardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  gridCardHighlight: {
    fontSize: 14,
    color: '#8CC63F',
    fontWeight: 'bold',
    marginTop: 4,
  },
  // Sections
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 12,
    marginTop: 8,
  },
  // List Cards (Objetivo, Relógio, Histórico)
  listCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  listCardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  listCardIconText: {
    fontSize: 24,
  },
  listCardContent: {
    flex: 1,
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  listCardSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  listCardRight: {
    marginLeft: 16,
  },
  connectedText: {
    fontSize: 14,
    color: '#8CC63F',
  },
});
