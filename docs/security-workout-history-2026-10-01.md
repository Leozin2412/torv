# Security Review: Histórico de treinos (Round 1)

- **Data:** 2026-10-01
- **Branch:** `feat/workout-module`
- **Escopo:** `4d94ea2..HEAD` (`ad5bcee`). O código está em `e2b6d71`, `630f70f` e `941c394`. Os outros commits são plano e relatórios de QA.
  - **Backend (`e2b6d71`):**
    - plugin `/activities` novo: `activities.routes.js`, `activities.controller.js`, `activities.repository.js`;
    - `completed_recently` em `GET /workouts/routines` e `POST /plan/accept`, via `workoutRepository.recentRoutineIds`;
    - remoção de `GET /workouts/sessions` (listagem) e do schema `SessionSummary`.
  - **Frontend (`630f70f`, `941c394`):** `services/activities.ts`, `utils/activities.ts`, `utils/historyGroups.ts`, `Workouts/History.tsx`, `Workouts/index.tsx` (segmentado, selo e aviso), `Home` (aviso) e `Profile` (lista só STRENGTH via `/activities`).
- **Plano:** Task 6 de `docs/superpowers/plans/2026-10-01-workout-history.md`
- **Spec:** `docs/superpowers/specs/2026-10-01-workout-history-design.md`
- **Pré-condição:** Teste completo PASS (`docs/qa-workout-history-full-2026-10-01.md`, `ad5bcee`)
- **Lente:** OWASP Top 10 (A01, A03, A04, A05, A06, A09)
- **Veredito: PASS.** Não há CRITICAL, HIGH nem MEDIUM. Há 1 LOW (#1, backend), que não bloqueia e tem um fix de 2 linhas, e 3 INFO.

Não imprimi nenhum segredo e não usei token no shell. Também não criei conta, não gravei nada no banco, não abri portal e não subi outra instância do backend. A verificação teve cinco partes:

- **Testes:** backend `npm test` com **83/83**. Front: `node --test src/utils/*.test.mjs` com **17/17** e `npx tsc --noEmit` com exit 0.
- **`inject` num Fastify em memória:** a rota e o controller de `/activities` são reais, compilados pelo Ajv padrão do Fastify. O error handler é cópia literal de `server.js:58-73`.
  - O repository foi mockado para os limites, para a exposição e para os erros.
  - Para o caso do `before`, usei o **repository real (Prisma real)** com um `userId` fictício, que não tem nenhuma linha.
- **`curl` sem token válido no backend do Furnace (`localhost:3000`):** 14 requests. A validação da querystring roda antes do `preHandler` de auth. Por isso, sem token, um 400 mostra que o schema recusou o valor, e um 401 mostra que ele passou pelo schema.
- **Banco:** `SELECT` só de leitura com contagens agregadas e metadados (`pg_indexes`, `pg_class`, `has_table_privilege`), como `torv_api`. Nenhuma linha de usuário foi impressa.
- **Front:** grep das linhas adicionadas no diff, procurando `console.`, `EXPO_PUBLIC`, URLs, `fetch`/`axios`, `Linking`, storage, `Authorization`/`token`, `dangerouslySetInnerHTML`, `eval` e `WebView`. Também conferi o diff dos `package.json` e lockfiles.

**Sem request autenticada ao vivo:**
- Nenhum portal está ligado a este terminal. O único portal com sessão é o do QA, que pode ser a conta real do usuário.
- O QA já cobriu ao vivo o isolamento A/B com 3 contas de teste: `?user_id=` de outro, o cursor de outro e `completed_recently` cruzado.
- O que faltava ficou provado pelo `inject` com o Prisma real e pelo `curl` sem token.

---

## Step 1: checklist

### A01: IDOR ✅

- **`/activities` filtra pelo usuário do token.**
  - O plugin registra o hook `preHandler` `authenticateToken` (`activities.routes.js:24`).
  - O controller passa `request.user.userId` (`activities.controller.js:8`), e o repository põe `user_id: userId` no `where` sempre, antes dos filtros opcionais (`activities.repository.js:9`).
  - O spread `...(type && { activity_type: type })` só acrescenta `activity_type`, porque `type` é uma string do enum. Ele não sobrescreve `user_id`.
- **`recentRoutineIds` só olha as activities do próprio usuário.** O `where` é `{ user_id: userId, activity_type: 'STRENGTH', routine_id: { not: null }, start_time: { gte: since } }` (`workout.repository.js:118`). O `since` vem do relógio do servidor (`workout.controller.js:44`), e o `Set` resultante só marca itens de `listRoutines(userId)`.
  - **O vínculo de sessão com rotina já é validado na gravação.** `createSession` só liga `routine_id` se a rotina for do usuário (`workout.repository.js:195`). O QA comprovou ao vivo que a sessão de B com a rotina de C fica "Treino livre".
  - **No banco, entre todos os usuários:** há **0** activities cujo `routine_id` aponta para uma rotina de outro dono, e **0** activities com `start_time` NULL.
- **Nenhum id vem do cliente em `/activities`.** Da query só saem `type`, `before` e `limit` (`activities.controller.js:7`).
  - **Prova via `inject`:** mandei `?user_id=<outro>&userId=<outro>&orderBy=asc&order=asc&sort=start_time&take=1000&skip=3&type[]=RUN&limit=2`. Resultado: 200, e o repository recebeu `userId` = o do JWT e `{ limit: 2 }`, sem mais nada.
  - O `type[]` chega como a chave literal `type[]` e é ignorado.
- **O cursor de um usuário não vaza dados de outro.** O `before` é só um instante que **estreita** o conjunto `user_id = <token>` (`start_time < before`). Usado por outro usuário, ele só pagina as activities desse outro usuário. O QA comprovou ao vivo: B com o cursor de A recebe 0 itens de A.
- **`/workouts/sessions/:id` continua isolado**, com `findFirst { id, user_id }` → 404, sem mudança neste diff. A listagem foi removida, e ao vivo `GET /workouts/sessions` e `?limit=5` dão **404**.

### A04: Limites e cursor ✅ (com o LOW #1 no `before`)

Prova via `inject` com o Ajv padrão do Fastify. Todos os casos abaixo deram **400 sem chegar ao repository**:

| Parâmetro | Valores recusados (400) |
|---|---|
| `limit` | `0`, `51`, `-1`, `1.5`, `abc`, vazio, `1e9`, `limit=5&limit=6` |
| `type` | `RUN`, `strength`, vazio, `type=STRENGTH&type=RUN` |
| `before` | `ontem`, `2026-10-01` (só data), `2026-10-01T10:00:00` (sem fuso), `2026-02-30T10:00:00Z`, `2026-10-01T24:00:00Z`, dois `before` |

- O `limit` ausente vira **20** e o `limit=50` é aceito. O teto do pior caso por request é 50 linhas mais um `_count`.
- **Não há ordenação controlada pelo cliente.** O `orderBy: { start_time: 'desc' }` é fixo (`activities.repository.js:13`), e o `take` vem do `limit` validado (`:14`).
- **`type` em enum:** `Type.Union` de `Type.Literal` sobre `['STRENGTH']` (`activities.routes.js:32`).
- **`before` como `date-time`** (`activities.routes.js:33`). O Ajv exige fuso. **Exceção:** o Ajv aceita dois formatos que o `new Date()` do JS não parseia. Ver **LOW #1**.

Ao vivo, sem token: `limit=51`, `type=RUN` e `before=2026-10-01T10:00:00` dão **400**. `before=…Z`, `?user_id=<outro>&orderBy=asc` e os dois formatos do LOW #1 passam pelo schema e dão **401**.

### A01/A05: Exposição ✅

- **O schema de resposta `ActivityPage`** (`activities.routes.js:11-21`, registrado em `:36`) só declara `id`, `activity_type`, `title`, `start_time`, `duration_sec`, `set_count` e `next_before`. O `fast-json-stringify` descarta o resto, e o `select` do repository (`activities.repository.js:15-18`) já não traz outras colunas.
- **Prova via `inject`:** o repository mockado devolveu linhas com `user_id`, `routine_id`, `calories`, `distance_m` e `user: { email }`.
  - As chaves da resposta foram exatamente `activity_type, duration_sec, id, set_count, start_time, title`, mais `activities` e `next_before` no topo.
  - O regex no corpo não achou `user_id`, `routine_id`, `calories`, `distance` nem `email`.
- **`completed_recently` é só um booleano** por rotina do próprio usuário. O schema `RoutineList` ganhou só esse campo (`workout.schemas.js:42`).
- **Banco:** `activities` tem RLS ligado, e `anon` e `authenticated` não têm `SELECT` (`has_table_privilege` false). Nada mudou desde o lock-down.

### A09: Erros sem detalhe do Prisma ✅

| Caso (`inject`) | Resposta |
|---|---|
| `PrismaClientKnownRequestError` P2022 ("column `activities.start_time` does not exist") lançado no repository | **500** `{"error":"An unexpected error occurred"}` |
| `PrismaClientInitializationError` ("Can't reach database server at `db.example:5432`") | **500**, o mesmo corpo |
| `PrismaClientValidationError` real, vindo do LOW #1 | **500**, o mesmo corpo |

Os 400 do Ajv usam a mensagem padrão (`querystring/limit must be <= 50`). Ao vivo, sem token, a resposta é 401 `Access token is missing`. Com `Bearer x.y.z`, é 403 `Invalid or expired token`. Nenhuma resposta traz stack.

### A03: Injeção ✅

O diff não acrescenta SQL cru. `listActivities` e `recentRoutineIds` usam `findMany` com `where` de objeto, e os valores vêm do JWT, do enum, de um `Date` ou de um inteiro validado.

### Front: só a nossa API, nada novo em `EXPO_PUBLIC_*`, nada de token em log ✅

- **Só a nossa API.** `services/activities.ts` usa a instância `api` de `services/api.ts`, com o mesmo `baseURL` e o mesmo interceptor de `Authorization`, e chama só o caminho relativo `/activities`.
  - Fora isso, o diff só tira o `listSessions` de `services/workouts.ts`. Nenhuma referência a ele sobra no front nem no backend.
  - O `before` enviado é o `next_before` devolvido pelo servidor (`History.tsx:57`). Nenhum id do cliente entra na query.
- **`EXPO_PUBLIC_*`:** o diff não tem nenhuma linha adicionada com `EXPO_PUBLIC`. O `api.ts` commitado não mudou. A mudança local do usuário em `api.ts` (`127.0.0.1`) não faz parte do diff.
- **Logs:** o diff não adiciona nem remove nenhum `console.`. Os `catch` novos (`History.tsx:45`, `:61`; `Profile/index.tsx:63`) não logam nada.
- **Superfície nova:** o diff não usa `Linking`, `WebView`, `dangerouslySetInnerHTML`, `eval` nem storage.
  - A navegação para o resumo usa o `id` da própria activity (`WorkoutSummary { sessionId }`), e o backend valida o dono no `GET /workouts/sessions/:id`.
  - Os títulos são renderizados como `<Text>`.
- **A06:** nenhum `package.json` nem lockfile mudou, e não há dependência nova nos dois lados.

---

## Achados

### #1 LOW: `before` aceito pelo schema mas inválido para o `Date` do JS → 500 em vez de 400 (A04/A05, validação de entrada)

- **Camada:** backend
- **Onde:** `BackEndTorv/src/controller/activities.controller.js:10` (`before: before ? new Date(before) : undefined`), com o schema em `BackEndTorv/src/routes/activities.routes.js:33`.
- **Causa:** o formato `date-time` do `ajv-formats` 3.0.1 aceita duas formas válidas na RFC 3339 que o `new Date()` do V8 não parseia:
  - fuso só com hora: `2026-10-01T10:00:00-03`;
  - segundo bissexto: `2026-06-30T23:59:60Z` e `2026-10-01T02:59:60+03:00`.

  O controller cria um `Invalid Date` e o Prisma recusa o argumento com `PrismaClientValidationError`.
- **Prova:**

  | Request | Resultado |
  |---|---|
  | `GET /activities?before=2026-10-01T10:00:00-03`, via `inject` com rota, controller e repository reais (Prisma real, `userId` fictício) | `before=Invalid Date` → `PrismaClientValidationError` → **500** `An unexpected error occurred` |
  | Mesmo caso com `before=2026-06-30T23:59:60Z` e `before=2026-10-01T02:59:60+03:00` | **500** |
  | Os mesmos 3 valores **ao vivo, sem token** | **401**: passam pelo schema do servidor no ar e chegam ao auth |
  | `before=2026-10-01T10:00:00` ao vivo, sem token | **400** |
  | Controles: `2026-10-01t10:00:00z` (minúsculas), `2026-10-01 10:00:00Z` (espaço), `0000-01-01T00:00:00Z` | **200**, porque o JS parseia todos |

- **Impacto:**
  - Não vaza nada: a resposta é o 500 genérico, e o `where` com `user_id` nunca chega ao banco.
  - Não muda estado e não alcança dado de outro usuário.
  - O efeito é que um usuário autenticado recebe 500 em vez de 400, e cada request escreve o erro completo do Prisma no log do servidor (`server.js:59-60`). É ruído de log sem limite, já que não há rate limit (INFO #2).
  - O app nunca manda esses formatos, porque o `before` dele é sempre o `next_before` do servidor (`toISOString`, com `Z`).
- **Contraste:** o `POST /workouts/sessions` já trata esse caso. O `checkSessionBody` faz `Date.parse` e devolve 400 para NaN (`workoutValidation.js:19-20`).
- **Fix mínimo**, no backend, em `activities.controller.js:7-12`:

  ```js
  const beforeDate = before ? new Date(before) : undefined;
  if (beforeDate && Number.isNaN(beforeDate.getTime())) {
    return reply.status(400).send({ error: 'querystring/before must match format "date-time"' });
  }
  // ... listActivities(request.user.userId, { type, before: beforeDate, limit })
  ```

  Junto, entram 2 casos em `activities.routes.test.js` (`before=2026-10-01T10:00:00-03` e `before=2026-06-30T23:59:60Z` → 400, sem chamar o repository). Depois do fix, o reteste se limita ao contrato de `/activities` (Task 2) mais esses 2 casos.

### #2 INFO: `/activities` entra no LOW de rate limit que já está aberto

`/activities` é um prefixo novo sem rate limit, como `/workouts/*`. Isso é o LOW #1 da entrega 1 (`security-workout-routines-2026-09-30.md`), e o plano deixa rate limit fora do escopo. O custo por request é baixo: no máximo 50 linhas e um `_count`, com `ix_activities_user_id` e o índice parcial `activities_strength_user_start_key (user_id, start_time)` disponíveis. Quando o rate limit entrar, ele deve cobrir `/activities` também.

### #3 INFO: o cursor tem precisão de milissegundo

Esta nota avalia, pela ótica de Security, a observação do QA e o `ponytail:` em `activities.repository.js:5`.

- O `next_before` sai com precisão de ms (`toISOString`), e o `timestamptz` guarda µs.
- Duas activities do **mesmo usuário** no mesmo milissegundo, gravadas por SQL com sub-ms, podem ter uma delas pulada entre as páginas. Em tipos fora de STRENGTH, o mesmo vale para empates exatos.
- **Não há impacto de segurança:** o efeito fica no conjunto do próprio usuário, nunca duplica e nunca alcança dado de outro.
- O upgrade para cursor composto `(start_time, id)` já está anotado.

### #4 INFO: 400 antes de 401 também em `/activities`

É o mesmo comportamento da nota (b) de `security-workout-session-2026-09-30.md`: a querystring é validada antes do `preHandler` de auth. Uma request sem token com parâmetro inválido recebe 400 e só aprende o formato do schema, que já é público no Swagger fora de produção. Nenhum dado é exposto. O fix opcional continua o mesmo para todos os plugins: `addHook('onRequest', authenticateToken)`.

---

## Pendências anteriores (fora deste diff, sem mudança)

- **LOW #1 da entrega 1:** falta rate limit e teto de volume em `/workouts/*`. Agora vale também para `/activities` (INFO #2).
- **LOW #1 da entrega 2:** `started_at` e a quantidade de sessões ficam a cargo do cliente.
- **INFO #1 das regras do gerador:** `torv_api` tem escrita em `workout_template_slots`.

As duas LOW continuam como **pré-requisito de qualquer feature social ou de ranking**.

---

## Conclusão

Todos os itens do Step 1 da Task 6 estão verdes:

- **IDOR:** o usuário vem só do token, `recentRoutineIds` filtra pelo dono, nenhum id vem do cliente e o cursor só estreita o conjunto do próprio usuário.
- **Limites:** `limit` vai de 1 a 50, `type` é enum, não há ordenação vinda do cliente e `before` é `date-time` (com a ressalva do LOW #1).
- **Exposição:** a resposta tem só os 6 campos, sem `user_id` nem `routine_id`.
- **Erros:** o Prisma vira 500 genérico.
- **Front:** chama só a nossa API, sem `EXPO_PUBLIC_*` novo, sem log e sem dependência nova.

O **LOW #1** não bloqueia. Pela Step 2 do plano, o fix fica no backend e se limita a `activities.controller.js` mais 2 testes, com reteste só do contrato de `/activities`. A decisão de corrigir agora ou depois é do Maestro e do usuário. Com o Teste completo e este Security verdes, a **feature está pronta**.
