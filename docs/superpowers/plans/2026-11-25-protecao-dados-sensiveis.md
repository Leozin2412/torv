# Proteção de dados sensíveis (LGPD) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Neste projeto a execução é pelos recruits do Maestri (`maestri ask`), um por vez.** Se o CLI `maestri` não estiver disponível na sessão, usar os subagentes `torv-*` equivalentes e registrar isso no documento de revisão.

**Goal:** nenhum dado de perfil vai para os metadados/JWT do Supabase Auth, o e-mail só existe em `auth.users`, peso/altura/frequência cardíaca/rota/parciais/`basis_json` ficam cifrados (AES-256-GCM) no banco e o UXCam grava todas as telas desfocadas — sem mudar o contrato da API.

**Architecture:**
- **Backend:** módulo `lib/fieldCrypto.js` (`node:crypto`), usado só pelos repositórios (cifram na escrita, decifram na leitura). O cadastro deixa de mandar metadados ao GoTrue e grava o perfil pelo Prisma logo depois do signup; falha apaga a conta no Auth. `GET /profile` lê o e-mail do token.
- **Banco:** uma migration troca as colunas cifradas para `TEXT`, remove 3 CHECKs e `users.email`, e reduz o `handle_new_user` a inserir só `public.users`.
- **Frontend:** `App.tsx` passa `occlusions: [new UXBlur()]` ao UXCam.
- **Testes com usuários:** Supabase local (Supabase CLI + Docker). No fim, o backend local volta para a produção.

**Tech Stack:** Node 24 + Fastify 5 + TypeBox, Prisma 6 (Postgres/Supabase), `node --test` (`npm test` em `BackEndTorv`); React Native/Expo 57 com `react-native-ux-cam` 6.0.25; Supabase CLI + Docker 29.9.

**Spec:** `docs/superpowers/specs/2026-11-25-protecao-dados-sensiveis-design.md`

## Global Constraints

- **Branch:** `feature/criptografia-dados-sensiveis`. Nada de push até a Task 11.
- **Execução estritamente sequencial:** um recruit por vez; cada task só começa com a anterior verde.
- **Commits:** Conventional Commits em português, um por task, só os arquivos da task, com pathspec explícito; nunca `.env`, `revisar*.md`, `node_modules`, `package-lock.json` alterado por `npm ci`; linha final dos recruits: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Chave:** env `DATA_ENCRYPTION_KEY` = 32 bytes em base64. A chave de produção nunca aparece no chat, no código, no git, em log ou em saída de comando. Testes e o Supabase local usam chaves descartáveis geradas na hora.
- **Formato da cifra:** `v1.<iv>.<tag>.<cifra>`, base64url, IV de 12 bytes aleatório por chamada, tag GCM de 16 bytes, conteúdo = `JSON.stringify(valor)`. `null`/`undefined` → coluna `NULL`.
- **AAD:** `<tabela>.<coluna>:<user_id do dono da linha>`.
- **Campos cifrados (exatamente):** `user_measurements.weight_kg`, `user_measurements.height_cm`, `activity_gps_data.avg_hr`, `activity_gps_data.max_hr`, `activity_gps_data.splits`, `activity_gps_data.route`, `nutrition_targets.basis_json`. Gênero e nascimento ficam legíveis.
- **Erros:** falha ao decifrar → 500 genérico; mensagem de erro nunca contém valor, cifra, AAD ou `user_id`. Nunca logar corpo de requisição nem valor decifrado.
- **Contrato da API inalterado** (mesmos schemas de resposta). O app só muda no `App.tsx` (UXCam).
- **Usuários de teste só no Supabase local.** Nenhuma conta de QA na produção, exceto a conta real do desenvolvedor no teste final (Task 12).
- **Produção:** migration e deploy só com autorização explícita do responsável (o desenvolvedor), na Task 12.

## Review Focus

