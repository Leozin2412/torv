# Manual — do TORV local ao APK dos testes

Escrito em 2026-10-08. Cobre, nesta ordem: **(1) e-mail de confirmação**, **(2) Storage das fotos**, **(3) backend na Vercel** e **(4) APK com o EAS**.

**Como ler:**
- 🧑 **Você** = passos em painéis, contas e terminal que só você faz.
- ⚙️ **Claude (código)** = mudanças no repositório que eu faço depois que você me avisar. Cada seção diz quando.
- ⚠️ = armadilha. 🔍 = não consegui confirmar na documentação; confira na hora.

> **Regra de ouro:** chave secreta, senha de banco e senha de app **nunca** vão para o chat, para o Git ou para o app. Elas ficam só no `.env` do backend e nas variáveis de ambiente da Vercel. Tudo que começa com `EXPO_PUBLIC_` vai **dentro do APK** e qualquer um pode ler.

---

## 0. Antes de começar

### Contas
- [ ] Supabase (já tem).
- [ ] Vercel (já tem).
- [ ] **Expo**: crie em https://expo.dev/signup (grátis). Guarde o usuário e a senha.
- [ ] Uma caixa de e-mail para enviar os códigos (ver 1.2).

### Valores que você precisa decidir (anote aqui)

| Item | Sugestão | Seu valor |
|---|---|---|
| `android.package` (ID único do app) | `com.<seunome>.torv`, só minúsculas, números e `_`, partes separadas por ponto. **Não precisa de domínio.** Escolha uma vez: se mudar, o Android trata como outro app | |
| Nome do app no celular | `TORV` | |
| Nome do bucket das fotos | `torv-images` | |
| URL do backend (Vercel) | `https://<projeto>.vercel.app` | |

### Antes de colocar o backend na Vercel
- [ ] ⚠️ **Troque a senha do usuário `torv_api` do banco.** Um recruit imprimiu a `DATABASE_URL` no terminal dele por engano (relatório do Security round 2). Troque a senha, atualize a `DATABASE_URL` e a `DIRECT_URL` no `.env`, e só depois coloque as variáveis na Vercel.

### O que eu (Claude) vou ajustar no código
Nada abaixo está pronto ainda. Cada item tem a sua seção.

| Item | Esforço aproximado |
|---|---|
| Enquadramento da capa do grupo e loader de "puxar para recarregar" (já pedidos, **feitos antes** de você começar este manual) | ~0,5 a 1 dia |
| Verificação de e-mail (backend + tela de código) | ~2 a 3 dias |
| Storage das fotos | ~1 a 1,5 dia |
| Ajustes para a Vercel | ~0,5 a 1 dia |
| `app.json`, `eas.json`, ícone | ~0,5 a 1 dia |

---

## 1. E-mail de confirmação (código de 6 dígitos)

### 1.1 Como vai funcionar
1. A pessoa se cadastra no app.
2. O Supabase manda um e-mail com um **código de 6 dígitos**.
3. A pessoa digita o código numa tela do app e entra.
4. Sem confirmar, o login responde "confirme seu e-mail", com botão de reenviar.

Escolhi **código em vez de link** porque o link de confirmação abre o navegador e precisa voltar para o app (deep link ou página hospedada). O código não precisa de nada disso.

### 1.2 Escolha o remetente do e-mail

⚠️ Sem SMTP próprio o Supabase **só entrega para e-mails da equipe do projeto** (os outros recebem "Email address not authorized"), com limite baixo e sem garantia. A doc diz que esse servidor "não é para produção". Por isso precisa de um SMTP.

**Opção A — Gmail (sem domínio, só para os 3 testadores)**
1. Na conta Google: ative a **verificação em duas etapas**.
2. Abra https://myaccount.google.com/apppasswords e crie uma **senha de app** (16 caracteres). Guarde.
3. Valores para o Supabase:
   - Host: `smtp.gmail.com`
   - Porta: `465` (ou `587`)
   - Usuário: seu e-mail completo
   - Senha: a senha de app
   - Remetente: o mesmo e-mail
