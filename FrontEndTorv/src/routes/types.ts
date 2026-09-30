import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type TabParamList = {
  Home: undefined;
  Workouts: undefined;
  MyDiet: undefined;
  Profile: undefined;
};

// Telas empilhadas sobre as abas (cobrem a tab bar).
export type AppStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  RoutineEditor: { routineId?: string };
};

export type AppNavigation = NativeStackNavigationProp<AppStackParamList>;
