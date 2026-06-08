import React, { useContext } from 'react';
import { View, Text, Image } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ClipboardList, User } from 'lucide-react-native';

import { AuthContext } from '../contexts/AuthContext';

// Screens
import LoginScreen from '../screens/Login';
import RegisterScreen from '../screens/Register';
import HomeScreen from '../screens/Home';
import MyDietScreen from '../screens/MyDiet';
import ProfileScreen from '../screens/Profile';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ focused, icon: Icon, label, photoUrl }: any) => {
  return (
    <View style={{
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: focused ? 'rgba(140, 198, 63, 0.15)' : 'transparent',
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 20,
      minWidth: 80,
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
        <Icon color={focused ? '#8CC63F' : '#8E8E93'} size={24} />
      )}
      <Text style={{
        color: focused ? '#8CC63F' : '#8E8E93',
        fontSize: 10,
        marginTop: 4,
        fontWeight: focused ? 'bold' : '500'
      }}>
        {label}
      </Text>
    </View>
  );
};

const AuthRoutes = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const AppRoutes = ({ user }: { user: any }) => (
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

export const Routes = () => {
  const { signed, user } = useContext(AuthContext);

  return (
    <NavigationContainer>
      {signed ? <AppRoutes user={user} /> : <AuthRoutes />}
    </NavigationContainer>
  );
};
