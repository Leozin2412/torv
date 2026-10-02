import React, { useCallback, useRef, useState } from 'react';
import { View, Text, SectionList, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Dumbbell, ChevronRight } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { activitiesApi, ACTIVITY_TYPES, type ActivityItem, type ActivityType } from '../../services/activities';
import { ACTIVITY_LABELS, activityLabel } from '../../utils/activities';
import { groupByDay, prependNew, type DayGroup } from '../../utils/historyGroups';
import { formatClock } from '../../utils/clock';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { historyStyles as styles } from './historyStyles';

const PAGE = 20;
const pad = (n: number) => String(n).padStart(2, '0');
const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

type Status = 'loading' | 'ready' | 'error';

export default function History({ onShowRoutines }: { onShowRoutines: () => void }) {
  const navigation = useNavigation<AppNavigation>();
  const [type, setType] = useState<ActivityType | undefined>(undefined); // undefined = Todos
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0); // resposta de um filtro antigo chega depois → descarta
  const loadedType = useRef<ActivityType | undefined | null>(null); // filtro da última carga ok; null = nunca carregou ou deu erro
  const offset = useRef(0); // posição da lista, para voltar do resumo no mesmo ponto
  const listRef = useRef<SectionList<ActivityItem, DayGroup<ActivityItem>>>(null);

  const loadFirst = async (filter: ActivityType | undefined, refresh = false) => {
    const id = ++request.current;
    offset.current = 0;
    loadedType.current = null; // carga em andamento invalida o atalho do foco (troca rápida A→B→A)
    if (refresh) setRefreshing(true);
    else setStatus('loading');
    try {
      const page = await activitiesApi.list({ type: filter, limit: PAGE });
      if (id !== request.current) return;
      setItems(page.activities);
      setNextBefore(page.next_before);
      setStatus('ready');
      loadedType.current = filter;
    } catch {
      if (id !== request.current) return;
      loadedType.current = null;
      setStatus('error');
    } finally {
      if (id === request.current) setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!nextBefore || loadingMore || status !== 'ready') return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const page = await activitiesApi.list({ type, before: nextBefore, limit: PAGE });
      if (id !== request.current) return;
      setItems((prev) => [...prev, ...page.activities]);
      setNextBefore(page.next_before);
    } catch {
      // Falha ao paginar não apaga o que já está na tela; o próximo fim de lista tenta de novo.
    } finally {
      setLoadingMore(false);
    }
  };

  // Volta do resumo (ou de um treino): só traz o que é novo no topo, sem spinner e sem desmontar a lista.
  // ponytail: mais de PAGE treinos novos fora da tela deixam um buraco entre eles e o resto; puxar para baixo recarrega.
  const refreshTop = async () => {
    const id = request.current;
    try {
      const page = await activitiesApi.list({ type, limit: PAGE });
      if (id === request.current) setItems((prev) => prependNew(prev, page.activities));
    } catch {
      // Falhou: fica o que já está na tela.
    }
  };

  // No web (native-stack) a tela de baixo fica com display:none enquanto o resumo está aberto, e isso zera o scrollTop.
  const restoreScroll = () => {
    const y = offset.current;
    requestAnimationFrame(() => listRef.current?.getScrollResponder()?.scrollTo({ y, animated: false }));
  };

  // Mesmo filtro já carregado → mantém a lista e a posição; filtro novo (ou 1ª vez, ou erro) → carga do zero.
  useFocusEffect(useCallback(() => {
    if (loadedType.current === type) {
      refreshTop();
      restoreScroll();
    } else loadFirst(type);
  }, [type]));

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
      {[undefined, ...ACTIVITY_TYPES].map((t) => {
        const active = t === type;
        return (
          <TouchableOpacity
            key={t ?? 'ALL'}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => setType(t)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            aria-selected={active} // react-native-web ignora accessibilityState
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{t ? ACTIVITY_LABELS[t] : 'Todos'}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (status !== 'ready') {
    return (
      <View style={[styles.container, styles.padded]}>
        {chips}
        {status === 'loading' ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          <View style={styles.centered}>
            <Text style={styles.message}>Não foi possível carregar o histórico.</Text>
            <Button title="Tentar de novo" outline onPress={() => loadFirst(type)} />
          </View>
        )}
      </View>
    );
  }

  return (
    <SectionList
      ref={listRef}
      style={styles.container}
      contentContainerStyle={styles.list}
      sections={groupByDay(items, new Date())}
      keyExtractor={(a) => a.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={chips}
      renderSectionHeader={({ section }) => <Text style={styles.dayTitle}>{section.title}</Text>}
      renderItem={({ item }) => {
        const title = item.title || activityLabel(item.activity_type);
        const content = (
          <Card style={styles.item}>
            <View style={styles.itemIcon}>
              <Dumbbell color={colors.brand} size={20} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
              <Text style={styles.itemMeta}>
                {timeOf(item.start_time)} · {formatClock(item.duration_sec)} · {item.set_count} {item.set_count === 1 ? 'série' : 'séries'}
              </Text>
            </View>
            {item.activity_type === 'STRENGTH' && <ChevronRight color={colors.textSecondary} size={20} />}
          </Card>
        );
        // Só musculação tem resumo (GET /workouts/sessions/:id).
        return item.activity_type === 'STRENGTH' ? (
          <TouchableOpacity
            onPress={() => navigation.navigate('WorkoutSummary', { sessionId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Ver treino ${title}`}
          >
            {content}
          </TouchableOpacity>
        ) : content;
      }}
      ListEmptyComponent={(
        <Card style={styles.empty}>
          <Dumbbell color={colors.textSecondary} size={28} />
          <Text style={styles.message}>Nenhum treino ainda</Text>
          <Button title="Ver meus treinos" outline onPress={onShowRoutines} />
        </Card>
      )}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : null}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      onScroll={(e) => { offset.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFirst(type, true)} tintColor={colors.brand} />}
    />
  );
}
