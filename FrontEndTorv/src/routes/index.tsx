import React, { useContext, useEffect } from 'react';
import * as Linking from 'expo-linking';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';

import { AuthContext } from '../contexts/AuthContext';
import { PublicRoutes } from './PublicRoutes';
import { PrivateRoutes } from './PrivateRoutes';
import { joinTokenFromUrl } from '../utils/groupLink';
import { setPendingJoin } from '../utils/pendingJoin';
import type { AppStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<AppStackParamList>();

export const Routes = () => {
  const { signed, user } = useContext(AuthContext);

  // Convite por link (torv://join/CODIGO). Logado e com a navegação pronta → abre JoinGroup; senão guarda,
  // e o componente Tabs abre quando montar (depois do login, ou na partida a frio).
  const handleUrl = (url: string | null) => {
    const code = joinTokenFromUrl(url);
    if (!code) return;
    if (signed && navigationRef.isReady()) navigationRef.navigate('JoinGroup', { token: code });
    else setPendingJoin(code);
  };

  useEffect(() => {
    Linking.getInitialURL().then(handleUrl).catch(() => {});
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => subscription.remove();
  }, [signed]);

  return (
    <NavigationContainer ref={navigationRef}>
      {signed ? <PrivateRoutes user={user} /> : <PublicRoutes />}
    </NavigationContainer>
  );
};
