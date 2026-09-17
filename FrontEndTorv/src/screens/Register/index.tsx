import React, { useState } from 'react';
import { View, Text, Alert, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { X, Mars, Venus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { SelectCard } from '../../components/SelectCard';
import api from '../../services/api';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const FITNESS_LEVELS = [
  { value: 'INICIANTE', label: 'Iniciante', color: colors.brand, description: 'Está começando agora ou treina raramente. Vamos construir sua base do zero.' },
  { value: 'INTERMEDIÁRIO', label: 'Intermediário', color: colors.accentIntermediate, description: 'Treina com regularidade. Quer evoluir com mais inteligência e consistência.' },
  { value: 'AVANÇADO', label: 'Avançado', color: colors.accentAdvanced, description: 'Treina pesado há muito tempo. Busca performance máxima e superação.' },
];

export default function Register() {
  const navigation = useNavigation();
  const [step, setStep] = useState(0); // 0 to 5
  const [loading, setLoading] = useState(false);

  // Form Data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState<'Masculino' | 'Feminino' | null>(null);
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [goals, setGoals] = useState<string[]>([]);

  // Errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [nameError, setNameError] = useState('');
  const [registerError, setRegisterError] = useState('');

  const handleDateChange = (text: string) => {
    let clean = text.replace(/\D/g, '');
    if (clean.length > 2) clean = clean.slice(0, 2) + '/' + clean.slice(2);
    if (clean.length > 5) clean = clean.slice(0, 5) + '/' + clean.slice(5, 9);
    setBirthDate(clean);
  };

  const validateStep0 = () => {
    let valid = true;
    setEmailError('');
    setPasswordError('');
    if (!email.trim()) {
      setEmailError('Informe seu e-mail.');
      valid = false;
    }
    if (password.length < 6) {
      setPasswordError('A senha deve ter pelo menos 6 caracteres.');
      valid = false;
    } else if (password !== confirmPassword) {
      setPasswordError('As senhas não conferem.');
      valid = false;
    }
    return valid;
  };

  const validateStep1 = () => {
    let valid = true;
    setNameError('');
    if (!name.trim().includes(' ')) {
      setNameError('Por favor, insira seu nome completo.');
      valid = false;
    }
    if (!username.trim()) valid = false;
    if (!birthDate) valid = false;
    return valid;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && (!weight || !height)) return;
    if (step === 3 && !gender) return;
    if (step === 4 && !fitnessLevel) return;

    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleRegister = async () => {
    if (loading || goals.length === 0) return;

    setLoading(true);
    setRegisterError('');
    try {
      await api.post('/auth/register', {
        email,
        password,
        name,
        username,
        birth_date: birthDate,
        weight: Number(weight),
        height: Number(height),
        gender,
        fitness_level: fitnessLevel,
        goal: goals.join(', '),
      });
      
      navigation.goBack();
    } catch (error) {
      console.log(error);
      setRegisterError('Falha ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {step > 0 ? (
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View key={s} style={[styles.progressSegment, step >= s && styles.progressSegmentActive]} />
          ))}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Fechar cadastro"
        >
          <X color={colors.textSecondary} size={24} />
        </TouchableOpacity>
      )}

      <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
        {step === 0 && (
          <>
            <Text style={styles.title}>Registre-se</Text>
            <View style={{ marginTop: 24 }}>
              <Input label="E-mail" placeholder="Seu e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={emailError} />
              <Input label="Senha" placeholder="Sua senha" value={password} onChangeText={setPassword} secureTextEntry />
              <Input label="Confirme a senha" placeholder="Confirme a senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={passwordError} />
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.title}>Sobre você</Text>
            <Text style={styles.subtitle}>Conte-nos um pouco sobre você.</Text>
            <Input label="Como quer ser chamado?" placeholder="Nome completo" value={name} onChangeText={(text) => { setName(text); setNameError(''); }} error={nameError} />
            <Input label="Nome de usuário" placeholder="ex: seunome123" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Input label="Data de nascimento" placeholder="DD/MM/AAAA" value={birthDate} onChangeText={handleDateChange} keyboardType="numeric" maxLength={10} />
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Seu corpo</Text>
            <Text style={styles.subtitle}>Suas medidas para calcularmos suas métricas.</Text>
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Input label="Peso (kg)" placeholder="Ex: 70" value={weight} onChangeText={setWeight} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Altura (cm)" placeholder="Ex: 175" value={height} onChangeText={setHeight} keyboardType="numeric" />
              </View>
            </View>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.title}>Sexo biológico</Text>
            <Text style={styles.subtitle}>Usamos essa informação para refinar seus cálculos metabólicos.</Text>
            <View style={styles.genderContainer}>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'Masculino' && styles.genderButtonActiveMale]}
                onPress={() => setGender('Masculino')}
                accessibilityRole="button"
                accessibilityLabel="Selecionar sexo biológico masculino"
              >
                <Mars color={colors.accentCarbs} size={64} strokeWidth={1.5} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.genderButton, gender === 'Feminino' && styles.genderButtonActiveFemale]}
                onPress={() => setGender('Feminino')}
                accessibilityRole="button"
                accessibilityLabel="Selecionar sexo biológico feminino"
              >
                <Venus color={colors.accentFat} size={64} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.title}>Nível físico</Text>
            <Text style={styles.subtitle}>Escolha a opção que melhor descreve sua rotina atual.</Text>
            {FITNESS_LEVELS.map((level) => (
              <SelectCard
                key={level.value}
                title={level.label}
                titleColor={level.color}
                description={level.description}
                selected={fitnessLevel === level.value}
                onPress={() => setFitnessLevel(level.value)}
              />
            ))}
          </>
        )}

        {step === 5 && (
          <>
            <Text style={styles.title}>Qual seu objetivo?</Text>
            <Text style={styles.subtitle}>Isso nos ajuda a personalizar seus treinos e metas.</Text>
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
                selected={goals.includes(option)} 
                onPress={() => {
                  if (goals.includes(option)) {
                    setGoals(goals.filter(g => g !== option));
                  } else {
                    setGoals([...goals, option]);
                  }
                }} 
              />
            ))}
          </>
        )}
      </ScrollView>

      {registerError ? (
        <Text style={styles.errorText}>{registerError}</Text>
      ) : null}

      <View style={styles.footer}>
        {step > 0 && <Button title="Voltar" onPress={handleBack} outline style={styles.navButton} />}
        {step < 5 ? (
          <Button title={step === 0 ? "Registre-se" : "Continuar"} onPress={handleNext} style={styles.navButton} />
        ) : (
          <Button title="Continuar" onPress={handleRegister} loading={loading} style={styles.navButton} />
        )}
      </View>
    </SafeAreaView>
  );
}
