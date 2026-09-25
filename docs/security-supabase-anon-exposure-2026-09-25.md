# Security Review — Supabase anon exposure / auth pelo backend (Round 1)

- **Date:** 2026-09-25
- **Branch:** `fix/supabase-anon-exposure`
- **Scope:** `git diff feat/calorie-macro-calculator...fix/supabase-anon-exposure` (commits `e80bb00`..`007b5be`). Excluídos, por serem do usuário: `FrontEndTorv/tsconfig.json` e a linha em branco não commitada de `BancoDeDadosTorv/Gestao_e_Performance.sql`.
- **Spec:** `docs/superpowers/specs/2026-09-25-backend-auth-and-db-lockdown-design.md`
- **Precondition:** QA `qa-supabase-anon-exposure-2026-09-25.md` (FAIL) → `-round2.md` (PASS, com checagem de catálogo feita pelo Maestro)
- **Lens:** OWASP Top 10, revisão reforçada (código de auth + lockdown de banco)
- **Verdict: FAIL** — 1 MEDIUM na camada **Database**. Bloqueia. A correção é uma linha, numa migration nova. Os LOW e INFO não bloqueiam.

---

## Achados

| # | Sev | Camada | OWASP | Achado |
|---|---|---|---|---|
| 1 | **MEDIUM** | Database | A01 | O default privilege de EXECUTE para PUBLIC em funções **não** é revogado para funções futuras |
| 2 | LOW | Backend | A04/A07 | A cota por IP do GoTrue agora é compartilhada por todos os usuários (IP do backend), o que abre DoS global de login e cadastro |
| 3 | LOW | Frontend | A07 | O logout com access token expirado não revoga o refresh token |
| 4 | LOW | Backend | A07 | O rate limit é só por IP e só em memória, sem throttle por conta |
| 5 | INFO | Backend | A07 | Enumeração via `409 EMAIL_TAKEN`/`USERNAME_TAKEN` — **aceitável** (ver abaixo) |
| 6 | INFO | Database | A01 | Resíduo conhecido: o default ACL do `supabase_admin` inclui `anon` — aceito |
| 7 | INFO | Frontend | A02/A08 | A sessão fica em `localStorage` no web — paridade com o supabase-js, aceito |
| 8 | INFO | Backend | A05 | CORS `origin: *` — ok, porque a auth é Bearer, sem cookie |
| 9 | INFO | Backend (pré-existente) | A07 | `jwtVerify` sem checagem de `audience` |

---

### 1. MEDIUM — o REVOKE de EXECUTE para PUBLIC em funções futuras é um no-op

