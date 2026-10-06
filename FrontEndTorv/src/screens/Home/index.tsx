import React, { useState, useContext, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, Activity, Clock, ChevronRight, MoreHorizontal, Heart, MessageCircle, MapPin, User, Flame, RotateCcw, Hand, Dumbbell } from 'lucide-react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { ProgressBar } from '../../components/ProgressBar';
import { Card } from '../../components/Card';
import { ConfirmModal } from '../../components/ConfirmModal';
import { WelcomeModal } from '../../components/WelcomeModal';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
import { workoutsApi, type RoutineSummary } from '../../services/workouts';
import { activitiesApi, type ActivitySummary } from '../../services/activities';
import { loadDraft } from '../../utils/workoutDraft';
import { toISODate } from '../../utils/date';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

export default function Home() {
  const navigation = useNavigation<AppNavigation>();
  const { user, dismissWelcome } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(user?.goalCalories || 2400);
  const [remaining, setRemaining] = useState(0);
  // undefined = carregando/erro; null = sem rotinas
  const [nextRoutine, setNextRoutine] = useState<RoutineSummary | null | undefined>(undefined);
  const [confirmRepeat, setConfirmRepeat] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  // null = carregando/erro (UI mostra '–', nunca um número inventado)
  const [activity, setActivity] = useState<ActivitySummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDietSummary();
      loadWorkout();
      loadActivitySummary();
    }, [user?.id])
  );

  // Falha aqui não derruba dieta/treino: try/catch próprio.
  const loadActivitySummary = async () => {
    try {
      const now = new Date();
      setActivity(await activitiesApi.summary({ date: toISODate(now), tz_offset_min: -now.getTimezoneOffset() }));
    } catch (error) {
      console.log('Failed to load activity summary', error);
      setActivity(null);
    }
  };

  // 1ª chamada depois do login gera o treino padrão no backend.
  const loadWorkout = async () => {
    try {
      const [list, draft] = await Promise.all([
        workoutsApi.listRoutines(),
        user?.id ? loadDraft(user.id) : Promise.resolve(null),
      ]);
      setNextRoutine(list.routines.find((r) => r.id === list.next_routine_id) ?? null);
      setHasDraft(!!draft);
    } catch (error) {
      console.log('Failed to load workouts', error);
      setNextRoutine(undefined);
    }
  };

  const startNext = () => {
    setConfirmRepeat(false);
    if (nextRoutine) navigation.navigate('WorkoutSession', { routineId: nextRoutine.id });
  };

  // Treino feito nos últimos 7 dias: mesmo aviso da aba Treinos, sem impedir.
  const onWorkoutPress = () => {
    if (hasDraft) navigation.navigate('WorkoutSession', { resume: true });
    else if (nextRoutine?.completed_recently) setConfirmRepeat(true);
    else if (nextRoutine) startNext();
    else navigation.navigate('Workouts' as never);
  };

  const loadDietSummary = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const today = toISODate(new Date());
      const response = await api.get(`/diet/summary?date=${today}`);
      const consumedData = response.data.consumed || {};
      const targetsData = response.data.targets || {};

      const totalConsumed = consumedData.calories || 0;
      const dailyGoal = targetsData.daily_calories || 2400;
      const rem = dailyGoal - totalConsumed;

      setConsumed(totalConsumed);
      setGoal(dailyGoal);
      setRemaining(rem);
    } catch (error) {
      console.log('Failed to load diet summary', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia,';
    if (hour >= 12 && hour < 18) return 'Boa tarde,';
    return 'Boa noite,';
  };

  const progress = goal > 0 ? consumed / goal : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Dynamic Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{user?.name?.split(' ')[0] || 'Atleta'}</Text>
              <Hand color={colors.brand} size={22} />
            </View>
          </View>
          {user?.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <User color={colors.brand} size={24} style={styles.avatarIcon} />
            </View>
          )}
        </View>

        {/* Top Grid Mocks */}
        <View style={styles.gridRow}>
          <Card style={styles.streakCard}>
            <View style={styles.streakTitleRow}>
              <Flame color={colors.textSecondary} size={14} />
              <Text style={styles.streakTitle}>Streak</Text>
            </View>
            <Text style={styles.streakValue}>{activity ? activity.streak_days : '–'}</Text>
            <Text style={styles.streakSub}>{activity?.streak_days === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
          </Card>

          <Card style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>Treino de hoje</Text>
            <Text style={styles.workoutValue} numberOfLines={2}>
              {hasDraft ? 'Treino em andamento' : nextRoutine ? nextRoutine.name : nextRoutine === null ? 'Monte seu treino' : 'Treinos'}
            </Text>
            <TouchableOpacity style={styles.workoutAction} onPress={onWorkoutPress} accessibilityRole="button">
              <Play color={colors.brand} size={14} fill={colors.brand} />
              <Text style={styles.workoutActionText}>{hasDraft ? 'Continuar treino' : nextRoutine ? 'Iniciar' : 'Ver treinos'}</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Morning Walk Mock */}
        <Card style={styles.walkCard}>
          <View style={styles.walkIconBlock}>
            <Activity color={colors.brand} size={32} />
          </View>
          <View style={styles.walkInfo}>
            <Text style={styles.walkTitle}>Caminhada matinal</Text>
            <View style={styles.walkStatsRow}>
              <Text style={styles.walkStat}>3.2km</Text>
              <Text style={styles.walkStat}>32min</Text>
              <Text style={styles.walkStat}>180kcal</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.watchButton}>
            <Clock color={colors.textSecondary} size={14} />
            <Text style={styles.watchText}>Relógio</Text>
          </TouchableOpacity>
        </Card>

        {/* Main Nutrition Integration */}
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginBottom: 24 }} />
        ) : loadError ? (
          <Card style={styles.caloriesSection}>
            <Text style={styles.caloriesTitle}>Calorias de hoje</Text>
            <Text style={styles.errorText}>Não foi possível carregar suas calorias.</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadDietSummary}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar calorias novamente"
            >
              <RotateCcw color={colors.brand} size={14} />
              <Text style={styles.retryText}>Tentar novamente</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          <Card style={styles.caloriesSection}>
            <TouchableOpacity onPress={() => navigation.navigate('MyDiet' as never)} style={styles.caloriesHeader}>
              <Text style={styles.caloriesTitle}>Calorias de hoje</Text>
              <Text style={styles.caloriesLink}>ver detalhes {'>'}</Text>
            </TouchableOpacity>

            <View style={styles.caloriesGrid}>
              <View style={styles.calorieBox}>
                <Text style={styles.calorieBoxTitle}>Consumidas</Text>
                <Text style={styles.calorieBoxValue}>
                  {consumed.toLocaleString('pt-BR')}
                </Text>
                <Text style={styles.calorieBoxSub}>kcal</Text>
              </View>

              <View style={styles.calorieBox}>
                <Text style={styles.calorieBoxTitle}>Gastas</Text>
                <Text style={styles.calorieBoxValueGreen}>
                  {activity ? activity.calories_burned.toLocaleString('pt-BR') : '–'}
                </Text>
                <Text style={styles.calorieBoxSub}>kcal = atividades</Text>
              </View>
            </View>

            <ProgressBar progress={progress} color={colors.brand} style={{ height: 6 }} />
            <Text style={styles.remainingText}>
              {remaining > 0 ? `${remaining.toLocaleString('pt-BR')} kcal restantes para sua meta` : 'Meta atingida!'}
            </Text>
          </Card>
        )}

        {/* Feed Mock */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Feed</Text>
          <Text style={styles.sectionLink}>Ver tudo</Text>
        </View>
        <Card style={styles.feedCard}>
          <View style={styles.feedHeader}>
            <View style={styles.feedUser}>
              <View style={styles.feedAvatar}>
                <User color={colors.brand} size={20} />
              </View>
              <View>
                <Text style={styles.feedName}>Marina Alves</Text>
                <Text style={styles.feedTime}>há 23 min · Corrida</Text>
              </View>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Mais opções da publicação">
              <MoreHorizontal color={colors.textSecondary} size={20} />
            </TouchableOpacity>
          </View>

          <View style={styles.feedStatsRow}>
            <View style={styles.feedStatBlock}>
              <Text style={styles.feedStatText}>5.4 km</Text>
            </View>
            <View style={styles.feedStatBlock}>
              <Text style={styles.feedStatText}>28:12</Text>
            </View>
            <View style={[styles.feedStatBlock, { borderRightWidth: 0 }]}>
              <Text style={styles.feedStatText}>312 kcal</Text>
            </View>
          </View>

          <View style={styles.feedContentRow}>
            <Dumbbell color={colors.textMuted} size={14} />
            <Text style={styles.feedContent}>Corrida matinal feita! Cada km conta.</Text>
          </View>

          <View style={styles.feedFooter}>
            <View style={styles.feedAction}>
              <Heart color={colors.textSecondary} size={16} />
              <Text style={styles.feedActionText}>47</Text>
            </View>
            <View style={styles.feedAction}>
              <MessageCircle color={colors.textSecondary} size={16} />
              <Text style={styles.feedActionText}>12</Text>
            </View>
          </View>
        </Card>

        {/* Explorar Mock */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explorar</Text>
          <Text style={styles.sectionLink}>Ver mapa</Text>
        </View>
        <Card style={styles.exploreCard}>
          <View style={styles.exploreFilters}>
            <View style={styles.filterPill}>
              <Activity color={colors.background} size={14} />
              <Text style={styles.filterText}>Academias</Text>
            </View>
            <View style={styles.filterPillDark}>
              <MapPin color={colors.text} size={14} />
              <Text style={styles.filterTextDark}>Trajetos</Text>
            </View>
            <View style={styles.filterPillDark}>
              <MapPin color={colors.text} size={14} />
              <Text style={styles.filterTextDark}>Parques</Text>
            </View>
          </View>

          <View style={styles.placeCard}>
            <View>
              <Text style={styles.placeTitle}>SmartFit Centro</Text>
              <Text style={styles.placeSub}>320m de distância · Aberto 24h</Text>
            </View>
            <TouchableOpacity style={styles.placeButton}>
              <Text style={styles.placeButtonText}>Abrir</Text>
              <ChevronRight color={colors.brand} size={14} />
            </TouchableOpacity>
          </View>
        </Card>

      </ScrollView>
      <ConfirmModal
        visible={confirmRepeat}
        title="Treino já concluído"
        message="Você já fez esse treino nos últimos 7 dias. O ideal é dar de 48 a 72 horas para o músculo se recuperar."
        confirmLabel="Treinar mesmo assim"
        onConfirm={startNext}
        onCancel={() => setConfirmRepeat(false)}
      />
      <WelcomeModal visible={!!user?.welcome_pending} name={user?.name} onClose={dismissWelcome} />
    </SafeAreaView>
  );
}
