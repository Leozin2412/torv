import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { GroupCover } from '../GroupCover';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface Props {
  name: string;
  coverUri: string | null;
  subtitle: string; // "12 membros · 3 dias restantes"
  meta?: string; // "#2 · 7 dias" (só nos meus grupos)
  onPress: () => void;
}

export const GroupCard: React.FC<Props> = ({ name, coverUri, subtitle, meta, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${name}. ${subtitle}${meta ? `. ${meta}` : ''}`}>
    <GroupCover uri={coverUri} name={name} height={64} style={styles.thumb} />
    <View style={styles.body}>
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
      <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      {meta ? <Text style={styles.meta} numberOfLines={1}>{meta}</Text> : null}
    </View>
    <ChevronRight color={colors.textSecondary} size={20} />
  </TouchableOpacity>
);
