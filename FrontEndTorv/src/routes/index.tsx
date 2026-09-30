import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';

import { AuthContext } from '../contexts/AuthContext';
import { PublicRoutes } from './PublicRoutes';
import { PrivateRoutes } from './PrivateRoutes';

export const Routes = () => {
  const { signed, user } = useContext(AuthContext);

  return (
    <NavigationContainer>
      {signed ? <PrivateRoutes user={user} /> : <PublicRoutes />}
    </NavigationContainer>
  );
};
