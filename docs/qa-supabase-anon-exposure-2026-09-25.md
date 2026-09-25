# QA — Auth pelo backend + bloqueio do schema public (rodada 1)

**Data:** 2026-09-25
**Recruta:** Torv Review and Tests
**Branch:** `fix/supabase-anon-exposure` (base `feat/calorie-macro-calculator`)
**Diff:** `git diff feat/calorie-macro-calculator...fix/supabase-anon-exposure`. Ficaram de fora `FrontEndTorv/tsconfig.json` e a linha em branco não commitada de `Gestao_e_Performance.sql`, que são do usuário.
**Commits:** `f73a077` (DB lockdown, já aplicado no Supabase), `e68e38a` + `29d1fb8` (back `/auth`), `536266a` + `d0115d5` (front sem supabase-js), `28cfffd` (spec)
**Spec:** `docs/superpowers/specs/2026-09-25-backend-auth-and-db-lockdown-design.md`, seção Testes

**Veredito: FAIL (1 MEDIUM).** O bloqueio do banco está fechado de verdade. O contrato `/auth` e o fluxo do navegador funcionam, **exceto o logout do app**: ele recebe **415** e **nunca revoga** o refresh token no GoTrue. Com a branch base (`supabase.auth.signOut()`) a revogação acontecia, então isso é uma regressão. Não avança para Security.

---

## Achados (por severidade)

| # | Sev. | Camada | Onde | Achado |
|---|---|---|---|---|
| 1 | **MEDIUM** | Front | `FrontEndTorv/src/contexts/AuthContext.tsx` (`logout`, `authApi.post('/auth/logout', null, …)`) | O axios, com body `null`, manda `Content-Type: application/x-www-form-urlencoded` (e `Content-Length: 0`). O Fastify não tem parser pra esse tipo e responde **415 Unsupported Media Type**. O `.catch(() => {})` engole o erro, então o logout local funciona, mas o `/logout` do GoTrue **nunca é chamado**. |
| 2 | LOW | Back (+ Front) | `BackEndTorv/src/routes/auth.routes.js` (body do `/register`) | `name` e `username` não têm `maxLength`, mas no banco são `VarChar(100)`. Um nome com 101 caracteres ou mais passa na validação, o trigger `handle_new_user` falha e a rota devolve **502 "Authentication provider unavailable"**, quando o certo seria 400. O front também não limita o tamanho, então dá pra chegar nisso pela UI. |
| 3 | LOW | Back (deploy) | `BackEndTorv/server.js` / rate-limit | O rate-limit usa `request.ip` e o servidor não tem `trustProxy`. Localmente está certo. Mas, se o deploy ficar atrás de proxy ou load balancer, todos os clientes caem no mesmo IP: 10 logins/min **no total** derrubam o login de todo mundo. |

### #1: evidência

Navegador (portal TorvWeb). XHR capturado no clique em "Sair da conta":

```json
{"u":"http://192.168.15.179:3000/auth/logout","st":415,
 "h":{"Content-Type":"application/x-www-form-urlencoded","Authorization":"<bearer>"},
 "body":"{\"error\":\"Unsupported Media Type\"}"}
```

Em seguida, `POST /auth/refresh` com o refresh token salvo **antes** do logout → **200**, ou seja, a sessão continua válida no provedor.

Reprodução isolada no node, com o axios do próprio front:

| Chamada | Resultado |
|---|---|
| `authApi.post('/auth/logout', null, …)` (atual) | 415 |
| `authApi.post('/auth/logout', undefined, …)` | 415 |
| `authApi.post('/auth/logout', {}, …)` | **204** |
| `fetch` sem Content-Type + Bearer válido | 204, e o refresh seguinte dá **401** (revogou) |

**Cenário de falha:** alguém obtém o refresh token (localStorage no web, backup do aparelho). O usuário faz logout achando que encerrou a sessão, mas o token continua renovando sessões até expirar no GoTrue.

