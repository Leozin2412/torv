# Torv

Torv é um aplicativo de registro de refeições, metas nutricionais, treinos, acompanhamento da saúde e gamificação em grupo. O projeto é dividido em uma aplicação **Front-end (Mobile)** e um **Back-end (API REST)**.

## 🚀 Tecnologias (Stack)

### Front-end (`FrontEndTorv`)
- **React Native** com **Expo**
- **TypeScript**
- **React Navigation** (Native Stack e Bottom Tabs)
- **Axios** para requisições HTTP
- **Lucide React Native** para ícones
- **UXCam** para análise de uso

### Back-end (`BackEndTorv`)
- **Node.js** com **Fastify 5**
- **TypeBox** para validação de rotas e **Swagger/OpenAPI** para documentação automática
- **Prisma ORM** para modelagem e acesso ao banco de dados
- **PostgreSQL no Supabase** como banco de dados principal
- **Supabase Auth** para cadastro, login e confirmação de e-mail (tokens JWT validados via JWKS com `jose`)
- **Supabase Storage** para fotos de perfil e capas de grupo
- Deploy na **Vercel**

> A pasta `BancoDeDadosTorv` guarda os scripts antigos do SQL Server, mantidos só como referência. O banco atual é o PostgreSQL do Supabase, versionado pelas migrations do Prisma.

---

## 🛠️ Configuração Local

### Pré-requisitos
- Node.js instalado
- Um projeto no Supabase (banco, Auth e um bucket do Storage)
- Expo (via `npx expo`) para rodar o aplicativo mobile

### 1. Instalando as dependências

Depois de clonar o repositório, instale as dependências de cada diretório separadamente:

```bash
# Back-end (o postinstall já roda `prisma generate`)
cd BackEndTorv
npm install

# Front-end
cd ../FrontEndTorv
npm install
```

### 2. Variáveis de ambiente

Os arquivos `.env` são ignorados pelo Git. Nunca faça commit de valores reais.

**`BackEndTorv/.env`**
```env
# Conexão do Prisma com o Postgres do Supabase
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true"  # conexão com pool (usada pela API)
DIRECT_URL="postgresql://...supabase.com:5432/postgres"                         # conexão direta (usada pelas migrations)

# Supabase
SUPABASE_URL="https://<projeto>.supabase.co"
PUBLISHABLE_KEY="<chave publishable/anon>"
SUPABASE_SECRET_KEY="<chave secreta - nunca expor no front-end>"
SUPABASE_STORAGE_BUCKET="<nome do bucket de fotos>"

# Opcional
PORT=3000
```

**`FrontEndTorv/.env`**
```env
EXPO_PUBLIC_API_URL="http://<ip-da-sua-maquina>:3000"
EXPO_PUBLIC_UXCAM_KEY="<chave do UXCam>"
```

### 3. Banco de dados

Para aplicar as migrations no banco:

```bash
cd BackEndTorv
npx prisma migrate deploy
```

### 4. Executando o projeto

Rode os dois servidores em terminais separados.

**Back-end** (porta 3000 por padrão):
```bash
cd BackEndTorv
npm run dev   # com nodemon; ou: npm start
```

**Front-end:**
```bash
cd FrontEndTorv
npm start     # expo start; também há npm run android / ios / web
```

### 5. Testes

```bash
cd BackEndTorv
npm test      # node --test
```

### 6. Documentação da API

Fora de produção, a documentação interativa (Swagger UI) fica em `http://localhost:3000/documentation`. Ela é gerada a partir dos schemas TypeBox de cada rota.

---

## 📱 Rotas do Front-end

A navegação fica em `FrontEndTorv/src/routes`, separada em rotas públicas e privadas. O componente `Routes` (`routes/index.tsx`) lê o estado `signed` do `AuthContext` e escolhe qual conjunto renderizar:

