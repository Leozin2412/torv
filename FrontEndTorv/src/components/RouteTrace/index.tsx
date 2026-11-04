import React, { useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';

import { projectRoute } from '../../utils/routeProjection';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

// Traçado da rota (só para o dono da atividade). Sem mapa de fundo: nada de chave de API nem localização enviada a terceiros.
export function RouteTrace({ route, height = 200 }: { route: [number, number][]; height?: number }) {
  const [width, setWidth] = useState(0);
  const pts = useMemo(() => projectRoute(route, width, height, 16), [route, width, height]);
  const start = pts[0];
  const end = pts[pts.length - 1];
  return (
    <View>
      <View
        style={[styles.box, { height }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessibilityRole="image"
        accessibilityLabel="Traçado da rota"
      >
        {width > 0 && pts.length > 1 && (
          <Svg width={width} height={height}>
            <Polyline points={pts.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={colors.brand} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            {/* Fim maior e por baixo: em ida e volta o Início (por cima) continua visível. */}
            <Circle cx={end[0]} cy={end[1]} r={8} fill={colors.text} stroke={colors.background} strokeWidth={2} />
            <Circle cx={start[0]} cy={start[1]} r={5} fill={colors.brand} stroke={colors.background} strokeWidth={2} />
          </Svg>
        )}
      </View>
      <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={[styles.dot, { backgroundColor: colors.brand }]} /><Text style={styles.legendText}>Início</Text>
        <View style={[styles.dot, { backgroundColor: colors.text }]} /><Text style={styles.legendText}>Fim</Text>
      </View>
    </View>
  );
}
