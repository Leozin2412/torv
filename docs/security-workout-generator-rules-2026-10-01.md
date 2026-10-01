# Security Review: Regras do gerador de treino no banco (Round 1)

- **Data:** 2026-10-01
- **Branch:** `feat/workout-module`
- **Escopo:** `40be50a..9a63423`. O código está em `6389ce3`, `193b4f6` e `6981c9d`. O `9a63423` é só o relatório de QA.
  - `6389ce3`: a migration `20261001150000_workout_generator_rules` traz `exercises.type`, `min_level` e `catalog_order` com CHECKs, mais a tabela `workout_template_slots` (101 linhas) com RLS e policy `torv_api_full_access`. Também atualiza o `schema.prisma`.
  - `193b4f6`: sync de `BancoDeDadosTorv/` (`SQL BANCO DE DADOS.sql`, `Regras BD.sql`, `Gestao_e_Performance.sql`, `Mock Dados.sql`).
  - `6981c9d`: `workoutRepository.getGeneratorRules` (2 `findMany`). Saem `CATALOG` e `SLOTS` de `workoutGenerator.js`. O `generatePlan(input, { catalog, slots })` devolve `exercise_id`, e o `savePlan` passa a usar esse id direto, sem a busca por slug.
  - A API não mudou e não há frontend no diff.
- **Pré-condição:** QA PASS (`docs/qa-workout-generator-rules-2026-10-01.md`, `9a63423`).
- **Anteriores:** `docs/security-workout-routines-2026-09-30.md` e `docs/security-workout-session-2026-09-30.md`, ambos PASS com 1 LOW cada.
- **Lente:** OWASP Top 10 (A01, A03, A04, A05, A08, A09).
- **Veredito: PASS.** Não há CRITICAL, HIGH, MEDIUM nem LOW novo. Há 2 INFO, e nenhum deles exige mudança.

Não imprimi nenhum segredo e não usei token no shell. Também não criei conta, não gravei nada no banco e não subi outra instância do backend. A verificação teve cinco partes:

- **Testes:** `npm test` no `BackEndTorv`, com **80/80 passando**.
- **Banco:** `SELECT` só de leitura no catálogo do Postgres (`pg_class`, `pg_policies`, `pg_constraint`, `pg_indexes`, `pg_default_acl`, `information_schema.role_table_grants`, `has_table_privilege`) e contagens agregadas. A conexão foi via Prisma com o `DATABASE_URL` do `.env`, como `torv_api`. Nenhuma linha de usuário foi impressa.
- **`getGeneratorRules` real contra o banco:** um script fora do repo chamou o método do repository e conferiu os ids devolvidos com uma contagem. Imprimiu só números.
- **`inject` num Fastify em memória:** usei as rotas, o controller e o gerador reais, com o repository mockado. O error handler é cópia literal de `server.js:57-72`.
- **`curl` sem token válido no backend do Furnace (`localhost:3000`):** 8 requests.

---

## Step 1: checklist

### A01/A05: RLS e privilégios da tabela nova ✅ (verificado no banco)

A migration faz `ENABLE ROW LEVEL SECURITY` e cria a policy `torv_api_full_access TO torv_api` (`migration.sql:118-119`). O padrão é o da `20260925180000_lock_down_public_schema`.

| tabela | dono | RLS | policies | ACL (`relacl`) |
|---|---|---|---|---|
| `workout_template_slots` | `postgres` | true | `torv_api_full_access`: `{torv_api}`, `ALL`, `USING true`, `WITH CHECK true` | `postgres=arwdDxtm`, `service_role=arwdDxtm`, `torv_api=arwd` |
| `exercises` | `postgres` | true | a mesma | a mesma |

Resultado de `has_table_privilege` em `public.workout_template_slots`:

| papel | SELECT | INSERT | UPDATE | DELETE | TRUNCATE |
|---|---|---|---|---|---|
| `anon` | **false** | **false** | **false** | **false** | **false** |
| `authenticated` | **false** | **false** | **false** | **false** | **false** |
| `public` | **false** | **false** | **false** | **false** | **false** |
| `torv_api` | true | true | true | true | false |

- **As default privileges do lock-down funcionaram.** O `pg_default_acl` do `postgres` para tabelas é `{postgres, service_role, torv_api=arwd}`, sem `anon` nem `authenticated`, e a tabela nova nasceu com exatamente esse ACL. Por isso `workout_template_slots` não aparece para a publishable key no `/rest/v1`.
- O default do `supabase_admin`, que dá acesso a `anon`, vale só para objetos criados por ele. As migrations rodam como `postgres`.
- `service_role` com acesso total é o padrão do Supabase e já existia em todas as tabelas. O backend não usa essa chave: o `.env` tem `PUBLISHABLE_KEY`, e não a service key.
- `torv_api` tem escrita na tabela, mas só precisa de leitura. Ver INFO #1.

