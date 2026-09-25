# Security Review — Latência da API (Round 1)

- **Data:** 2026-09-25
- **Branch:** `perf/api-latency`
- **Escopo:** `630c2c0..HEAD`
  - `b33d2be`: redige a senha vazada no plano de migração
  - `3ed4b54`: front, Profile com `Promise.all`
  - `76f2998`: back, queries em paralelo em `diet.controller`, `profile.controller`, `nutritionSuggestion` e `profile.repository`
  - `29ba86b`: relatório de QA
- **Fora do diff, mas parte da feature:** `BackEndTorv/.env` (gitignored). O `DATABASE_URL` (`torv_api`) passou do pooler em modo transação (6543, `pgbouncer=true`) para o modo sessão (5432, `connection_limit=5`).
- **Pré-condição:** QA `qa-api-latency-2026-09-25.md`: PASS
- **Lente:** OWASP Top 10 (A01 authz, A02/A05 config, A04 DoS, A07 credenciais), mais a verificação do vazamento de senha (HIGH #1 do QA)
- **Veredito: PASS.**
  - O diff não introduz vulnerabilidade.
  - O HIGH #1 do QA (senha do `postgres` no histórico público) está **mitigado**: a senha foi rotacionada, o valor atual não é o vazado e o catálogo não tem sinal de persistência.
  - Ficam 2 LOW e itens de processo, nenhum bloqueante.

Nenhum segredo foi impresso nesta revisão. Os valores foram comparados só por prefixo de sha256, e a credencial vazada **não** foi usada.

---

## Achados

| # | Sev | Camada | OWASP | Achado | Bloqueia? |
|---|---|---|---|---|---|
| 1 | ~~HIGH~~ → **mitigado** | Infra/DB | A07 | A senha do `postgres` continua no histórico público (`faf2fb3`) e está **rotacionada**. Veja o resíduo de processo abaixo | não |
| 2 | LOW | Backend/env | A04 | Pool de 5 conexões + fan-out de 4 queries + nenhum rate limit nas rotas autenticadas: uma conta gratuita consegue esgotar o pool | não |
| 3 | LOW (pré-existente) | Backend/env | A02/A05 | `DATABASE_URL`/`DIRECT_URL` sem `sslmode`: o Prisma usa `prefer`, sem exigir TLS nem validar o certificado | não |
| 4 | INFO | Processo | A07 | O gitleaks padrão (8.30.1) **não** pega o vazamento de `faf2fb3`. A regra custom abaixo foi testada e pega | não |
| 5 | INFO | Backend/env | A01 | Modo sessão vs transação: sem vazamento de estado entre requests hoje. Há uma regra para o futuro | não |
| 6 | INFO | Database | — | Correção da rodada 2 do anon-exposure: `pgcrypto`/`uuid-ossp` têm o `postgres` como dono | não |

---

### 1. Vazamento da senha do `postgres`: mitigação confirmada

**O que vazou.**
- O commit `faf2fb3` (autor em 2026-09-15) adicionou, em `docs/superpowers/plans/2026-09-15-postgres-fastify-migration.md:785`, uma URL `postgresql://postgres.<ref>:[<senha>]@…pooler.supabase.com:6543`. A senha estava **entre colchetes**, no formato do template `[YOUR-PASSWORD]` do dashboard do Supabase.
- `faf2fb3` está em `origin/main` e em `origin/feat/calorie-macro-calculator`, e o repositório é público. A janela de exposição foi de ~10 dias, até a rotação.

**Verificação, sem usar a credencial vazada:**

| Checagem | Resultado |
|---|---|
| HEAD: todas as URLs `postgres(ql)://user:senha@` nos arquivos versionados | só placeholders (`***`, `<postgres-password>`, `<generated-password-1>`) ✅ |
| Histórico completo, **todas as refs**, linhas adicionadas e removidas | único literal real: o `postgres` de `faf2fb3` (removido em `b33d2be`). A senha do `torv_api` nunca vazou: só `<generated-password-1>` ✅ |
| sha256 da senha vazada (com e sem colchetes) vs a do `DIRECT_URL` atual no `.env` | **diferentes**: o `.env` já usa o valor novo ✅ |
| sha256 da senha vazada vs a do `DATABASE_URL` (`torv_api`) | diferentes (sem reuso) ✅ |
| Maestro: a senha vazada é recusada (`credentials for postgres are not valid`) e a nova conecta | informado. Não reproduzi, por política de não usar credencial vazada |

**Auditoria de persistência.** Quem teve o `postgres` (BYPASSRLS, CREATEROLE) durante a janela poderia ter deixado uma porta que sobrevive à rotação. Fiz uma leitura do catálogo como `torv_api`:

- **Roles:** só os padrão do Supabase, mais `torv_api` e `torv_analyst`. Nenhum role novo com LOGIN, SUPER ou BYPASSRLS. As memberships em `service_role`/`postgres`/`torv_api` são as padrão.
- **Event triggers:** só os 6 padrão do Supabase, com dono `supabase_admin`.
- **Funções no `public`:** as 7 conhecidas. O único `SECURITY DEFINER` é o `handle_new_user`, e nenhuma tem EXECUTE para `anon`, `authenticated` ou PUBLIC.
- **Objetos fora do `public`:** o `postgres` não é dono de nenhuma função, tabela ou view fora do `public` (fora as de extensão).
- **Triggers:** em `public.activities` estão só as 2 conhecidas. Em `auth.users`, só a `on_auth_user_created` (`handle_new_user`).
- **Policies:** só as 15 `torv_api_full_access` (`{torv_api}`, `true`). Nenhuma policy extra.
- **Grants e RLS:** nenhum grant de tabela, view ou sequence para `anon`/`authenticated`/PUBLIC, e o RLS está ligado em todas as tabelas.
- **Extensões:** `pg_stat_statements`, `pgcrypto`, `uuid-ossp`, `plpgsql` e `supabase_vault`, todas padrão. Não há `pg_cron` nem `pg_net`.
- **Limite:** o `torv_api` não lê o schema `auth` nem os logs. Contas criadas direto em `auth.users` e conexões antigas ficam fora desta checagem (ver o que resta a fazer).

**O que ainda resta (processo, sem bloquear):**

1. **Regra custom no gitleaks (#4).** O `gitleaks git --log-opts=--all` padrão encontrou 7 achados, e **nenhum** era o de `faf2fb3`.
   - A regra genérica de URL de conexão não casa uma senha entre colchetes.
   - Testei a regra abaixo com `--log-opts=--all`: pega `faf2fb3:…:785` e não gera falso positivo no HEAD.
   - Sugestão: versionar como `.gitleaks.toml` na raiz e rodar num pre-commit ou no CI.
   ```toml
   [extend]
   useDefault = true

   [[rules]]
   id = "postgres-url-password"
   description = "Postgres connection URL with inline password"
   regex = '''postgres(?:ql)?://[^:/@\s'"]+:([^@\s'"]{4,})@'''
   secretGroup = 1
   keywords = ["postgres://", "postgresql://"]
   [[rules.allowlists]]
   regexTarget = "secret"
   regexes = ['''^(\*+|<[a-z0-9-]+>|\[[A-Z][A-Z_-]*\]|\$\{?[A-Z_]+\}?)$''']
   ```
   A allowlist aceita `[YOUR-PASSWORD]` (maiúsculas) mas **não** `[senhaReal$…]`. Foi exatamente isso que escapou.
2. **Nota do canvas `database-url-postgresql-pos`.** Não está conectada a este recruta, então não consegui ler.
   - O Maestro deve conferir se ela tem alguma senha literal, vazada ou nova, e trocar por um placeholder.
   - As notas do Maestri são locais (não são públicas), mas não devem guardar a senha do `postgres`.
3. **Outros segredos em `docs/` e arquivos soltos.** Varri com a regra custom e o gitleaks padrão: `docs/` (HEAD e não versionados), `graphify-out/`, `.maestri/`, `.claude/`, `orchestration.md` e `docs/politica-de-seguranca*.md`.
   - O único achado é o valor sintético `senhaSegura123`, que já foi avaliado no calorie-calculator rounds 5 e 6.
   - Ele aparece em `docs/qa-calorie-…-round8.md`, `docs/security-calorie-…-round5/6.md` e nos commits antigos `caf73fc`/`a647fef`. Pelo hash, os dois commits antigos têm o mesmo valor.
   - Não é credencial real.
4. **Checagem que só o usuário consegue fazer:** no dashboard do Supabase, ver em Auth → Users se há contas desconhecidas, e nos logs do Postgres se houve conexões do `postgres` vindas de IPs estranhos entre 15/09 e a rotação (a retenção de log pode já ter apagado a janela). Também confirmar que a senha vazada **não era reutilizada** em nenhum outro serviço.
5. **Reescrever o histórico continua opcional.** O valor morreu com a rotação, e reescrever só apaga o registro.

---

### 2. LOW: DoS por pool pequeno

- `connection_limit=5` e `pool_timeout` padrão (10 s).
- O `GET /profile` agora abre 4 queries ao mesmo tempo, e a tela Profile abre 6.
- O `@fastify/rate-limit` só está registrado dentro do plugin `/auth`. As rotas `/profile` e `/diet` não têm limite nenhum.
- **Cenário:** uma conta gratuita (o cadastro permite 10 por minuto por IP) dispara ~50 `GET /profile` em paralelo, o que dá ~200 queries na fila de 5 conexões. Depois de 10 s, o Prisma devolve P2024, e **todos os usuários** recebem 500 enquanto a rajada durar.
- O QA mediu 10 requests em paralelo terminando em 1,0 s sem erro. O teto existe, só não foi atingido.
- A causa já existia antes (API autenticada sem rate limit). Este diff barateia o ataque: o pool é ~3× menor que o default anterior do Prisma, que era `cpus*2+1`, e o fan-out subiu.
- No modo sessão, o Supavisor também tem limite de clientes por projeto. Várias instâncias do backend, ou dev e prod juntos, podem esgotar esse limite.
- **Ação:** entra no backlog junto do LOW #4 do anon-exposure. Registrar o `@fastify/rate-limit` também para as rotas autenticadas, com `hook: 'preHandler'` e `keyGenerator: req => req.user.userId`. Deixar `pool_timeout` explícito e dimensionar `connection_limit` pelo pool size do modo sessão do projeto. A sugestão de 8 do QA serve se couber no limite do Supavisor.

### 3. LOW (pré-existente): TLS com o banco não é exigido

- `DATABASE_URL`: host `…pooler.supabase.com:5432`, com o parâmetro `connection_limit=5` e sem `sslmode`.
- `DIRECT_URL`: sem nenhum parâmetro.
- Sem `sslmode`, o Prisma usa `prefer`: tenta TLS, mas aceita cair para texto puro e não valida o certificado. Um atacante de rede entre o backend e o pooler pode forçar o downgrade e ler ou alterar o tráfego.
- A senha não trafega em claro, porque o SCRAM a protege, mas os dados sim.
- Já era assim com a URL 6543, então não foi introduzido agora.
- **Ação:** adicionar `sslmode=require` nas duas URLs e ligar "Enforce SSL on incoming connections" no Supabase (Database → Settings). Para o nível seguinte: o certificado CA do Supabase com `sslaccept=strict`.

### 4. INFO: gitleaks

Veja o item 1 do "O que ainda resta".

### 5. INFO: modo sessão vs transação (isolamento entre requests)

- **No modo sessão**, cada conexão do pool do Prisma fica presa a uma conexão de servidor dedicada enquanto existir. Se houvesse estado de sessão, ele passaria **entre requests do próprio backend**, que rodam todas como `torv_api`.
- **No modo transação**, esse estado podia vazar para **outros clientes** do pooler. Nesse ponto, o modo sessão é mais isolado, e não menos.
- **Não há estado de sessão hoje:**
  - O código não usa `SET`, `SET ROLE`, `set_config`, tabelas temporárias, advisory locks, `LISTEN` nem transações interativas.
  - O `$queryRaw` usa template tag (parametrizado).
  - O único `SET` é o atributo `SET search_path = public` do `handle_new_user`, que vale só dentro da função.
  - As prepared statements do Prisma são por conexão e só têm o texto da query, sem dado de usuário. Isso é exatamente o que o modo sessão permite: o `pgbouncer=true` saiu corretamente.
- **Não há contexto por usuário no banco:** as policies são `USING (true)` para o `torv_api`, e a autorização fica no app.
- **Regra para o futuro:** se um dia o RLS passar a ser por usuário, com `set_config('request.jwt.claims', …)` ou `SET ROLE`, use **sempre** `set_config(..., true)` (`is_local`) dentro de uma `$transaction`. Com `false`, a identidade de um usuário fica na conexão e é herdada pela próxima request de outro usuário.

### 6. INFO: correção de uma afirmação da rodada 2 do anon-exposure

- Lá eu disse que extensões no Supabase ficam com o `supabase_admin` como dono. O catálogo mostra que `pgcrypto`, `uuid-ossp` e `pg_stat_statements` têm o **`postgres`** como dono (no schema `extensions`).
- As funções que já existem não mudam, porque o revoke global só vale para objetos novos.
- Numa extensão nova criada como `postgres` fora do `public`, as funções podem nascer sem EXECUTE para o `torv_api`. O efeito é fail-closed: dá erro visível, e um `GRANT EXECUTE … TO torv_api` na migration resolve.
- O veredito daquela rodada não muda.

---

## Diff: verificado OK

- **Authz preservada:**
  - Todas as rotas alteradas leem `userId` só de `request.user`, que o `auth.middleware` preenche no `preHandler` de `/diet` e `/profile` a partir do `sub` do JWT validado por JWKS.
  - Nenhum `userId` vem de `params`, `body` ou `query`.
  - Nas funções alteradas, toda query dentro do `Promise.all` filtra pelo **mesmo** `userId`.
  - `getUserProfile`: 4 leituras (`users.id`, `user_profiles.user_id`, `user_streaks.user_id`, `user_measurements.user_id` + `take 1` via `findFirst`) com o mesmo `userId`. O shape e as colunas de `users` (`id`, `email`, `auth_provider`, `created_at`) são idênticos aos do `include`, então nenhum campo novo foi exposto e nenhum dado de outro usuário entra. O único chamador é `profile.controller.js:31`.
  - `buildSuggestion` e `ensureTargets` recebem `request.user.userId` (`diet.controller.js:210`, `profile.controller.js:145`).
- **Erros:**
  - O `Promise.all` rejeita com o primeiro erro e trata as demais rejeições, então não há `unhandledRejection` para derrubar o processo.
  - Os `catch` continuam respondendo mensagens fixas (500 genérico, 409 `Username is already taken` via P2002). Nenhum `error.message` ou `meta` do Prisma vai ao cliente.
  - O `request.log.error` loga o erro do Prisma, que no máximo traz o uuid e a data do próprio usuário, sem segredo.
- **Timing:**
  - O `getUserProfile` de um usuário inexistente agora roda as 4 queries e depois devolve `null`, então não sai mais cedo. Mesmo assim, não é um oráculo útil, porque o `userId` vem do próprio token.
  - Nenhuma rota do diff compara segredo.
- **Corrida em `ensureTargets` ∥ `buildSuggestion`:** a meta é criada só se não existe linha. No pior caso sai um P2002, que é engolido (o QA testou em conta nova). A integridade é garantida pelo UNIQUE no banco. Isso não gera escalada nem dado cruzado.
- **`PUT /profile`:** a escrita em `updateProfile` em paralelo com a leitura em `getLatestMeasurement` não muda a atomicidade: antes também não havia transação, e o estado parcial numa falha é o mesmo.
- **Front `Profile`:**
  - As 2 requests em paralelo passam pelos interceptors existentes. O refresh proativo e o refresh no 401/403 continuam em chamada única, então duas 401 simultâneas fazem 1 refresh e 2 retries.
  - Nenhum token é logado. O achado #3 do QA é só funcional.
- **`b33d2be`:** redige corretamente a linha 785 no HEAD. A linha 777 já era placeholder.

---

## Backlog acumulado (só anotado)

| Origem | Sev | Item |
|---|---|---|
| este round #2 + anon-exposure #4 | LOW | Rate limit em rotas autenticadas (por `userId`), `pool_timeout`, `connection_limit` vs limite do Supavisor |
| este round #3 | LOW | `sslmode=require` nas URLs e "Enforce SSL" no Supabase |
| este round #1/#4 | processo | `.gitleaks.toml` com `postgres-url-password` + pre-commit/CI. Conferir a nota do canvas, Auth → Users, logs e reuso de senha |
| anon-exposure #2 | LOW | Cota por IP do GoTrue compartilhada |
| anon-exposure #5–#9 + storage | INFO | Sem mudança |
