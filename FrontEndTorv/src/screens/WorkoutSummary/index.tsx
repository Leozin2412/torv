import React, { useContext, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi } from '../../services/workouts';
import {
  summaryFromDetail, summaryFromState, toSessionPayload, weightChanges, formatWeight, type SessionState, type SummaryView,
} from '../../utils/workoutSession';
import { formatClock } from '../../utils/clock';
import { loadDraft, clearDraft } from '../../utils/workoutDraft';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

// saving → saved | retry (rede/5xx: rascunho fica) | invalid (400: só descartar) | history (vindo do Perfil)
type Status = 'loading' | 'saving' | 'saved' | 'retry' | 'invalid' | 'history' | 'missing';
// Card "Cargas diferentes da rotina": stale = rotina mudou e nada bateu; gone = rotina apagada (404).
type WeightsStatus = 'idle' | 'saving' | 'done' | 'stale' | 'gone' | 'error' | 'kept';

export default function WorkoutSummary() {
  const navigation = useNavigation<AppNavigation>();
  const { sessionId } = useRoute<RouteProp<AppStackParamList, 'WorkoutSummary'>>().params ?? {};
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const [summary, setSummary] = useState<SummaryView | null>(null);
  const [draft, setDraft] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [weightsStatus, setWeightsStatus] = useState<WeightsStatus>('idle');
  // Do estado da tela: o clearDraft depois do save não apaga o card.
  const changes = useMemo(() => (draft ? weightChanges(draft) : []), [draft]);

  const save = async (state: SessionState) => {
    if (!userId) return;
    setStatus('saving');
    try {
      await workoutsApi.saveSession(toSessionPayload(state));
      await clearDraft(userId);
      setStatus('saved');
    } catch (error) {
      setStatus(axios.isAxiosError(error) && error.response?.status === 400 ? 'invalid' : 'retry');
    }
  };

  useEffect(() => {
    (async () => {
      if (sessionId) {
        try {
          setSummary(summaryFromDetail(await workoutsApi.getSession(sessionId)));
          setStatus('history');
        } catch {
          setStatus('missing');
        }
        return;
      }
      if (!userId) return;
      const state = await loadDraft(userId);
      if (!state || state.phase !== 'done') {
        setStatus('missing');
        return;
      }
      setDraft(state);
      setSummary(summaryFromState(state));
      save(state);
    })();
  }, [sessionId, userId]);

  const updateRoutineWeights = async () => {
    if (!draft) return;
    setWeightsStatus('saving');
    try {
      const updated = await workoutsApi.updateRoutineWeights(
        draft.routine_id,
        changes.map(({ position, exercise_id, set_number, to }) => ({ position, exercise_id, set_number, weight_kg: to })),
      );
      setWeightsStatus(updated > 0 ? 'done' : 'stale');
    } catch (error) {
      setWeightsStatus(axios.isAxiosError(error) && error.response?.status === 404 ? 'gone' : 'error');
    }
  };

  const discard = async () => {
    if (userId) await clearDraft(userId);
    navigation.popTo('Tabs', { screen: 'Workouts' });
  };

  // Modo histórico (veio do Histórico ou do Perfil): seta para voltar, também carregando e em "não encontrado".
  const backHeader = sessionId ? (
    <View style={styles.header}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
        <ArrowLeft color={colors.error} size={26} />
      </TouchableOpacity>
    </View>
  ) : null;

  if (status === 'loading' || !summary) {
    return (
      <SafeAreaView style={styles.container}>
        {backHeader}
        {status === 'missing' ? (
          <View style={styles.centered}>
            <Text style={styles.muted}>Treino não encontrado.</Text>
            <Button title="Voltar" outline onPress={() => navigation.goBack()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {backHeader}
      <ScrollView contentContainerStyle={[styles.scroll, !!sessionId && styles.scrollUnderHeader]}>
        {status === 'saved' && (
          <View style={styles.hero}>
            <CheckCircle2 color={colors.brand} size={40} />
            <Text style={styles.heroTitle}>Treino concluído</Text>
          </View>
        )}
        <Text style={styles.title}>{summary.title}</Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatClock(summary.total_sec)}</Text>
            <Text style={styles.statLabel}>tempo total</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.set_count}</Text>
            <Text style={styles.statLabel}>séries</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{summary.avg_rest_sec === null ? '—' : formatClock(summary.avg_rest_sec)}</Text>
            <Text style={styles.statLabel}>descanso médio</Text>
          </View>
        </View>

        {status === 'saved' && changes.length > 0 && weightsStatus !== 'kept' && (
          <Card style={styles.changes}>
            <Text style={styles.changesTitle}>Cargas diferentes da rotina</Text>
            {changes.map((c) => (
              <Text key={`${c.position}-${c.set_number}`} style={styles.changeItem}>
                {c.name} · série {c.set_number}: {formatWeight(c.from)} → {formatWeight(c.to)}
              </Text>
            ))}
            {weightsStatus === 'done' && <Text style={styles.changesOk}>Rotina atualizada</Text>}
            {weightsStatus === 'stale' && <Text style={styles.changesNote}>A rotina mudou e as cargas não foram aplicadas.</Text>}
            {weightsStatus === 'gone' && <Text style={styles.changesNote}>Essa rotina não existe mais.</Text>}
            {weightsStatus === 'error' && <Text style={styles.error}>Não foi possível atualizar.</Text>}
            {(weightsStatus === 'idle' || weightsStatus === 'saving' || weightsStatus === 'error') && (
              <>
                <Button
                  title={weightsStatus === 'error' ? 'Tentar de novo' : 'Atualizar rotina'}
                  loading={weightsStatus === 'saving'}
                  onPress={updateRoutineWeights}
                />
                <Button title="Manter" outline disabled={weightsStatus === 'saving'} onPress={() => setWeightsStatus('kept')} />
              </>
            )}
          </Card>
        )}

        {summary.groups.map((g, gi) => (
          <Card key={`${g.name}-${gi}`}>
            <Text style={styles.groupName}>{g.name}</Text>
            {g.sets.map((s) => (
              <View key={s.set_number} style={styles.setRow}>
                <View style={styles.setLabelBox}>
                  <Text style={styles.setLabel}>Série {s.set_number}</Text>
                  {s.weight_kg !== null && <Text style={styles.setWeight}>{formatWeight(s.weight_kg)}</Text>}
                </View>
                <Text style={styles.setValue}>{formatClock(s.duration_sec)}</Text>
                <Text style={[styles.restValue, s.overdue && styles.overdue]}>
                  {s.rest_before_sec === null ? '—' : `descanso ${formatClock(s.rest_before_sec)}`}
                </Text>
              </View>
            ))}
          </Card>
        ))}

        {status === 'saving' && <ActivityIndicator color={colors.brand} />}
        {status === 'retry' && (
          <>
            <Text style={styles.error}>Não foi possível salvar. O treino continua guardado no aparelho.</Text>
            <Button title="Tentar de novo" onPress={() => draft && save(draft)} />
            <Button title="Voltar depois" outline onPress={() => navigation.popTo('Tabs', { screen: 'Workouts' })} />
          </>
        )}
        {status === 'invalid' && (
          <>
            <Text style={styles.error}>Não foi possível salvar este treino.</Text>
            <Button title="Descartar" danger onPress={discard} />
          </>
        )}
        {(status === 'saved' || status === 'history') && (
          <Button title="Concluir" onPress={() => (status === 'saved' ? navigation.popTo('Tabs', { screen: 'Workouts' }) : navigation.goBack())} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
