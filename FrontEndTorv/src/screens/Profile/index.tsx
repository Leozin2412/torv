import React, { useContext, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LogOut, Edit2, ChevronRight, User as UserIcon, Plus, X, Flame, Dumbbell, Watch, UtensilsCrossed, Activity, Scale } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SelectCard } from '../../components/SelectCard';
import { Card } from '../../components/Card';
import { GoalConflictWarning } from '../../components/GoalConflictWarning';
import { NutritionSuggestionModal, type NutritionSuggestion } from '../../components/NutritionSuggestionModal';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
import { workoutsApi, type SessionSummary } from '../../services/workouts';
import type { AppNavigation } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { FITNESS_LEVELS, GOAL_OPTIONS, fitnessLevelLabel } from '../../utils/profileOptions';
import { styles } from './styles';

const formatDayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Profile() {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation<AppNavigation>();

  const [avatarUri, setAvatarUri] = useState<string | null>(user?.photo_url || null);
  const [foodLogs, setFoodLogs] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  // Edit States
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editGoals, setEditGoals] = useState<string[]>([]);

  const [showLevelModal, setShowLevelModal] = useState(false);
  const [editLevel, setEditLevel] = useState('');

  const [showBodyModal, setShowBodyModal] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [editHeight, setEditHeight] = useState('');
  const [bodyError, setBodyError] = useState('');

  const [suggestion, setSuggestion] = useState<NutritionSuggestion | null>(null);

  // Fetch all data every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          const [dietResponse, profileResponse, recentSessions] = await Promise.all([
            api.get('/diet/summary'),
            api.get('/profile'),
            workoutsApi.listSessions(5).catch(() => [] as SessionSummary[]),
          ]);
          setSessions(recentSessions);
          if (dietResponse.data && dietResponse.data.logs) {
            const formattedLogs = dietResponse.data.logs.map((log: any) => ({
              id: String(log.id),
              name: log.food_name,
              calories: log.calories,
            }));
            setFoodLogs(formattedLogs);
          } else {
            setFoodLogs([]);
          }

          if (profileResponse.data) {
            setProfileData(profileResponse.data);
            if (profileResponse.data.photo_url) {
              setAvatarUri(profileResponse.data.photo_url);
            }
          }
        } catch (error) {
          console.log('Failed to fetch screen data', error);
        }
      }
      loadData();
    }, [])
  );

  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permissão negada', 'Precisamos de acesso à galeria para alterar a foto.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        uploadAvatar(uri, result.assets[0].file);
      }
    } catch (error) {
      console.log('Image picker error', error);
    }
  };

  const uploadAvatar = async (uri: string, webFile?: File) => {
    setLoadingAvatar(true);
    try {
      const formData = new FormData();

      if (webFile) {
        formData.append('photo', webFile, webFile.name);
      } else {
        const filename = uri.split('/').pop() || 'avatar.jpg';
        formData.append('photo', {
          uri,
          name: filename,
          type: 'image/jpeg',
        } as any);
      }

      const response = await api.post('/profile/upload', formData);

      if (response.data.photo_url) {
        setAvatarUri(response.data.photo_url);
      } else {
        // Fallback for UI if backend isn't ready
        setAvatarUri(uri);
      }
    } catch (error) {
      console.log('Avatar upload error', error);
      Alert.alert('Erro', 'Não foi possível atualizar a foto de perfil.');
    } finally {
      setLoadingAvatar(false);
    }
  };

  const handleOpenUsernameEdit = () => {
    setEditUsername(profileData?.username || user?.username || '');
    setShowUsernameModal(true);
  };

  const handleSaveUsername = async () => {
    try {
      await api.put('/profile', { username: editUsername });
      setProfileData((prev: any) => ({ ...prev, username: editUsername }));
      setShowUsernameModal(false);
    } catch (error) {
      console.log('Failed to save username', error);
      Alert.alert('Erro', 'Não foi possível atualizar o nome de usuário.');
    }
  };

  const handleOpenGoalEdit = () => {
    const currentGoalsStr = profileData?.goal || user?.goal || '';
    const currentGoals = currentGoalsStr ? currentGoalsStr.split(',').map((g: string) => g.trim()) : [];
    setEditGoals(currentGoals);
    setShowGoalModal(true);
  };

  const handleToggleGoal = (option: string) => {
    if (editGoals.includes(option)) {
      setEditGoals(editGoals.filter(g => g !== option));
    } else {
      setEditGoals([...editGoals, option]);
    }
  };

  const handleSaveGoals = async () => {
    try {
      const newGoalStr = editGoals.join(', ');
      const response = await api.put('/profile', { goal: newGoalStr });
      setProfileData((prev: any) => ({ ...prev, goal: newGoalStr }));
      setShowGoalModal(false);
      setSuggestion(response.data.nutrition_suggestion ?? null);
    } catch (error) {
      console.log('Failed to save goals', error);
      Alert.alert('Erro', 'Não foi possível atualizar os objetivos.');
    }
  };

  const handleOpenLevelEdit = () => {
    setEditLevel(profileData?.fitness_level || '');
    setShowLevelModal(true);
  };

  const handleSaveLevel = async () => {
    if (!editLevel) return;
    try {
      const response = await api.put('/profile', { fitness_level: editLevel });
      setProfileData((prev: any) => ({ ...prev, fitness_level: editLevel }));
      setShowLevelModal(false);
      setSuggestion(response.data.nutrition_suggestion ?? null);
    } catch (error) {
      console.log('Failed to save fitness level', error);
      Alert.alert('Erro', 'Não foi possível atualizar o nível físico.');
    }
  };

  const handleOpenBodyEdit = () => {
    setEditWeight(profileData?.weight_kg != null ? String(profileData.weight_kg) : '');
    setEditHeight(profileData?.height_cm != null ? String(profileData.height_cm) : '');
    setBodyError('');
    setShowBodyModal(true);
  };

  const handleSaveBody = async () => {
    const weight = Number(editWeight.replace(',', '.'));
    const height = Number(editHeight);
    if (!(weight >= 20 && weight <= 300)) return setBodyError('Peso deve estar entre 20 e 300 kg.');
    if (!Number.isInteger(height) || height < 50 || height > 250) return setBodyError('Altura deve ser um número inteiro entre 50 e 250 cm.');
    try {
      const response = await api.put('/profile', { weight_kg: weight, height_cm: height });
      setProfileData((prev: any) => ({ ...prev, weight_kg: weight, height_cm: height }));
      setShowBodyModal(false);
      setSuggestion(response.data.nutrition_suggestion ?? null);
    } catch (error) {
      console.log('Failed to save weight/height', error);
      setBodyError('Não foi possível salvar. Tente novamente.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity style={styles.menuButton} onPress={logout} accessibilityRole="button" accessibilityLabel="Sair da conta">
          <LogOut color={colors.error} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Avatar & Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarContainer}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <UserIcon color={colors.textSecondary} size={48} />
              )}
            </View>
            <TouchableOpacity
              style={styles.editBadge}
              onPress={handlePickImage}
              disabled={loadingAvatar}
              accessibilityRole="button"
              accessibilityLabel="Alterar foto de perfil"
            >
              <Edit2 color={colors.background} size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{profileData?.name || user?.name || 'Usuário'}</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{profileData?.username || user?.username || 'usuario'}</Text>
            <TouchableOpacity
              onPress={handleOpenUsernameEdit}
              style={styles.usernameEditButton}
              accessibilityRole="button"
              accessibilityLabel="Editar nome de usuário"
            >
              <Edit2 color={colors.textSecondary} size={14} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData?.followers || 0}</Text>
            <Text style={styles.statLabel}>seguidores</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData?.following || 0}</Text>
            <Text style={styles.statLabel}>seguindo</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData?.total_workouts || 0}</Text>
            <Text style={styles.statLabel}>treinos</Text>
          </View>
        </View>

        {/* Grid Cards */}
        <View style={styles.gridContainer}>
          <Card style={styles.gridCard}>
            <View style={styles.gridCardTitleRow}>
              <Flame color={colors.textSecondary} size={14} />
              <Text style={styles.gridCardTitle}>Streak</Text>
            </View>
            <Text style={styles.gridCardValue}>{profileData?.streak || 0}</Text>
            <Text style={styles.gridCardHighlight}>Recorde: {profileData?.longest_streak || 0} dias</Text>
          </Card>
          <Card style={styles.gridCard}>
            <Text style={styles.gridCardTitle}>Este mês</Text>
            <Text style={styles.gridCardValue}>{profileData?.workouts_in_month || 0}</Text>
            <Text style={styles.gridCardSubtitle}>Treinos</Text>
            <Text style={styles.gridCardHighlight}>+0 vs mês passado</Text>
          </Card>
        </View>

        {/* Objetivo */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleInline}>Objetivo</Text>
          <TouchableOpacity onPress={handleOpenGoalEdit} accessibilityRole="button" accessibilityLabel="Editar objetivo">
             <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Dumbbell color={colors.brand} size={22} />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>{profileData?.goal || user?.goal || 'Ganhar Massa Muscular'}</Text>
            <Text style={styles.listCardSubtitle}>Definido no cadastro</Text>
          </View>
        </Card>

        {/* Nível físico */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleInline}>Nível físico</Text>
          <TouchableOpacity onPress={handleOpenLevelEdit} accessibilityRole="button" accessibilityLabel="Editar nível físico">
            <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Activity color={colors.brand} size={22} />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>{fitnessLevelLabel(profileData?.fitness_level)}</Text>
          </View>
        </Card>

        {/* Peso e altura */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleInline}>Peso e altura</Text>
          <TouchableOpacity onPress={handleOpenBodyEdit} accessibilityRole="button" accessibilityLabel="Editar peso e altura">
            <Text style={styles.editLink}>Editar</Text>
          </TouchableOpacity>
        </View>
        <Card style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Scale color={colors.brand} size={22} />
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>
              {profileData?.weight_kg != null ? `${profileData.weight_kg} kg` : '— kg'} · {profileData?.height_cm != null ? `${profileData.height_cm} cm` : '— cm'}
            </Text>
          </View>
        </Card>

        {/* Relógio conectado */}
        <Text style={styles.sectionTitle}>Relógio conectado</Text>
        <TouchableOpacity activeOpacity={0.8}>
          <Card style={styles.listCard}>
            <View style={styles.listCardIconContainer}>
              <Watch color={colors.brand} size={22} />
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>Apple Watch Series 9</Text>
              <Text style={styles.connectedText}>Conectado</Text>
            </View>
            <ChevronRight color={colors.textSecondary} size={20} style={styles.listCardRight} />
          </Card>
        </TouchableOpacity>

        {/* Histórico de hoje */}
        <Text style={styles.sectionTitle}>Atividade Física</Text>

        {sessions.length > 0 ? (
          sessions.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => navigation.navigate('WorkoutSummary', { sessionId: s.id })}
              accessibilityRole="button"
              accessibilityLabel={`Ver treino ${s.title}`}
            >
              <Card style={styles.listCard}>
                <View style={styles.listCardIconContainer}>
                  <Dumbbell color={colors.brand} size={22} />
                </View>
                <View style={styles.listCardContent}>
                  <Text style={styles.listCardTitle}>{s.title}</Text>
                  <Text style={styles.listCardSubtitle}>
                    {formatDayMonth(s.start_time)} · {Math.max(1, Math.round(s.duration_sec / 60))} min · {s.set_count} séries
                  </Text>
                </View>
                <ChevronRight color={colors.textSecondary} size={20} style={styles.listCardRight} />
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Card style={styles.listCard}>
            <View style={styles.listCardIconContainer}>
              <Dumbbell color={colors.textSecondary} size={22} />
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>Nenhum treino ainda</Text>
              <Text style={styles.listCardSubtitle}>Seus treinos finalizados aparecem aqui.</Text>
            </View>
          </Card>
        )}

        <Text style={styles.sectionTitle}>Alimentação</Text>

        {/* Real Food Logs (Mapped) */}
        {foodLogs.length > 0 ? (
          foodLogs.map((log: any, index: number) => (
            <Card key={index} style={styles.listCard}>
              <View style={styles.listCardIconContainer}>
                <UtensilsCrossed color={colors.brand} size={20} />
              </View>
              <View style={styles.listCardContent}>
                <Text style={styles.listCardTitle}>{log.name || 'Refeição'}</Text>
                <Text style={styles.listCardSubtitle}>{log.calories || 0} kcal</Text>
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.listCard}>
            <View style={styles.listCardIconContainer}>
              <UtensilsCrossed color={colors.textSecondary} size={20} />
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>Nenhuma refeição ainda</Text>
              <Text style={styles.listCardSubtitle}>Você ainda não registrou nada hoje.</Text>
            </View>
          </Card>
        )}

        <TouchableOpacity
          style={styles.addMealButton}
          onPress={() => navigation.navigate('MyDiet' as never)}
          accessibilityRole="button"
          accessibilityLabel="Adicionar refeição"
        >
          <Plus color={colors.brand} size={24} style={styles.addMealIcon} />
          <Text style={styles.addMealText}>Adicionar Refeição</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Username Edit Modal */}
      <Modal visible={showUsernameModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[colors.brandTint, colors.background]}
            style={styles.modalContent}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meu Username</Text>
              <TouchableOpacity onPress={() => setShowUsernameModal(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de username">
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Escolha um nome de usuário único para o seu perfil.</Text>

            <Input 
              label="Username" 
              value={editUsername} 
              onChangeText={setEditUsername} 
              autoCapitalize="none"
              placeholder="ex: seunome123"
            />
            
            <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveUsername}>
              <LinearGradient
                colors={[colors.brand, colors.brandDark]}
                style={styles.futuristicButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.futuristicButtonText}>CONFIRMAR E SALVAR</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Goal Edit Modal */}
      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[colors.brandTint, colors.background]}
            style={[styles.modalContent, styles.goalModalContent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={[styles.modalHeader, styles.goalModalPadded]}>
              <Text style={styles.modalTitle}>Meus Objetivos</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de objetivos">
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, styles.goalModalPadded]}>
              Selecione o que você quer alcançar para ajustarmos seu plano.
            </Text>

            <ScrollView style={styles.goalScrollView} showsVerticalScrollIndicator={false}>
              {GOAL_OPTIONS.map((option) => (
                <SelectCard
                  key={option}
                  title={option}
                  selected={editGoals.includes(option)}
                  onPress={() => handleToggleGoal(option)}
                  style={styles.goalSelectCard}
                />
              ))}
            </ScrollView>

            <View style={styles.goalModalPadded}>
              <GoalConflictWarning goals={editGoals} />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveGoals}>
                <LinearGradient
                  colors={[colors.brand, colors.brandDark]}
                  style={styles.futuristicButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.futuristicButtonText}>ATUALIZAR OBJETIVOS</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Fitness Level Edit Modal */}
      <Modal visible={showLevelModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient colors={[colors.brandTint, colors.background]} style={styles.modalContent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nível físico</Text>
              <TouchableOpacity onPress={() => setShowLevelModal(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de nível físico">
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Escolha a opção que melhor descreve sua rotina atual.</Text>
            {FITNESS_LEVELS.map((level) => (
              <SelectCard
                key={level.value}
                title={level.label}
                titleColor={level.color}
                description={level.description}
                selected={editLevel === level.value}
                onPress={() => setEditLevel(level.value)}
              />
            ))}
            <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveLevel}>
              <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.futuristicButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.futuristicButtonText}>ATUALIZAR NÍVEL</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      {/* Weight & Height Edit Modal */}
      <Modal visible={showBodyModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient colors={[colors.brandTint, colors.background]} style={styles.modalContent} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Peso e altura</Text>
              <TouchableOpacity onPress={() => setShowBodyModal(false)} accessibilityRole="button" accessibilityLabel="Fechar edição de peso e altura">
                <X color={colors.textSecondary} size={24} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>Mantenha seus dados atualizados para ajustarmos suas metas.</Text>
            <Input label="Peso (kg)" placeholder="Ex: 70" value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad" />
            <Input label="Altura (cm)" placeholder="Ex: 175" value={editHeight} onChangeText={setEditHeight} keyboardType="number-pad" />
            {bodyError ? <Text style={styles.formError}>{bodyError}</Text> : null}
            <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveBody}>
              <LinearGradient colors={[colors.brand, colors.brandDark]} style={styles.futuristicButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.futuristicButtonText}>SALVAR</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>

      <NutritionSuggestionModal
        suggestion={suggestion}
        onClose={() => setSuggestion(null)}
        onResolved={() => setSuggestion(null)}
      />

    </SafeAreaView>
  );
}
