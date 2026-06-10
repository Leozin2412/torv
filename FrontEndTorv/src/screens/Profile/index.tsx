import React, { useContext, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LogOut, Edit2, ChevronRight, User as UserIcon, Plus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SelectCard } from '../../components/SelectCard';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
import { styles } from './styles';

export default function Profile() {
  const { user, logout } = useContext(AuthContext);
  const navigation = useNavigation();

  const [avatarUri, setAvatarUri] = useState<string | null>(user?.photo_url || null);
  const [foodLogs, setFoodLogs] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  // Edit States
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editGoals, setEditGoals] = useState<string[]>([]);

  // Fetch all data every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          // Fetch diet data
          const dietResponse = await api.get('/diet/summary');
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

          // Fetch profile data
          const profileResponse = await api.get('/profile');
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
        uploadAvatar(uri);
      }
    } catch (error) {
      console.log('Image picker error', error);
    }
  };

  const uploadAvatar = async (uri: string) => {
  setLoadingAvatar(true);

  try {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'avatar.jpg';

    formData.append('photo', {
      uri,
      name: filename,
      type: 'image/jpeg',
    } as any);

    const response = await api.post('/profile/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.photo_url) {
      setAvatarUri(response.data.photo_url);
    } else {
      setAvatarUri(uri);
    }

  } catch (error: any) {
    console.log('Avatar upload error', error);

    Alert.alert(
      'Erro',
      'Não foi possível atualizar a foto de perfil.'
    );

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
      await api.put('/profile', { goal: newGoalStr });
      setProfileData((prev: any) => ({ ...prev, goal: newGoalStr }));
      setShowGoalModal(false);
    } catch (error) {
      console.log('Failed to save goals', error);
      Alert.alert('Erro', 'Não foi possível atualizar os objetivos.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
        <TouchableOpacity style={styles.menuButton} onPress={logout}>
          <LogOut color="#FF3B30" size={24} />
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
                <UserIcon color="#8E8E93" size={48} />
              )}
            </View>
            <TouchableOpacity style={styles.editBadge} onPress={handlePickImage} disabled={loadingAvatar}>
              <Edit2 color="#121212" size={16} />
            </TouchableOpacity>
          </View>
          <Text style={styles.name}>{profileData?.name || user?.name || 'Usuário'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text style={[styles.username, { marginTop: 0 }]}>@{profileData?.username || user?.username || 'usuario'}</Text>
            <TouchableOpacity onPress={handleOpenUsernameEdit} style={{ marginLeft: 8 }}>
              <Edit2 color="#8E8E93" size={14} />
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
          <View style={styles.gridCard}>
            <Text style={styles.gridCardTitle}>STREAK🔥</Text>
            <Text style={styles.gridCardValue}>{profileData?.streak || 0}</Text>
            <Text style={styles.gridCardHighlight}>Recorde: {profileData?.longest_streak || 0} dias</Text>
          </View>
          <View style={styles.gridCard}>
            <Text style={styles.gridCardTitle}>ESTE MÊS</Text>
            <Text style={styles.gridCardValue}>{profileData?.workouts_in_month || 0}</Text>
            <Text style={styles.gridCardSubtitle}>Treinos</Text>
            <Text style={styles.gridCardHighlight}>+0 vs mês passado</Text>
          </View>
        </View>

        {/* Objetivo */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Objetivo</Text>
          <TouchableOpacity onPress={handleOpenGoalEdit}>
             <Text style={{ color: '#8CC63F', fontWeight: 'bold' }}>Editar</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.listCard, { marginTop: -8 }]}>
          <View style={styles.listCardIconContainer}>
            <Text style={styles.listCardIconText}>💪</Text>
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>{profileData?.goal || user?.goal || 'Ganhar Massa Muscular'}</Text>
            <Text style={styles.listCardSubtitle}>Definido no cadastro</Text>
          </View>
        </View>

        {/* Relógio conectado */}
        <Text style={styles.sectionTitle}>Relógio conectado</Text>
        <TouchableOpacity style={styles.listCard} activeOpacity={0.8}>
          <View style={styles.listCardIconContainer}>
            <Text style={styles.listCardIconText}>⌚</Text>
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>Apple Watch Series 9</Text>
            <Text style={styles.connectedText}>🟢 Conectado</Text>
          </View>
          <ChevronRight color="#8E8E93" size={20} style={styles.listCardRight} />
        </TouchableOpacity>

        {/* Histórico de hoje */}
        <Text style={styles.sectionTitle}>Atividade Física</Text>
        
        {/* Mocked Activity */}
        <View style={styles.listCard}>
          <View style={styles.listCardIconContainer}>
            <Text style={styles.listCardIconText}>🚶‍♂️</Text>
          </View>
          <View style={styles.listCardContent}>
            <Text style={styles.listCardTitle}>Caminhada</Text>
            <Text style={styles.listCardSubtitle}>07:15 · 32 min · 180kcal · ⌚ via relógio</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Alimentação</Text>
        
        {/* Real Food Logs (Mapped) */}
        {foodLogs.length > 0 ? (
          foodLogs.map((log: any, index: number) => (
            <View key={index} style={styles.listCard}>
              <View style={styles.listCardIconContainer}>
                <Text style={styles.listCardIconText}>🍽️</Text>
              </View>
              <View style={styles.listCardContent}>
                <Text style={styles.listCardTitle}>{log.name || 'Refeição'}</Text>
                <Text style={styles.listCardSubtitle}>{log.calories || 0} kcal</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.listCard}>
            <View style={styles.listCardIconContainer}>
              <Text style={styles.listCardIconText}>🍽️</Text>
            </View>
            <View style={styles.listCardContent}>
              <Text style={styles.listCardTitle}>Nenhuma refeição ainda</Text>
              <Text style={styles.listCardSubtitle}>Você ainda não registrou nada hoje.</Text>
            </View>
          </View>
        )}

        <TouchableOpacity 
          style={[styles.listCard, { justifyContent: 'center', backgroundColor: '#1C1C1E', borderColor: '#8CC63F', borderWidth: 1 }]} 
          onPress={() => navigation.navigate('MyDiet' as never)}
        >
          <Plus color="#8CC63F" size={24} style={{ marginRight: 8 }} />
          <Text style={{ color: '#8CC63F', fontWeight: 'bold', fontSize: 16 }}>Adicionar Refeição</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Username Edit Modal */}
      <Modal visible={showUsernameModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1F2916', '#121212']}
            style={styles.modalContent}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meu Username</Text>
              <TouchableOpacity onPress={() => setShowUsernameModal(false)}>
                <X color="#8E8E93" size={24} />
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
                colors={['#8CC63F', '#5A9E1C']}
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
            colors={['#1F2916', '#121212']}
            style={[styles.modalContent, { paddingHorizontal: 0, paddingBottom: 0 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          >
            <View style={[styles.modalHeader, { paddingHorizontal: 24 }]}>
              <Text style={styles.modalTitle}>Meus Objetivos</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                <X color="#8E8E93" size={24} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.modalSubtitle, { paddingHorizontal: 24 }]}>
              Selecione o que você quer alcançar para ajustarmos seu plano.
            </Text>

            <ScrollView style={{ maxHeight: 450, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
              {[
                'Perder Peso',
                'Ganhar Massa Muscular',
                'Melhorar Condicionamento',
                'Aumentar Resistência',
                'Criar uma Rotina',
                'Saúde & Bem-estar'
              ].map((option) => (
                <SelectCard 
                  key={option}
                  title={option} 
                  selected={editGoals.includes(option)} 
                  onPress={() => handleToggleGoal(option)}
                  style={{ marginBottom: 12 }}
                />
              ))}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.futuristicButton} onPress={handleSaveGoals}>
                <LinearGradient
                  colors={['#8CC63F', '#5A9E1C']}
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

    </SafeAreaView>
  );
}
