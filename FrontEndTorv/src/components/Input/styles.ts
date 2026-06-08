import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    color: '#E0E0E0',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderRadius: 12,
    color: '#FFF',
    paddingHorizontal: 16,
    height: 50,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: '#8CC63F',
  },
  error: {
    color: '#FF453A',
    fontSize: 12,
    marginTop: 4,
  },
});
