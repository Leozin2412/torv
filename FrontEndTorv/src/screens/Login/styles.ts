import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 32,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#8E8E93',
  },
  registerLink: {
    color: '#8CC63F',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  // Landing Layout
  landingContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  imageWrapper: {
    flex: 1.5,
    width: '100%',
  },
  landingImage: {
    width: '100%',
    height: '100%',
  },
  landingContent: {
    flex: 1,
    padding: 24,
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  landingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  landingTitleHighlight: {
    color: '#8CC63F',
  },
  landingSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 40,
  },
  backButton: {
    marginBottom: 24,
    marginTop: 16,
  },
  backButtonText: {
    color: '#8CC63F',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
