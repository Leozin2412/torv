import React from 'react';
import { View, Text } from 'react-native';

import { Card } from '../Card';
import { RouteTrace } from '../RouteTrace';
import type { GpsMetrics } from '../../services/gps';
import { formatDistance, formatPace, splitRows } from '../../utils/gpsFormat';
import { formatClock } from '../../utils/clock';
import { styles } from './styles';

// Corpo de uma atividade de GPS (prévia do GpxImport e resumo do GpsActivity): grade de métricas, traçado e parciais.
// elapsed = "Tempo total" (só no resumo, onde ele já está gravado).
export function GpsMetricsView({ metrics, showElapsed = false }: { metrics: GpsMetrics; showElapsed?: boolean }) {
  const dash = '—';
  // `unit` em texto menor: "175 passos/min" não cabe na meia coluna de 320 px com o valor em 18 px.
  const stats: { label: string; value: string; unit?: string }[] = [
    { label: 'Distância', value: formatDistance(metrics.distance_m) },
    { label: 'Tempo', value: formatClock(metrics.duration_sec) },
    { label: 'Pace', value: metrics.pace_sec_per_km === null ? dash : formatPace(metrics.pace_sec_per_km) },
    { label: 'Elevação', value: metrics.elevation_gain_m === null ? dash : `${metrics.elevation_gain_m.toLocaleString('pt-BR')} m` },
    { label: 'FC média / máx', value: metrics.avg_hr === null ? dash : `${metrics.avg_hr} / ${metrics.max_hr}`, unit: metrics.avg_hr === null ? undefined : 'bpm' },
    { label: 'Cadência', value: metrics.avg_cadence === null ? dash : String(metrics.avg_cadence), unit: metrics.avg_cadence === null ? undefined : 'passos/min' },
    { label: 'Calorias', value: metrics.calories === null ? dash : `${metrics.calories} kcal` },
  ];
  if (showElapsed) stats.splice(2, 0, { label: 'Tempo total', value: formatClock(metrics.elapsed_sec) });

  return (
    <>
      <View style={styles.grid}>
        {stats.map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statValue}>{s.value}{!!s.unit && <Text style={styles.statUnit}> {s.unit}</Text>}</Text>
          </Card>
        ))}
      </View>
      {metrics.calories === null && <Text style={styles.hint}>Cadastre seu peso no Perfil para estimar as calorias.</Text>}

      {metrics.route.length > 1 && <RouteTrace route={metrics.route} />}

      {metrics.splits.length > 0 && (
        <Card style={styles.splits}>
          <View style={styles.splitRow}>
            <Text style={[styles.splitHead, styles.splitKm]}>Km</Text>
            <Text style={styles.splitHead}>Tempo</Text>
            <Text style={styles.splitHead}>Pace</Text>
          </View>
          {splitRows(metrics.splits).map((s) => (
            <View key={s.label} style={[styles.splitRow, styles.splitRowBorder]}>
              <Text style={[styles.splitCell, styles.splitKm]}>{s.label}</Text>
              <Text style={styles.splitCell}>{s.time}</Text>
              <Text style={styles.splitCell}>{s.pace}</Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}
