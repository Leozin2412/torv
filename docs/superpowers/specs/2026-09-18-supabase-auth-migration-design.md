# Migração de Auth para Supabase Auth (httpOnly-equivalent + refresh token) — Design

## Contexto

Hoje o `BackEndTorv` faz auth própria: `bcrypt` para hash de senha, JWT assinado com secret próprio (`jsonwebtoken`, `JWT_SECRET`), token de acesso único com 7 dias de validade, sem refresh token, enviado como `Authorization: Bearer` a partir do `AuthContext` do RN (que guarda token+usuário em `AsyncStorage`, sem criptografia). Não há CSRF/XSS hardening, nem refresh/rotação de sessão.

O pedido original era "sistema httpOnly com auth_token expirável, banco guardando só o refresh token, migrando pro mecanismo de auth do Supabase". Como o app é 100% React Native (sem cliente web — ver `CLAUDE.md`), o conceito de cookie httpOnly não se aplica da mesma forma (não existe o modelo de ameaça de XSS-lendo-cookie do browser, e o RN não gerencia cookie jar automaticamente). O equivalente mobile correto é armazenamento seguro no dispositivo (Keychain/Keystore via `expo-secure-store`) — decisão validada com o usuário durante o brainstorm.

O banco (`BackEndTorv/.env`, `DATABASE_URL`) já roda em um projeto Supabase (`figlsyikardnbfuykhxq`, pooler `aws-0-us-east-1`) — existe uma decisão de projeto anterior (memória) de evitar features proprietárias do Supabase visando portabilidade futura pra AWS/Azure. Essa tensão foi levantada e resolvida explicitamente com o usuário: **Supabase Auth (GoTrue) é open source e self-hostable, e o hash de senha usado (`bcrypt`) é padrão, não proprietário** — uma migração futura de cloud não perde os usuários, só exige reimplementar a integração/SDK client-side. Com essa informação, o usuário optou por seguir com Supabase Auth mesmo assim.

## Decisões (via brainstorm)

| Pergunta | Decisão |
|---|---|
| Migrar usuários pro `auth.users` do Supabase, ou só usar tokens do Supabase por cima da tabela atual? | Migrar de verdade pro `auth.users` |
| Trade-off lock-in vs. Supabase Auth | Seguir com Supabase Auth (lock-in real é só no SDK/integração, dados continuam portáveis) |
| Onde guardar os tokens no RN (equivalente a httpOnly) | `expo-secure-store` (Keychain/Keystore) |
| Há usuários reais a preservar? | Não — dados atuais são só teste, migração pode resetar |
| TTL access token / refresh token | 15 min / 30 dias |
| Multi-dispositivo (múltiplas sessões simultâneas) | Sim — já é o comportamento nativo do GoTrue (`auth.refresh_tokens`/`auth.sessions`), não precisa de tabela própria |

## Arquitetura

### Por que SDK direto no RN, e não proxy pelo nosso backend

A ideia original de "banco guardando só o refresh token" é satisfeita nativamente pelo Supabase Auth: o GoTrue já mantém `auth.refresh_tokens` (rotação + detecção de reuso configuráveis) e `auth.sessions` (multi-dispositivo) na mesma instância Postgres do projeto — não precisamos reimplementar essa tabela/rotação na mão. A abordagem mais enxuta é o RN falar **direto** com o Supabase Auth via `@supabase/supabase-js` (padrão oficial documentado pra Expo, usando `expo-secure-store` como storage adapter), em vez de proxiar login/refresh pelo nosso Fastify. O backend deixa de emitir token: só passa a **validar** o JWT que o Supabase assina.

### Frontend (`FrontEndTorv`)

- **Novo** `src/services/supabase.ts`: `createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { storage: ExpoSecureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`, com um adapter fino em cima de `expo-secure-store` (`getItem`/`setItem`/`removeItem` assíncronos).
- **`src/contexts/AuthContext.tsx`** (reescrito): não gerencia mais token nem `AsyncStorage` manualmente. Assina `supabase.auth.onAuthStateChange((event, session) => ...)`; quando `session` existe, busca o perfil via `GET /profile` (nome, username, foto, goal — que não vêm mais no retorno do login, já que o Supabase só devolve `id`/`email`); expõe `user`, `session`, `loading`, `logout` (chama `supabase.auth.signOut()`).
- **`src/screens/Login/index.tsx`**: troca `api.post('/auth/login', ...)` por `supabase.auth.signInWithPassword({ email, password })`.
- **`src/screens/Register/index.tsx`**: troca `api.post('/auth/register', ...)` por `supabase.auth.signUp({ email, password, options: { data: { name, birth_date, weight, height, gender, fitness_level, goal, username } } })` — esses campos extras viram `raw_user_meta_data`, lidos pela trigger no banco (abaixo).
- **`src/services/api.ts`**: o interceptor de request passa a buscar `(await supabase.auth.getSession()).data.session?.access_token` a cada chamada, em vez de header fixo setado uma vez pelo contexto — o SDK já mantém o token renovado.
- **Nova dependência:** `@supabase/supabase-js`, instalada via `npx expo install` (checar compat SDK 56).