- `routes/PublicRoutes` (Stack): `Login`, `Register` e `VerifyEmail`. Aparecem quando não há sessão.
- `routes/PrivateRoutes`: abas `Home`, `Workouts`, `MyDiet`, `Groups` e `Profile`, mais as telas em pilha `RoutineEditor`, `WorkoutSession`, `WorkoutSummary`, `WorkoutEdit`, `GroupDetail`, `GroupEditor`, `GroupManage` e `JoinGroup`. Só ficam acessíveis com o usuário logado.

Ao fazer logout ou quando a sessão expira, `signed` volta para `false` e o app volta para o login. Links de convite (`torv://join/<código>`) abrem a tela `JoinGroup`; se o usuário não estiver logado, o convite fica guardado até o login.

---

## 🛣️ Rotas do Back-end

As rotas privadas exigem o header `Authorization: Bearer <token>`. A referência completa, com corpos e respostas, está no Swagger (`/documentation`).

### Saúde
- `GET /health`: verifica se a API está no ar.

### Autenticação (`/auth`)
- `POST /auth/register`: cadastra o usuário no Supabase Auth e cria o perfil.
- `POST /auth/verify-email`: confirma o e-mail com o código recebido.
- `POST /auth/resend-code`: reenvia o código de confirmação.
- `POST /auth/login`: autentica e devolve os tokens de acesso.
- `POST /auth/refresh`: renova o token de acesso.
- `POST /auth/logout`: encerra a sessão.

### Perfil (`/profile`)
- `GET /profile/`: dados do perfil do usuário logado.
- `PUT /profile/`: atualiza o perfil (idade, objetivo, nível de condicionamento etc.).
- `POST /profile/welcome`: conclui o onboarding de boas-vindas.
- `POST /profile/upload`: envia a foto de perfil para o Supabase Storage.

### Alimentação e dieta (`/diet`)
- `GET /diet/`: alimentos registrados em uma data.
- `POST /diet/`: registra um alimento.
- `PUT /diet/:logId` / `DELETE /diet/:logId`: edita ou remove um registro.
- `GET /diet/summary`: resumo do dia (meta calórica, consumido, restante e macronutrientes).
- `PUT /diet/targets`: atualiza as metas de calorias e macronutrientes.
- `GET /diet/targets/suggestion`: sugestão de metas calculada a partir do perfil.
- `POST /diet/targets/suggestion/accept` / `dismiss`: aceita ou dispensa a sugestão.

### Treinos (`/workouts`)
- `GET|POST /workouts/routines`, `GET|PUT|DELETE /workouts/routines/:id`: rotinas de treino.
- `PATCH /workouts/routines/:id/weights`: atualiza as cargas de uma rotina.
- `POST /workouts/plan/accept` / `dismiss`: aceita ou dispensa o plano gerado automaticamente.
- `GET|POST /workouts/exercises`, `PUT|DELETE /workouts/exercises/:id`: exercícios personalizados.
- `POST /workouts/sessions`, `GET|PUT|DELETE /workouts/sessions/:id`: sessões de treino realizadas.

### Atividades (`/activities`)
- `GET /activities/`: histórico de atividades.
- `GET /activities/summary`: resumo das atividades.

### Grupos e competição (`/groups`)
- `POST|GET /groups/`, `GET /groups/discover`: cria, lista e descobre grupos.
- `GET|PATCH|DELETE /groups/:id`, `POST /groups/:id/cover`: detalhes, edição, exclusão e capa do grupo.
- `GET /groups/:id/ranking`: ranking dos membros.
- `DELETE /groups/:id/members/:userId`: remove um membro.
- `POST /groups/:id/invitations`, `GET /groups/invitations/received`, `POST /groups/invitations/:id/accept` / `decline`, `DELETE /groups/invitations/:id`: convites.
- `POST|GET /groups/:id/requests`: pedidos de entrada.
- `POST|DELETE /groups/:id/invite-link`, `GET|POST /groups/join/:token`: link de convite.
