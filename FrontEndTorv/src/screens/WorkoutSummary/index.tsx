import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import axios from 'axios';
import { CheckCircle2 } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi } from '../../services/workouts';
import { summaryFromDetail, summaryFromState, toSessionPayload, type SessionState, type SummaryView } from '../../utils/workoutSession';
import { formatClock } from '../../utils/clock';
import { loadDraft, clearDraft } from '../../utils/workoutDraft';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

// saving → saved | retry (rede/5xx: rascunho fica) | invalid (400: só descartar) | history (vindo do Perfil)
type Status = 'loading' | 'saving' | 'saved' | 'retry' | 'invalid' | 'history' | 'missing';

export default function WorkoutSummary() {
  const navigation = useNavigation<AppNavigation>();
  const { sessionId } = useRoute<RouteProp<AppStackParamList, 'WorkoutSummary'>>().params ?? {};
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const [summary, setSummary] = useState<SummaryView | null>(null);
  const [draft, setDraft] = useState<SessionState | null>(null);
  const [status, setStatus] = useState<Status>('loading');

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

  const discard = async () => {
    if (userId) await clearDraft(userId);
    navigation.popTo('Tabs', { screen: 'Workouts' });
  };

  if (status === 'loading' || !summary) {
    return (
      <SafeAreaView style={styles.container}>
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
      <ScrollView contentContainerStyle={styles.scroll}>
        {status !== 'history' && (
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

        {summary.groups.map((g, gi) => (
          <Card key={`${g.name}-${gi}`}>
            <Text style={styles.groupName}>{g.name}</Text>
            {g.sets.map((s) => (
              <View key={s.set_number} style={styles.setRow}>
                <Text style={styles.setLabel}>Série {s.set_number}</Text>
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
