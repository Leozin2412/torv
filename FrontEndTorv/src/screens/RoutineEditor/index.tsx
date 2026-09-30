import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Minus } from 'lucide-react-native';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { ExercisePicker } from '../../components/ExercisePicker';
import { workoutsApi } from '../../services/workouts';
import { formatClock } from '../../utils/clock';
import {
  LIMITS, buildRoutineInput, clampRest, formFromDetail, moveItem, newFormExercise, type FormExercise,
} from '../../utils/routineForm';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

export default function RoutineEditor() {
  const navigation = useNavigation<AppNavigation>();
  const { routineId } = useRoute<RouteProp<AppStackParamList, 'RoutineEditor'>>().params ?? {};
  const [name, setName] = useState('');
  const [items, setItems] = useState<FormExercise[]>([]);
  const [loading, setLoading] = useState(!!routineId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!routineId) return;
    workoutsApi.getRoutine(routineId)
      .then((d) => {
        setName(d.name);
        setItems(formFromDetail(d));
      })
      .catch(() => setError('Não foi possível carregar a rotina.'))
      .finally(() => setLoading(false));
  }, [routineId]);

  const update = (key: string, patch: Partial<FormExercise>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const save = async () => {
    const result = buildRoutineInput(name, items);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (routineId) await workoutsApi.updateRoutine(routineId, result.body);
      else await workoutsApi.createRoutine(result.body);
      navigation.goBack();
    } catch {
      setError('Não foi possível salvar a rotina.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!routineId) return;
    setSaving(true);
    try {
      await workoutsApi.deleteRoutine(routineId);
      setConfirmDelete(false);
      navigation.goBack();
    } catch {
      setConfirmDelete(false);
      setError('Não foi possível excluir a rotina.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.brand} style={styles.loading} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
            <ArrowLeft color={colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{routineId ? 'Editar rotina' : 'Nova rotina'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Input label="Nome da rotina" value={name} maxLength={LIMITS.name} onChangeText={setName} placeholder="Ex.: Peito e tríceps" />

          {items.map((it, index) => (
            <Card key={it.key}>
              <View style={styles.exerciseHeader}>
                <View style={styles.flex}>
                  <Text style={styles.exerciseName}>{it.name}</Text>
                  <Text style={styles.exerciseGroup}>{it.muscle_group}</Text>
                </View>
                <TouchableOpacity style={styles.iconButton} onPress={() => setItems((l) => moveItem(l, index, -1))} accessibilityRole="button" accessibilityLabel={`Subir ${it.name}`}>
                  <ArrowUp color={colors.textSecondary} size={18} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setItems((l) => moveItem(l, index, 1))} accessibilityRole="button" accessibilityLabel={`Descer ${it.name}`}>
                  <ArrowDown color={colors.textSecondary} size={18} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} onPress={() => setItems((l) => l.filter((x) => x.key !== it.key))} accessibilityRole="button" accessibilityLabel={`Remover ${it.name}`}>
                  <Trash2 color={colors.error} size={18} />
                </TouchableOpacity>
              </View>

              <View style={styles.fieldsRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Reps mín.</Text>
                  <TextInput style={styles.smallInput} keyboardType="number-pad" maxLength={3} value={it.reps_min} onChangeText={(v) => update(it.key, { reps_min: v })} accessibilityLabel={`Repetições mínimas de ${it.name}`} />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Reps máx.</Text>
                  <TextInput style={styles.smallInput} keyboardType="number-pad" maxLength={3} value={it.reps_max} onChangeText={(v) => update(it.key, { reps_max: v })} accessibilityLabel={`Repetições máximas de ${it.name}`} />
                </View>
                <View style={[styles.field, styles.restField]}>
                  <Text style={styles.fieldLabel}>Descanso</Text>
                  <View style={styles.stepper}>
                    <TouchableOpacity style={styles.stepperButton} onPress={() => update(it.key, { rest_sec: clampRest(it.rest_sec - LIMITS.restStep) })} accessibilityRole="button" accessibilityLabel={`Diminuir descanso de ${it.name}`}>
                      <Minus color={colors.brand} size={18} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{formatClock(it.rest_sec)}</Text>
                    <TouchableOpacity style={styles.stepperButton} onPress={() => update(it.key, { rest_sec: clampRest(it.rest_sec + LIMITS.restStep) })} accessibilityRole="button" accessibilityLabel={`Aumentar descanso de ${it.name}`}>
                      <Plus color={colors.brand} size={18} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {it.weights.map((w, setIndex) => (
                <View key={setIndex} style={styles.setRow}>
                  <Text style={styles.setLabel}>Série {setIndex + 1}</Text>
                  <TextInput
                    style={styles.weightInput}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    placeholder="—"
                    placeholderTextColor={colors.textSecondary}
                    value={w}
                    onChangeText={(v) => update(it.key, { weights: it.weights.map((x, i) => (i === setIndex ? v : x)) })}
                    accessibilityLabel={`Carga da série ${setIndex + 1} de ${it.name}`}
                  />
                  <Text style={styles.kg}>kg</Text>
                </View>
              ))}
              <View style={styles.setActions}>
                <TouchableOpacity
                  style={styles.setActionButton}
                  disabled={it.weights.length >= LIMITS.sets}
                  onPress={() => update(it.key, { weights: [...it.weights, it.weights[it.weights.length - 1] ?? ''] })}
                  accessibilityRole="button"
                >
                  <Text style={[styles.setAction, it.weights.length >= LIMITS.sets && styles.disabled]}>+ Série</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.setActionButton}
                  disabled={it.weights.length <= 1}
                  onPress={() => update(it.key, { weights: it.weights.slice(0, -1) })}
                  accessibilityRole="button"
                >
                  <Text style={[styles.setAction, it.weights.length <= 1 && styles.disabled]}>− Série</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}

          {items.length < LIMITS.exercises && (
            <TouchableOpacity style={styles.addButton} onPress={() => setPickerOpen(true)} accessibilityRole="button">
              <Plus color={colors.brand} size={20} />
              <Text style={styles.addText}>Adicionar exercício</Text>
            </TouchableOpacity>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          <Button title="Salvar rotina" loading={saving} onPress={save} />
          {routineId && <Button title="Excluir rotina" outline danger style={styles.deleteButton} onPress={() => setConfirmDelete(true)} />}
        </ScrollView>
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setItems((l) => [...l, newFormExercise(e)]);
          setPickerOpen(false);
        }}
      />
      <ConfirmModal
        visible={confirmDelete}
        title="Excluir rotina?"
        message="Ela sai da sua lista. O histórico de treinos continua."
        confirmLabel="Excluir"
        danger
        loading={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </SafeAreaView>
  );
}
