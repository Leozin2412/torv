import React from 'react';
import { Image, View, Text, type StyleProp, type ViewStyle } from 'react-native';
import { styles } from './styles';

interface Props {
  uri: string | null;
  name: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

// Capa do grupo; sem imagem, mostra a inicial do nome sobre um fundo da marca.
// A inicial acompanha a altura (miniatura de 64 e capa de 140 ficam proporcionais).
export const GroupCover: React.FC<Props> = ({ uri, name, height = 140, style }) =>
  uri ? (
    <Image
      source={{ uri }}
      style={[styles.image, { height }, style as any]}
      resizeMode="cover"
      accessibilityLabel={`Capa do grupo ${name}`}
    />
  ) : (
    <View style={[styles.placeholder, { height }, style]} accessibilityLabel={`Grupo ${name}, sem capa`}>
      <Text style={[styles.initial, { fontSize: Math.round(height * 0.42) }]}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
