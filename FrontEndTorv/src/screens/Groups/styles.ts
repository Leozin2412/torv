import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

// Mesma linguagem da aba Treinos: título grande, controle segmentado em tinta, ação em tracejado verde.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // paddingBottom grande: a tab bar flutuante cobre ~110 px.
  scroll: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 130 },
  title: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 32, marginBottom: 16 },

  // Criar grupo | Entrar com código: lado a lado; o texto quebra em 2 linhas em 320 px.
  actions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 52,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  actionText: { flexShrink: 1, color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 14, lineHeight: 18, textAlign: 'center' },

  // Meus grupos | Descobrir
  segments: { flexDirection: 'row', padding: 4, marginBottom: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.brandTint },
  segmentText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 14 },
  segmentTextActive: { color: colors.brand },

  // Convites recebidos: caixa verde-tinta (algo que espera resposta). O nome ocupa a linha de cima;
  // Aceitar e Recusar descem para a de baixo quando não cabem (320 px).
  invites: { marginBottom: 16, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.brandTint },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  invite: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 },
  inviteThumb: { width: 48, height: 48, borderRadius: radius.sm },
  inviteBody: { flex: 1, minWidth: 160, marginLeft: 4 },
  inviteName: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 15 },
  inviteFrom: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },
  inviteButton: { width: 'auto', flexGrow: 1, flexBasis: 110, height: 44, marginTop: 0 },
  error: { color: colors.error, fontFamily: fontFamily.regular, fontSize: 14, marginTop: 12 },

  loading: { marginTop: 32 },
  centered: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 8 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    marginBottom: 16,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: 50, color: colors.text, fontFamily: fontFamily.regular, fontSize: 16 },
});
