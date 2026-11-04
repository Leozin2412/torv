import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, type GestureResponderEvent } from 'react-native';

import { buildHeatmap, cellAt, cellLabel, type HeatCell } from '../../utils/heatmap';
import { CELL, GAP, LEVEL_COLORS, styles } from './styles';

interface Props {
  start: string;
  end: string;
  days: { date: string; count: number }[];
}

// Linhas 1, 3 e 5 (segunda, quarta e sexta), como no GitHub.
const WEEKDAY_LABELS = ['', 'Seg', '', 'Qua', '', 'Sex', ''];

export function ActivityHeatmap({ start, end, days }: Props) {
  const data = useMemo(() => buildHeatmap(start, end, days), [start, end, days]);
  const [selected, setSelected] = useState<HeatCell | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const gridRef = useRef<View>(null);
  const pitch = CELL + GAP;

  // Um único alvo de toque para a grade inteira (371 botões seriam pesados e poluiriam o leitor de tela).
  // No web o onPress chega como click do DOM, sem locationX/Y (RNW 0.21): usa a posição do toque na janela
  // menos a da grade na janela, que vale no web e no celular (já desconta o scroll horizontal).
  const onPress = (e: GestureResponderEvent) => {
    const ne = e.nativeEvent as unknown as { clientX?: number; clientY?: number; pageX?: number; pageY?: number };
    const x = ne.clientX ?? ne.pageX;
    const y = ne.clientY ?? ne.pageY;
    if (x == null || y == null) return;
    gridRef.current?.measureInWindow((gx, gy) => {
      const pos = cellAt(x - gx, y - gy, CELL, GAP);
      setSelected(pos ? data.weeks[pos.week]?.[pos.day] ?? null : null);
    });
  };

  const summary = `${data.activeDays} ${data.activeDays === 1 ? 'dia ativo' : 'dias ativos'} nos últimos 12 meses`;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.weekdays}>
          {WEEKDAY_LABELS.map((label, i) => <Text key={i} style={styles.weekday}>{label}</Text>)}
        </View>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Abre na semana atual, como o GitHub no celular.
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <View style={[styles.months, { width: data.weeks.length * pitch }]}>
              {data.months.map((m) => (
                <Text key={`${m.label}-${m.week}`} style={[styles.month, { left: m.week * pitch }]}>{m.label}</Text>
              ))}
            </View>
            <Pressable onPress={onPress} accessibilityRole="image" accessibilityLabel={summary}>
              <View ref={gridRef} style={styles.grid}>
                {data.weeks.map((week, w) => (
                  <View key={w} style={styles.week}>
                    {week.map((cell, d) => (
                      <View
                        key={d}
                        style={[
                          styles.cell,
                          { backgroundColor: cell ? LEVEL_COLORS[cell.level] : 'transparent' },
                          cell !== null && selected?.date === cell.date && styles.cellSelected,
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </Pressable>
          </View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.selected}>{selected ? cellLabel(selected) : 'Toque num dia para ver o total'}</Text>
        <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.legendText}>Menos</Text>
          {LEVEL_COLORS.map((c) => <View key={c} style={[styles.legendCell, { backgroundColor: c }]} />)}
          <Text style={styles.legendText}>Mais</Text>
        </View>
      </View>
    </View>
  );
}