- 🔍 A doc do Supabase não cita o Gmail. Deve funcionar, mas teste (ver 1.5). Os e-mails podem cair no **spam**, e o Gmail limita o volume diário (da ordem de centenas por dia).
- Não é para produção.

**Opção B — provedor de e-mail com domínio (o caminho certo para produção)**
- O Supabase cita: Resend, AWS SES, Postmark, SendGrid, ZeptoMail e Brevo.
- Precisa de um **domínio seu**. O provedor pede para você adicionar registros DNS (SPF e DKIM) e espera a verificação, o que leva de minutos a horas.
- 🔍 Host, porta, usuário e senha SMTP ficam no painel do provedor. No Resend, por exemplo, o host é `smtp.resend.com`, o usuário é `resend` e a senha é a chave de API. Confirme no painel dele.
- Remetente: algo como `no-reply@seudominio.com`.

Para testar com seu irmão e seu primo, a **Opção A basta**.

### 1.3 Configurar o SMTP no Supabase 🧑
1. Abra https://supabase.com/dashboard/project/_/auth/smtp (troque `_` pelo código do seu projeto).
2. Ative **Enable custom SMTP**.
3. Preencha **Host, Port, User, Password, Sender** (e o nome do remetente, por exemplo "TORV").
4. **Save**.
5. O Supabase passa a limitar a **30 e-mails por hora**. Ajuste em https://supabase.com/dashboard/project/_/auth/rate-limits se precisar.

### 1.4 Trocar o e-mail "Confirm signup" para mostrar o código 🧑
1. Abra https://supabase.com/dashboard/project/_/auth/templates.
2. Escolha **Confirm signup**.
3. Assunto: `Seu código do TORV`.
4. Corpo (a variável `{{ .Token }}` é o código de 6 dígitos):

```html
<h2>Confirme seu e-mail</h2>
<p>Seu código do TORV:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Digite esse código no app. Ele vale por tempo limitado. Se não foi você, ignore este e-mail.</p>
```

5. Salve.
- 🔍 O tempo de validade do código fica nas configurações de e-mail do Auth (padrão da ordem de 1 hora). O nome exato do campo no painel pode variar.

### 1.5 Testar o SMTP sem o app 🧑
Com o toggle "Confirm email" **ainda desligado**, teste o envio:
1. No painel, **Authentication → Users**.
2. Na linha de um usuário de teste cujo e-mail seja **seu**, use a ação **Send password recovery** (🔍 o nome pode variar). Ela passa pelo SMTP configurado.
3. Chegou? Confira também a pasta de **spam**.
4. Não chegou: veja **Logs → Auth** no painel e refaça os valores do SMTP (porta, senha de app, remetente).

### 1.6 Contas que já existem
Contas criadas com a confirmação desligada ficam confirmadas, mas confira antes de ligar. No **SQL Editor** do painel (só leitura):

```sql
select count(*) as total,
       count(*) filter (where email_confirmed_at is null) as nao_confirmados
from auth.users;
```

Se `nao_confirmados` for maior que zero, me avise e decidimos o que fazer com essas contas.

### 1.7 Código ⚙️ (me avise quando 1.3 e 1.4 estiverem prontos)
Eu faço:
- **Backend:**
  - login que distingue "e-mail não confirmado" de "senha errada";
  - rota para verificar o código e outra para reenviar, com rate limit;
  - cadastro que sempre responde igual para e-mail já usado (hoje responde 409);
  - testes.
- **Frontend:** tela "Digite o código" (com reenvio e tempo de espera) e a mensagem certa no login.
- Possível limpeza periódica de contas nunca confirmadas, que ocupam username.

### 1.8 Ligar a confirmação 🧑 (só depois do passo 1.7 estar no ar)
⚠️ **Não ligue antes.** Ligando antes de o código estar pronto, quem se cadastrar não consegue entrar.
1. **Authentication → Sign In / Providers → Email** (🔍 o caminho pode variar com a versão do painel).
2. Ative **Confirm email**.
3. Salve.

