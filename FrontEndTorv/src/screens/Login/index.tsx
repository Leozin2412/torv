import React, { useState, useContext } from 'react';
import { View, Text, Alert, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AuthContext } from '../../contexts/AuthContext';
import api from '../../services/api';
import { styles } from './styles';

type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login } = useContext(AuthContext);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      login(token, user);
    } catch (error) {
      console.log(error);
      Alert.alert('Erro', 'Falha ao realizar login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  if (!showForm) {
    return (
      <View style={styles.landingContainer}>
        <View style={styles.imageWrapper}>
          <Image 
            source={require('../../../assets/FotoTelaLogin.png')} 
            style={styles.landingImage} 
            resizeMode="cover" 
          />
          <LinearGradient
            colors={['transparent', '#121212']}
            style={StyleSheet.absoluteFillObject}
          />
        </View>
        <View style={styles.landingContent}>
          <Text style={styles.landingTitle}>Bem-vindo(a) ao <Text style={styles.landingTitleHighlight}>TORV!</Text></Text>
          <Text style={styles.landingSubtitle}>Comece hoje a construir sua melhor versão.</Text>
          <Button title="Registre-se" onPress={() => navigation.navigate('Register')} style={{ marginBottom: 16 }} />
          <Button title="Login" onPress={() => setShowForm(true)} outline />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => setShowForm(false)} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Bem-vindo ao TORV</Text>
      <Text style={styles.subtitle}>Faça login para continuar</Text>

      <Input
        label="E-mail"
        placeholder="Digite seu e-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Input
        label="Senha"
        placeholder="Digite sua senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button
        title="Entrar"
        onPress={handleLogin}
        loading={loading}
      />

      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>Não possui conta?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.registerLink}>Registre-se</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
