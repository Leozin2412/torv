import React, { useEffect, useRef } from 'react';
import RNUxcam from 'react-native-ux-cam';
import AppRoot from './src/AppRoot';
import { navigationRef } from './src/routes';

// Coloque a App Key no ambiente do EAS (preview) ou em .env.local.
// Sem chave, o SDK não inicia e nenhuma sessão é gravada.
const uxcamAppKey = process.env.EXPO_PUBLIC_UXCAM_KEY;

export default function App() {
  const lastScreenName = useRef<string | null>(null);

  useEffect(() => {
    if (!uxcamAppKey) return;

    // Proteção básica dos campos digitados. Ainda é preciso mascarar
    // os dados pessoais/de saúde exibidos nas demais telas no UXCam.
    RNUxcam.occludeAllTextFields(true);
    RNUxcam.optIntoVideoRecording();
    RNUxcam.startWithConfiguration({
      userAppKey: uxcamAppKey,
      enableAutomaticScreenNameTagging: false,
    });

    // O Torv usa React Navigation (não usa Expo Router).
    // Nomeia a tela ativa para facilitar a configuração de privacidade
    // e a identificação da navegação no painel do UXCam.
    const tagCurrentScreen = () => {
      if (!navigationRef.isReady()) return;
      const screenName = navigationRef.getCurrentRoute()?.name;
      if (!screenName || screenName === lastScreenName.current) return;
      lastScreenName.current = screenName;
      RNUxcam.tagScreenName(screenName);
    };

    const unsubscribeReady = navigationRef.addListener('ready', tagCurrentScreen);
    const unsubscribeState = navigationRef.addListener('state', tagCurrentScreen);
    tagCurrentScreen();

    return () => {
      unsubscribeReady();
      unsubscribeState();
    };
  }, []);

  return <AppRoot />;
}