### 1.9 Checklist de teste (você, com um e-mail real)
- [ ] Cadastro novo → chega o e-mail com o código (veja o spam).
- [ ] Código errado → mensagem de erro, sem entrar.
- [ ] Código certo → entra no app.
- [ ] Tentar logar antes de confirmar → "confirme seu e-mail".
- [ ] **Reenviar código** → chega um novo, e o antigo deixa de valer.
- [ ] Reenviar várias vezes seguidas → aparece o limite.

---

## 2. Storage das fotos (Supabase)

### 2.1 Criar o bucket 🧑
1. Painel → **Storage → New bucket**.
2. Nome: `torv-images`.
3. Marque como **Public** (a leitura por URL funciona sem login, como as fotos de hoje).
4. Se o painel oferecer, restrinja:
   - tamanho máximo: **4 MB**;
   - tipos permitidos: `image/jpeg, image/png, image/webp`.

   Se não oferecer, crie pelo **SQL Editor**:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('torv-images', 'torv-images', true, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
```

Por que 4 MB: a Vercel recusa corpo de requisição acima de 4,5 MB.

### 2.2 Policies: não crie nenhuma
- Bucket público só significa que existe uma URL pública para **baixar**. Gravar e apagar continuam exigindo permissão.
- O backend grava com a **chave secreta**, que ignora o RLS (isso está na doc do Supabase). Logo não precisa de policy.
- ⚠️ Não crie policy de `INSERT` para `anon` ou `authenticated`: qualquer pessoa poderia gravar no bucket.

### 2.3 Criar a chave secreta 🧑
1. **Settings → API Keys**.
2. Crie uma **secret key** (começa com `sb_secret_`) e dê um nome, por exemplo `torv-backend`.
3. Copie e cole **direto** no `BackEndTorv/.env` (nunca no chat):

```env
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=torv-images
```

- Regras do próprio Supabase para essa chave: só no backend, nunca no app, nunca no Git, nunca em URL, nunca em log.
- Não use a chave antiga `service_role` (JWT que começa com `eyJ`): o Supabase está descontinuando as chaves antigas até o fim de 2026.
- Se vazar: crie outra, troque em todos os lugares e só então apague a antiga.

### 2.4 Fotos que já existem 🧑
São 9 arquivos em `BackEndTorv/profilePhotos/`. Para **não precisar mexer no banco**, mantenha os nomes:
1. Painel → **Storage → torv-images → Upload files**.
2. Envie todos os arquivos de `profilePhotos/` para a raiz do bucket.

Se preferir, eu faço isso por script.

### 2.5 Código ⚙️ (me avise quando 2.1 a 2.3 estiverem feitos)
Eu faço:
- Reescrever `src/lib/imageUpload.js` (gravar, apagar e montar a URL no Storage), com a URL no formato
  `https://<projeto>.supabase.co/storage/v1/object/public/torv-images/<arquivo>`.
- Baixar o limite da capa de 5 MB para 4 MB.
- Remover a pasta `profilePhotos` e a rota `/uploads`.
- Atualizar os testes.

### 2.6 Checklist de teste
- [ ] Trocar a foto do perfil → aparece no app.
- [ ] A URL da foto abre no navegador **sem login**.
- [ ] Trocar a foto de novo → a antiga some do bucket (Storage → torv-images).
- [ ] Criar grupo com capa → aparece no card e no detalhe.
- [ ] A foto continua aparecendo com o backend **desligado no seu PC** (ela vem do Supabase, não do backend).

⚠️ Bucket público: quem tiver o link abre a imagem. Os nomes têm trechos aleatórios, mas não suba nada sensível.

---

## 3. Backend na Vercel

Você já sabe hospedar, então este é só o checklist do que é específico deste projeto.

### 3.1 Configuração 🧑
- [ ] **Root Directory:** `BackEndTorv`.
- [ ] A Vercel reconhece Fastify sem configuração. O `server.js` na raiz da pasta é um ponto de entrada que ela detecta. O app vira **uma Vercel Function**.
- [ ] **Build Command:** `npx prisma generate`.
- [ ] **Região:** a mais próxima do seu projeto Supabase. O padrão da Vercel é `iad1` (Virgínia).
- [ ] Plano **Hobby** serve para os testes, mas é para uso pessoal e não comercial.

### 3.2 Variáveis de ambiente 🧑
Cadastre em **Settings → Environment Variables**, para Production:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | URL do **pooler** do Supabase (a de runtime). Em serverless pode haver várias instâncias, então o `connection_limit` deve ser baixo; eu confirmo o valor na etapa de código |
| `DIRECT_URL` | URL direta, usada só para migrations |
| `SUPABASE_URL` | URL do projeto |
| `PUBLISHABLE_KEY` | chave publicável |
| `SUPABASE_SECRET_KEY` | chave secreta (do passo 2.3) |
| `SUPABASE_STORAGE_BUCKET` | `torv-images` |

🔍 O `.env` atual também tem `JWT_SECRET` e `PROJECT_URL`. Eu confirmo no código se ainda são usadas antes de você cadastrá-las.

### 3.3 Migrations
Rode do seu PC, **não** no build da Vercel:

```bash
cd BackEndTorv
npx prisma migrate status
npx prisma migrate deploy
```

### 3.4 Código ⚙️ (me avise)
Eu faço:
- `trustProxy` com o número de saltos (sem isso o rate limit enxerga o IP da Vercel e todos os usuários dividem o mesmo limite).
- Teto de upload e `connection_limit` ajustados.
- Binários do Prisma empacotados.
- Rota `/health`.
- Remoção de dependências sem uso (`bcrypt`, `jsonwebtoken`).

### 3.5 Limites que você precisa conhecer
- O corpo de requisição da Vercel vai até **4,5 MB**. Por isso o limite de foto é 4 MB.
- O disco da função não é persistente. Por isso as fotos vão para o Storage (seção 2).
- O rate limit e a fila por usuário ficam **por instância**. Para 3 pessoas não importa. O teto de 5 treinos por dia continua garantido pelo banco.
- Tempo máximo por requisição no Hobby: 300 s (folgado para nós).

### 3.6 Verificar depois do deploy 🧑
- [ ] `https://<projeto>.vercel.app/groups` responde **401** (sem token, é o esperado).
- [ ] `/documentation` **não** existe em produção (o Swagger só liga fora de produção).
- [ ] Cadastro, login e treino funcionam pela URL da Vercel.
- ⚠️ Se a API devolver uma **página de login da Vercel** em vez de JSON, é a "Deployment Protection". Use o domínio de **produção** (`<projeto>.vercel.app`), não a URL de preview, e confira em Settings → Deployment Protection. 🔍 O comportamento padrão pode variar.
- ⚠️ A primeira requisição depois de um tempo parado pode demorar (cold start).

---

## 4. O APK (EAS Build)

### 4.1 O que são essas peças
- **EAS** é o serviço de build do Expo, na nuvem. Você não precisa de Android Studio nem de Java.
- **`eas.json`** (na pasta `FrontEndTorv/`) descreve os perfis de build. Para os testes usamos um perfil `preview`, que gera um **APK** instalável. O `.aab` é o formato da Play Store e **não** instala direto no celular.
- **`android.package`** é o ID único do app no Android, no `app.json`.
- **`versionCode`** é um número inteiro que precisa crescer a cada APK novo, para um APK novo instalar por cima do antigo.

### 4.2 Ícone e nome
Hoje todos os ícones em `FrontEndTorv/assets/` são o **template do Expo** (o "A" azul), e o nome é `FrontEndTorv`.

| Arquivo | Tamanho | Observação |
|---|---|---|
| `icon.png` | 1024×1024, PNG | sem transparência |
| `android-icon-foreground.png` | 1024×1024, fundo transparente | símbolo na **área central** (~66%); o Android recorta as bordas |
| `android-icon-background.png` | cor lisa ou imagem | sugestão: `#121212` |
| `android-icon-monochrome.png` | símbolo em uma cor só | usado nos ícones temáticos |
| `splash-icon.png` | logo da tela de abertura | |

Você me passa o logo (de preferência com fundo transparente) ou me pede para gerar uma opção, e eu preparo os 5 arquivos.

### 4.3 Preparar a conta e a ferramenta 🧑
```bash
npm install --global eas-cli
eas login
eas whoami
```

### 4.4 Ajustar o `app.json` ⚙️ (ou você, se preferir)
Trechos que entram em `FrontEndTorv/app.json`, dentro de `expo`:

```json
{
  "name": "TORV",
  "android": {
    "package": "com.SEUNOME.torv",
    "versionCode": 1
  }
}
```

- Mantenha o `scheme: "torv"` (já existe) e o resto do `android`.
- ⚠️ O `android.package` precisa estar definido **antes do primeiro build**.

### 4.5 Configurar o EAS 🧑
**Sempre dentro de `FrontEndTorv/`.** A doc do Expo manda rodar os comandos na pasta do app, não na raiz do repositório.

```bash
cd FrontEndTorv
eas build:configure
```

Isso cria o `eas.json` e liga o projeto à sua conta Expo. Depois, deixe o `eas.json` assim (perfil `preview`):

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "environment": "preview",
      "android": { "buildType": "apk" }
    }
  }
}
```

(Se o `eas build:configure` já criou outros perfis, mantenha-os e adicione este.)

### 4.6 A URL da API dentro do APK 🧑
O arquivo `FrontEndTorv/.env` **não** vai para o build na nuvem (os `.env` costumam ficar fora do Git). Use as variáveis do EAS:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://<projeto>.vercel.app --environment preview --visibility plaintext
```