### A04/A08: o exercício próprio de um usuário nunca entra no plano de outro ✅

- **No código:** `getGeneratorRules` filtra `where: { owner_user_id: null }` (`workout.repository.js:56-66`). No Prisma, `null` vira `IS NULL`. O `generatePlan` só monta o `eligible` a partir desse `catalog` (`workoutGenerator.js:60-62`) e só escreve `exercise_id: ex.id` a partir dele (`:79`).
- **Prova com o método real contra o banco:** existia 1 exercício próprio no banco no momento do teste, então o caso negativo era real.

  | Medida | Valor |
  |---|---|
  | linhas devolvidas por `getGeneratorRules()` | 71 |
  | linhas devolvidas com `owner_user_id IS NOT NULL` | **0** |
  | linhas devolvidas com `owner_user_id IS NULL` | 71 (o catálogo inteiro) |
  | campos selecionados | `id, min_level, muscle_group, slug, type` |
  | slots | 101 |

- **No banco inteiro, contando todos os usuários:**
  - `routine_exercises` de rotina `is_default` que aponta para um exercício próprio: **0**.
  - `routine_exercises` cujo exercício próprio é de um dono diferente do dono da rotina: **0**.
- **Mesmo que o código errasse, o banco barra o caminho até o catálogo.**
  - A API só cria exercício com `owner_user_id` igual ao `userId` do JWT, e só com `name` e `muscle_group` (`workout.repository.js:158`).
  - `updateExercise` e `deleteExercise` filtram `owner_user_id: userId` (`:163`, `:168`), então nenhuma rota escreve em `type`, `min_level`, `catalog_order` nem `owner_user_id`.
  - Se um exercício próprio perdesse o dono, ele cairia no filtro `owner_user_id IS NULL`. Isso não acontece: a FK do dono é `ON DELETE CASCADE`, e um próprio que virasse `owner_user_id NULL` sem as 3 regras seria recusado pelo `exercises_catalog_rules_check`.

### A08: o `exercise_id` do `savePlan` só vem do catálogo carregado no servidor ✅

- **Caminho:** `ensureDefaultPlan` e `acceptPlan` (`workoutPlan.js:9`, `:24`) chamam `generatePlan(inputs, await getGeneratorRules())`. O `inputs` vem de `getPlanInputs(userId)`, e o `userId` vem do JWT (`workout.routes.js:13`). O `savePlan` grava `e.exercise_id` da saída do gerador (`workout.repository.js:84`).
- **Nenhum dado do cliente entra nesse caminho.** `/plan/accept` não tem schema de corpo, e o controller não lê `request.body` nem a query (`workout.controller.js:94-97`). `GET /routines` também não lê nada do cliente.
- **Prova via `inject`:**

  | Request | Resultado |
  |---|---|
  | `POST /workouts/plan/accept` com corpo forjado: `exercise_id` e `user_id` alheios, `routines[].exercises[].exercise_id` alheio com `set_count: 10`, `catalog` com um id alheio, `slots` com `session_name: 'pwn'` | **200**. O `savePlan` recebeu `userId` = o do JWT, `mode: 'replace'`, 5 rotinas e 39 `exercise_id`, **todos do catálogo do servidor**. O id forjado não aparece e nenhuma rotina tem "pwn" |
  | `GET /workouts/routines?exercise_id=<alheio>&catalog=<alheio>` com plano nunca gerado | **200**. `mode: 'create'`, 18 `exercise_id`, todos do catálogo do servidor |

- **Sem token, no backend do Furnace:** a mesma request responde **401** `Access token is missing`. Com `Bearer x.y.z`, responde **403** `Invalid or expired token`.

### A migration: `UPDATE` por slug e CHECK de catálogo × próprio ✅

- **O `UPDATE ... WHERE e."slug" = v."slug"` (`migration.sql:14-88`) não alcança exercício próprio.**
  - O `exercises_catalog_or_owned_check` de `20260930200000_workout_module` (`CHECK (slug IS NULL OR owner_user_id IS NULL)`) obriga todo exercício próprio a ter `slug` NULL, e `NULL = 'x'` nunca é verdadeiro.
  - O `slug` também é único (`exercises_slug_key`), então cada tupla casa no máximo 1 linha.
