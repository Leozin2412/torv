import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 24,
  },
  // Progress Bar
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 16,
  },
  progressSegment: {
    height: 4,
    flex: 1,
    backgroundColor: '#2C2C2E',
    marginHorizontal: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#8CC63F',
  },
  // Header Text
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
  },
  formContainer: {
    flex: 1,
  },
  // Gender Buttons
  genderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 32,
  },
  genderButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  genderButtonActiveMale: {
    borderColor: '#8CC63F',
    backgroundColor: '#1F2916',
  },
  genderButtonActiveFemale: {
    borderColor: '#8CC63F',
    backgroundColor: '#2A2A2A',
  },
  genderText: {
    color: '#FFF',
    fontSize: 90,
    fontWeight: 'bold',
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  navButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 16,
  },
});
