import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { GroupCover } from '../../components/GroupCover';
import { AuthContext } from '../../contexts/AuthContext';
import { groupsApi, type GroupDetailData, type RankingRow } from '../../services/groups';
import { groupStatus, periodLabel, formatDay } from '../../utils/groupPeriod';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Status = 'loading' | 'ready' | 'missing' | 'error';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function GroupDetail() {
  const navigation = useNavigation<AppNavigation>();
  const { groupId } = useRoute<RouteProp<AppStackParamList, 'GroupDetail'>>().params;
  const { user } = useContext(AuthContext);
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const detail = await groupsApi.get(groupId);
      setGroup(detail);
      setRanking(detail.is_member ? await groupsApi.ranking(groupId) : []);
      setStatus('ready');
    } catch (error) {
      setStatus(axios.isAxiosError(error) && error.response?.status === 404 ? 'missing' : 'error');
    } finally {
      setRefreshing(false);
    }
  };

  // Volta de GroupEditor / GroupManage: tudo fresco (nome, capa, período, membros, ranking).
  useFocusEffect(useCallback(() => { load(); }, [groupId]));

  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await run();
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const requestJoin = () => act(async () => {
    await groupsApi.requestJoin(groupId);
    setMessage('Pedido enviado. O dono do grupo vai analisar.');
    await load();
  });

  const answerInvitation = (accept: boolean) => act(async () => {
    const id = group?.my_invitation?.id;
    if (!id) return;
    if (accept) await groupsApi.accept(id);
    else await groupsApi.decline(id);
    await load();
  });

  const leave = () => act(async () => {
    if (!user?.id) return;
    await groupsApi.removeMember(groupId, user.id);
    setConfirmLeave(false);
    navigation.goBack();
  });

  const back = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={26} />
      </TouchableOpacity>
    </View>
  );

  if (status === 'loading') {
    return <SafeAreaView style={styles.container}>{back}<ActivityIndicator color={colors.brand} style={styles.loading} /></SafeAreaView>;
  }
  if (status === 'missing' || status === 'error' || !group) {
    return (
      <SafeAreaView style={styles.container}>
        {back}
        <View style={styles.centered}>
          <Text style={styles.muted}>{status === 'missing' ? 'Grupo não encontrado.' : 'Não foi possível carregar o grupo.'}</Text>
          {status === 'error' && <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); load(); }} />}
        </View>
      </SafeAreaView>
    );
  }

  const state = groupStatus(group);
  const invitedByAdmin = group.my_invitation?.kind === 'INVITE';
  const requested = group.my_invitation?.kind === 'REQUEST';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.brand} />}>
        <View>
          <GroupCover uri={group.cover_url} name={group.name} height={180} style={styles.cover} />
          <TouchableOpacity style={styles.backOnCover} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
            <ArrowLeft color={colors.text} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{group.name}</Text>
          <Text style={styles.meta}>
            {group.visibility === 'PUBLIC' ? 'Público' : 'Privado'} · {plural(group.member_count, 'membro', 'membros')}
          </Text>
          <Text style={[styles.period, state === 'ended' && styles.periodEnded]}>
            {formatDay(group.starts_at)} {group.ends_at ? `→ ${formatDay(group.ends_at)}` : '→ sem data de término'} · {periodLabel(group)}
          </Text>
        </View>

        {group.is_owner && (
          <View style={styles.ownerActions}>
            <Button title="Editar" outline style={styles.ownerButton} onPress={() => navigation.navigate('GroupEditor', { groupId })} />
            <Button title="Gerenciar" outline style={styles.ownerButton} onPress={() => navigation.navigate('GroupManage', { groupId })} />
          </View>
        )}

        {!group.is_member && state !== 'ended' && (
          <Card style={styles.joinCard}>
            {invitedByAdmin ? (
              <>
                <Text style={styles.joinText}>Você foi convidado para este grupo.</Text>
                <Button title="Aceitar convite" loading={busy} onPress={() => answerInvitation(true)} />
                <Button title="Recusar" outline disabled={busy} onPress={() => answerInvitation(false)} />
              </>
            ) : requested ? (
              <Text style={styles.joinText}>Pedido enviado. Aguardando o dono do grupo.</Text>
            ) : (
              <>
                <Text style={styles.joinText}>Entre no grupo para ver o ranking e competir.</Text>
                <Button title="Pedir para entrar" loading={busy} onPress={requestJoin} />
              </>
            )}
          </Card>
        )}
        {!group.is_member && state === 'ended' && <Text style={styles.muted}>Este grupo já foi encerrado e não aceita novos membros.</Text>}
        {message && <Text style={styles.message}>{message}</Text>}

        {group.is_member && (
          <View style={styles.rankingBox}>
            <Text style={styles.sectionTitle}>Ranking</Text>
            {state === 'upcoming' && <Text style={styles.muted}>A competição ainda não começou: todo mundo está com zero.</Text>}
            {ranking.map((r) => (
              <View key={r.user_id} style={[styles.row, r.is_me && styles.rowMe, r.position <= 3 && styles.rowTop]} accessibilityLabel={`${r.position}º, ${r.name}, ${plural(r.total_points, 'dia', 'dias')}${r.is_me ? ', você' : ''}`}>
                <Text style={[styles.position, r.position <= 3 && styles.positionTop]}>{r.position}</Text>
                {r.photo_url ? (
                  <Image source={{ uri: r.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarEmpty}><Text style={styles.avatarInitial}>{r.name.trim().charAt(0).toUpperCase() || '?'}</Text></View>
                )}
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{r.is_me ? `${r.name} (você)` : r.name}</Text>
                  <Text style={styles.rowUser} numberOfLines={1}>@{r.username}</Text>
                </View>
                <View style={styles.points}>
                  <Text style={styles.pointsValue}>{r.total_points}</Text>
                  <Text style={styles.pointsLabel}>{r.total_points === 1 ? 'dia' : 'dias'}</Text>
                </View>
              </View>
            ))}
            {!group.is_owner && <Button title="Sair do grupo" danger outline onPress={() => setConfirmLeave(true)} />}
          </View>
        )}
        {!group.is_member && <Text style={styles.muted}>Entre no grupo para ver o ranking.</Text>}
      </ScrollView>

      <ConfirmModal
        visible={confirmLeave}
        title="Sair do grupo?"
        message="Se voltar depois, a contagem começa do zero."
        confirmLabel="Sair"
        danger
        loading={busy}
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </SafeAreaView>
  );
}