- 🔍 A doc do Expo usa o comando `eas env:set`, e em alguns CLIs o nome é `eas env:create`. Use o que o seu `eas --help` mostrar.
- Tem que ser **`https`**. O Android bloqueia `http` em build de produção.
- ⚠️ `EXPO_PUBLIC_*` vira texto dentro do APK. Só a URL pública da API entra aqui. **Nunca** a chave secreta.

### 4.7 Gerar o APK 🧑
```bash
cd FrontEndTorv
eas build --platform android --profile preview
```
- Na primeira vez ele pergunta se deve **gerar um Android Keystore**: responda **sim**. O EAS guarda a chave com segurança.
- ⚠️ Guarde essa chave: sem ela, um APK novo **não instala por cima** do antigo (teria que desinstalar). O EAS a mantém na sua conta Expo.
- O build roda na nuvem e leva de minutos a algumas dezenas de minutos, dependendo da fila. Você acompanha com `eas build:list` ou em https://expo.dev.
- No fim, a página do build tem o botão **Install** e o link/QR para baixar o APK.

### 4.8 Instalar e compartilhar 🧑
1. No celular Android, abra o link do build, baixe e instale.
2. O Android pede para permitir "instalar apps desconhecidos" para o navegador (ou o gerenciador de arquivos). Permita.
3. O **Play Protect** pode avisar sobre app desconhecido: toque em "Instalar mesmo assim".
4. Envie o link para seu irmão e seu primo. Se o link pedir login, baixe o APK pelo botão de download e mande o arquivo (WhatsApp, Drive).
5. Peça para eles abrirem o app e criarem a conta deles.