**Fix mínimo (front):** trocar `null` por `{}` no `authApi.post('/auth/logout', …)`.

**Teste que faltou:** o teste do back (`fastify.inject` sem payload) não reproduz o que o cliente real manda. Vale um caso em `auth.routes.test.js` com `content-type: application/x-www-form-urlencoded` e body vazio, ou garantir isso só pelo front. A decisão é da camada que fizer o fix.

### #2: evidência

`POST /auth/register` com `name` de 300 caracteres → `502 {"error":"Authentication provider unavailable"}`. Nenhuma conta foi criada: o login com o mesmo e-mail dá 401, porque o trigger faz rollback. **Fix:** `maxLength: 100` em `name` e `username` no schema TypeBox, e `maxLength` nos `Input` do cadastro.

---

## 1. Testes automatizados ✅

- `BackEndTorv`: `npm test` → **41/41 pass**, 0 fail. Inclui `authProvider.test.js` (fetch mockado) e `auth.routes.test.js` (`fastify.inject` + provedor mockado, com 409 EMAIL_TAKEN e USERNAME_TAKEN, 429 em login e refresh).
- `FrontEndTorv`: `npx tsc --noEmit` → **0 erros**.
- `@supabase/*` e `react-native-url-polyfill` não estão mais em `node_modules` do front.

## 2. Contrato HTTP `/auth` ao vivo (Furnace :3000) ✅, exceto o logout do cliente real (#1)

Contas usadas: `qa.auth.1790342936114@torvtest.dev` (+ variantes `r1`/`r2`), `qa.auth.1790343236@torvtest.dev` (navegador) e `qa.auth.<ts>long@…` (não criada).

