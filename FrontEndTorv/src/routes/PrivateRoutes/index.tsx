import React from 'react';
import { View, Text, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, ClipboardList, User, Dumbbell } from 'lucide-react-native';

import { colors } from '../../theme/tokens';
import HomeScreen from '../../screens/Home';
import WorkoutsScreen from '../../screens/Workouts';
import MyDietScreen from '../../screens/MyDiet';
import ProfileScreen from '../../screens/Profile';
import RoutineEditorScreen from '../../screens/RoutineEditor';
import WorkoutSessionScreen from '../../screens/WorkoutSession';
import WorkoutSummaryScreen from '../../screens/WorkoutSummary';
import type { AppStackParamList, TabParamList } from '../types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<AppStackParamList>();

const TabIcon = ({ focused, icon: Icon, label, photoUrl }: any) => {
  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: focused ? 'rgba(140, 198, 63, 0.15)' : 'transparent',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      minWidth: 64,
    }}>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: focused ? 2 : 0,
            borderColor: '#8CC63F'
          }}
        />
      ) : (
        <Icon color={focused ? colors.brand : colors.textSecondary} size={24} />
      )}
      <Text style={{
        color: focused ? colors.brand : colors.textSecondary,
        fontSize: 10,
        marginTop: 4,
        fontWeight: focused ? 'bold' : '500'
      }}>
        {label}
      </Text>
    </View>
  );
};

const Tabs = ({ user }: { user: any }) => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarIconStyle: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      },
      tabBarStyle: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        elevation: 0,
        backgroundColor: 'rgba(28, 28, 30, 0.95)',
        borderRadius: 40,
        height: 64,
        borderTopWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        paddingBottom: 0,
        paddingTop: 0,
      },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Home} label="Home" />,
      }}
    />
    <Tab.Screen
      name="Workouts"
      component={WorkoutsScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={Dumbbell} label="Treinos" />,
      }}
    />
    <Tab.Screen
      name="MyDiet"
      component={MyDietScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={ClipboardList} label="My Diet" />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon={User} label="Profile" photoUrl={user?.photo_url} />,
      }}
    />
  </Tab.Navigator>
);

// Telas empilhadas acima das abas cobrem a tab bar.
export const PrivateRoutes = ({ user }: { user: any }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Tabs">{() => <Tabs user={user} />}</Stack.Screen>
    <Stack.Screen name="RoutineEditor" component={RoutineEditorScreen} />
    <Stack.Screen name="WorkoutSession" component={WorkoutSessionScreen} options={{ gestureEnabled: false }} />
    <Stack.Screen name="WorkoutSummary" component={WorkoutSummaryScreen} options={{ gestureEnabled: false }} />
  </Stack.Navigator>
);
