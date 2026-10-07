import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { GroupCover } from '../../components/GroupCover';
import { DatePickerModal } from '../../components/DatePickerModal';
import { groupsApi, coverForm, type Visibility } from '../../services/groups';
import { describeError } from '../../utils/groupErrors';
import { formatDay } from '../../utils/groupPeriod';
import { toISODate } from '../../utils/date';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Picking = null | 'start' | 'end';
interface PickedCover { uri: string; webFile?: File }

// O seletor de ano termina no ano do maxDate: 5 anos à frente cobre qualquer competição razoável.
const farFuture = () => toISODate(new Date(new Date().getFullYear() + 5, 11, 31));

export default function GroupEditor() {
  const navigation = useNavigation<AppNavigation>();
  const editingId = useRoute<RouteProp<AppStackParamList, 'GroupEditor'>>().params?.groupId;

  const [loading, setLoading] = useState(!!editingId);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [startsAt, setStartsAt] = useState(toISODate(new Date()));
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [current, setCurrent] = useState<{ starts_at: string; ends_at: string | null } | null>(null); // para só mandar o período se mudou
  const [remoteCover, setRemoteCover] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedCover | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Criou o grupo mas a capa falhou: tentar de novo só reenvia a capa, não cria outro grupo.
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const g = await groupsApi.get(editingId);
        setName(g.name);
        setVisibility(g.visibility);
        setStartsAt(g.starts_at);
        setEndsAt(g.ends_at);
        setRemoteCover(g.cover_url);
        setCurrent({ starts_at: g.starts_at, ends_at: g.ends_at });
      } catch (err) {
        setError(describeError(err, 'Grupo não encontrado.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [editingId]);

  const pickCover = async () => {
    setError(null);
    try {
      // Mesmo pedido de permissão do Perfil (handlePickImage), mas a recusa aparece na própria tela.
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Precisamos de acesso à galeria para escolher a capa.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.7 });
      if (!result.canceled && result.assets?.length) {
        setPicked({ uri: result.assets[0].uri, webFile: result.assets[0].file });
      }
    } catch {
      setError('Não foi possível abrir a galeria.');
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Dê um nome ao grupo.');
    if (endsAt && endsAt < startsAt) return setError('O fim não pode ser antes do início.');
    setSaving(true);
    setError(null);
    let id = editingId ?? createdId;
    try {
      if (id) {
        const periodChanged = !current || current.starts_at !== startsAt || current.ends_at !== endsAt;
        await groupsApi.update(id, { name: trimmed, visibility, ...(periodChanged && { starts_at: startsAt, ends_at: endsAt }) });
      } else {
        const created = await groupsApi.create({ name: trimmed, visibility, starts_at: startsAt, ends_at: endsAt, tz_offset_min: -new Date().getTimezoneOffset() });
        id = created.id;
        setCreatedId(id);
      }
      if (picked) await groupsApi.uploadCover(id, coverForm(picked.uri, picked.webFile));
      if (editingId) navigation.goBack();
      else navigation.replace('GroupDetail', { groupId: id });
    } catch (err) {
      setError(id && picked ? `${editingId ? 'Alterações salvas' : 'Grupo criado'}, mas a capa não foi enviada. ${describeError(err)}` : describeError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.container}><ActivityIndicator color={colors.brand} style={styles.loading} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <Text style={styles.title}>{editingId ? 'Editar grupo' : 'Novo grupo'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.coverButton} onPress={pickCover} accessibilityRole="button" accessibilityLabel="Escolher capa do grupo">
          <GroupCover uri={picked?.uri ?? remoteCover} name={name || 'Grupo'} height={160} />
          <View style={styles.coverBadge}><Camera color={colors.text} size={18} /><Text style={styles.coverBadgeText}>{picked || remoteCover ? 'Trocar capa' : 'Adicionar capa'}</Text></View>
        </TouchableOpacity>

        <Input label="Nome do grupo" value={name} onChangeText={setName} maxLength={100} placeholder="Ex.: Galera da academia" />

        {/* A linha inteira é o alvo de toque (o Switch sozinho tem 40×20); o Switch só mostra o estado. */}
        <TouchableOpacity
          style={styles.switchRow}
          activeOpacity={0.7}
          onPress={() => setVisibility(visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC')}
          accessibilityRole="switch"
          accessibilityLabel="Grupo público"
          accessibilityState={{ checked: visibility === 'PUBLIC' }}
          aria-checked={visibility === 'PUBLIC'} // react-native-web ignora accessibilityState
        >
          <View style={styles.switchText}>
            <Text style={styles.label}>Grupo público</Text>
            <Text style={styles.hint}>{visibility === 'PUBLIC' ? 'Aparece na busca e aceita pedidos de entrada.' : 'Só entra por convite ou código.'}</Text>
          </View>
          <View style={styles.switchDecor} accessible={false} importantForAccessibility="no-hide-descendants">
            <Switch value={visibility === 'PUBLIC'} trackColor={{ true: colors.brand }} />
          </View>
        </TouchableOpacity>

        <Text style={styles.label}>Período da competição</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setPicking('start')} accessibilityRole="button" accessibilityLabel={`Início: ${formatDay(startsAt)}`}>
          <Text style={styles.dateLabel}>Início</Text>
          <Text style={styles.dateValue}>{formatDay(startsAt)}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchRow}
          activeOpacity={0.7}
          onPress={() => setEndsAt(endsAt === null ? startsAt : null)}
          accessibilityRole="switch"
          accessibilityLabel="Sem data de término"
          accessibilityState={{ checked: endsAt === null }}
          aria-checked={endsAt === null}
        >
          <Text style={styles.label}>Sem data de término</Text>
          <View style={styles.switchDecor} accessible={false} importantForAccessibility="no-hide-descendants">
            <Switch value={endsAt === null} trackColor={{ true: colors.brand }} />
          </View>
        </TouchableOpacity>
        {endsAt !== null && (
          <TouchableOpacity style={styles.dateButton} onPress={() => setPicking('end')} accessibilityRole="button" accessibilityLabel={`Fim: ${formatDay(endsAt)}`}>
            <Text style={styles.dateLabel}>Fim</Text>
            <Text style={styles.dateValue}>{formatDay(endsAt)}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.hint}>Conta 1 ponto por dia em que o membro treinou, a partir do dia em que entrou no grupo.</Text>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button title={editingId ? 'Salvar' : 'Criar grupo'} loading={saving} onPress={save} />
      </ScrollView>

      <DatePickerModal
        visible={picking === 'start'}
        title="Início da competição"
        value={startsAt}
        maxDate={farFuture()}
        onConfirm={(d) => { setStartsAt(d); if (endsAt && endsAt < d) setEndsAt(d); setPicking(null); }}
        onClose={() => setPicking(null)}
      />
      <DatePickerModal
        visible={picking === 'end'}
        title="Fim da competição"
        value={endsAt ?? startsAt}
        minDate={startsAt}
        maxDate={farFuture()}
        onConfirm={(d) => { setEndsAt(d); setPicking(null); }}
        onClose={() => setPicking(null)}
      />
    </SafeAreaView>
  );
}
