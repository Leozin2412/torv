# Autenticação no backend + bloqueio do schema public — Design

Branch: `fix/supabase-anon-exposure` (criada a partir de `feat/calorie-macro-calculator`; vai ser mergeada nela após aprovação do usuário).

## Problema

1. **Exposição de dados (CRITICAL, pré-existente desde 2026-09-18).** O front embute `EXPO_PUBLIC_SUPABASE_ANON_KEY` no bundle (toda variável `EXPO_PUBLIC_*` é inlined no JS do cliente). O schema `public` não tem RLS e mantém os grants padrão do Supabase para `anon`/`authenticated`. Resultado verificado em 2026-09-25: com a anon key, `GET /rest/v1/<tabela>` devolve as linhas de **todos** os usuários (`users` 3, `user_profiles` 3, `user_measurements` 9, `food_logs` 200, `nutrition_targets` 2). Funções do `public` (ex.: `fn_log_food_and_return_remaining(p_user_id, ...)`) também ficam expostas via `/rest/v1/rpc/*`, porque funções recebem `EXECUTE` para `PUBLIC` por padrão.
2. **Decisão do usuário:** toda autenticação passa pelo backend. O front só chama rotas da nossa API: sem SDK do Supabase, sem anon/publishable key, sem chamada direta ao Supabase. A latência extra no cadastro e no login foi aceita.

## Decisões

| Tema | Decisão |
|---|---|
| Tokens | Continuam sendo os JWTs do Supabase Auth (GoTrue). O `auth.middleware.js` (JWKS) **não muda**. |
| Cliente do GoTrue no backend | `fetch` nativo (Node 24) contra a API REST do GoTrue, num adapter fino `src/lib/authProvider.js`. Sem `@supabase/supabase-js` no backend. Manter o adapter isolado facilita trocar de provedor ao sair do Supabase. |
| Chave usada pelo backend | `PUBLISHABLE_KEY` + `SUPABASE_URL`, que já estão em `BackEndTorv/.env` (gitignored). **Não** usar service role. |
| Rate limit | `@fastify/rate-limit` só nas rotas `/auth/*`. Como agora o GoTrue vê o IP do backend para todos os usuários, o limite por IP do cliente passa a ser nossa responsabilidade. |
| Armazenamento da sessão no front | `expo-secure-store` no nativo, `localStorage` no web (mesmo comportamento de antes, quando o supabase-js usava localStorage no web). |
| URL da API no front | `process.env.EXPO_PUBLIC_API_URL`, com fallback `http://localhost:3000`. O IP de LAN do desenvolvedor sai do código e vai pro `FrontEndTorv/.env` (gitignored). A URL da API não é segredo. |
| Banco | Revogar tudo de `anon`/`authenticated` (e `EXECUTE` de funções de `PUBLIC`) no schema `public`, mais default privileges. Ligar RLS em todas as tabelas do `public` e criar uma policy explícita de acesso total para `torv_api`, o role que o backend usa em `DATABASE_URL` (ele não é dono das tabelas; sem policy, o RLS o bloquearia). Tudo Postgres puro. |

## Contrato HTTP — `/auth` (novo)

`Session = { access_token: string, refresh_token: string, expires_at: number /* unix s */, user: { id: string, email: string } }`

| Rota | Body | Sucesso | Erros |
|---|---|---|---|
| `POST /auth/register` | `{ email, password, name, username?, birth_date: 'YYYY-MM-DD', weight_kg, height_cm, gender: 'Masculino'\|'Feminino', fitness_level, goal }` | `201 { session: Session \| null, confirmation_required: boolean }` | `400` validação · `409 { code: 'EMAIL_TAKEN' \| 'USERNAME_TAKEN' }` (username checado antes do signup; corrida rara ainda cai no 502) · `429` · `502` falha do provedor |
| `POST /auth/login` | `{ email, password }` | `200 { session }` | `400` · `401` genérico ("Invalid email or password", sem distinguir usuário inexistente de senha errada) · `429` · `502` |
| `POST /auth/refresh` | `{ refresh_token }` | `200 { session }` | `400` · `401` · `429` · `502` |
| `POST /auth/logout` | — (Bearer access token) | `204` sempre; revogação no GoTrue é best-effort | — |

