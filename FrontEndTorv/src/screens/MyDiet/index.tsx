import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X, Edit2, Trash2, UtensilsCrossed } from 'lucide-react-native';

import { ProgressBar } from '../../components/ProgressBar';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import api from '../../services/api';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

interface MacroState {
  current: number;
  goal: number;
  color: string;
}

interface DietMetrics {
  calories: MacroState;
  protein: MacroState;
  carbs: MacroState;
  fat: MacroState;
}

export default function MyDiet() {
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [meals, setMeals] = useState<any[]>([]);

  // New/Edit Meal Form
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [mealProtein, setMealProtein] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [mealFormError, setMealFormError] = useState('');

  // CRUD States
  const [selectedMealId, setSelectedMealId] = useState<string | null>(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);

  // Targets Edit State
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [editTargets, setEditTargets] = useState({ calories: '', protein: '', carbs: '', fat: '' });

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isDateLoading, setIsDateLoading] = useState(false);

  const [metrics, setMetrics] = useState<DietMetrics>({
    calories: { current: 0, goal: 2400, color: colors.brand },
    protein: { current: 0, goal: 150, color: colors.accentProtein },
    carbs: { current: 0, goal: 250, color: colors.accentCarbs },
    fat: { current: 0, goal: 75, color: colors.accentFat }
  });

  const generateDates = () => {
    const dates = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayNames = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
      dates.push({
        fullDate: d.toISOString().split('T')[0],
        dayName: dayNames[d.getDay()],
        dayNumber: d.getDate(),
      });
    }
    return dates;
  };

  const [availableDates] = useState(generateDates());

  const updateDietMetrics = (data: any) => {
    const targets = data.targets || { daily_calories: 2400, protein_g: 150, carbs_g: 250, fat_g: 75 };
    const consumed = data.consumed || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    
    setMetrics({
      calories: { current: consumed.calories || 0, goal: targets.daily_calories || 2400, color: colors.brand },
      protein: { current: consumed.protein_g || 0, goal: targets.protein_g || 150, color: colors.accentProtein },
      carbs: { current: consumed.carbs_g || 0, goal: targets.carbs_g || 250, color: colors.accentCarbs },
      fat: { current: consumed.fat_g || 0, goal: targets.fat_g || 75, color: colors.accentFat },
    });

    if (data.logs) {
      const formattedLogs = data.logs.map((log: any) => {
        let macros = { proteins: 0, carbs: 0, fats: 0 };
        try {
          macros = typeof log.macros_json === 'string' ? JSON.parse(log.macros_json) : log.macros_json || macros;
        } catch (e) {}
        return {
          id: String(log.id),
          name: log.food_name,
          calories: log.calories,
          protein: macros.protein || macros.proteins || 0,
          carbs: macros.carbs || 0,
          fat: macros.fat || macros.fats || 0,
        };
      });
      setMeals(formattedLogs);
    } else {
      setMeals([]);
    }
  };

  const loadDataForDate = async (dateStr: string) => {
    setIsDateLoading(true);
    try {
      const response = await api.get(`/diet/summary?date=${dateStr}`);
      updateDietMetrics(response.data);
    } catch (error) {
      console.log('Error fetching summary for date', error);
      updateDietMetrics({});
    } finally {
      setIsDateLoading(false);
    }
  };

  useEffect(() => {
    loadDataForDate(selectedDate);
  }, [selectedDate]);

  const handleAddMeal = async () => {
    if (loading) return;
    setMealFormError('');

    if (!mealName.trim() || !mealCalories) {
      setMealFormError('Nome e calorias são obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        food_name: mealName,
        calories: Number(mealCalories),
        macros_json: { protein: Number(mealProtein), carbs: Number(mealCarbs), fat: Number(mealFat) },
      };

      if (selectedMealId) {
        await api.put(`/diet/${selectedMealId}`, payload);
      } else {
        await api.post('/diet', payload);
      }

      await loadDataForDate(selectedDate);
      setModalVisible(false);
    } catch (error) {
      setMealFormError('Falha ao salvar refeição.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTargetEdit = () => {
    setEditTargets({
      calories: String(metrics.calories.goal),
      protein: String(metrics.protein.goal),
      carbs: String(metrics.carbs.goal),
      fat: String(metrics.fat.goal),
    });
    setTargetModalVisible(true);
  };

  const handleSaveTargets = async () => {
    setLoading(true);
    try {
      await api.put('/diet/targets', {
        daily_calories: Number(editTargets.calories),
        protein_g: Number(editTargets.protein),
        carbs_g: Number(editTargets.carbs),
        fat_g: Number(editTargets.fat)
      });
      await loadDataForDate(selectedDate);
      setTargetModalVisible(false);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível atualizar as metas.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenNewMeal = () => {
    setSelectedMealId(null);
    setMealName('');
    setMealCalories('');
    setMealProtein('');
    setMealCarbs('');
    setMealFat('');
    setMealFormError('');
    setModalVisible(true);
  };

  const handleOpenEditMeal = (meal: any) => {
    setSelectedMealId(meal.id);
    setMealName(meal.name);
    setMealCalories(String(meal.calories));
    setMealProtein(String(meal.protein));
    setMealCarbs(String(meal.carbs));
    setMealFat(String(meal.fat));
    setMealFormError('');
    setModalVisible(true);
  };

  const handleDeleteMealPrompt = (id: string) => {
    setMealToDelete(id);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!mealToDelete) return;
    try {
      await api.delete(`/diet/${mealToDelete}`);
      await loadDataForDate(selectedDate);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao excluir a refeição.');
    } finally {
      setDeleteConfirmVisible(false);
      setMealToDelete(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Minha Dieta</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateSelector}>
        {availableDates.map((item) => {
          const isActive = item.fullDate === selectedDate;
          return (
            <TouchableOpacity
              key={item.fullDate}
              onPress={() => setSelectedDate(item.fullDate)}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar dia ${item.dayNumber} de ${item.dayName}`}
            >
              <Card style={[styles.dateItem, isActive && styles.dateItemActive]}>
                <Text style={styles.dateDay}>{item.dayName}</Text>
                <Text style={styles.dateNumber}>{item.dayNumber}</Text>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Main Calories Progress Bar */}
      <Card style={styles.mainCaloriesCard}>
        <View style={styles.caloriesHeaderRow}>
          <View style={styles.caloriesTitleRow}>
            <Text style={styles.mainCaloriesTitle}>Total Calorias</Text>
            <TouchableOpacity
              onPress={handleOpenTargetEdit}
              style={styles.editTargetButton}
              accessibilityRole="button"
              accessibilityLabel="Editar metas diárias"
            >
              <Edit2 color={colors.brand} size={16} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.mainCaloriesValue, metrics.calories.current > metrics.calories.goal && styles.valueOverGoal]}>
            {metrics.calories.current} <Text style={styles.mainCaloriesGoal}>/ {metrics.calories.goal} kcal</Text>
          </Text>
        </View>
        <ProgressBar progress={metrics.calories.goal > 0 ? metrics.calories.current / metrics.calories.goal : 0} color={metrics.calories.color} style={styles.mainCaloriesBar} />
      </Card>

      <View style={styles.macrosContainer}>
        <Card style={styles.macroCard}>
          <Text style={styles.macroTitle}>Proteína</Text>
          <Text style={[styles.macroValue, metrics.protein.current > metrics.protein.goal && styles.valueOverGoal]}>
            {metrics.protein.current} <Text style={styles.macroGoal}>/ {metrics.protein.goal}g</Text>
          </Text>
          <ProgressBar progress={metrics.protein.goal > 0 ? metrics.protein.current / metrics.protein.goal : 0} color={metrics.protein.color} />
        </Card>
        <Card style={styles.macroCard}>
          <Text style={styles.macroTitle}>Carboidratos</Text>
          <Text style={[styles.macroValue, metrics.carbs.current > metrics.carbs.goal && styles.valueOverGoal]}>
            {metrics.carbs.current} <Text style={styles.macroGoal}>/ {metrics.carbs.goal}g</Text>
          </Text>
          <ProgressBar progress={metrics.carbs.goal > 0 ? metrics.carbs.current / metrics.carbs.goal : 0} color={metrics.carbs.color} />
        </Card>
        <Card style={styles.macroCard}>
          <Text style={styles.macroTitle}>Gordura</Text>
          <Text style={[styles.macroValue, metrics.fat.current > metrics.fat.goal && styles.valueOverGoal]}>
            {metrics.fat.current} <Text style={styles.macroGoal}>/ {metrics.fat.goal}g</Text>
          </Text>
          <ProgressBar progress={metrics.fat.goal > 0 ? metrics.fat.current / metrics.fat.goal : 0} color={metrics.fat.color} />
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Refeições</Text>
      
      <ScrollView>
        {meals.length === 0 && !isDateLoading ? (
          <Card style={styles.mealCard}>
            <View style={styles.mealEmptyIconContainer}>
              <UtensilsCrossed color={colors.textSecondary} size={20} />
            </View>
            <View style={styles.mealInfo}>
              <Text style={styles.mealName}>Nenhuma refeição ainda</Text>
              <Text style={styles.mealMacros}>Você ainda não registrou nada hoje.</Text>
            </View>
          </Card>
        ) : (
          meals.map(meal => (
            <Card key={meal.id} style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealMacros}>
                  P: {meal.protein}g · C: {meal.carbs}g · G: {meal.fat}g
                </Text>
              </View>
              <View style={styles.mealActions}>
                <Text style={styles.mealCalories}>{meal.calories} kcal</Text>
                <TouchableOpacity
                  onPress={() => handleOpenEditMeal(meal)}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar refeição ${meal.name}`}
                >
                  <Edit2 color={colors.textSecondary} size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteMealPrompt(meal.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir refeição ${meal.name}`}
                >
                  <Trash2 color={colors.error} size={18} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
        {isDateLoading && (
          <ActivityIndicator size="small" color={colors.brand} style={styles.dateLoadingIndicator} />
        )}

        <TouchableOpacity
          style={styles.addMealButton}
          onPress={handleOpenNewMeal}
          accessibilityRole="button"
          accessibilityLabel="Adicionar refeição"
        >
          <Plus color={colors.brand} size={24} style={styles.addMealIcon} />
          <Text style={styles.addMealText}>Adicionar Refeição</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Form Modal (Create/Edit) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedMealId ? 'Editar Refeição' : 'Nova Refeição'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar formulário de refeição">
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Input label="Nome da Refeição" placeholder="Ex: Almoço" value={mealName} onChangeText={setMealName} />
              <Input label="Calorias" placeholder="0" value={mealCalories} onChangeText={setMealCalories} keyboardType="numeric" />

              <View style={styles.formRow}>
                <View style={styles.formRowItem}>
                  <Input label="Proteína (g)" placeholder="0" value={mealProtein} onChangeText={setMealProtein} keyboardType="numeric" />
                </View>
                <View style={styles.formRowItem}>
                  <Input label="Carbo (g)" placeholder="0" value={mealCarbs} onChangeText={setMealCarbs} keyboardType="numeric" />
                </View>
                <View style={styles.formRowItem}>
                  <Input label="Gordura (g)" placeholder="0" value={mealFat} onChangeText={setMealFat} keyboardType="numeric" />
                </View>
              </View>

              {mealFormError ? (
                <Text style={styles.formError}>{mealFormError}</Text>
              ) : null}

              <Button title="Salvar" onPress={handleAddMeal} loading={loading} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Targets Modal */}
      <Modal visible={targetModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar Metas Diárias</Text>
              <TouchableOpacity onPress={() => setTargetModalVisible(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de metas">
                <X color={colors.text} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Input label="Calorias Totais (kcal)" placeholder="2000" value={editTargets.calories} onChangeText={(val) => setEditTargets({...editTargets, calories: val})} keyboardType="numeric" />

              <View style={styles.formRow}>
                <View style={styles.formRowItem}>
                  <Input label="Proteína (g)" placeholder="150" value={editTargets.protein} onChangeText={(val) => setEditTargets({...editTargets, protein: val})} keyboardType="numeric" />
                </View>
                <View style={styles.formRowItem}>
                  <Input label="Carbo (g)" placeholder="250" value={editTargets.carbs} onChangeText={(val) => setEditTargets({...editTargets, carbs: val})} keyboardType="numeric" />
                </View>
                <View style={styles.formRowItem}>
                  <Input label="Gordura (g)" placeholder="75" value={editTargets.fat} onChangeText={(val) => setEditTargets({...editTargets, fat: val})} keyboardType="numeric" />
                </View>
              </View>

              <Button title="Salvar Metas" onPress={handleSaveTargets} loading={loading} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade">
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Excluir Refeição?</Text>
            </View>
            <Text style={styles.deleteModalText}>
              Tem certeza que deseja excluir esta refeição permanentemente? Os dados não poderão ser recuperados.
            </Text>
            <View style={styles.deleteModalActions}>
              <Button title="Cancelar" outline onPress={() => setDeleteConfirmVisible(false)} style={styles.deleteModalButton} />
              <Button title="Excluir" danger onPress={handleConfirmDelete} style={styles.deleteModalButton} />
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}
