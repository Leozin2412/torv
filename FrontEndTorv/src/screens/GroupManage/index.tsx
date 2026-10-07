import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { ArrowLeft, Check, X, Trash2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { ConfirmModal } from '../../components/ConfirmModal';
import { groupsApi, type GroupDetailData, type PendingLists, type RankingRow } from '../../services/groups';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Confirm = null | { kind: 'remove'; row: RankingRow } | { kind: 'regenerate' } | { kind: 'revoke' } | { kind: 'delete' };

export default function GroupManage() {
  const navigation = useNavigation<AppNavigation>();
  const { groupId } = useRoute<RouteProp<AppStackParamList, 'GroupManage'>>().params;
  const [group, setGroup] = useState<GroupDetailData | null>(null);
  const [pending, setPending] = useState<PendingLists>({ requests: [], invites: [] });
  const [members, setMembers] = useState<RankingRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<string | null>(null); // chave da ação em andamento
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const load = async () => {
    try {
      const [detail, lists, ranking] = await Promise.all([groupsApi.get(groupId), groupsApi.pending(groupId), groupsApi.ranking(groupId)]);
      if (!detail.is_owner) return navigation.goBack(); // só o dono gerencia
      setGroup(detail);
      setPending(lists);
      setMembers(ranking);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };
  useFocusEffect(useCallback(() => { load(); }, [groupId]));

  const run = async (key: string, action: () => Promise<void>, okText?: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      if (okText) setMessage({ text: okText, error: false });
    } catch (error) {
      setMessage({ text: describeError(error, 'Usuário não encontrado.'), error: true });
    } finally {
      setBusy(null);
    }
  };

  const invite = () => run('invite', async () => {
    const value = username.trim().replace(/^@/, '');
    if (!value) throw new Error('empty');
    await groupsApi.invite(groupId, value);
    setUsername('');
    await load();
  }, 'Convite enviado.');

  const resolve = (id: string, accept: boolean) => run(`res-${id}`, async () => {
    if (accept) await groupsApi.accept(id);
    else await groupsApi.decline(id);
    await load();
  });

  const cancelInvite = (id: string) => run(`can-${id}`, async () => { await groupsApi.cancelInvitation(id); await load(); });

  const createLink = (okText: string) => run('link', async () => {
    await groupsApi.createInviteLink(groupId);
    await load();
  }, okText);

  const share = () => run('share', async () => {
    if (!group?.invite_token) return;
    const url = Linking.createURL(`join/${group.invite_token}`);
    await Share.share({ message: `Entre no meu grupo "${group.name}" no TORV.\nCódigo: ${group.invite_token}\nLink: ${url}` });
  });

  const doConfirm = () => run('confirm', async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === 'remove') { await groupsApi.removeMember(groupId, c.row.user_id); await load(); }
    if (c.kind === 'regenerate') { await groupsApi.createInviteLink(groupId); await load(); setMessage({ text: 'Novo código gerado. O anterior parou de funcionar.', error: false }); }
    if (c.kind === 'revoke') { await groupsApi.revokeInviteLink(groupId); await load(); setMessage({ text: 'Link desativado.', error: false }); }
    if (c.kind === 'delete') { await groupsApi.remove(groupId); navigation.popTo('Tabs', { screen: 'Groups' }); }
  });

  const confirmCopy = {
    remove: (c: Extract<Confirm, { kind: 'remove' }>) => ({ title: `Remover ${c.row.name}?`, message: 'A pessoa sai do grupo e perde a contagem de dias.', label: 'Remover' }),
    regenerate: () => ({ title: 'Gerar novo código?', message: 'O código e o link atuais deixam de funcionar.', label: 'Gerar novo' }),
    revoke: () => ({ title: 'Desativar o link?', message: 'Ninguém mais entra por código ou link até você gerar um novo.', label: 'Desativar' }),
    delete: () => ({ title: 'Excluir o grupo?', message: 'O grupo, o ranking e a capa são apagados para todos. Isso não pode ser desfeito.', label: 'Excluir' }),
  };
  const copy = confirm ? (confirmCopy[confirm.kind] as (c: any) => { title: string; message: string; label: string })(confirm) : null;

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={26} />
      </TouchableOpacity>
      <Text style={styles.title}>Gerenciar grupo</Text>
    </View>
  );

  if (status !== 'ready' || !group) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        {status === 'loading' ? <ActivityIndicator color={colors.brand} style={styles.loading} /> : (
          <View style={styles.centered}>
            <Text style={styles.muted}>Não foi possível carregar.</Text>
            <Button title="Tentar de novo" outline onPress={() => { setStatus('loading'); load(); }} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const personRow = (p: { id: string; name: string; username: string }, actions: React.ReactNode) => (
    <View key={p.id} style={styles.personRow}>
      <View style={styles.personBody}>
        <Text style={styles.personName} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.personUser} numberOfLines={1}>@{p.username}</Text>
      </View>
      {actions}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {message && <Text style={message.error ? styles.error : styles.ok}>{message.text}</Text>}

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Convidar por username</Text>
          <Input value={username} onChangeText={setUsername} placeholder="@username" autoCapitalize="none" autoCorrect={false} maxLength={100} accessibilityLabel="Username de quem convidar" />
          <Button title="Convidar" loading={busy === 'invite'} disabled={!username.trim()} onPress={invite} />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Código e link de convite</Text>
          {group.invite_token ? (
            <>
              <Text style={styles.code} selectable accessibilityLabel={`Código ${group.invite_token.split('').join(' ')}`}>{group.invite_token}</Text>
              <Button title="Compartilhar" loading={busy === 'share'} onPress={share} />
              <Button title="Gerar novo código" outline onPress={() => setConfirm({ kind: 'regenerate' })} />
              <Button title="Desativar link" outline danger onPress={() => setConfirm({ kind: 'revoke' })} />
            </>
          ) : (
            <>
              <Text style={styles.muted}>Nenhum link ativo. Gere um código para convidar quem estiver fora do app.</Text>
              <Button title="Gerar código" loading={busy === 'link'} onPress={() => createLink('Código gerado.')} />
            </>
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Pedidos de entrada ({pending.requests.length})</Text>
          {pending.requests.length === 0 && <Text style={styles.muted}>Nenhum pedido pendente.</Text>}
          {pending.requests.map((r) => personRow(r, (
            <View style={styles.rowActions}>
              <TouchableOpacity style={styles.iconButton} onPress={() => resolve(r.id, true)} disabled={busy === `res-${r.id}`} accessibilityRole="button" accessibilityLabel={`Aceitar ${r.name}`}><Check color={colors.brand} size={22} /></TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => resolve(r.id, false)} disabled={busy === `res-${r.id}`} accessibilityRole="button" accessibilityLabel={`Recusar ${r.name}`}><X color={colors.error} size={22} /></TouchableOpacity>
            </View>
          )))}
          {pending.invites.length > 0 && <Text style={styles.subTitle}>Convites enviados</Text>}
          {pending.invites.map((r) => personRow(r, (
            <TouchableOpacity style={styles.iconButton} onPress={() => cancelInvite(r.id)} disabled={busy === `can-${r.id}`} accessibilityRole="button" accessibilityLabel={`Cancelar convite de ${r.name}`}><X color={colors.textSecondary} size={22} /></TouchableOpacity>
          )))}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Membros ({members.length})</Text>
          {members.map((m) => personRow({ id: m.user_id, name: m.name, username: m.username }, (
            m.is_me ? <Text style={styles.you}>você</Text> : (
              <TouchableOpacity style={styles.iconButton} onPress={() => setConfirm({ kind: 'remove', row: m })} accessibilityRole="button" accessibilityLabel={`Remover ${m.name}`}><Trash2 color={colors.error} size={20} /></TouchableOpacity>
            )
          )))}
        </Card>

        <Button title="Excluir grupo" danger outline onPress={() => setConfirm({ kind: 'delete' })} />
      </ScrollView>

      <ConfirmModal
        visible={!!copy}
        title={copy?.title ?? ''}
        message={copy?.message ?? ''}
        confirmLabel={copy?.label ?? ''}
        danger={confirm?.kind !== 'regenerate'}
        loading={busy === 'confirm'}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}
