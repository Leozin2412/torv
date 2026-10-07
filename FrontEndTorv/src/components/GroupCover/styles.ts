import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  image: {
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt, // aparece enquanto a imagem carrega
  },
  // Sem capa: a inicial do grupo, grande, sobre o verde-escuro da marca. Mesma borda dos cards.
  placeholder: {
    width: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.brandTint,
    borderWidth: 1,
    borderColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontFamily: fontFamily.extraBold,
    color: colors.brand,
  },
});
