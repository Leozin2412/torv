import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { GroupCover } from '../../components/GroupCover';
import { groupsApi, type JoinPreview } from '../../services/groups';
import { normalizeCode, isValidCode, TOKEN_LENGTH } from '../../utils/groupLink';
import { describeError } from '../../utils/groupErrors';
import { periodLabel } from '../../utils/groupPeriod';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const NOT_FOUND = 'Código inválido ou link desativado.';

export default function JoinGroup() {
  const navigation = useNavigation<AppNavigation>();
  const initial = useRoute<RouteProp<AppStackParamList, 'JoinGroup'>>().params?.token ?? '';
  const [code, setCode] = useState(initial);
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [looking, setLooking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = async (raw: string) => {
    const normalized = normalizeCode(raw);
    setPreview(null);
    if (!isValidCode(normalized)) return setError(`Código inválido. São ${TOKEN_LENGTH} caracteres, sem 0, O, 1, I e L.`);
    setLooking(true);
    setError(null);
    try {
      setPreview(await groupsApi.joinPreview(normalized));
    } catch (err) {
      setError(describeError(err, NOT_FOUND));
    } finally {
      setLooking(false);
    }
  };

  // Veio por link (torv://join/CODIGO): já mostra a prévia.
  useEffect(() => { if (initial) lookup(initial); }, [initial]);

  const join = async () => {
    if (!preview) return;
    if (preview.is_member) return navigation.replace('GroupDetail', { groupId: preview.group.id });
    setJoining(true);
    setError(null);
    try {
      const groupId = await groupsApi.join(normalizeCode(code));
      navigation.replace('GroupDetail', { groupId });
    } catch (err) {
      setError(describeError(err, NOT_FOUND));
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft color={colors.text} size={26} />
        </TouchableOpacity>
        <Text style={styles.title}>Entrar com código</Text>
      </View>

      <View style={styles.body}>
        <Input
          label="Código do convite"
          value={code}
          onChangeText={(t) => { setCode(t); setPreview(null); setError(null); }}
          onSubmitEditing={() => lookup(code)}
          placeholder="Ex.: AB3DK7MN"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          returnKeyType="search"
        />
        <Button title="Buscar grupo" outline loading={looking} disabled={!code.trim()} onPress={() => lookup(code)} />

        {looking && <ActivityIndicator color={colors.brand} style={styles.loading} />}
        {error && <Text style={styles.error}>{error}</Text>}

        {preview && (
          <View style={styles.preview}>
            <GroupCover uri={preview.group.cover_url} name={preview.group.name} height={140} />
            <Text style={styles.name}>{preview.group.name}</Text>
            <Text style={styles.meta}>
              {preview.group.member_count} {preview.group.member_count === 1 ? 'membro' : 'membros'} · {periodLabel(preview.group)}
            </Text>
            {preview.ended ? (
              <Text style={styles.error}>Este grupo já foi encerrado e não aceita novos membros.</Text>
            ) : (
              <Button title={preview.is_member ? 'Abrir grupo' : 'Entrar no grupo'} loading={joining} onPress={join} />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