### Backend (`BackEndTorv`)

- **`src/middlewares/auth.middleware.js`**: o projeto Supabase já rotacionou pra chaves de assinatura assimétricas (ECC P-256) — não existe mais um secret HS256 compartilhado pra tokens novos, só um "previous key" HS256 que só valida tokens já emitidos antes da rotação. Verificação passa a ser via **JWKS** (conjunto de chaves públicas do projeto, `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), usando a lib `jose` (`createRemoteJWKSet` + `jwtVerify`) — `jsonwebtoken` sozinho não faz fetch/cache de JWKS, por isso é a única dependência nova do backend nesta migração. Normaliza `request.user.userId = payload.sub` logo após verificar — **isso é o único ponto de mudança de shape**; os 9 call-sites existentes (`diet.controller.js`, `profile.controller.js`) que fazem `const { userId } = request.user` continuam funcionando sem alteração.
- **`src/controller/auth.controller.js`** e **`src/routes/auth.routes.js`**: removidos — não há mais login/registro no nosso backend.
- **`server.js`**: remove o `fastify.register(require('./src/routes/auth.routes'), { prefix: '/auth' })`.
- **`.env`**: adiciona `SUPABASE_URL` (não é segredo — é a URL pública do projeto, usada só pra montar o endpoint do JWKS). Nenhum secret novo é necessário no backend: JWKS é público por natureza.

### Banco (`BackEndTorv/prisma/schema.prisma` + migração SQL)

- `users`: remove `password_hash`; `id` ganha FK `references auth.users(id) on delete cascade` (mantida como tabela "espelho" fina — as 9 tabelas dependentes de hoje, `user_profiles`/`user_measurements`/`user_streaks`/`follows`/`group_members`/`group_rankings`/`activities`/`workout_routines`/`nutrition_targets`/`food_logs`, continuam referenciando `users.id` sem nenhuma mudança de schema nelas).
- Trigger SQL `handle_new_user()` (`AFTER INSERT ON auth.users`): insere em `public.users` (id, email) e `public.user_profiles` (name, username, birth_date, weight, height, gender, fitness_level, goal — lidos de `NEW.raw_user_meta_data`), replicando o que `authController.register` fazia manualmente hoje.
- Como confirmado que os dados atuais são só de teste: a migração reseta (`TRUNCATE ... CASCADE` ou equivalente) `users` e as tabelas dependentes antes de aplicar o novo schema, em vez de tentar preservar linhas órfãs sem `auth.users` correspondente.
- `.env`: adiciona `SUPABASE_URL`, `SUPABASE_ANON_KEY` — a **publishable key** nova (`sb_publishable_...`), não a legada — usados só no frontend, mas documentados aqui pra referência de setup.

## Fora de escopo

- **CSRF**: não aplicável — o access token vai em header `Authorization`, nunca em cookie, então não há o que um CSRF exploraria (anexo automático de cookie pelo browser). Isso estava no pedido original assumindo o modelo de cookie httpOnly, que foi descartado nesta decisão.
- **XSS hardening**: subsistema separado, tratado em spec própria — sem relação com esta migração de auth.
- MFA, login social, fluxo de "esqueci minha senha" por email: não pedidos, não incluídos (o Supabase Auth já suporta nativamente se algum dia forem pedidos).

## Riscos / pontos de atenção pra quem for implementar

- `expo-secure-store` tem limite de tamanho por item (~2KB no iOS Keychain) — sessão do Supabase (JWT + refresh token + metadata) normalmente cabe, mas vale checar no smoke test.
- A troca de retorno do login (sem perfil embutido) precisa que a tela pós-login trate um estado "sessão ativa, perfil ainda carregando" sem quebrar (hoje `login()` seta tudo de uma vez, síncrono).
- `auth.middleware.js` precisa continuar rejeitando token ausente/inválido com os mesmos códigos HTTP de hoje (401/403) — os testes de `torv-review-tests` devem cobrir isso.