- **A migration falha fechada.** Se algum item do catálogo ficasse sem `UPDATE`, o `exercises_catalog_rules_check`, criado logo depois (`:91-94`), seria validado contra as linhas existentes e recusaria a migration. Um slug que não existisse só deixaria de casar e não criaria nenhuma linha.
- **O CHECK no banco** (`pg_get_constraintdef`, `convalidated` conferido pelo QA) aceita dois formatos de linha:
  - `owner_user_id IS NULL` com `type`, `min_level` e `catalog_order` NOT NULL (catálogo);
  - `owner_user_id IS NOT NULL` com os 3 NULL (próprio).

  Junto vêm `exercises_type_check`, `exercises_min_level_check` e o índice único `exercises_catalog_order_key`.
- **Estado ao vivo:**
  - catálogo: 71 linhas, 0 sem regra e 0 sem slug, com `catalog_order` de 1 a 71;
  - próprios: 0 com `slug`, `type`, `min_level` ou `catalog_order` preenchido.
- **`workout_template_slots`:**
  - PK `(days_per_week, day, position)`;
  - CHECKs de `day` (`1..days_per_week`), `position >= 1`, `muscle_group` (os 12 grupos), `type`, `min_level` e `sex`;
  - sem coluna de usuário e sem FK para `users`. O conteúdo é regra de produto, não dado pessoal.

### A03: Injeção ✅

O diff não acrescenta SQL cru. `getGeneratorRules` usa só `findMany` com `where` e `orderBy` fixos. Os únicos `$executeRaw` do `savePlan` já existiam, são tagged template (parametrizados) e não mudaram.

O `eligible` e o `used` do gerador são indexados por `` `${muscle_group}|${type}` ``. Esses valores vêm do banco, limitados pelos CHECKs, então não existe chave `__proto__`.

### Documentação em `BancoDeDadosTorv/` sem segredo nem dado real ✅

- O grep no diff inteiro procurou URL de conexão, `supabase.co`, JWT (`eyJ`), `service_role`, `sk_`, `password`/`senha`/`secret`/`token`, CPF e telefone. **Não há nenhum segredo.** As ocorrências de "token" estão no relatório de QA e descrevem o método ("os tokens ficaram só na página"), sem valor de token.
- O `Mock Dados.sql` usa UUIDs sintéticos (`A1000000-…`, `C3000000-…`, `D4000000-…`, `E5000000-…`, `F6000000-…`) e nomes de exercício e rotina fictícios. Não traz e-mail nem nome de pessoa.
- Os únicos e-mails do diff são as contas de teste `qa.wgr.*@torvtest.dev`, no relatório de QA.
- `Gestao_e_Performance.sql` documenta o mesmo ENABLE + policy da migration e não tem nenhum `GRANT` a `anon` ou `authenticated`.

### A09/A05: Erros sem detalhe do Prisma ✅

O `setErrorHandler` (`server.js:57-72`) só repassa a mensagem quando o erro é de validação ou tem `statusCode < 500`. Os erros do Prisma não têm `statusCode`, então viram 500 genérico.

Prova via `inject`: fiz `getGeneratorRules` lançar três erros do Prisma reais (a classe instanciada, com mensagens que citam tabela, código e host) e chamei `POST /workouts/plan/accept` e `GET /workouts/routines`.

| Erro lançado | Resposta (as 2 rotas) |
|---|---|
| `PrismaClientKnownRequestError` P2021 ("table `public.workout_template_slots` does not exist") | **500** `{"error":"An unexpected error occurred"}` |
| `PrismaClientUnknownRequestError` (`42501 permission denied for table workout_template_slots`) | **500**, o mesmo corpo |
| `PrismaClientInitializationError` ("Can't reach database server at `db.example:5432`") | **500**, o mesmo corpo |

Conferi por regex que nenhum corpo tem `prisma`, `P20`, `42501`, o nome da tabela, a porta nem stack.

Respostas do backend no ar:

| Request | Status | Corpo |
|---|---|---|
| `GET /workouts/routines` sem token | 401 | `Access token is missing` |
| `POST /workouts/plan/accept` sem token, com `exercise_id` forjado | 401 | `Access token is missing` |
| `POST /workouts/plan/dismiss` sem token | 401 | (mesmo) |
| `GET /workouts/exercises` sem token | 401 | (mesmo) |
| `POST /workouts/plan/accept` com `Bearer x.y.z` | 403 | `Invalid or expired token` |
| `GET /workouts/routines?catalog=1` com `Bearer x.y.z` | 403 | `Invalid or expired token` |

