import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { X, SkipForward, ChevronsRight, Minus, Plus } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { ConfirmModal } from '../../components/ConfirmModal';
import { AuthContext } from '../../contexts/AuthContext';
import { workoutsApi } from '../../services/workouts';
import {
  createSession, startSet, finishSet, skipSet, skipExercise, finish, setWeight, stepWeight, formatWeight,
  totalElapsedSec, phaseElapsedSec, isRestOverdue, MAX_WEIGHT, type SessionState,
} from '../../utils/workoutSession';
import { parseWeight } from '../../utils/routineForm';
import { formatClock } from '../../utils/clock';
import { loadDraft, saveDraft, clearDraft } from '../../utils/workoutDraft';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

type Transition = (s: SessionState, now: number) => SessionState;

export default function WorkoutSession() {
  const navigation = useNavigation<AppNavigation>();
  const { routineId, resume } = useRoute<RouteProp<AppStackParamList, 'WorkoutSession'>>().params ?? {};
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const [state, setState] = useState<SessionState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [weightText, setWeightText] = useState<string | null>(null); // digitando a carga; null = mostrando o valor

  // Carrega o rascunho (Continuar) ou começa a rotina do zero, sobrescrevendo qualquer rascunho.
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const initial = resume
          ? await loadDraft(userId)
          : createSession(await workoutsApi.getRoutine(routineId as string), Date.now());
        if (!initial || initial.exercises.length === 0) {
          setError(initial ? 'Esta rotina não tem exercícios.' : 'Nenhum treino em andamento.');
          return;
        }
        if (initial.phase === 'done') {
          navigation.replace('WorkoutSummary', {});
          return;
        }
        if (!resume) await saveDraft(userId, initial);
        setState(initial);
      } catch {
        setError('Não foi possível abrir o treino.');
      }
    })();
  }, [userId, routineId, resume]);

  // Só redesenha; os tempos vêm dos timestamps do estado.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const apply = async (transition: Transition) => {
    if (!state || !userId) return;
    const next = transition(state, Date.now());
    if (next === state) return;
    // Pular até o fim sem nenhuma série = mesmo caminho do "Finalizar" com 0 séries: confirmar descarte, sem POST.
    if (next.phase === 'done' && next.sets.length === 0) {
      setConfirmFinish(true);
      return;
    }
    setState(next);
    setNow(Date.now());
    // O resumo lê o rascunho: grava antes de navegar.
    await saveDraft(userId, next).catch(() => {});
    if (next.phase === 'done') navigation.replace('WorkoutSummary', {});
  };

  // Cada texto válido já vale (o rascunho grava): sair do campo, ou tocar em "Terminei a série" com ele
  // aberto, não perde nada. Texto inválido ("7,", "abc") só não muda a carga.
  const typeWeight = (text: string) => {
    setWeightText(text);
    const kg = parseWeight(text);
    if (!Number.isNaN(kg)) apply((s) => setWeight(s, kg));
  };

  const discard = async () => {
    if (userId) await clearDraft(userId);
    setConfirmFinish(false);
    navigation.goBack();
  };

  if (!state) {
    return (
      <SafeAreaView style={styles.container}>
        {error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
            <Button title="Voltar" outline onPress={() => navigation.goBack()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.brand} style={styles.loading} />
        )}
      </SafeAreaView>
    );
  }

  const exercise = state.exercises[state.exercise_index];
  const weight = exercise.weights[state.set_index];
  const overdue = isRestOverdue(state, now);
  const elapsed = phaseElapsedSec(state, now);
  const nothingDone = state.sets.length === 0 && state.phase !== 'set';
  const upcoming = state.exercises.slice(state.exercise_index + 1);

  const mainLabel = state.phase === 'set'
    ? 'Terminei a série'
    : state.phase === 'resting'
      ? `Acabou o descanso — iniciar série ${state.set_index + 1}`
      : 'Iniciar série';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Sair do treino (continua salvo)">
          <X color={colors.textSecondary} size={24} />
        </TouchableOpacity>
        <Text style={styles.routineName} numberOfLines={1}>{state.routine_name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.timers}>
          <View style={styles.timerBox}>
            <Text style={styles.timerLabel}>Total</Text>
            <Text style={styles.timerValue} accessibilityLabel={`Tempo total ${formatClock(totalElapsedSec(state, now))}`}>
              {formatClock(totalElapsedSec(state, now))}
            </Text>
          </View>
          <View style={[styles.timerBox, styles.phaseBox, overdue && styles.timerBoxOverdue]}>
            <Text style={[styles.timerLabel, overdue && styles.overdueText]}>{state.phase === 'set' ? 'Série' : 'Descanso'}</Text>
            <Text style={[styles.timerValue, styles.phaseValue, overdue && styles.overdueText]}>
              {state.phase === 'ready' ? '—' : formatClock(elapsed)}
            </Text>
            {state.phase === 'resting' && state.rest_target_sec !== null && (
              <Text style={[styles.timerTarget, overdue && styles.overdueText]}>alvo {formatClock(state.rest_target_sec)}</Text>
            )}
          </View>
        </View>

        <View style={styles.exerciseCard}>
          <Text style={styles.exerciseGroup}>{exercise.muscle_group}</Text>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          <Text style={styles.setInfo}>Série {state.set_index + 1} de {exercise.weights.length}</Text>
          <Text style={styles.target}>{exercise.reps_min}–{exercise.reps_max} reps</Text>

          <View style={styles.weightRow}>
            <TouchableOpacity
              style={[styles.weightStep, weight === null && styles.weightStepDisabled]}
              onPress={() => apply((s) => setWeight(s, stepWeight(weight, -1)))}
              disabled={weight === null}
              accessibilityRole="button"
              accessibilityLabel="Diminuir carga em 2,5 kg"
            >
              <Minus color={colors.text} size={20} />
            </TouchableOpacity>
            {weightText === null ? (
              <TouchableOpacity
                style={styles.weightValue}
                onPress={() => setWeightText(weight === null ? '' : String(weight).replace('.', ','))}
                accessibilityRole="button"
                accessibilityLabel={`Carga desta série: ${formatWeight(weight)}. Toque para digitar`}
              >
                <Text style={styles.weightText}>{formatWeight(weight)}</Text>
              </TouchableOpacity>
            ) : (
              <TextInput
                style={[styles.weightValue, styles.weightInput]}
                value={weightText}
                onChangeText={typeWeight}
                onBlur={() => setWeightText(null)}
                onSubmitEditing={() => setWeightText(null)}
                keyboardType="decimal-pad"
                returnKeyType="done"
                autoFocus
                selectTextOnFocus
                maxLength={6}
                placeholder="Sem carga"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Carga desta série em kg"
              />
            )}
            <TouchableOpacity
              style={[styles.weightStep, weight === MAX_WEIGHT && styles.weightStepDisabled]}
              onPress={() => apply((s) => setWeight(s, stepWeight(weight, 1)))}
              disabled={weight === MAX_WEIGHT}
              accessibilityRole="button"
              accessibilityLabel="Aumentar carga em 2,5 kg"
            >
              <Plus color={colors.text} size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <Button title={mainLabel} onPress={() => apply(state.phase === 'set' ? finishSet : startSet)} style={styles.mainButton} />

        {state.phase !== 'set' && (
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondary} onPress={() => apply(skipSet)} accessibilityRole="button">
              <SkipForward color={colors.textSecondary} size={18} />
              <Text style={styles.secondaryText}>Pular série</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => apply(skipExercise)} accessibilityRole="button">
              <ChevronsRight color={colors.textSecondary} size={18} />
              <Text style={styles.secondaryText}>Próximo exercício</Text>
            </TouchableOpacity>
          </View>
        )}

        {upcoming.length > 0 && (
          <View style={styles.upcoming}>
            <Text style={styles.upcomingTitle}>A seguir</Text>
            {upcoming.map((e, i) => (
              <Text key={`${e.exercise_id}-${i}`} style={styles.upcomingItem}>{e.name} · {e.weights.length} {e.weights.length === 1 ? 'série' : 'séries'}</Text>
            ))}
          </View>
        )}

        <Button title="Finalizar treino" outline danger onPress={() => setConfirmFinish(true)} />
      </ScrollView>

      <ConfirmModal
        visible={confirmFinish}
        title={nothingDone ? 'Descartar treino?' : 'Finalizar treino?'}
        message={nothingDone ? 'Nenhuma série foi feita. O treino será descartado.' : 'As séries feitas serão salvas no seu histórico.'}
        confirmLabel={nothingDone ? 'Descartar' : 'Finalizar'}
        danger={nothingDone}
        onConfirm={() => {
          if (nothingDone) {
            discard();
          } else {
            setConfirmFinish(false);
            apply(finish);
          }
        }}
        onCancel={() => setConfirmFinish(false)}
      />
    </SafeAreaView>
  );
}