### 4.9 Novas versões
- Cada mudança no app exige **um APK novo** (mesmo comando).
- O `versionCode` precisa subir. Eu configuro o EAS para incrementar sozinho (`autoIncrement`).
- ⚠️ "App não instalado" costuma ser: outro APK com o mesmo ID mas **assinado com outra chave**. Desinstale o antigo e instale de novo.

### 4.10 Checklist de teste no celular 🧑
- [ ] Cadastro com e-mail real e código (depois de 1.8).
- [ ] Login e logout.
- [ ] Foto de perfil pela galeria (o Android pede permissão).
- [ ] Criar grupo com capa e ajustar o enquadramento.
- [ ] Puxar para recarregar nos grupos, no detalhe do grupo e no histórico.
- [ ] Gerar o código do grupo e usar **Compartilhar**: abre a folha nativa de compartilhamento.
- [ ] Entrar em um grupo com o código por outro celular.
- [ ] Salvar um treino e ver o ranking.
- [ ] Editar e excluir um treino.
- [ ] Link `torv://join/CODIGO`: muitos aplicativos de conversa **não** tornam esse tipo de link clicável. Para testar de verdade, um caminho é o terminal do PC com o celular em modo depuração: `adb shell am start -a android.intent.action.VIEW -d "torv://join/CODIGO"`. Por isso a mensagem de compartilhamento inclui o código digitável.

