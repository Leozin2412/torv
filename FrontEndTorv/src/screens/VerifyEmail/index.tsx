import React, { useContext, useEffect, useState } from 'react';
import { Text, TouchableOpacity, KeyboardAvoidingView, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { AuthContext } from '../../contexts/AuthContext';
import { isCodeComplete, sanitizeCode, CODE_LENGTH } from '../../utils/emailCode';
import type { AuthNavigation, AuthStackParamList } from '../../routes/types';
import { styles } from './styles';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const navigation = useNavigation<AuthNavigation>();
  const { params } = useRoute<RouteProp<AuthStackParamList, 'VerifyEmail'>>();
  const { email, cooldownSeconds = 0 } = params;
  const { verifyEmail, resendCode } = useContext(AuthContext);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(cooldownSeconds);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleConfirm = async () => {
    if (loading || !isCodeComplete(code)) return;
    setLoading(true);
    setError('');
    setInfo('');
    try {
      // Sucesso: a sessão começa e o app troca sozinho para as rotas privadas.
      await verifyEmail(email, code);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400 && e.response.data?.code === 'INVALID_CODE') {
        setError('Código inválido ou expirado.');
      } else if (status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos e tente de novo.');
      } else {
        setError('Não foi possível confirmar. Tente novamente.');
      }
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || cooldown > 0) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      await resendCode(email);
      setInfo('Código reenviado. Confira seu e-mail.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e: any) {
      if (e?.response?.status === 429) {
        setError('Aguarde um pouco para pedir outro código.');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setError('Não foi possível reenviar agora.');
      }
    } finally {
      setResending(false);
    }
  };

  const resendBlocked = cooldown > 0 || resending;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Confirme seu e-mail</Text>
          <Text style={styles.subtitle}>Enviamos um código de 6 dígitos para {email}</Text>

          <Input
            label="Código"
            placeholder="000000"
            value={code}
            onChangeText={(text) => setCode(sanitizeCode(text))}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
            maxLength={CODE_LENGTH}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            style={styles.codeInput}
            accessibilityLabel="Código de confirmação de 6 dígitos"
          />

          {error ? <Text style={styles.errorText} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
          {info ? <Text style={styles.infoText} accessibilityRole="alert" accessibilityLiveRegion="polite">{info}</Text> : null}

          <Button
            title="Confirmar"
            onPress={handleConfirm}
            loading={loading}
            disabled={loading || !isCodeComplete(code)}
            style={!isCodeComplete(code) ? { opacity: 0.5 } : undefined}
            accessibilityLabel="Confirmar código"
          />

          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resendBlocked}
            accessibilityRole="button"
            accessibilityLabel={cooldown > 0 ? `Reenviar código em ${cooldown} segundos` : 'Reenviar código'}
            accessibilityState={{ disabled: resendBlocked }}
          >
            <Text style={[styles.resendText, resendBlocked && styles.resendTextDisabled]}>
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : 'Reenviar código'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>Não chegou? Veja a caixa de spam.</Text>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.popTo('Login')}
            accessibilityRole="button"
            accessibilityLabel="Voltar ao login"
          >
            <Text style={styles.backButtonText}>← Voltar ao login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
