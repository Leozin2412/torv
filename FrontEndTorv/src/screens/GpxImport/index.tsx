import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { ArrowLeft, FileUp } from 'lucide-react-native';

import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { GpsMetricsView } from '../../components/GpsMetricsView';
import { workoutsApi, type RoutineDetail } from '../../services/workouts';
import { gpsApi, type GpsMetrics, type GpsType } from '../../services/gps';
import { parseGpx, GpxError, type ParsedGpx } from '../../utils/gpx';
import { readPickedFile } from '../../utils/readPickedFile';
import { gpsErrorText } from '../../utils/gpsErrors';
import { activityLabel } from '../../utils/activities';
import { bumpSessionsVersion } from '../../utils/sessionsVersion';
import type { AppNavigation, AppStackParamList } from '../../routes/types';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const GPS_TYPES: GpsType[] = ['RUN', 'WALK'];
const errorText = (err: unknown) =>
  axios.isAxiosError(err) ? gpsErrorText(err.response?.status, err.response?.data?.error) : gpsErrorText(500);

export default function GpxImport() {
  const navigation = useNavigation<AppNavigation>();
  const { routineId } = useRoute<RouteProp<AppStackParamList, 'GpxImport'>>().params;
  const [routine, setRoutine] = useState<RoutineDetail | null>(null);
  const [parsed, setParsed] = useState<ParsedGpx | null>(null);
  const [metrics, setMetrics] = useState<GpsMetrics | null>(null);
  const [type, setType] = useState<GpsType>('RUN');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<'' | 'reading' | 'saving'>('');
  const [error, setError] = useState(''); // leitura e prévia: no topo
  const [saveError, setSaveError] = useState(''); // salvar: junto do botão, que fica no fim da tela
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    workoutsApi.getRoutine(routineId)
      .then((r) => { setRoutine(r); setType(r.activity_type === 'WALK' ? 'WALK' : 'RUN'); })
      .catch(() => setError('Não foi possível carregar a rotina.'));
  }, [routineId]);

  const routineType: GpsType = routine?.activity_type === 'WALK' ? 'WALK' : 'RUN';

  const reset = () => { setParsed(null); setMetrics(null); setDuplicateId(null); setSaveError(''); };

  // Prévia calculada no servidor (mesma conta que vai ser gravada). Mudar o tipo recalcula (calorias mudam).
  const preview = async (gpx: ParsedGpx, t: GpsType) => {
    setBusy('reading');
    setError('');
    try {
      setMetrics(await gpsApi.preview({ activity_type: t, start_time: gpx.startTime, points: gpx.points }));
    } catch (err) {
      reset();
      setError(errorText(err));
    } finally {
      setBusy('');
    }
  };

  // O seletor só abre por toque: o navegador exige gesto do usuário (Review Focus 3 cobre os erros).
  const pick = async () => {
    setError('');
    setSaveError('');
    setDuplicateId(null);
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false, base64: false });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!/\.gpx$/i.test(asset.name)) return setError('Escolha um arquivo .gpx.');
    if ((asset.size ?? 0) > MAX_FILE_BYTES) return setError('Arquivo grande demais (máx. 25 MB).');
    reset();
    setBusy('reading');
    let gpx: ParsedGpx;
    try {
      gpx = parseGpx(await readPickedFile(asset));
    } catch (err) {
      setBusy('');
      return setError(err instanceof GpxError ? err.message : 'Não foi possível ler o arquivo.');
    }
    setParsed(gpx);
    setTitle(gpx.name ?? routine?.name ?? '');
    setType(routineType);
    await preview(gpx, routineType);
  };

  const changeType = (t: GpsType) => {
    if (!parsed || t === type || busy) return;
    setType(t);
    preview(parsed, t);
  };

  const save = async () => {
    if (!parsed) return;
    setBusy('saving');
    setSaveError('');
    try {
      const created = await gpsApi.create({
        routine_id: routineId, activity_type: type, title: title.trim(), start_time: parsed.startTime, points: parsed.points,
      });
      bumpSessionsVersion(); // Histórico e Perfil recarregam ao voltar
      navigation.replace('GpsActivity', { activityId: created.id });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) setDuplicateId(err.response.data?.activity_id ?? null);
      setSaveError(errorText(err));
      setBusy('');
    }
  };

  const mismatch = parsed?.type === 'RUN' || parsed?.type === 'WALK' ? parsed.type !== routineType : false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Importar GPX</Text>
          {routine && <Text style={styles.headerSub} numberOfLines={1}>{routine.name} · {activityLabel(routine.activity_type)}</Text>}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!metrics && (
          <Card style={styles.pickCard}>
            <FileUp color={colors.brand} size={32} />
            <Text style={styles.pickTitle}>Escolha o .gpx do seu treino</Text>
            <Text style={styles.pickHint}>Exporte o .gpx no Strava, no Garmin Connect ou no app do seu relógio.</Text>
            <Button title={parsed ? 'Escolher outro arquivo' : 'Escolher arquivo .gpx'} loading={busy === 'reading'} disabled={!routine} onPress={pick} />
          </Card>
        )}

        {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        {parsed && metrics && (
          <>
            {mismatch && (
              <Card style={styles.warning}>
                <Text style={styles.warningText}>
                  O arquivo indica {activityLabel(parsed.type ?? routineType)}, mas a rotina é de {activityLabel(routineType)}. Salvar como:
                </Text>
                <View style={styles.segmented} accessibilityRole="tablist">
                  {GPS_TYPES.map((t) => (
                    <TouchableOpacity key={t} style={[styles.segment, type === t && styles.segmentActive]} onPress={() => changeType(t)} accessibilityRole="tab" accessibilityState={{ selected: type === t }} aria-selected={type === t}>
                      <Text style={[styles.segmentText, type === t && styles.segmentTextActive]}>{activityLabel(t)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            )}

            <Input label="Título" value={title} maxLength={100} onChangeText={setTitle} placeholder={routine?.name} />

            <GpsMetricsView metrics={metrics} />

            {!!saveError && <Text style={styles.error} accessibilityRole="alert">{saveError}</Text>}
            {duplicateId && <Button title="Ver atividade" outline onPress={() => navigation.replace('GpsActivity', { activityId: duplicateId })} />}
            <Button title="Salvar atividade" loading={busy === 'saving'} disabled={busy === 'reading'} onPress={save} />
            <Button title="Escolher outro arquivo" outline disabled={busy !== ''} onPress={pick} />
          </>
        )}
        {busy === 'reading' && metrics === null && parsed !== null && <ActivityIndicator color={colors.brand} />}
      </ScrollView>
    </SafeAreaView>
  );
}