### 4.11 Problemas comuns
| Sintoma | Causa provável |
|---|---|
| `Network request failed` no app | `EXPO_PUBLIC_API_URL` errada ou em `http`; ou a Vercel devolvendo a página de proteção (ver 3.6) |
| App abre e não carrega nada | A URL foi definida **depois** do build: o valor é embutido no momento do build, então gere outro |
| "App não instalado" | Chave de assinatura diferente ou `versionCode` menor (ver 4.9) |
| Build falha | Rode `npx expo-doctor` dentro de `FrontEndTorv/` e veja o log do build em expo.dev |
| E-mail do código não chega | Veja o spam; confira Logs → Auth e o limite de 30 por hora (ver 1.3 e 1.5) |

---

## 5. Ordem sugerida e quem faz o quê

| # | Passo | Quem |
|---|---|---|
| 0 | Contas, decisões, trocar a senha do `torv_api` | 🧑 |
| 1 | Enquadramento da capa + loader de recarregar | ⚙️ (antes de tudo) |
| 2 | **E-mail:** SMTP e template (1.3 a 1.5) | 🧑 |
| 3 | **E-mail:** código backend + tela (1.7) | ⚙️ |
| 4 | **E-mail:** ligar "Confirm email" e testar (1.8, 1.9) | 🧑 |
| 5 | **Storage:** bucket e chave (2.1 a 2.4) | 🧑 |
| 6 | **Storage:** código (2.5) e teste (2.6) | ⚙️ + 🧑 |
| 7 | **Vercel:** código (3.4) | ⚙️ |
| 8 | **Vercel:** deploy, variáveis e verificação (3.1 a 3.6) | 🧑 |
| 9 | **APK:** `app.json`, `eas.json`, ícone | ⚙️ |
| 10 | **APK:** EAS, variável, build, instalar (4.3 a 4.8) | 🧑 |
| 11 | Teste no celular (4.10) | 🧑 + 👥 irmão e primo |

Ficam **fora** desta rodada: o link `https` de grupo (depende de domínio e de App Links) e o iOS (exige conta Apple paga).

---

## 6. Referências (documentação oficial)

- Supabase: SMTP próprio — https://supabase.com/docs/guides/auth/auth-smtp
- Supabase: templates de e-mail — https://supabase.com/docs/guides/auth/auth-email-templates
- Supabase: chaves de API — https://supabase.com/docs/guides/api/api-keys
- Supabase: criar buckets — https://supabase.com/docs/guides/storage/buckets/creating-buckets
- Supabase: servir arquivos do Storage — https://supabase.com/docs/guides/storage/serving/downloads
- Vercel: Fastify — https://vercel.com/docs/frameworks/backend/fastify
- Vercel: limites das funções — https://vercel.com/docs/functions/limitations
- Expo: primeiro build — https://docs.expo.dev/build/setup/
- Expo: `eas.json` — https://docs.expo.dev/build/eas-json/
- Expo: variáveis de ambiente do build — https://docs.expo.dev/build-reference/variables/
- Expo: `app.json` (`android.package`) — https://docs.expo.dev/versions/latest/config/app/
