export const colors = {
  background: '#121212',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  border: '#2C2C2E',
  brand: '#8CC63F',
  brandDark: '#5A9E1C',
  brandTint: '#1F2916',
  text: '#FFFFFF',
  textSecondary: '#8F958A', // cinza com leve subtom verde da marca, substitui o systemGray do iOS
  textMuted: '#E0E0E0',
  error: '#FF453A',
  // Paleta de apoio própria TORV (substitui os tokens de sistema iOS)
  accentProtein: '#E8A33D', // proteína
  accentCarbs: '#4DB6E0', // carboidrato
  accentFat: '#C77DFF', // gordura
  accentIntermediate: '#E8A33D',
  accentAdvanced: '#E0524D',
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

export const fontFamily = {
  regular: 'Sora_400Regular',
  semiBold: 'Sora_600SemiBold',
  extraBold: 'Sora_800ExtraBold',
};

export const fontWeights = {
  regular: '400' as const,
  semiBold: '600' as const,
  extraBold: '800' as const,
};
