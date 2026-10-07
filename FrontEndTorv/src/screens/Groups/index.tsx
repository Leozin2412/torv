import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Plus, KeyRound, Search, Users } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { GroupCard } from '../../components/GroupCard';
import { GroupCover } from '../../components/GroupCover';
import { groupsApi, type DiscoverItem, type GroupListItem, type ReceivedInvitation } from '../../services/groups';
import { periodLabel } from '../../utils/groupPeriod';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Segment = 'mine' | 'discover';
type Status = 'loading' | 'ready' | 'error';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Groups() {
  const navigation = useNavigation<AppNavigation>();
  const [segment, setSegment] = useState<Segment>('mine');

  const [mine, setMine] = useState<GroupListItem[]>([]);
  const [received, setReceived] = useState<ReceivedInvitation[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [found, setFound] = useState<DiscoverItem[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [discoverStatus, setDiscoverStatus] = useState<Status>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const searchId = useRef(0); // resposta de uma busca antiga chega depois → descarta

  const loadMine = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      // Falha em convites não derruba a lista de grupos.
      const [groups, invitations] = await Promise.all([groupsApi.list(), groupsApi.received().catch(() => [] as ReceivedInvitation[])]);
      setMine(groups);
      setReceived(invitations);
      setStatus('ready');
    } catch {
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  };

  // Volta de GroupDetail / GroupEditor / JoinGroup: lista e convites sempre frescos.
  useFocusEffect(useCallback(() => { loadMine(); }, []));

  const search = async (q: string, cursor = 0) => {
    const id = ++searchId.current;
    if (cursor === 0) setDiscoverStatus('loading');
    else setLoadingMore(true);
    try {
      const page = await groupsApi.discover(q.trim(), cursor);
      if (id !== searchId.current) return;
      setFound((prev) => (cursor === 0 ? page.groups : [...prev, ...page.groups]));
      setNextCursor(page.next_cursor);
      setDiscoverStatus('ready');
    } catch {
      if (id !== searchId.current) return;
      if (cursor === 0) setDiscoverStatus('error');
    } finally {
      if (id === searchId.current) setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (segment === 'discover') search(query);
  }, [segment]);

  const answer = async (invitation: ReceivedInvitation, accept: boolean) => {
    setBusyInvitation(invitation.id);
    setInviteError(null);
    try {
      if (accept) {
        await groupsApi.accept(invitation.id);
        navigation.navigate('GroupDetail', { groupId: invitation.group.id });
      } else {
        await groupsApi.decline(invitation.id);
      }
      await loadMine();
    } catch (error) {
      setInviteError(describeError(error));
    } finally {
      setBusyInvitation(null);
    }
  };

  const segmentButton = (key: Segment, label: string) => (
    <TouchableOpacity
      key={key}
      style={[styles.segment, segment === key && styles.segmentActive]}
      onPress={() => setSegment(key)}
      accessibilityRole="button"
      accessibilityState={{ selected: segment === key }}
      aria-selected={segment === key} // react-native-web ignora accessibilityState
    >
      <Text style={[styles.segmentText, segment === key && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => (segment === 'mine' ? loadMine(true) : search(query))} tintColor={colors.brand} />}
      >
        <Text style={styles.title}>Grupos</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.action} onPress={() => navigation.navigate('GroupEditor', {})} accessibilityRole="button" accessibilityLabel="Criar grupo">
            <Plus color={colors.brand} size={20} />
            <Text style={styles.actionText}>Criar grupo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.action} onPress={() => navigation.navigate('JoinGroup', {})} accessibilityRole="button" accessibilityLabel="Entrar com código">
            <KeyRound color={colors.brand} size={20} />
            <Text style={styles.actionText}>Entrar com código</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segments}>
          {segmentButton('mine', 'Meus grupos')}
          {segmentButton('discover', 'Descobrir')}
        </View>

        {segment === 'mine' && (
          <>
            {received.length > 0 && (
              <View style={styles.invites}>
                <Text style={styles.sectionTitle}>Convites recebidos</Text>
                {received.map((inv) => (
                  <View key={inv.id} style={styles.invite}>
                    <GroupCover uri={inv.group.cover_url} name={inv.group.name} height={48} style={styles.inviteThumb} />
                    <View style={styles.inviteBody}>
                      <Text style={styles.inviteName} numberOfLines={1}>{inv.group.name}</Text>
                      <Text style={styles.inviteFrom} numberOfLines={1}>Convite de @{inv.invited_by.username}</Text>
                    </View>
                    <Button title="Aceitar" style={styles.inviteButton} loading={busyInvitation === inv.id} onPress={() => answer(inv, true)} />
                    <Button title="Recusar" outline style={styles.inviteButton} disabled={busyInvitation === inv.id} onPress={() => answer(inv, false)} />
                  </View>
                ))}
                {inviteError && <Text style={styles.error}>{inviteError}</Text>}
              </View>
            )}

            {status === 'loading' && <ActivityIndicator color={colors.brand} style={styles.loading} />}
            {status === 'error' && (
              <View style={styles.centered}>
                <Text style={styles.muted}>Não foi possível carregar seus grupos.</Text>
                <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); loadMine(); }} />
              </View>
            )}
            {status === 'ready' && mine.length === 0 && (
              <View style={styles.centered}>
                <Users color={colors.textSecondary} size={40} />
                <Text style={styles.muted}>Você ainda não está em nenhum grupo. Crie um, entre com um código ou procure em Descobrir.</Text>
              </View>
            )}
            {status === 'ready' && mine.map((g) => (
              <GroupCard
                key={g.id}
                name={g.name}
                coverUri={g.cover_url}
                subtitle={`${plural(g.member_count, 'membro', 'membros')} · ${periodLabel(g)}`}
                meta={`#${g.my_rank} · ${plural(g.my_points, 'dia', 'dias')}`}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
              />
            ))}
          </>
        )}

        {segment === 'discover' && (
          <>
            <View style={styles.searchBox}>
              <Search color={colors.textSecondary} size={18} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => search(query)}
                placeholder="Buscar grupo pelo nome"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="search"
                maxLength={100}
                accessibilityLabel="Buscar grupo pelo nome"
              />
            </View>
            {discoverStatus === 'loading' && <ActivityIndicator color={colors.brand} style={styles.loading} />}
            {discoverStatus === 'error' && (
              <View style={styles.centered}>
                <Text style={styles.muted}>Não foi possível buscar.</Text>
                <Button title="Tentar de novo" outline onPress={() => search(query)} />
              </View>
            )}
            {discoverStatus === 'ready' && found.length === 0 && (
              <Text style={styles.muted}>Nenhum grupo público encontrado.</Text>
            )}
            {discoverStatus === 'ready' && found.map((g) => (
              <GroupCard
                key={g.id}
                name={g.name}
                coverUri={g.cover_url}
                subtitle={`${plural(g.member_count, 'membro', 'membros')} · ${periodLabel(g)}`}
                onPress={() => navigation.navigate('GroupDetail', { groupId: g.id })}
              />
            ))}
            {discoverStatus === 'ready' && nextCursor !== null && (
              <Button title="Carregar mais" outline loading={loadingMore} onPress={() => search(query, nextCursor)} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
