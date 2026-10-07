import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft, Trash2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { workoutsApi, type SessionDetail } from '../../services/workouts';
import { toEditRows, toEditPayload, type EditRow } from '../../utils/setEdit';
import { bumpSessionsVersion } from '../../utils/sessionsVersion';
import { describeError } from '../../utils/groupErrors';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

export default function WorkoutEdit() {
  const navigation = useNavigation<AppNavigation>();
  const { sessionId } = useRoute<RouteProp<AppStackParamList, 'WorkoutEdit'>>().params;
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await workoutsApi.getSession(sessionId);
        setDetail(d);
        setRows(toEditRows(d.sets));
        setStatus('ready');
      } catch (err) {
        setStatus(axios.isAxiosError(err) && err.response?.status === 404 ? 'missing' : 'error');
      }
    })();
  }, [sessionId]);

  const change = (id: string, patch: Partial<EditRow>) => setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!detail) return;
    const result = toEditPayload(detail.duration_sec, rows);
    if (!result.ok) return setError(result.error);
    setSaving(true);
    setError(null);
    try {
      await workoutsApi.updateSession(sessionId, result.body);
      bumpSessionsVersion();
      navigation.goBack();
    } catch (err) {
      setError(describeError(err, 'Treino não encontrado.'));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.error} size={26} />
      </TouchableOpacity>
      <Text style={styles.title}>Editar treino</Text>
    </View>
  );

  if (status !== 'ready' || !detail) {
    return (
      <SafeAreaView style={styles.container}>
        {header}
        {status === 'loading' ? <ActivityIndicator color={colors.brand} style={styles.loading} /> : (
          <View style={styles.centered}>
            <Text style={styles.muted}>{status === 'missing' ? 'Treino não encontrado.' : 'Não foi possível carregar o treino.'}</Text>
            <Button title="Voltar" outline onPress={() => navigation.goBack()} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.name}>{detail.title}</Text>
        <Text style={styles.note}>A data do treino não pode ser alterada. Para tirar uma série, use a lixeira.</Text>

        {rows.map((r) => (
          <Card key={r.id} style={styles.setCard}>
            <View style={styles.setHeader}>
              <Text style={styles.setLabel} numberOfLines={2}>{r.label}</Text>
              <TouchableOpacity style={styles.remove} onPress={() => setRows((prev) => prev.filter((x) => x.id !== r.id))} accessibilityRole="button" accessibilityLabel={`Remover ${r.label}`}>
                <Trash2 color={colors.error} size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.fields}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tempo (s)</Text>
                <TextInput style={styles.input} value={r.durationText} onChangeText={(t) => change(r.id, { durationText: t })} keyboardType="number-pad" maxLength={4} accessibilityLabel={`Tempo em segundos, ${r.label}`} />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Carga (kg)</Text>
                <TextInput style={styles.input} value={r.weightText} onChangeText={(t) => change(r.id, { weightText: t })} keyboardType="decimal-pad" maxLength={7} placeholder="Sem carga" placeholderTextColor={colors.textSecondary} accessibilityLabel={`Carga em quilos, ${r.label}`} />
              </View>
            </View>
          </Card>
        ))}

        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
        <Button title="Salvar alterações" loading={saving} onPress={save} />
        <Button title="Cancelar" outline disabled={saving} onPress={() => navigation.goBack()} />
      </ScrollView>
    </SafeAreaView>
  );
}
