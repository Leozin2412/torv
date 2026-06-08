import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  button: {
    backgroundColor: '#8CC63F',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8CC63F',
  },
  text: {
    color: '#121212',
    fontSize: 16,
    fontWeight: 'bold',
  },
  textOutline: {
    color: '#8CC63F',
  },
});
