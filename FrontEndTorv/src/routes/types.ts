import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Workouts: undefined;
  MyDiet: undefined;
  Groups: undefined;
  Profile: undefined;
};

// Telas empilhadas sobre as abas (cobrem a tab bar).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  RoutineEditor: { routineId?: string };
  WorkoutSession: { routineId?: string; resume?: boolean };
  WorkoutSummary: { sessionId?: string }; // sem sessionId: treino recém-finalizado (rascunho)
  WorkoutEdit: { sessionId: string };
  GroupDetail: { groupId: string };
  GroupEditor: { groupId?: string }; // sem groupId: criar
  GroupManage: { groupId: string };
  JoinGroup: { token?: string }; // sem token: digitar o código
  GpxImport: { routineId: string }; // importar o .gpx numa rotina de corrida/caminhada
  GpsActivity: { activityId: string }; // resumo de uma atividade de GPS
  MemberProfile: { userId: string }; // perfil de outro membro (ou o próprio): GET /users/:id/profile
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;

// Telas públicas (antes do login).
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: { email: string; cooldownSeconds?: number };
};

export type AuthNavigation = NativeStackNavigationProp<AuthStackParamList>;
