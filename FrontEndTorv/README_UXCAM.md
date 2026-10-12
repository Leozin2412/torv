# Integração UXCam — Torv

O código foi preparado para iniciar o UXCam **somente no aplicativo móvel**, desde que `EXPO_PUBLIC_UXCAM_KEY` esteja definida. O aplicativo Web usa `App.web.tsx` e não foi modificado.

## Passos para concluir no seu computador

1. Abra o terminal na pasta `FrontEndTorv`.
2. Instale as dependências do projeto e depois o SDK do UXCam (este ZIP **não** contém `node_modules` nem o SDK):

   ```sh
   npm install
   npx expo install react-native-ux-cam
   ```

   O comando de instalação atualizará `package.json` e `package-lock.json` corretamente.

3. Configure a chave para o build na conta Expo do projeto:

   ```sh
   npx eas-cli login
   npx eas-cli build:configure
   npx eas-cli env:set --name EXPO_PUBLIC_UXCAM_KEY --value SUA_APP_KEY --environment preview --visibility plaintext
   ```

   O arquivo `eas.json` deste ZIP já contém o perfil `preview` para APK. Preserve o perfil ao passar por `build:configure`.
   Consulte o colega que mantém o projeto para acessar a organização/projeto EAS original, as credenciais de assinatura Android e variáveis já usadas pela API. O ZIP original **não incluía** `eas.json` nem um `extra.eas.projectId` no `app.json`. Não associe a outro projeto sem combinar com o grupo.

4. Gere e instale o APK:

   ```sh
   npx eas-cli build --platform android --profile preview
   ```

   Depois de instalar, abra o aplicativo em um dispositivo, navegue e coloque o app em segundo plano. Confirme a sessão no painel UXCam.

## Cuidados importantes

- **Antes de testar com usuários reais**, informe-os e configure consentimento e retenção conforme a finalidade e LGPD.
- **Configure em UXCam > Settings > Video Recording Privacy** o mascaramento/ocultação das telas `Login`, `Register`, `VerifyEmail`, `Profile`, `MyDiet` e outras que mostrem dados pessoais ou de saúde. O código oculta campos de texto, mas isso **não protege valores já exibidos em outras partes da tela**.
- Não registre senhas, tokens, nome, e-mail, informações de saúde ou identificadores de usuário em eventos personalizados.
- A App Key é uma chave de identificação pública no binário, não uma senha privada; ainda assim mantenha arquivos `.env.local` fora do Git.
- Se a variável não for definida, o SDK não inicia; isso é intencional para evitar gravação acidental.
- A instalação/compilação não pôde ser concluída nesta preparação offline. O pacote `react-native-ux-cam` ainda precisa ser instalado e o APK precisa ser compilado/testado no ambiente EAS.

Referências: https://developer.uxcam.com/docs/react-native ; https://developer.uxcam.com/docs/expo-installation-react-native ; https://docs.expo.dev/build/eas-json/.
