import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
    padding: 8,
    paddingRight: 12,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
  },
  body: {
    flex: 1,
    minWidth: 0, // deixa o numberOfLines cortar o nome em vez de empurrar o chevron para fora (320 px)
    marginHorizontal: 12,
  },
  name: {
    fontSize: 16,
    fontFamily: fontFamily.semiBold,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: fontFamily.semiBold,
    color: colors.brand,
  },
});
