import React, { useCallback, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft, Flame, UserX } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ActivityIcon } from '../../components/ActivityIcon';
import { ActivityHeatmap } from '../../components/ActivityHeatmap';
import { usersApi, localDayQuery, type MemberProfileData } from '../../services/users';
import type { ActivityItem } from '../../services/activities';
import { activityLabel } from '../../utils/activities';
import { activityMeta } from '../../utils/activityMeta';
import { deltaLabel, plural } from '../../utils/profileStats';
import { FITNESS_LEVELS, fitnessLevelLabel } from '../../utils/profileOptions';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Status = 'loading' | 'ready' | 'missing' | 'error';
const PAGE = 20;

export default function MemberProfile() {
  const navigation = useNavigation<AppNavigation>();
  const { userId } = useRoute<RouteProp<AppStackParamList, 'MemberProfile'>>().params;
  const [data, setData] = useState<MemberProfileData | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0); // resposta de uma carga antiga chega depois → descarta

  const load = async (refresh = false) => {
    const id = ++request.current;
    if (refresh) setRefreshing(true);
    try {
      const [profile, page] = await Promise.all([
        usersApi.profile(userId, localDayQuery()),
        usersApi.activities(userId, { limit: PAGE }),
      ]);
      if (id !== request.current) return;
      setData(profile);
      setItems(page.activities);
      setNextBefore(page.next_before);
      setStatus('ready');
    } catch (error) {
      if (id !== request.current) return;
      // 404: saiu do grupo (ou nunca dividiu um). Some tudo da tela, nada de dado antigo.
      const missing = axios.isAxiosError(error) && error.response?.status === 404;
      if (missing) setData(null);
      setStatus(missing ? 'missing' : data ? 'ready' : 'error');
    } finally {
      if (id === request.current) setRefreshing(false);
    }
  };

  // Volta de outra tela: dados frescos (o membro pode ter treinado ou saído do grupo).
  useFocusEffect(useCallback(() => { load(); }, [userId]));

  const loadMore = async () => {
    if (!nextBefore || loadingMore || status !== 'ready') return;
    const id = request.current;
    setLoadingMore(true);
    try {
      const page = await usersApi.activities(userId, { before: nextBefore, limit: PAGE });
      if (id !== request.current) return;
      setItems((prev) => [...prev, ...page.activities]);
      setNextBefore(page.next_before);
    } catch {
      // Falhou ao paginar: fica o que já está na tela; o próximo fim de lista tenta de novo.
    } finally {
      setLoadingMore(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={26} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Perfil</Text>
    </View>
  );

  if (status === 'loading') {
    return <SafeAreaView style={styles.container}>{header}<ActivityIndicator color={colors.brand} style={styles.loading} /></SafeAreaView>;
  }
  if (status !== 'ready' || !data) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        <View style={styles.centered}>
          {status === 'missing' && <UserX color={colors.textSecondary} size={32} />}
          <Text style={status === 'missing' ? styles.missingTitle : styles.muted}>{status === 'missing' ? 'Perfil indisponível.' : 'Não foi possível carregar o perfil.'}</Text>
          {status === 'missing' && <Text style={styles.mutedSmall}>Vocês não estão mais em um grupo em comum.</Text>}
          {status === 'missing' && <Button title="Voltar" outline onPress={() => navigation.goBack()} />}
          {status === 'error' && <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); load(); }} />}
        </View>
      </SafeAreaView>
    );
  }

  const { user, streak, month, calendar } = data;
  const level = FITNESS_LEVELS.find((l) => l.value === user.fitness_level);

  const top = (
    <View>
      <View style={styles.identity}>
        {user.photo_url ? (
          <Image source={{ uri: user.photo_url }} style={styles.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.avatarEmpty}><Text style={styles.avatarInitial}>{user.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
        )}
        <Text style={styles.name} numberOfLines={2}>{data.is_me ? `${user.name} (você)` : user.name}</Text>
        <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
        <View style={[styles.levelChip, level && { borderColor: level.color }]}>
          <Text style={[styles.levelText, level && { color: level.color }]}>Nível físico: {fitnessLevelLabel(user.fitness_level)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <Card style={styles.gridCard}>
          <View style={styles.cardTitleRow}>
            <Flame color={colors.textSecondary} size={14} />
            <Text style={styles.cardTitle}>Streak</Text>
          </View>
          <Text style={styles.cardValue}>{streak.current}</Text>
          <Text style={styles.cardSub}>{streak.current === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
          <Text style={styles.cardHighlight}>Recorde: {plural(streak.longest, 'dia', 'dias')}</Text>
        </Card>
        <Card style={styles.gridCard}>
          <Text style={styles.cardTitle}>Este mês</Text>
          <Text style={styles.cardValue}>{month.active_days}</Text>
          <Text style={styles.cardSub}>{month.active_days === 1 ? 'dia ativo' : 'dias ativos'} · {plural(month.activities, 'atividade', 'atividades')}</Text>
          <Text style={styles.cardHighlight}>{deltaLabel(month.active_days_delta)}</Text>
        </Card>
      </View>

      <Card style={styles.calendarCard}>
        <Text style={styles.sectionTitle}>Atividade nos últimos 12 meses</Text>
        <ActivityHeatmap start={calendar.start} end={calendar.end} days={calendar.days} />
      </Card>

      <Text style={styles.sectionTitle}>Histórico</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={top}
        renderItem={({ item }) => (
          // Sem toque: o detalhe da atividade de outra pessoa fica de fora (spec).
          <Card style={styles.item}>
            <View style={styles.itemIcon}>
              <ActivityIcon type={item.activity_type} color={colors.brand} size={20} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title || activityLabel(item.activity_type)}</Text>
              <Text style={styles.itemMeta}>{activityMeta(item, { date: true })}</Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={<Card style={styles.empty}><Text style={styles.muted}>Nenhuma atividade ainda.</Text></Card>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.brand} style={styles.footer} /> : null}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />}
      />
    </SafeAreaView>
  );
}
