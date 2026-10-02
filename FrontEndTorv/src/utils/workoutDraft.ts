import AsyncStorage from '@react-native-async-storage/async-storage';
import { upgradeState, type SessionState } from './workoutSession';

// Treino em andamento salvo no aparelho, por usuário. Sai após o servidor confirmar o
// POST /workouts/sessions, ao descartar e no logout (AuthContext).
const key = (userId: string) => `torv.workoutDraft.${userId}`;

export async function loadDraft(userId: string): Promise<SessionState | null> {
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  try {
    return upgradeState(JSON.parse(raw) as SessionState);
  } catch {
    await AsyncStorage.removeItem(key(userId));
    return null;
  }
}

export const saveDraft = (userId: string, state: SessionState) => AsyncStorage.setItem(key(userId), JSON.stringify(state));

export const clearDraft = (userId: string) => AsyncStorage.removeItem(key(userId));
