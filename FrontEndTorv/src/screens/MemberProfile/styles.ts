import { StyleSheet } from 'react-native';
import { colors, radius, fontFamily } from '../../theme/tokens';

// Mesma linguagem do Profile: fundo escuro, cards em grade, verde da marca só nos destaques.
export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: 48 },
  centered: { alignItems: 'center', gap: 12, paddingVertical: 32, paddingHorizontal: 20 },
  muted: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  missingTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, textAlign: 'center' },
  mutedSmall: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 20, marginLeft: 4 },

  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  // Identidade: o nome quebra em até 2 linhas e o @username fica em 1, mesmo em 320 px.
  identity: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.brand, backgroundColor: colors.surfaceAlt, marginBottom: 12 },
  avatarEmpty: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.brand,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitial: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 38 },
  name: { alignSelf: 'stretch', color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  username: { alignSelf: 'stretch', color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 16, marginTop: 2, textAlign: 'center' },
  levelChip: { marginTop: 12, paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  levelText: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },

  // minWidth: 0 deixa os dois cards encolherem lado a lado sem cortar o texto.
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  gridCard: { flex: 1, minWidth: 0, borderRadius: radius.lg },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  cardTitle: { color: colors.textSecondary, fontFamily: fontFamily.semiBold, fontSize: 13 },
  cardValue: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 28, marginBottom: 4 },
  cardSub: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  cardHighlight: { color: colors.brand, fontFamily: fontFamily.semiBold, fontSize: 13, lineHeight: 18, marginTop: 4 },

  // O calendário rola só dentro do card (o ScrollView horizontal fica no componente).
  calendarCard: { borderRadius: radius.lg, marginBottom: 16, overflow: 'hidden' },
  sectionTitle: { color: colors.text, fontFamily: fontFamily.extraBold, fontSize: 18, marginBottom: 12 },

  item: { borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { color: colors.text, fontFamily: fontFamily.semiBold, fontSize: 16, marginBottom: 4 },
  itemMeta: { color: colors.textSecondary, fontFamily: fontFamily.regular, fontSize: 14 },
  empty: { borderRadius: radius.lg, alignItems: 'center' },
  footer: { marginVertical: 16 },
});