Os schemas de resposta não mudaram, então `type`, `min_level` e `catalog_order` não saem pela API. O `listExercises` seleciona só `id`, `name`, `muscle_group` e `owner_user_id`.

**Prova ao vivo com token:** não fiz nenhuma request autenticada.
- A única sessão no navegador é a do portal, que pode ser a conta real do usuário, e um `POST /plan/accept` com sugestão pendente troca as rotinas default.
- O QA já cobriu o fluxo autenticado com 4 contas de teste, incluindo o IDOR de exercício entre contas.
- O que é específico deste diff ficou coberto pelo `inject` e pelas contagens no banco, que abrangem todos os usuários.

---

## Achados

### #1 INFO: `torv_api` pode escrever nas regras do gerador, mas só precisa ler

- **Onde:** `workout_template_slots` (`torv_api=arwd`, herdado do `pg_default_acl` do `postgres`) e as colunas `type`, `min_level` e `catalog_order` de `exercises`.
- **O que mudou:** antes deste diff, as regras eram constantes em `workoutGenerator.js`, e mudá-las exigia um deploy. Agora ficam no banco, e o papel de runtime pode alterá-las. Uma escrita indevida nessas tabelas afetaria o plano default de **todos** os usuários gerados depois dela.
- **Por que é só INFO:**
  - Não há vetor hoje. Nenhuma rota escreve nessas tabelas ou colunas, e não há SQL cru com interpolação.
  - Quem já tem SQL arbitrário como `torv_api` tem acesso total aos dados de todos os usuários, então essa escrita a mais quase não muda o impacto.
  - É o mesmo padrão de todas as tabelas do schema.
- **Endurecimento opcional:** uma migration de uma linha, numa mudança própria. Migrations rodam como `postgres`, então ela não quebra futuras migrations de regra.

  ```sql
  REVOKE INSERT, UPDATE, DELETE ON "workout_template_slots" FROM torv_api;
  ```

  O mesmo em nível de coluna para `exercises`, com `REVOKE UPDATE` e `GRANT UPDATE ("name", "muscle_group")`, exige revisar o `INSERT` do `createExercise`. Não vale a pena só por isso.
- **Atenção ao QA:** os testes de "controle positivo" que fazem `INSERT` em slots com ROLLBACK passariam a falhar com 42501.

### #2 INFO: `POST /plan/accept` lê as regras antes de saber se há algo a trocar

`acceptPlan` (`workoutPlan.js:21-26`) chama `getGeneratorRules()` antes do `UPDATE` condicional do `savePlan`, que é quem decide se há algo a fazer.

- Cada `accept`, mesmo sem sugestão pendente, custa 2 `SELECT` a mais: 71 + 101 linhas, em tabelas pequenas. Antes do diff, a única leitura de regras (a busca por slug) ficava dentro da transação e só rodava depois que o `UPDATE` tinha efeito.
- É uma amplificação pequena de um custo que já existia.
- Fica coberta pelo **LOW #1 da entrega 1, ainda aberto**: falta rate limit por `userId` em `/workouts/*`. Não exige mudança própria.

---

## Pendências anteriores (fora deste diff, sem mudança)

- **LOW #1 da entrega 1** (`security-workout-routines-2026-09-30.md`): `/workouts/*` não tem rate limit nem teto de volume.
- **LOW #1 da entrega 2** (`security-workout-session-2026-09-30.md`): `started_at` e a quantidade de sessões ficam a cargo do cliente.

As duas continuam como **pré-requisito de qualquer feature social ou de ranking**.

---

## Conclusão

Todos os itens pedidos estão verdes:

- `workout_template_slots` tem RLS, a policy só para `torv_api` e nenhum privilégio para `anon`, `authenticated` ou `public`, conferido no catálogo do banco.
- O gerador lê só o catálogo (`owner_user_id IS NULL`). O caminho que faria um exercício próprio virar catálogo está fechado no código e no banco. No banco, o número de rotinas default com exercício próprio é 0.
- O `exercise_id` gravado no plano vem só das regras carregadas no servidor, e um corpo forjado é ignorado.
- O `UPDATE` por slug só alcança o catálogo, e o CHECK separa catálogo e próprio.
- A documentação não tem segredo nem dado real.
- Erros do Prisma viram 500 genérico.

Os 2 INFO são opcionais. Com o QA e este Security verdes, o refactor está pronto para a aprovação do usuário.
