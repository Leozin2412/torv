import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 48 },
  centered: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginVertical: 8 },

  // Cabeçalho simples (carregando / erro); com o grupo carregado a seta vai sobre a capa.
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
  cover: { borderRadius: radius.lg },
  backOnCover: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.72)',
  },

  info: { marginTop: 16, marginBottom: 16 },
  name: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 26, lineHeight: 32 },
  meta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, marginTop: 4 },
  period: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, marginTop: 6 },
  periodEnded: { color: colors.textSecondary },

  ownerActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  ownerButton: { flex: 1, width: 'auto', marginTop: 0 },

  joinCard: { marginBottom: 16, gap: 4 },
  joinText: { color: colors.textMuted, fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22 },
  message: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 20, marginBottom: 16 },

  rankingBox: { marginTop: 8 },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, marginBottom: 12 },

  // Top 3: número em verde e barra à esquerda. Eu: fundo em tinta, borda verde e "(você)" no texto.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowMe: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  rowTop: { borderLeftWidth: 4, borderLeftColor: colors.brand },
  position: { width: 28, textAlign: 'center', color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 16 },
  positionTop: { color: colors.brand, fontFamily: fontFamily.extraBold, fontSize: 20 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt },
  avatarEmpty: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  avatarInitial: { color: colors.textMuted, fontFamily: fontFamily.semiBold, fontSize: 16 },
  rowBody: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  rowUser: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 1 },
  points: { minWidth: 44, alignItems: 'flex-end' },
  pointsValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, lineHeight: 24 },
  pointsLabel: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 12 },
});
