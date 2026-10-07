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
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;
