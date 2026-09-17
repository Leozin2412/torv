import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.brand,
    height: 50,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.brand,
  },
  buttonOutlineDanger: {
    borderColor: colors.error,
  },
  buttonSolidDanger: {
    backgroundColor: colors.error,
  },
  text: {
    color: colors.background,
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
  },
  textOutline: {
    color: colors.brand,
  },
  textOutlineDanger: {
    color: colors.error,
  },
  textSolidDanger: {
    color: colors.text,
  },
});
