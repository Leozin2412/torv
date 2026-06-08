import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '500',
  },
  nameText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: 'bold',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2C2C2E',
  },
  
  // Top Grid
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  streakCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  streakTitle: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  streakValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  streakSub: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  workoutCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    width: '48%',
    borderWidth: 1,
    borderColor: '#8CC63F',
  },
  workoutTitle: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  workoutValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  workoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workoutActionText: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Walk Card
  walkCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  walkIconBlock: {
    marginRight: 16,
  },
  walkInfo: {
    flex: 1,
  },
  walkTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  walkStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  walkStat: {
    color: '#8E8E93',
    fontSize: 12,
  },
  watchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  watchText: {
    color: '#8E8E93',
    fontSize: 12,
    marginLeft: 4,
  },

  // Main Calories Card
  caloriesSection: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  caloriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  caloriesTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  caloriesLink: {
    color: '#8CC63F',
    fontSize: 12,
  },
  caloriesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  calorieBox: {
    backgroundColor: '#2C2C2E',
    borderRadius: 16,
    padding: 16,
    width: '48%',
  },
  calorieBoxTitle: {
    color: '#8E8E93',
    fontSize: 14,
    marginBottom: 4,
  },
  calorieBoxValue: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  calorieBoxValueGreen: {
    color: '#8CC63F',
    fontSize: 24,
    fontWeight: 'bold',
  },
  calorieBoxSub: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 4,
  },
  remainingText: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 12,
  },

  // Feed Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionLink: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: '500',
  },
  feedCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
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
    borderColor: '#8CC63F',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedTime: {
    color: '#8E8E93',
    fontSize: 12,
  },
  feedStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  feedStatBlock: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#1C1C1E',
  },
  feedStatText: {
    color: '#8CC63F',
    fontSize: 14,
    fontWeight: 'bold',
  },
  feedContent: {
    color: '#E0E0E0',
    fontSize: 14,
    marginBottom: 16,
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
    color: '#8E8E93',
    fontSize: 12,
  },

  // Explorar Section
  exploreCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    position: 'relative',
    overflow: 'hidden',
  },
  exploreFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8CC63F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterPillDark: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterText: {
    color: '#121212',
    fontWeight: 'bold',
    fontSize: 12,
    marginLeft: 4,
  },
  filterTextDark: {
    color: '#FFF',
    fontWeight: '500',
    fontSize: 12,
    marginLeft: 4,
  },
  placeCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  placeTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  placeSub: {
    color: '#8E8E93',
    fontSize: 12,
  },
  placeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#8CC63F',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  placeButtonText: {
    color: '#8CC63F',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  }
});