- Validação do register: reaproveita `validateProfileUpdate` para `goal`/`fitness_level`/`weight_kg`/`height_cm`. `gender` com `Object.hasOwn` em lista fechada, `birth_date` com `format: 'date'` e idade plausível (10–120), `email` com `format: 'email'`, `password` com a mesma regra mínima que o front já aplica.
- O metadata enviado ao GoTrue precisa bater com o que o trigger `handle_new_user` lê: `name`, `username`, `birth_date`, `weight` (← `weight_kg`), `height` (← `height_cm`), `gender`, `fitness_level`, `goal`.
- Rate limit sugerido: `login`/`register` 10 req/min por IP; `refresh` 30 req/min por IP.
- Nunca logar senha, access token ou refresh token. Erros 5xx genéricos.

## Front

- Remover `src/services/supabase.ts`, `@supabase/supabase-js` e `react-native-url-polyfill` (se não houver outro uso).
- `src/services/session.ts` (novo): `getSession`/`setSession`/`clearSession`, com SecureStore no nativo e localStorage no web.
- `src/services/api.ts`:
  - `baseURL` vem do env;
  - o interceptor de request anexa o access token e faz refresh **proativo** quando faltam menos de 60 s para expirar;
  - o interceptor de response, num 401/403, faz **um** refresh e repete a request uma vez;
  - só um refresh roda por vez;
  - se o refresh falhar, limpa a sessão e avisa o `AuthContext`;
  - as chamadas `/auth/*` usam uma instância sem interceptor, pra não entrar em loop.
- `AuthContext`: expõe `signed`, `user`, `loading`, `login(email, password)`, `register(payload)`, `logout()`. Ao montar, lê a sessão do storage e carrega `/profile`.
- Login e Register chamam o contexto. Mensagens de erro: `401` → "Email ou senha incorretos."; `409` → "Já existe uma conta com esse e-mail."; `429` → "Muitas tentativas. Aguarde um minuto e tente de novo."; demais → mensagem genérica atual.
- `FrontEndTorv/.env`: remover `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` e adicionar `EXPO_PUBLIC_API_URL` com o IP que hoje está hardcoded no `api.ts` do usuário.
- Critério: o bundle web não contém `supabase` nem a anon key.

## Banco — migration `<ts>_lock_down_public_schema`

1. `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` e o mesmo para `SEQUENCES`.
2. `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, PUBLIC;` e re-`GRANT EXECUTE ... TO torv_api` se preciso.
3. `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ... FROM anon, authenticated` para tabelas, sequences e funções (e funções de `PUBLIC`), para que objetos futuros não nasçam expostos.
4. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nas 15 tabelas do app e também em `_prisma_migrations`.
5. `CREATE POLICY torv_api_full_access ON <tabela> TO torv_api USING (true) WITH CHECK (true)` em cada tabela do app. `torv_analyst` lê só as views, que rodam com o privilégio do dono (`postgres`) e não são afetadas.
6. `handle_new_user` (SECURITY DEFINER, dono `postgres`) precisa continuar funcionando: provar com um cadastro real.
7. Atualizar `BancoDeDadosTorv/` (seção de segurança/roles) para manter a paridade da documentação.

Verificação obrigatória logo depois de aplicar:
- a sondagem anon (`/rest/v1/<tabela>` e `/rest/v1/rpc/<função>`) passa a devolver erro de permissão;
- o backend (`torv_api`) continua lendo e escrevendo;
- o cadastro continua criando as 4 linhas.

Se o backend quebrar, reverter na hora.

## Testes (Review and Tests)

- `npm test` do backend: o adapter é testado com `fetch` mockado; o controller com `fastify.inject` e o provedor mockado.
- `tsc` do front com 0 erros.
- HTTP: todos os códigos do contrato, incluindo 429.
- Navegador (portal web do Maestri):
  - cadastro;
  - login;
  - reload mantém a sessão;
  - access token corrompido ou expirado → refresh transparente;
  - refresh token inválido → volta para o Login;
  - logout.
- Sondagem anon no Supabase: tudo negado.
- Bundle web: sem anon key e sem supabase.

## Fora do escopo

- Rotação da anon key: depois do REVOKE ela só dá acesso ao signup público do GoTrue, que já é público por natureza.
- Recuperação de senha, OAuth, confirmação de e-mail. O projeto hoje não confirma e-mail; o contrato já devolve `confirmation_required` para o caso de ligar depois.