1. **Valor cifrado corrompido ou chave trocada** (alguém mexeu no banco; chave errada no `.env`): a rota responde 500 genérico, sem cifra, valor ou `user_id` no corpo e no log. Coberto em `fieldCrypto.test.js` (mensagem do erro) e no teste de rota de `GET /profile` com decifração falhando (Task 4).
2. **Campos opcionais nulos** (medida sem altura; GPX sem frequência cardíaca): continuam `null` de ponta a ponta, nunca a string `"null"` cifrada. Coberto em `fieldCrypto.test.js` e nos testes de repositório de medida e GPS (Task 4).
3. **Peso com casa decimal** (`60.5`): volta como número `60.5`, não string nem `Decimal`, e a conta de calorias usa o mesmo valor. Coberto no teste de `getCalcInputs` (Task 4).
4. **Cadastro refeito de conta não confirmada com dados diferentes:** o perfil é atualizado e fica **uma** medida só. Coberto no teste de `saveSignupProfile` (Task 5).
5. **Username tomado entre o pre-check e a gravação:** a conta no Auth é apagada e a resposta é 409 `USERNAME_TAKEN`. Coberto no teste de rota (Task 5).

---

### Task 1: Backend — `lib/fieldCrypto.js` e checagem da chave no boot

**Recruit:** Torv Backend · **Files:**
- Create: `BackEndTorv/src/lib/fieldCrypto.js`
- Test: `BackEndTorv/src/lib/tests/fieldCrypto.test.js`
- Modify: `BackEndTorv/server.js` (chamar `assertKey()` no carregamento, antes de registrar rotas)
- Create/Modify: `BackEndTorv/.env.example` (listar todas as envs do `CLAUDE.md` + `DATA_ENCRYPTION_KEY`, todas sem valor)

**Interfaces:**
- Produces:
  - `encryptField(value: any, ctx: { table: string, column: string, userId: string }): string | null`
  - `decryptField(text: string | null, ctx: { table: string, column: string, userId: string }): any | null`
  - `assertKey(): void` — lança `Error('DATA_ENCRYPTION_KEY ausente ou inválida: precisa de 32 bytes em base64')`.

- [ ] **Step 1: Baseline**

Run: `cd BackEndTorv && npm ci && npm test` → anotar o total (tudo PASS).

- [ ] **Step 2: Escrever o teste que falha**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const newKey = () => crypto.randomBytes(32).toString('base64');
process.env.DATA_ENCRYPTION_KEY = newKey();
const { encryptField, decryptField, assertKey } = require('../fieldCrypto');

const USER = '11111111-1111-4111-8111-111111111111';
const ctx = { table: 'user_measurements', column: 'weight_kg', userId: USER };
const FORMAT = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

test('ida e volta: número, decimal, array e objeto', () => {
  const route = Array.from({ length: 500 }, (_, i) => [-23.5 + i / 1e5, -46.6]);
  for (const v of [165, 60.5, route, [{ km: 1, distance_m: 1000, duration_sec: 300 }], { age: 30, weight_kg: 60.5 }]) {
    const c = encryptField(v, ctx);
    assert.match(c, FORMAT);
    assert.deepEqual(decryptField(c, ctx), v);
  }
});

test('null e undefined não são cifrados', () => {
  assert.equal(encryptField(null, ctx), null);
  assert.equal(encryptField(undefined, ctx), null);
  assert.equal(decryptField(null, ctx), null);
});

test('IV aleatório: o mesmo valor cifra diferente', () => {
  assert.notEqual(encryptField(60.5, ctx), encryptField(60.5, ctx));
});

test('AAD: outra coluna, tabela ou usuário não decifra', () => {
  const c = encryptField(60.5, ctx);
  assert.throws(() => decryptField(c, { ...ctx, column: 'height_cm' }));
  assert.throws(() => decryptField(c, { ...ctx, table: 'nutrition_targets' }));
  assert.throws(() => decryptField(c, { ...ctx, userId: '22222222-2222-4222-8222-222222222222' }));
});

test('adulterado, versão desconhecida ou lixo → erro sem vazar conteúdo', () => {
  const c = encryptField(60.5, ctx);
  const [v, iv, tag, ct] = c.split('.');
  const flippedTag = [v, iv, (tag[0] === 'A' ? 'B' : 'A') + tag.slice(1), ct].join('.');
  for (const bad of [flippedTag, 'v2' + c.slice(2), 'v1.x', '60.5']) {
    assert.throws(() => decryptField(bad, ctx), (err) =>
      !err.message.includes(bad) && !err.message.includes(USER) && !err.message.includes('60.5'));
  }
});