`BackEndTorv/prisma/migrations/20260925180000_lock_down_public_schema/migration.sql:16`

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC;
```

- A documentação do Postgres (`ALTER DEFAULT PRIVILEGES`) diz: *"Default privileges that are specified per-schema are added to whatever the global default privileges are… you cannot revoke privileges per-schema if they are granted globally (either by default, …)"*.
- `EXECUTE TO PUBLIC` em funções é justamente um default **global embutido**. Por isso a parte `FROM PUBLIC` com `IN SCHEMA public` não tem efeito.
- A parte `anon, authenticated` funciona, porque os grants do Supabase para esses roles são per-schema. Isso explica por que a checagem do Maestro ("default privileges do postgres no public não incluem anon/authenticated") passou: ela olhou só essas linhas.
- **Cenário:** uma migration futura cria `public.fn_x(...)` como `postgres`. A função nasce com `EXECUTE` para PUBLIC. `anon` herda PUBLIC e consegue chamar `POST /rest/v1/rpc/fn_x` com a anon key, que continua pública (fica em bundles antigos e é derivável do projeto).
  - Se a função for `SECURITY DEFINER`, como `handle_new_user` e o padrão `fn_log_food_and_return_remaining(p_user_id, …)`, ela roda como `postgres` com BYPASSRLS. Isso reabre exatamente a exposição que esta branch fecha, agora para leitura/escrita arbitrária por `p_user_id`.
  - Se for `SECURITY INVOKER`, o RLS e a falta de grants em tabela seguram.
- **O estado atual está correto:** as 7 funções existentes foram revogadas pelo `REVOKE … ON ALL FUNCTIONS` da linha 10. O defeito é latente. Mesmo assim, o comentário da migration ("Future objects… must not be born exposed") afirma uma garantia que não vale para funções, e isso é exatamente o que o próximo autor de migration vai assumir.
- **Fix (camada Database, migration nova):**
  ```sql
  -- Global (sem IN SCHEMA): o único jeito de tirar o EXECUTE embutido de PUBLIC.
  ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  ```
  É idempotente e inofensivo se já existir. `torv_api` perde o EXECUTE implícito em funções futuras, então a migration que criar uma função nova precisa de `GRANT EXECUTE … TO torv_api`. Documentar isso junto do lembrete de RLS e espelhar em `Gestao_e_Performance.sql` (passo 1.3).
- **Prova esperada no reteste:**
  1. `SELECT defaclnamespace, defaclacl FROM pg_default_acl WHERE defaclrole='postgres'::regrole AND defaclobjtype='f';` mostra uma linha com `defaclnamespace = 0` sem `=X/postgres` para PUBLIC.
  2. Numa transação com `ROLLBACK`: `CREATE FUNCTION public.zz_probe() RETURNS int LANGUAGE sql AS 'select 1';` e depois `SELECT has_function_privilege('anon','public.zz_probe()','EXECUTE');` → `false`.
- **Limite desta revisão:** o catálogo não foi consultado por este recruta. O MCP do Supabase nesta sessão só enxerga outro projeto ("Portal Tradsul"), e ele não foi tocado. O achado se apoia na semântica documentada do Postgres. A prova acima confirma ou derruba o achado em segundos.

### 2. LOW — a cota do GoTrue por IP virou uma cota global

`BackEndTorv/src/lib/authProvider.js:26`

- Toda chamada ao GoTrue sai do IP do backend. Os limites de auth do projeto Supabase (sign-in/sign-up e token refresh por IP, configuráveis em Auth → Rate Limits) passam a valer para **todos os usuários somados**.
- Cada IP pode fazer 10 req/min em `/auth/login` e `/auth/register`, então poucos IPs bastam para esgotar a cota do GoTrue. Depois disso, todo login e cadastro cai em 429 → `PROVIDER` → 502 para todo mundo. O mesmo vale para o `refresh` quando a base de usuários crescer.
- Não há vazamento, só disponibilidade. **Não bloqueia.**
- **Ação:** conferir e aumentar os limites de Auth no dashboard do projeto torv, na mesma ordem de grandeza do tráfego esperado. Ao sair do Supabase, o provedor novo precisa aceitar o IP do cliente repassado de forma confiável.

### 3. LOW — logout ocioso não revoga

`FrontEndTorv/src/contexts/AuthContext.tsx` (`logout`)

- O logout usa `authApi` (sem interceptor) com o `access_token` salvo. Se o app ficou parado mais de 1 h, esse token já expirou: o GoTrue `/logout` responde 401, o erro é engolido como best-effort e o **refresh token continua válido no servidor**, apagado só localmente.
- O risco só existe se o refresh token já tiver vazado, por exemplo pelo `localStorage` no web.
- **Ação (opcional):** antes do logout, se `expires_at` já passou, chamar `refreshSession()` e usar o token novo.

### 4. LOW — rate limit só por IP e em memória

`BackEndTorv/src/routes/auth.routes.js:17-20`

- O store é em memória, então zera no restart e não é compartilhado entre instâncias. A chave é só `request.ip`, sem limite por e-mail. Credential stuffing distribuído (muitos IPs, 10 tentativas por minuto cada) continua possível.
- `trustProxy` está desligado. Isso está **correto** hoje: ligar `trustProxy: true` sem restringir aos IPs do proxy permitiria burlar o limite com `X-Forwarded-For` forjado. O comentário `ponytail:` já registra isso.
- **Ação quando houver deploy:** usar `trustProxy` com a lista/CIDR do LB (nunca `true`) e, se possível, uma chave extra por e-mail no `/login`.

### 5. INFO — enumeração via 409: aceitável

- **`EMAIL_TAKEN`:** aceitável.
  - O signup do GoTrue é público e, com a confirmação de e-mail desligada, já devolve `user_already_exists` para quem tiver a anon key. O 409 não cria um oráculo novo.
  - A rota tem 10 req/min por IP, e o `/login` responde 401 genérico, sem distinguir usuário inexistente de senha errada (verificado em `signIn`).
  - Se a confirmação de e-mail for ligada, o GoTrue passa a mascarar o signup repetido, e aí vale remover o 409 e responder sempre `confirmation_required: true`.
- **`USERNAME_TAKEN`:** aceitável. Username é identificador público num app social, e a checagem só roda depois da validação completa do corpo, sob o mesmo rate limit.

### 6–9. INFO

- **6:** o residual do `supabase_admin` já foi documentado no QA round 2. As migrations rodam como `postgres`. Aceito.
- **7:** o `localStorage` expõe a sessão a XSS no web. No nativo a sessão fica no SecureStore, o que é correto. Não há sink de HTML dinâmico no diff. Aceito, com paridade com o supabase-js.
- **8:** o `@fastify/cors` sem `origin` reflete `*`. Sem cookie/credential, isso não abre CSRF.
- **9:** `auth.middleware.js` (fora do diff, pré-existente) valida issuer e assinatura via JWKS, mas não `audience: 'authenticated'`. Para endurecer, é uma linha.

---

## Verificado OK

- **Sem segredo no diff.** As senhas nos testes são fixtures (`pw123456`, `a@b.dev`). Não há `eyJ…`, `sb_publishable`, `sb_secret` nem `service_role`. `.env` de back e front estão no `.gitignore` da raiz. `PUBLISHABLE_KEY`/`SUPABASE_URL` só existem no back.
- **Front sem Supabase.** `supabase.ts`, `@supabase/supabase-js` e `react-native-url-polyfill` foram removidos. O QA confirmou o bundle web sem a anon key.
- **Logs sem senha nem token.** `disableRequestLogging: true`. O `onResponse` loga só método, URL e status, e nenhuma rota `/auth` leva token na URL. `sendAuthError` e o logout logam só `{ code }`. O `setErrorHandler` loga o objeto de erro, mas erros de validação do Ajv não carregam o corpo.
- **Erros do provedor não vazam.** O corpo do GoTrue nunca é propagado: só códigos tipados com mensagens fixas. 429 e 5xx do GoTrue viram 502 genérico. Exceções não tipadas caem no 500 genérico do error handler.
- **Sem SSRF nem injeção na chamada ao GoTrue.** A URL base vem do env, os paths e a query são constantes e o corpo passa por `JSON.stringify`. O Bearer do cliente vai só no header, e o undici rejeita CR/LF, o que é capturado e vira `PROVIDER`.
- **Validação de entrada no register.** Schema TypeBox com `format: email/date`, `maxLength: 100` e lista fechada de `gender` via `Object.hasOwn` (sem prototype pollution). Idade 10–120. Os campos de perfil passam pelo `validateProfileUpdate` já existente. O metadata é montado campo a campo, sem spread do body.
- **Tokens no front.**
  - O refresh é single-flight e proativo (menos de 60 s para expirar).
  - O retry acontece uma vez por request (`_retry`).
  - A sessão só é limpa em 400/401 do refresh. Rede, 5xx e 429 mantêm a sessão, o que não é um vetor de ataque.
  - `/auth/*` usa a instância sem interceptor, sem loop.
  - JSON corrompido no storage é descartado.
  - O retry em 403 bate com o middleware, que responde 403 para token inválido ou expirado.
- **Revogação no logout.** O GoTrue `/logout` usa scope global por padrão, e o QA round 2 provou o refresh anterior → 401.
- **Lockdown do banco (estado atual).**
  - O `REVOKE ALL` em tabelas cobre também as views.
  - Sequences e funções foram revogadas de `anon`, `authenticated` e PUBLIC.
  - O RLS está ligado nas 16 tabelas, e a policy `TO torv_api` é restrita ao role (não é `TO public`).
  - `_prisma_migrations` ficou com RLS e sem policy.
  - `handle_new_user` (SECURITY DEFINER, dono `postgres`) continua funcionando: o QA provou com um cadastro real.
  - `torv_analyst` continua só nas views.
  - A documentação em `BancoDeDadosTorv/` está em paridade com a migration.

---

## Próximo passo

- **Retrabalho:** só **Database**, achado #1: uma migration nova com o `ALTER DEFAULT PRIVILEGES` global, mais a nota de `GRANT EXECUTE … TO torv_api` para funções futuras e a paridade em `Gestao_e_Performance.sql`.
- **Reteste:** QA só do que mudou, com as duas provas de catálogo listadas no #1. Depois, Security round 2 do mesmo delta.
- **LOW #2–#4:** não bloqueiam. Ficam registrados para o deploy e o backlog.
