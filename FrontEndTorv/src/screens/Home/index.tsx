import React, { useState, useEffect, useContext, useCallback } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play, Activity, Clock, ChevronRight, MoreHorizontal, Heart, MessageCircle, MapPin, User } from 'lucide-react-native';

import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { ProgressBar } from '../../components/ProgressBar';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
import { styles } from './styles';

export default function Home() {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [consumed, setConsumed] = useState(0);
  const [goal, setGoal] = useState(user?.goalCalories || 2400);
  const [remaining, setRemaining] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadDietSummary();
    }, [])
  );

  const loadDietSummary = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
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
      setConsumed(1840); 
      setGoal(2400);
      setRemaining(560);
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
            <Text style={styles.nameText}>{user?.name?.split(' ')[0] || 'Atleta'}👋</Text>
          </View>
          {user?.photo_url ? (
            <Image source={{ uri: user.photo_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <User color="#8CC63F" size={24} style={{ position: 'absolute', top: 12, left: 12 }} />
            </View>
          )}
        </View>

        {/* Top Grid Mocks */}
        <View style={styles.gridRow}>
          <View style={styles.streakCard}>
            <Text style={styles.streakTitle}>STREAK🔥</Text>
            <Text style={styles.streakValue}>12</Text>
            <Text style={styles.streakSub}>dias seguidos</Text>
          </View>

          <View style={styles.workoutCard}>
            <Text style={styles.workoutTitle}>TREINO DE HOJE</Text>
            <Text style={styles.workoutValue}>Peito & Tríceps</Text>
            <TouchableOpacity style={styles.workoutAction}>
              <Play color="#8CC63F" size={14} fill="#8CC63F" />
              <Text style={styles.workoutActionText}>Iniciar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Morning Walk Mock */}
        <View style={styles.walkCard}>
          <View style={styles.walkIconBlock}>
            <Activity color="#8CC63F" size={32} />
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
            <Clock color="#8E8E93" size={14} />
            <Text style={styles.watchText}>Relógio</Text>
          </TouchableOpacity>
        </View>

        {/* Main Nutrition Integration */}
        {loading ? (
          <ActivityIndicator color="#8CC63F" style={{ marginBottom: 24 }} />
        ) : (
          <View style={styles.caloriesSection}>
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
                <Text style={styles.calorieBoxValueGreen}>180</Text>
                <Text style={styles.calorieBoxSub}>kcal = caminhada</Text>
              </View>
            </View>

            <ProgressBar progress={progress} color="#8CC63F" height={6} />
            <Text style={styles.remainingText}>
              {remaining > 0 ? `${remaining.toLocaleString('pt-BR')} kcal restantes para sua meta` : 'Meta atingida!'}
            </Text>
          </View>
        )}

        {/* Feed Mock */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Feed</Text>
          <Text style={styles.sectionLink}>Ver tudo</Text>
        </View>
        <View style={styles.feedCard}>
          <View style={styles.feedHeader}>
            <View style={styles.feedUser}>
              <View style={styles.feedAvatar}>
                <User color="#8CC63F" size={20} />
              </View>
              <View>
                <Text style={styles.feedName}>Marina Alves</Text>
                <Text style={styles.feedTime}>há 23 min · Corrida🏃‍♂️</Text>
              </View>
            </View>
            <MoreHorizontal color="#8E8E93" size={20} />
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

          <Text style={styles.feedContent}>
            Corrida matinal feita! 💪 Cada km conta.
          </Text>

          <View style={styles.feedFooter}>
            <View style={styles.feedAction}>
              <Heart color="#8E8E93" size={16} />
              <Text style={styles.feedActionText}>47</Text>
            </View>
            <View style={styles.feedAction}>
              <MessageCircle color="#8E8E93" size={16} />
              <Text style={styles.feedActionText}>12</Text>
            </View>
          </View>
        </View>

        {/* Explorar Mock */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explorar</Text>
          <Text style={styles.sectionLink}>Ver mapa</Text>
        </View>
        <View style={styles.exploreCard}>
          <View style={styles.exploreFilters}>
            <View style={styles.filterPill}>
              <Activity color="#121212" size={14} />
              <Text style={styles.filterText}>Academias</Text>
            </View>
            <View style={styles.filterPillDark}>
              <MapPin color="#FFF" size={14} />
              <Text style={styles.filterTextDark}>Trajetos</Text>
            </View>
            <View style={styles.filterPillDark}>
              <MapPin color="#FFF" size={14} />
              <Text style={styles.filterTextDark}>Parques</Text>
            </View>
          </View>

          <View style={styles.placeCard}>
            <View>
              <Text style={styles.placeTitle}>SmartFit Centro</Text>
              <Text style={styles.placeSub}>📍 320m de distância · Aberto 24h</Text>
            </View>
            <TouchableOpacity style={styles.placeButton}>
              <Text style={styles.placeButtonText}>Abrir</Text>
              <ChevronRight color="#8CC63F" size={14} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
