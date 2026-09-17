import React, { useContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Sora_400Regular, Sora_600SemiBold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import { Routes } from './src/routes';
import { colors } from './src/theme/tokens';

const LoadingScreen = () => (
  <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator color={colors.brand} />
  </View>
);

function AppContent() {
  const { loading } = useContext(AuthContext);
  if (loading) return <LoadingScreen />;
  return <Routes />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_600SemiBold,
    Sora_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
