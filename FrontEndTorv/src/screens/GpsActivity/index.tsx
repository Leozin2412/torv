import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft, Pencil } from 'lucide-react-native';

import { ActivityIcon } from '../../components/ActivityIcon';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { GpsMetricsView } from '../../components/GpsMetricsView';
import { Input } from '../../components/Input';
import { gpsApi, type GpsActivityDetail } from '../../services/gps';
import { gpsErrorText } from '../../utils/gpsErrors';
import { activityLabel } from '../../utils/activities';
import { bumpSessionsVersion } from '../../utils/sessionsVersion';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Status = 'loading' | 'ready' | 'missing' | 'error';

const pad = (n: number) => String(n).padStart(2, '0');
// ISO → "14/10/2026 · 11:08" no fuso do aparelho.
const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const errorText = (err: unknown) => {
  if (!axios.isAxiosError(err)) return gpsErrorText(500);
  if (err.response?.status === 404) return 'Esta atividade não existe mais.'; // gpsErrorText(404) fala de rotina
  return gpsErrorText(err.response?.status, err.response?.data?.error);
};

export default function GpsActivity() {
  const navigation = useNavigation<AppNavigation>();
  const { activityId } = useRoute<RouteProp<AppStackParamList, 'GpsActivity'>>().params;
  const [activity, setActivity] = useState<GpsActivityDetail | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setStatus('loading');
    gpsApi.get(activityId)
      .then((a) => { setActivity(a); setStatus('ready'); })
      .catch((err) => setStatus(axios.isAxiosError(err) && err.response?.status === 404 ? 'missing' : 'error'));
  }, [activityId]);

  useFocusEffect(load);

  const startEdit = () => {
    setDraftTitle(activity?.title ?? '');
    setError('');
    setEditing(true);
  };

  const rename = async () => {
    const next = draftTitle.trim();
    if (!next) return setError('Dê um título para a atividade.');
    setRenaming(true);
    setError('');
    try {
      setActivity(await gpsApi.rename(activityId, next));
      bumpSessionsVersion();
      setEditing(false);
    } catch (err) {
      setError(axios.isAxiosError(err) && err.response?.status === 400 ? 'Não foi possível salvar o título.' : errorText(err));
    } finally {
      setRenaming(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await gpsApi.remove(activityId);
      bumpSessionsVersion();
      setConfirmDelete(false);
      navigation.goBack();
    } catch (err) {
      setConfirmDelete(false);
      setError(errorText(err));
    } finally {
      setDeleting(false);
    }
  };

  const back = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.text} size={24} />
      </TouchableOpacity>
    </View>
  );

  if (!activity) {
    return (
      <SafeAreaView style={styles.container}>
        {back}
        {status === 'loading' && <ActivityIndicator style={styles.loading} color={colors.brand} />}
        {status === 'missing' && <Text style={styles.muted}>Atividade não encontrada.</Text>}
        {status === 'error' && (
          <View style={styles.centered}>
            <Text style={styles.muted}>Não foi possível carregar a atividade.</Text>
            <Button title="Tentar de novo" outline onPress={load} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {back}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.typeRow}>
          <ActivityIcon type={activity.activity_type} color={colors.brand} size={18} />
          <Text style={styles.typeText}>{activityLabel(activity.activity_type)}</Text>
        </View>

        {editing ? (
          <View>
            <Input label="Título" value={draftTitle} maxLength={100} onChangeText={setDraftTitle} autoFocus />
            <View style={styles.editActions}>
              <Button title="Salvar" style={styles.editButton} loading={renaming} onPress={rename} />
              <Button title="Cancelar" outline style={styles.editButton} disabled={renaming} onPress={() => { setEditing(false); setError(''); }} />
            </View>
          </View>
        ) : (
          <View style={styles.titleRow}>
            <Text style={styles.title}>{activity.title}</Text>
            <TouchableOpacity style={styles.pencil} onPress={startEdit} accessibilityRole="button" accessibilityLabel="Renomear">
              <Pencil color={colors.textSecondary} size={18} />
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.when}>{formatWhen(activity.start_time)}</Text>

        {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        <GpsMetricsView metrics={activity} showElapsed />

        <Button title="Excluir atividade" outline danger onPress={() => setConfirmDelete(true)} />
      </ScrollView>

      <ConfirmModal
        visible={confirmDelete}
        title="Excluir atividade?"
        message="Ela sai do histórico e, se for a única do dia, esse dia deixa de contar nos seus grupos. Isso não pode ser desfeito."
        confirmLabel="Excluir"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}
