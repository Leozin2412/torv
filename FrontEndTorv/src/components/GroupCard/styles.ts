import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
    paddingVertical: 10, // texto quebrado em várias linhas não encosta na borda
    paddingLeft: 8,
    paddingRight: 12,
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  thumb: {
    flexShrink: 0,
    width: 64,
    height: 64,
    borderRadius: radius.sm,
  },
  body: {
    flex: 1,
    minWidth: 0, // o texto quebra de linha dentro da coluna em vez de empurrar o chevron para fora (320 px)
    marginHorizontal: 12,
  },
  // Nada de linha única: o estado do período ("Encerrado em…", "Começa em…") é justo o que a pessoa procura.
  name: {
    fontSize: 16,
    lineHeight: 21,
    fontFamily: fontFamily.semiBold,
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.semiBold,
    color: colors.brand,
  },
});