| Caso | Esperado | Obtido |
|---|---|---|
| register válido | 201 + session | **201** `{session, confirmation_required:false}` |
| register e-mail inválido | 400 | **400** `body/email must match format "email"` |
| register e-mail repetido | 409 EMAIL_TAKEN | **409** `{code:"EMAIL_TAKEN"}` |
| register username repetido | 409 USERNAME_TAKEN | **409** `{code:"USERNAME_TAKEN"}` |
| register `gender: "toString"` | 400 | **400** |
| 2 registers em paralelo, mesmo username novo | 201 + 409/502 | **201 + 409** (o pre-check já viu a 1ª conta; 502 não reproduziu) |
| login ok | 200 | **200** |
| login senha errada / usuário inexistente | 401 genérico igual | **401** `Invalid email or password` nos dois |
| login sem senha | 400 | **400** |
| refresh ok | 200 | **200** |
| refresh lixo | 401 | **401** `Invalid refresh token` |
| refresh sem campo | 400 | **400** |
| logout Bearer válido (sem Content-Type) | 204 + revoga | **204**; refresh depois → **401** |
| logout sem token / Bearer lixo | 204 | **204** |
| logout como o axios manda | 204 | **415** (#1) |
| 11ª tentativa de login em 1 min | 429 | **429** `Rate limit exceeded, retry in 55 seconds`, `x-ratelimit-limit: 10`, `retry-after: 55` |
| 502 do provedor | — | Não reproduzível sem derrubar o GoTrue. Só aparece no caminho do #2 (mapeado como PROVIDER). Coberto por teste unitário. |

Observações (sem achado):
- Reusar um refresh token já rotacionado **dentro de ~10 s** dá 200. É o *reuse interval* padrão do GoTrue, não é bug.
- O access token continua aceito em `/profile` depois do logout até expirar (o JWKS é verificado localmente). Isso é design aceito na spec, igual ao comportamento anterior.
- As respostas de erro não vazam o corpo do provedor: só `{error}` (+ `code` no 409).

## 3. Sondagem anon/authenticated no Supabase ✅

Feita com `SUPABASE_URL` + `PUBLISHABLE_KEY` do `BackEndTorv/.env`.

**Como anon:**
- **16 tabelas** (15 do app + `_prisma_migrations`), `GET ?select=*&limit=1` → todas **401 / 42501 permission denied**, nenhuma linha.
- **Views** `vw_dashboard_user_stats` e `vw_group_leaderboard` → **401 / 42501**.
- **Escrita:** `POST food_logs` → 42501; `DELETE users` → 42501.
- **RPC**, com as assinaturas reais das migrations: `fn_log_food_and_return_remaining`, `fn_get_consumed_calories`, `fn_get_diet_summary` e `fn_calculate_age` (POST e GET) → todas **401 / 42501 permission denied for function**. As funções de trigger (`handle_new_user`, `trg_fn_*`) → 404, não são chamáveis via RPC.
- `GET /rest/v1/` (OpenAPI) → 401 "Secret API key required".

**Como authenticated** (JWT de usuário real + publishable key): `users`, `user_profiles`, `food_logs`, `nutrition_targets`, `vw_dashboard_user_stats` e RPC `fn_calculate_age` → todos **403 / 42501**.

**O backend (`torv_api`) continua lendo e escrevendo:** cadastro, `/profile`, meta do My Diet e aceite de sugestão funcionaram. O cadastro gerou `users` + perfil + medida + streak: o `/profile` da conta nova voltou com peso, altura, streak e username.

> Limite desta rodada: a checagem direta no catálogo (`has_table_privilege`/`pg_policies`/`pg_default_acl` via `DATABASE_URL`) foi bloqueada pelo classificador de permissões. O MCP do Supabase só enxerga outro projeto ("Portal Tradsul"), então não foi usado. Os default privileges para objetos futuros **não foram verificados** em runtime, só na leitura da migration.

## 4. Bundle web ✅

`GET localhost:8081/index.bundle?platform=web` → 200, 6,8 MB.

| Busca | Ocorrências |
|---|---|
| `supabase` | 0 |
| `supabase.co` | 0 |
| `sb_publishable` | 0 |
| `EXPO_PUBLIC_SUPABASE` | 0 |
| ref do projeto | 0 |
| `eyJ` | 2, ambas falso positivo (`_toPropertyKeyJs`), nenhum JWT |

A única env inlined é `EXPO_PUBLIC_API_URL` (`http://192.168.15.179:3000`), que não é segredo, conforme a spec.

## 5. Navegador (portal TorvWeb, Expo web, 412×906)

| Fluxo | Resultado |
|---|---|
| Cadastro completo (6 passos) | ✅ cai na Home, `localStorage` só tem `torv.session` |
| Reload | ✅ continua na Home com o perfil |
| Access token corrompido + reload | ✅ refresh transparente: o token foi substituído por um JWT novo e o perfil carregou |
| `expires_at` < 60 s + reload | ✅ refresh proativo, TTL novo de ~3590 s |
| Access corrompido + refresh_token inválido | ✅ volta pro Login e `torv.session` é apagado |
| Login com senha errada | ✅ "Email ou senha incorretos." |
| Login certo | ✅ Home |
| Logout | ⚠️ volta pro Login e limpa a sessão local, **mas o request dá 415 e não revoga** (#1) |

## 6. Regressão da calculadora ✅

- Conta nova (M, 31 anos, 80 kg, 180 cm, Intermediário, Ganhar Massa) → no 1º acesso ao My Diet a meta já veio calculada: **3101 kcal / P 233 / C 349 / G 86**. Não caiu no default de 2000.
- Mudar o nível no Profile → abre o modal "Nova meta sugerida • Seu nível físico mudou" com atual → sugerida (3723 → 3101). "Aplicar nova meta" → o My Diet mostra 3101.

---

## Rework sugerido

- **Front** (#1, bloqueante): `{}` no body do logout.
- **Back + Front** (#2, LOW): `maxLength: 100` em `name`/`username`.
- **Back** (#3, LOW): anotar `trustProxy` na checklist de deploy. Não precisa mudar código agora.

Na rodada 2, re-testar só o logout (revogação: refresh pós-logout → 401) e o #2, se for corrigido.
