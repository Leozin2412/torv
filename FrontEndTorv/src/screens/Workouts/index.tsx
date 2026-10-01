import React, { useCallback, useContext, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Play, Plus, Sparkles, Dumbbell, ChevronRight } from 'lucide-react-native';

import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi, type RoutineList } from '../../services/workouts';
import { loadDraft, clearDraft } from '../../utils/workoutDraft';
import type { SessionState } from '../../utils/workoutSession';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const REASONS: Record<string, string> = {
  fitness_level: 'Seu nível físico mudou',
  goals: 'Seu objetivo mudou',
  gender: 'Seus dados mudaram',
};

export default function Workouts() {
  const navigation = useNavigation<AppNavigation>();
  const { user } = useContext(AuthContext);
  const [data, setData] = useState<RoutineList | null>(null);
  const [draft, setDraft] = useState<SessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, saved] = await Promise.all([
        workoutsApi.listRoutines(),
        user?.id ? loadDraft(user.id) : Promise.resolve(null),
      ]);
      setData(list);
      setDraft(saved);
    } catch {
      setError('Não foi possível carregar seus treinos.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [user?.id]));

  const regenerate = async () => {
    setBusy(true);
    try {
      setData(await workoutsApi.acceptPlan());
    } catch {
      setError('Não foi possível gerar o novo treino.');
    } finally {
      setBusy(false);
      setConfirmRegenerate(false);
    }
  };

  // Otimista: o banner some na hora; se o dismiss falhar, volta no próximo foco.
  const keepPlan = async () => {
    setData((d) => d && { ...d, plan_suggestion: { has_suggestion: false, changed: [] } });
    await workoutsApi.dismissPlan().catch(() => {});
  };

  const discardDraft = async () => {
    if (user?.id) await clearDraft(user.id);
    setDraft(null);
    setConfirmDiscard(false);
  };

  const suggestion = data?.plan_suggestion;
  const reasons = [...new Set((suggestion?.changed ?? []).map((k) => REASONS[k]).filter(Boolean))];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Treinos</Text>

        {draft && (
          <Card style={styles.draftCard}>
            <Text style={styles.draftTitle}>Treino em andamento</Text>
            <Text style={styles.draftName}>{draft.routine_name}</Text>
            <View style={styles.bannerActions}>
              <Button title="Continuar" style={styles.bannerButton} onPress={() => navigation.navigate('WorkoutSession', { resume: true })} />
              <Button title="Descartar" outline danger style={styles.bannerButton} onPress={() => setConfirmDiscard(true)} />
            </View>
          </Card>
        )}

        {suggestion?.has_suggestion && (
          <Card style={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <Sparkles color={colors.brand} size={18} />
              <Text style={styles.suggestionTitle}>Novo treino padrão disponível</Text>
            </View>
            {reasons.map((r) => <Text key={r} style={styles.suggestionReason}>{r}</Text>)}
            <View style={styles.bannerActions}>
              <Button title="Regerar" style={styles.bannerButton} onPress={() => setConfirmRegenerate(true)} />
              <Button title="Manter" outline style={styles.bannerButton} onPress={keepPlan} />
            </View>
          </Card>
        )}

        {!!error && (
          <TouchableOpacity onPress={load} accessibilityRole="button">
            <Text style={styles.error}>{error} Toque para tentar de novo.</Text>
          </TouchableOpacity>
        )}

        {loading && !data ? (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        ) : (
          data?.routines.map((r) => (
            <TouchableOpacity
              key={r.id}
              onPress={() => navigation.navigate('RoutineEditor', { routineId: r.id })}
              accessibilityRole="button"
              accessibilityLabel={`Editar ${r.name}`}
            >
              <Card style={[styles.routineCard, r.id === data.next_routine_id && styles.routineCardNext]}>
                <View style={styles.routineInfo}>
                  <View style={styles.tags}>
                    {r.id === data.next_routine_id && <Text style={styles.nextTag}>Próximo</Text>}
                    {r.is_default && <Text style={styles.defaultTag}>Padrão</Text>}
                  </View>
                  <Text style={styles.routineName}>{r.name}</Text>
                  <Text style={styles.routineMeta}>{r.exercise_count} {r.exercise_count === 1 ? 'exercício' : 'exercícios'} · {r.set_count} {r.set_count === 1 ? 'série' : 'séries'}</Text>
                </View>
                {/* Com treino em andamento, só o banner continua/descarta: nada de 2 treinos ao mesmo tempo. */}
                {draft ? (
                  <ChevronRight color={colors.textSecondary} size={20} />
                ) : (
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={() => navigation.navigate('WorkoutSession', { routineId: r.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Iniciar ${r.name}`}
                  >
                    <Play color={colors.background} size={18} fill={colors.background} />
                  </TouchableOpacity>
                )}
              </Card>
            </TouchableOpacity>
          ))
        )}

        {data && data.routines.length === 0 && (
          <Card style={styles.emptyCard}>
            <Dumbbell color={colors.textSecondary} size={28} />
            <Text style={styles.emptyText}>Nenhuma rotina ainda.</Text>
          </Card>
        )}

        <TouchableOpacity style={styles.newButton} onPress={() => navigation.navigate('RoutineEditor', {})} accessibilityRole="button">
          <Plus color={colors.brand} size={22} />
          <Text style={styles.newText}>Nova rotina</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={confirmRegenerate}
        title="Regerar treino padrão?"
        message="Suas rotinas padrão serão substituídas, inclusive edições. As rotinas que você criou não mudam."
        confirmLabel="Regerar"
        loading={busy}
        onConfirm={regenerate}
        onCancel={() => setConfirmRegenerate(false)}
      />
      <ConfirmModal
        visible={confirmDiscard}
        title="Descartar treino?"
        message="As séries feitas neste treino serão perdidas."
        confirmLabel="Descartar"
        danger
        onConfirm={discardDraft}
        onCancel={() => setConfirmDiscard(false)}
      />
    </SafeAreaView>
  );
}
