import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { X, Plus, Edit2, Trash2 } from 'lucide-react-native';
import { Input } from '../Input';
import { Button } from '../Button';
import { MUSCLE_GROUPS, workoutsApi, type Exercise } from '../../services/workouts';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}

interface Form {
  id?: string; // presente = edição
  name: string;
  muscle_group: string;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const ExercisePicker: React.FC<Props> = ({ visible, onClose, onPick }) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Exercise | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setExercises(await workoutsApi.listExercises());
    } catch {
      setError('Não foi possível carregar os exercícios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      setForm(null);
      setToDelete(null);
      load();
    }
  }, [visible]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return exercises.filter((e) => (!group || e.muscle_group === group) && (!q || normalize(e.name).includes(q)));
  }, [exercises, query, group]);

  const saveForm = async () => {
    if (!form) return;
    const name = form.name.trim();
    if (!name || name.length > 100) {
      setError('Nome de 1 a 100 caracteres.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { name, muscle_group: form.muscle_group };
      if (form.id) await workoutsApi.updateExercise(form.id, body);
      else await workoutsApi.createExercise(body);
      setForm(null);
      await load();
    } catch {
      setError('Não foi possível salvar o exercício.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await workoutsApi.deleteExercise(toDelete.id);
      setToDelete(null);
      await load();
    } catch {
      setError('Não foi possível excluir o exercício.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: Exercise }) => (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.rowMain}
        onPress={() => onPick(item)}
        accessibilityRole="button"
        accessibilityLabel={`Adicionar ${item.name}`}
      >
        <Text style={styles.rowName}>{item.name}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowGroup}>{item.muscle_group}</Text>
          {item.is_custom && <Text style={styles.customTag}>Meu</Text>}
        </View>
      </TouchableOpacity>
      {item.is_custom && (
        <>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setForm({ id: item.id, name: item.name, muscle_group: item.muscle_group })}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.name}`}
          >
            <Edit2 color={colors.textSecondary} size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setToDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Excluir ${item.name}`}
          >
            <Trash2 color={colors.error} size={18} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{form ? (form.id ? 'Editar exercício' : 'Novo exercício') : 'Adicionar exercício'}</Text>
          <TouchableOpacity style={styles.iconButton} onPress={form ? () => setForm(null) : onClose} accessibilityRole="button" accessibilityLabel="Fechar">
            <X color={colors.textSecondary} size={24} />
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {form ? (
          <ScrollView keyboardShouldPersistTaps="handled">
            <Input label="Nome" value={form.name} maxLength={100} onChangeText={(name) => setForm({ ...form, name })} />
            <Text style={styles.label}>Grupo muscular</Text>
            <View style={styles.chips}>
              {MUSCLE_GROUPS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, form.muscle_group === g && styles.chipActive]}
                  onPress={() => setForm({ ...form, muscle_group: g })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: form.muscle_group === g }}
                >
                  <Text style={[styles.chipText, form.muscle_group === g && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Salvar exercício" loading={saving} onPress={saveForm} />
          </ScrollView>
        ) : (
          <>
            <Input placeholder="Buscar exercício" value={query} onChangeText={setQuery} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsRow}>
              {[null, ...MUSCLE_GROUPS].map((g) => (
                <TouchableOpacity
                  key={g ?? 'all'}
                  style={[styles.chip, group === g && styles.chipActive]}
                  onPress={() => setGroup(g)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: group === g }}
                >
                  <Text style={[styles.chipText, group === g && styles.chipTextActive]}>{g ?? 'Todos'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setForm({ name: query.trim(), muscle_group: group ?? MUSCLE_GROUPS[0] })}
              accessibilityRole="button"
            >
              <Plus color={colors.brand} size={18} />
              <Text style={styles.createText}>Criar exercício</Text>
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator color={colors.brand} style={styles.loading} />
            ) : (
              <FlatList
                data={filtered}
                keyExtractor={(e) => e.id}
                renderItem={renderItem}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={styles.empty}>Nenhum exercício encontrado.</Text>}
              />
            )}

            {toDelete && (
              <View style={styles.deleteBar}>
                <Text style={styles.deleteText}>Excluir "{toDelete.name}"? Ele sai de todas as rotinas.</Text>
                <View style={styles.deleteActions}>
                  <Button title="Cancelar" outline style={styles.deleteButton} onPress={() => setToDelete(null)} />
                  <Button title="Excluir" danger loading={saving} style={styles.deleteButton} onPress={confirmDelete} />
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </Modal>
  );
};