test('chave trocada não decifra', (t) => {
  const c = encryptField(60.5, ctx);
  const saved = process.env.DATA_ENCRYPTION_KEY;
  t.after(() => { process.env.DATA_ENCRYPTION_KEY = saved; });
  process.env.DATA_ENCRYPTION_KEY = newKey();
  assert.throws(() => decryptField(c, ctx));
});

test('assertKey: ausente, curta ou inválida → erro que não mostra o valor', (t) => {
  const saved = process.env.DATA_ENCRYPTION_KEY;
  t.after(() => { process.env.DATA_ENCRYPTION_KEY = saved; });
  assert.doesNotThrow(() => assertKey());
  for (const bad of [undefined, '', crypto.randomBytes(16).toString('base64'), 'não-é-base64!!']) {
    if (bad === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = bad;
    assert.throws(() => assertKey(), (err) => /DATA_ENCRYPTION_KEY/.test(err.message) && (!bad || !err.message.includes(bad)));
  }
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/lib/tests/fieldCrypto.test.js`
Expected: FAIL com `Cannot find module '../fieldCrypto'`.

- [ ] **Step 4: Implementar `fieldCrypto.js`**

`aes-256-gcm` do `node:crypto`. A chave é lida de `process.env` a cada chamada (troca de env nos testes funciona); base64 que não decodifica para exatamente 32 bytes é inválida. `setAAD(Buffer.from(\`${table}.${column}:${userId}\`))`. Toda falha de decifração vira `Error('falha ao decifrar campo')`. `server.js` chama `assertKey()` logo depois de carregar o `.env`.

- [ ] **Step 5: Rodar e ver passar**

Run: `cd BackEndTorv && npm test`
Expected: PASS (baseline + 7). Os testes que sobem o `server.js` (se houver) precisam da env: definir uma chave descartável no próprio teste, nunca uma fixa no código.

- [ ] **Step 6: Revisão de segurança da task**

Anotar no retorno: IV nunca reaproveitado (gerado por chamada); tag verificada antes de devolver qualquer dado; nenhuma mensagem/log com chave, valor, cifra ou AAD; `.env.example` sem nenhum valor real; nenhuma dependência nova.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(lgpd): módulo de criptografia de campos e checagem da chave no boot" -- BackEndTorv/src/lib/fieldCrypto.js BackEndTorv/src/lib/tests/fieldCrypto.test.js BackEndTorv/server.js BackEndTorv/.env.example
```

---

### Task 2: Ambiente — Supabase local (CLI + Docker)

**Executor:** Maestro · **Files:** nenhum no repositório. Pasta local: `C:\Users\Leonardo\torv-supabase-local\` (fora do git).

- [ ] **Step 1: Instalar o Supabase CLI**

Baixar a última release `supabase_windows_amd64.tar.gz` de `https://github.com/supabase/cli/releases`, extrair `supabase.exe` em `C:\Users\Leonardo\bin\` (já está no PATH; criar a pasta). Run: `supabase --version` → versão impressa.

- [ ] **Step 2: Projeto local**

Em `C:\Users\Leonardo\torv-supabase-local`: `supabase init`; `supabase gen signing-key --algorithm ES256` (o middleware valida JWT pelo JWKS, como na produção). No `supabase/config.toml`:
- `[auth] signing_keys_path = "./signing_keys.json"`;
- `[auth.email] enable_confirmations = true`, `otp_length = 6`;
- `[auth.email.template.confirmation]` com `content_path` para um HTML que contenha `{{ .Token }}` (o código aparece no Mailpit);
- `[auth.rate_limit] email_sent` alto o bastante para os testes.

- [ ] **Step 3: Subir e preparar o banco**

`supabase start` → anotar API `http://127.0.0.1:54321`, banco `54322`, Mailpit `http://127.0.0.1:54324` e as chaves **locais** (padrão de desenvolvimento; ainda assim, fora do git). No banco local, como `postgres`, espelhar o papel da produção:

```sql
create role torv_api login password 'torv_api_local';
grant usage on schema public to torv_api;
alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to torv_api;
alter default privileges for role postgres in schema public grant execute on functions to torv_api;
```

Depois, em `BackEndTorv`, com `DIRECT_URL`/`DATABASE_URL` locais só no ambiente do comando: `npx prisma migrate deploy` → todas as migrations atuais aplicadas.

- [ ] **Step 4: `.env` local do backend**

Criar `BackEndTorv/.env` apontando para o Supabase local (`DATABASE_URL` com `torv_api`, `DIRECT_URL` com `postgres`, `SUPABASE_URL`, `PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET=pictures`, `DATA_ENCRYPTION_KEY` descartável). Criar o bucket `pictures` local. Subir o backend no Furnace → `GET /documentation` responde.

---

### Task 3: Banco — migration e schema Prisma

**Recruit:** Torv Database · **Files:**
- Create: `BackEndTorv/prisma/migrations/20261125120000_protect_sensitive_data/migration.sql`
- Modify: `BackEndTorv/prisma/schema.prisma` (`users`, `user_measurements`, `activity_gps_data`, `nutrition_targets`)

**Interfaces:**
- Produces (tipos Prisma): `user_measurements.weight_kg String? @db.Text`, `height_cm String? @db.Text`; `activity_gps_data.avg_hr String? @db.Text`, `max_hr String? @db.Text`, `splits String @db.Text`, `route String @db.Text`; `nutrition_targets.basis_json String? @db.Text`; `users` sem `email`.

- [ ] **Step 1: Consulta que falha (estado atual)**

No banco local:

```sql
select table_name, column_name, data_type from information_schema.columns
where table_schema='public' and (table_name, column_name) in (('user_measurements','weight_kg'),('user_measurements','height_cm'),
 ('activity_gps_data','avg_hr'),('activity_gps_data','max_hr'),('activity_gps_data','splits'),('activity_gps_data','route'),
 ('nutrition_targets','basis_json'),('users','email'));
```

Expected agora: tipos `numeric`/`integer`/`smallint`/`jsonb` e a linha `users.email`. Meta: as 7 em `text` e nenhuma `users.email`.

- [ ] **Step 2: Migration**

- `ALTER COLUMN ... TYPE text USING NULL` nas 7 colunas (tabelas vazias; `splits`/`route` mantêm `NOT NULL` — usar `DROP NOT NULL`, trocar o tipo, `SET NOT NULL`);
- `DROP CONSTRAINT` `user_measurements_weight_kg_check`, `user_measurements_height_cm_check`, `activity_gps_data_hr_check`;
- `ALTER TABLE users DROP COLUMN email` (o índice único sai junto);
- `CREATE OR REPLACE FUNCTION public.handle_new_user()` (mesmo `SECURITY DEFINER` e `search_path`) inserindo só `public.users (id, auth_provider, created_at)` com `'email'` e `now()`;
- comentário de uma linha no topo: por que os tipos mudaram (spec, seção C).

- [ ] **Step 3: Aplicar no local e conferir**

`npx prisma migrate deploy` (local) e `npx prisma validate`. Rodar a consulta do Step 1 → 7 linhas `text`, nenhuma `users.email`. `select pg_get_functiondef('public.handle_new_user'::regproc)` → só o insert em `users`. `has_function_privilege('anon', 'public.handle_new_user()', 'execute')` → `false` (o lock-down continua).

- [ ] **Step 4: Revisão de segurança da task**

O `handle_new_user` não lê mais `raw_user_meta_data`; os privilégios da função não mudaram (`CREATE OR REPLACE` preserva); nenhuma política RLS alterada; nenhum dado sensível em comentário ou default.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(lgpd): colunas cifradas em texto, sem e-mail duplicado e trigger mínimo" -- BackEndTorv/prisma/schema.prisma BackEndTorv/prisma/migrations/20261125120000_protect_sensitive_data/migration.sql
```

---

### Task 4: Backend — repositórios cifram e decifram

**Recruit:** Torv Backend · **Files:**
- Modify: `BackEndTorv/src/repository/profile.repository.js` (`getUserProfile`, `getLatestMeasurement`, `addMeasurement`)
- Modify: `BackEndTorv/src/repository/diet.repository.js` (`getCalcInputs`, `getNutritionTargets`, `updateTargetsBasis`, `upsertNutritionTargets`)
- Modify: `BackEndTorv/src/repository/gps.repository.js` (`createGpsActivity`, `getGpsActivity` e qualquer retorno com `activity_gps_data`)
- Test: `BackEndTorv/src/repository/tests/profile.repository.test.js` (novo), `BackEndTorv/src/repository/tests/diet.repository.test.js` (novo), `BackEndTorv/src/repository/tests/gps.repository.test.js` (estender)
- Test: `BackEndTorv/src/routes/tests/profile.routes.test.js` (500 genérico)

**Interfaces:**
- Consumes: `encryptField`, `decryptField` (Task 1); tipos `String` da Task 3.
- Produces: as funções mantêm assinatura e formato de retorno; medidas e métricas voltam como números/arrays/objetos (`weight_kg: 60.5`, `height_cm: 165`, `avg_hr: 150`, `splits: [...]`, `route: [...]`, `basis_json: {...}`).

- [ ] **Step 1: Testes que falham** (Prisma falso via `require.cache`, como em `gps.repository.test.js`)

- `addMeasurement(USER, { weight_kg: 60.5, height_cm: null })` → o Prisma recebe `weight_kg` casando `/^v1\./` e `height_cm: null`.
- `getLatestMeasurement` / `getUserProfile` com linha cifrada por `encryptField(60.5, { table: 'user_measurements', column: 'weight_kg', userId: USER })` → devolvem `60.5` (`typeof === 'number'`).
- `getCalcInputs` → `weightKg === 60.5`, `heightCm === 165`.
- `updateTargetsBasis` / `upsertNutritionTargets` → `basis_json` gravado como `v1.`; `getNutritionTargets` devolve o objeto original; `basis_json: null` continua `null`.
- `createGpsActivity` → `avg_hr`, `max_hr`, `splits`, `route` gravados como `v1.` (com `avg_hr: null` → `null`); `getGpsActivity` devolve os valores originais.
- Linha com cifra de **outro** `user_id` → a leitura lança (o AAD amarra ao dono).
- Rota `GET /profile` com `profileRepository.getUserProfile` lançando `Error('falha ao decifrar campo')` → 500, corpo sem `v1.` e sem o `user_id`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && node --test src/repository/tests/ src/routes/tests/profile.routes.test.js`
Expected: FAIL nos casos novos (o Prisma recebe o valor puro).

- [ ] **Step 3: Implementar**

Cifrar no `data` antes de cada escrita e decifrar no resultado de cada leitura, com `ctx = { table, column, userId }`. No GPS, o `userId` é o do dono da atividade (o mesmo do `where`). Remover as conversões de `Decimal` que deixarem de ser necessárias no controller (`Number(...)` sobre número continua inofensivo).

- [ ] **Step 4: Rodar e ver passar**

Run: `cd BackEndTorv && npm test`
Expected: PASS (total da Task 1 + novos).

- [ ] **Step 5: Revisão de segurança da task**

Nenhum caminho grava os 7 campos sem `encryptField` (`grep -n "weight_kg\|height_cm\|avg_hr\|max_hr\|splits\|route\|basis_json" src/repository` conferido); nenhum `console`/`log` com valor decifrado; autorização intacta (o `where` com `user_id` continua em toda leitura).

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(lgpd): repositórios cifram medidas, métricas de GPS e base da dieta" -- BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/repository/diet.repository.js BackEndTorv/src/repository/gps.repository.js BackEndTorv/src/repository/tests/profile.repository.test.js BackEndTorv/src/repository/tests/diet.repository.test.js BackEndTorv/src/repository/tests/gps.repository.test.js BackEndTorv/src/routes/tests/profile.routes.test.js
```

---

### Task 5: Backend — cadastro sem metadados e e-mail do token

**Recruit:** Torv Backend · **Files:**
- Modify: `BackEndTorv/src/lib/authProvider.js` (`signUp`, novo `deleteUser`)
- Modify: `BackEndTorv/src/repository/profile.repository.js` (novo `saveSignupProfile`)
- Modify: `BackEndTorv/src/controller/auth.controller.js` (`register`)
- Modify: `BackEndTorv/src/controller/profile.controller.js` (e-mail de `request.user.email`)
- Modify: `BackEndTorv/src/routes/auth.routes.js` (descrição do `/register` no Swagger)
- Test: `src/lib/tests/authProvider.test.js`, `src/routes/tests/auth.routes.test.js`, `src/routes/tests/profile.routes.test.js`, `src/repository/tests/profile.repository.test.js`

**Interfaces:**
- Consumes: `encryptField` (Task 1).
- Produces:
  - `authProvider.signUp(email: string, password: string): Promise<{ session: Session | null, userId: string | null, swallowed?: string }>` — `userId = data.user?.id ?? data.id ?? null`; o corpo enviado ao GoTrue é só `{ email, password }`.
  - `authProvider.deleteUser(userId: string): Promise<void>` — `DELETE ${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}` com `apikey` e `Authorization: Bearer` = `SUPABASE_SECRET_KEY` (mesmo padrão de `imageUpload.js`); 200/404 = ok; outro status ou rede → `AuthError('PROVIDER')`.
  - `profileRepository.saveSignupProfile(userId: string, data: { username, name, birth_date, gender, fitness_level, goal, weight_kg, height_cm }): Promise<void>` — numa `$transaction`: `user_profiles.upsert`; `user_measurements.deleteMany({ where: { user_id } })` + `create` cifrado; `user_streaks.upsert` (create `{ current_streak: 0, longest_streak: 0 }`, update `{}`).

- [ ] **Step 1: Testes que falham**

- `authProvider`: `signUp` envia corpo sem `data`; devolve `userId` nos dois formatos do GoTrue (com sessão: `user.id`; sem sessão: `id` no topo); `deleteUser` monta URL/headers certos, aceita 404 e lança `PROVIDER` em 500 sem vazar detalhe.
- `saveSignupProfile`: a ordem das chamadas é upsert do perfil → `deleteMany` → `create` (cifrado) → upsert do streak, tudo dentro da transação; chamado duas vezes para o mesmo usuário com pesos diferentes → a segunda grava só o peso novo (Review Focus 4).
- Rota `/auth/register` (substitui o teste "mapeia metadata pro que handle_new_user lê"):
  - 201: `signUp` chamado com 2 argumentos; `saveSignupProfile` recebe `userId` e os dados validados (`weight_kg: 60.5`, `height_cm: 165`, `birth_date: '1995-04-10'`);
  - sem `username` → `saveSignupProfile` recebe `username: 'user_' + userId.slice(0, 8)`;
  - `saveSignupProfile` lança erro Prisma `P2002` em `username` → `deleteUser(userId)` chamado e 409 `{ code: 'USERNAME_TAKEN' }` (Review Focus 5);
  - outro erro → `deleteUser` chamado e 502; se o `deleteUser` também falhar, ainda 502 e o log só tem o código;
  - `swallowed` (sem `userId`) → `saveSignupProfile` **não** chamado e 201 como hoje.
- `GET /profile`: middleware falso com `request.user = { userId: USER, email: 'ana@torvtest.dev' }` e linha do repositório **sem** `email` → resposta `email === 'ana@torvtest.dev'`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd BackEndTorv && npm test`
Expected: FAIL nos testes novos/alterados.

- [ ] **Step 3: Implementar**

Interfaces acima. No `register`, a validação atual continua antes de tudo; o `birth_date` vai como `new Date(birth_date)` para a coluna `@db.Date`. A descrição do Swagger passa a dizer que o backend grava perfil/medida/streak depois do signup.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd BackEndTorv && npm test` → PASS, sem nenhum teste antigo de acesso negado removido.

- [ ] **Step 5: Revisão de segurança da task**

O corpo do signup não tem dado de perfil; a chave secreta só vai no header do `deleteUser`, nunca em log; `deleteUser` só é chamado com o `userId` devolvido pelo GoTrue nesta requisição; nenhum log com corpo, e-mail ou senha; `GET /profile` não expõe nada além do que já expunha.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(lgpd): cadastro grava o perfil no backend sem metadados no Auth" -- BackEndTorv/src/lib/authProvider.js BackEndTorv/src/repository/profile.repository.js BackEndTorv/src/controller/auth.controller.js BackEndTorv/src/controller/profile.controller.js BackEndTorv/src/routes/auth.routes.js BackEndTorv/src/lib/tests/authProvider.test.js BackEndTorv/src/routes/tests/auth.routes.test.js BackEndTorv/src/routes/tests/profile.routes.test.js BackEndTorv/src/repository/tests/profile.repository.test.js
```

---

### Task 6: Frontend — UXCam com desfoque em todas as telas

**Recruit:** Torv Frontend · **Files:**
- Modify: `FrontEndTorv/App.tsx` (bloco do UXCam, ~L14-23)

- [ ] **Step 1: Ler a doc do SDK instalado** (`node_modules/react-native-ux-cam/src/index.d.ts` e `UXCamOcclusion.tsx`, versão 6.0.25) e a doc do Expo v56 (`FrontEndTorv/AGENTS.md`).
- [ ] **Step 2: Implementar** — `startWithConfiguration({ userAppKey, enableAutomaticScreenNameTagging: false, occlusions: [new UXBlur()] })`, mantendo `occludeAllTextFields(true)`. Importar `UXBlur` do pacote. Trocar o comentário "Ainda é preciso mascarar..." por uma linha dizendo que todas as telas são gravadas desfocadas (LGPD).
- [ ] **Step 3: Verificar** — `cd FrontEndTorv && npx tsc --noEmit && node --test src/utils/*.test.mjs` → sem erros. Sem teste automatizado: o SDK é nativo; a prova é no aparelho (Task 12).
- [ ] **Step 4: Revisão de segurança** — nenhum `setUserIdentity`/propriedade de usuário; a chave do UXCam continua só no `.env`.
- [ ] **Step 5: Commit** — `feat(lgpd): UXCam grava todas as telas desfocadas` -- `FrontEndTorv/App.tsx`.

---

### Task 7: Teste da feature (Supabase local)

**Recruit:** Torv Review and Tests · **Files:**
- Create: `docs/qa-protecao-dados-sensiveis-2026-11-25.md`

- [ ] **Step 1: Automatizados e revisão multi-lente** — `npm test` (backend), `npx tsc --noEmit` e `node --test src/utils/*.test.mjs` (front); revisar `git diff main..HEAD` com a Review Focus em mãos.
- [ ] **Step 2: Ponta a ponta no Supabase local** (backend no Furnace com o `.env` local; Expo web no portal **TorvWeb** apontando para o backend local)
  1. Cadastro pelo app (passos 0–5) → código lido no Mailpit → confirmação → Home.
  2. SQL local: `user_measurements.weight_kg/height_cm` começam com `v1.`; `auth.users.raw_user_meta_data` sem `name`, `username`, `birth_date`, `gender`, `weight`, `height`, `fitness_level`, `goal`; `public.users` sem coluna `email`.
  3. JWT da sessão (decodificar só o payload, sem imprimir o token): `user_metadata` sem dado de perfil; claim `email` presente.
  4. Perfil mostra e-mail, peso e altura certos; editar o peso → nova linha `v1.` e o valor novo na tela.
  5. Dieta: sugestão de calorias igual à de antes para os mesmos dados; `nutrition_targets.basis_json` em `v1.`.
  6. Importar um GPX com frequência cardíaca (fixture de `src/lib/tests/fixtures`) → detalhe mostra FC, parciais e rota; colunas em `v1.`.
  7. Cadastro sem username (pela API) → username `user_xxxxxxxx`.
  8. Corrida de username: criar perfil com o username alvo direto no banco entre o pre-check e o signup (ou simular com dois cadastros simultâneos) → 409 `USERNAME_TAKEN` e nenhuma conta sobrando em `auth.users`.
  9. Adulterar um `weight_kg` no banco → `GET /profile` 500 genérico, sem cifra no corpo; log sem valor.
  10. Backend sem `DATA_ENCRYPTION_KEY` → não sobe, mensagem sem valor.
- [ ] **Step 3: Relatório e commit** — PASS/FAIL por item com evidência (SQL e respostas, sem tokens nem chaves). Apagar as contas do Supabase local. Commit `docs(qa): relatório da proteção de dados sensíveis` -- `docs/qa-protecao-dados-sensiveis-2026-11-25.md`.

**Falha:** o ciclo não avança; o Maestro reabre só a task responsável, em rodada `-round2`.

---

### Task 8: Security da feature (só com a Task 7 100% verde)

**Recruit:** Torv Security · **Files:**
- Create: `docs/security-protecao-dados-sensiveis-2026-11-25.md`

- [ ] **Step 1: Revisar `git diff main..HEAD` (OWASP Top 10 + criptografia)** — A02: GCM, IV de 96 bits aleatório por chamada, tag verificada, AAD amarrando tabela/coluna/dono, chave de 32 bytes só por env, falha fechada no boot; A01: `deleteUser` só com o id desta requisição e só no fluxo de cadastro, autorização dos repositórios intacta; A04/LGPD: nenhum dado de perfil nos metadados/JWT, e-mail só em `auth.users`, gênero/nascimento legíveis por decisão registrada, UXCam desfocado; A09: nenhum log com valor, cifra, chave, token ou e-mail; segredos: nenhum no diff.
- [ ] **Step 2: Relatório e commit** — `docs(security): revisão da proteção de dados sensíveis` -- `docs/security-protecao-dados-sensiveis-2026-11-25.md`.

**Falha:** volta à task apontada, depois Tasks 7 e 8 em nova rodada. A feature só termina com Testing e Security verdes na mesma rodada.

---

### Task 9: Segurança completa da branch (Maestro)

- [ ] `/security-review` e `/code-review` (nível `high`); achados reais corrigidos com teste (volta à task de origem).
- [ ] `gitleaks git --log-opts="main..HEAD" -v` → `no leaks found`.
- [ ] Mocks de autenticação: `git diff main..HEAD` sem mock de auth fora de `tests/`.
- [ ] RLS/roles: políticas `torv_api_full_access` e privilégios do `handle_new_user` iguais aos de antes (consulta no Supabase local).
- [ ] Sonar: dispensado pelo desenvolvedor.

### Task 10: Auditoria final de brechas (Maestro, só com a Task 9 limpa)

- [ ] Skill `security-audit` na branch, saída em `~/security-audit-skill/torv/run-N/` (fora do repositório), sem `.env` de produção carregado (o `.env` do backend ainda é o local).
- [ ] `confirmed` bloqueia (teste que reproduz → correção → Tasks 7–10 de novo); `needs_validation` vai para "Não verificado".

### Task 11: Documentação e PR (Maestro)

- [ ] README: env `DATA_ENCRYPTION_KEY` (o que é, como gerar, que perder = perder os dados), campos cifrados, como subir o Supabase local para testes. Commit `docs(readme): ...`.
- [ ] `graphify update .` e commit do `graphify-out/`.
- [ ] `revisar-2026-11-25-protecao-dados-sensiveis.md` na raiz (fora do git).
- [ ] PR com `superpowers:finishing-a-development-branch`.

### Task 12: Produção e teste real no smartphone (desenvolvedor + Maestro)

Cada passo só com autorização explícita do responsável.

- [ ] **Chave:** o desenvolvedor gera a chave na máquina dele, guarda no gerenciador de senhas e cadastra `DATA_ENCRYPTION_KEY` na Vercel (Production e Preview).
- [ ] **Reconectar à produção:** `supabase stop` (o Supabase local para); o desenvolvedor troca o `BackEndTorv/.env` pelos valores de produção, incluindo a mesma `DATA_ENCRYPTION_KEY`. Nenhum valor passa pelo chat.
- [ ] **Migration em produção:** `cd BackEndTorv && npx prisma migrate deploy` com o `.env` de produção → `20261125120000_protect_sensitive_data` aplicada. Conferir pelo MCP só os tipos das colunas (sem dados).
- [ ] **Backend local na produção:** reiniciar o Furnace; Expo no smartphone (rede local) → o desenvolvedor cria a conta real, preenche perfil, dieta e importa um GPX. Conferir no banco que as colunas estão em `v1.` (só o prefixo, sem decifrar).
- [ ] **UXCam:** no próximo APK com a chave do UXCam, o desenvolvedor confere no painel que a gravação sai desfocada. Até lá, fica em "Não verificado".
- [ ] **Deploy na Vercel:** merge do PR pelo responsável. Entre a migration e o deploy, o cadastro pela Vercel antiga quebra (o trigger não cria mais o perfil); como ninguém usa o app, a janela é aceita.
- [ ] Relatório de tempo em `~/Downloads/tempo-torv-protecao-dados-sensiveis.html`.

---

## Acompanhamento no canvas (Maestro)

Antes da Task 1: recrutar **Torv Backend**, **Torv Database**, **Torv Frontend**, **Torv Review and Tests** e **Torv Security** (preset "Claude Code", `claude --model sonnet --effort high`), mais os terminais shell **Furnace** (backend) e **Expo** e o portal **TorvWeb**; criar a nota **"Feature- Proteção de dados (LGPD)"** com a etapa (Edit / Test / Security), o recruit rodando, o resultado da última rodada (link em `docs/`) e, em retrabalho, a task reaberta e o motivo. Atualizar a nota a cada transição.
