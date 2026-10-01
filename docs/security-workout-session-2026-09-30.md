# Security Review: Módulo de treinos, entrega 2, execução do treino (Round 1)

- **Data:** 2026-09-30
- **Branch:** `feat/workout-module`
- **Escopo:** `362ecd0..d6bdbc1`. O código está em `536876f`, `9c349aa`, `b67b3ee`, `95ecf6f` e `d6bdbc1`; `86f69af` é só relatório de QA.
  - Backend: `workout.controller.js` (sessões), `workout.repository.js` (`findSessionByStart`, `createSession`, `listSessions`, `getSession`), `workout.routes.js`, `workout.schemas.js` (`SessionBody`), `profile.controller.js` e `profile.repository.js` (`workout_counts`)
  - Frontend: `utils/workoutDraft.ts`, `utils/workoutSession.ts`, `contexts/AuthContext.tsx` (logout), `services/workouts.ts`, `WorkoutSession`, `WorkoutSummary`, `Workouts`, `Home`, `Profile`
  - Dependência nova: `@react-native-async-storage/async-storage` 2.2.0
- **Spec:** `docs/superpowers/specs/2026-09-30-workout-module-design.md`
- **Pré-condição:** QA round 2 PASS (`docs/qa-workout-session-2026-09-30-round2.md`, `f8fc898`)
- **Anterior:** entrega 1, `docs/security-workout-routines-2026-09-30.md` (`362ecd0`): PASS com 1 LOW (sem rate limit nem teto em `/workouts/*`)
- **Lente:** OWASP Top 10 (A01, A02, A04, A05, A06, A08, A09)
- **Veredito: PASS.** Não há CRITICAL, HIGH nem MEDIUM. Há 1 LOW novo (#1), que não bloqueia hoje mas **bloqueia antes de grupos/ranking social**, e 4 INFO.

Nenhum segredo nem token foi impresso, e nenhum token foi usado no shell. Não criei conta nem gravei nada no banco. Para chegar ao veredito, fiz o seguinte:

- **Testes:** `node --test` de `workout.sessions.test.js` e `workout.routes.test.js`, com **17/17 passando**.
- **`SessionBody` real via `inject`:** compilado pelo Ajv padrão do Fastify e com o `auth.middleware` real como `preHandler`, num Fastify em memória e sem banco.
- **`curl` sem token no backend no ar (`localhost:3000`):** 6 requests. Uma delas não chegou ao servidor por erro de aspas no meu comando e foi coberta pelo `inject`.
- **`npm audit` do front:** comparei o estado atual com o lockfile de `362ecd0`.

---

## Step 1: checklist

### A01: IDOR/BOLA em `/workouts/sessions*` ✅

- As rotas herdam o hook `preHandler` `authenticateToken` do plugin (`workout.routes.js:13`), e o `userId` vem só do `sub` do JWT.
- `getSession` usa `findFirst { id, user_id, activity_type: 'STRENGTH' }` (`workout.repository.js:216`), e sessão alheia responde **404** (`workout.controller.js:165`). `listSessions` filtra `user_id` e tem `take` de 1 a 50 (`:207`; querystring `minimum: 1, maximum: 50`).
- **`routine_id` e `exercise_id` alheios não são vinculados e o nome deles não é exposto** (`workout.repository.js:172-205`):
  - a rotina é buscada com `{ id: routine_id, user_id: userId }`. Se não for do usuário, a sessão fica com `routine_id: null` e `title: 'Treino livre'`.
  - os exercícios são buscados com `visibleExercise(userId)`, que só traz o catálogo e os próprios. Exercício alheio ou apagado fica com `exercise_id: null` e `exercise_name: 'Exercício removido'`.
  - a resposta do `POST` traz só `{ activity_id }`, e o `SessionDetail` não traz `exercise_id` nem `routine_id`.
- `findSessionByStart` filtra `user_id` (`:162`). Um `started_at` igual ao de outro usuário não devolve o id dele.

### A08: Integridade ✅

- **`exercise_name` e `title` vêm só do banco** (`repository:186`, `:197`). O `createSession` desestrutura só `routine_id`, `started_at`, `duration_sec` e `sets`, e monta cada série campo a campo. Mandei `user_id`, `title` e `exercise_name` no corpo, e nenhum desses campos chega a uma escrita.
- **A idempotência não sobrescreve a sessão existente.** Um `started_at` já gravado devolve **200 com o id existente** e não faz nenhum `UPDATE` (`controller:140-141`).
  - Na corrida entre duas requests iguais, o índice único parcial `activities_strength_user_start_key (user_id, start_time) WHERE activity_type = 'STRENGTH'` gera P2002, e a request que perdeu devolve o id da que ganhou (`controller:146-148`).
  - Qualquer outro erro é relançado e vira 500 genérico.
  - Os testes cobrem os três casos: reenvio, corrida e "streak não incrementa de novo".
- O dono, o tipo e o vínculo da sessão nunca vêm do cliente (`user_id`, `activity_type`, `routine_id` validado).
- **Ressalva:** o momento do treino (`started_at`) e as durações vêm do cliente. Ver LOW #1.

### Dados no aparelho ✅

- O rascunho (`utils/workoutDraft.ts`) fica na chave `torv.workoutDraft.<userId>` e guarda só o `SessionState` (`workoutSession.ts:28-41`):
  - a rotina: `routine_id`, `routine_name` e os exercícios
  - os timestamps e a fase atual
  - as séries feitas

  **Não guarda token nem dado pessoal.** A sessão continua no `expo-secure-store` (`services/session.ts`), que não mudou.
- O rascunho **é apagado no logout** (`AuthContext.tsx:102`, antes do `clearSession`), também quando o servidor confirma o `POST` e quando o usuário descarta o treino. Um JSON corrompido é apagado na leitura.
- **Não há `EXPO_PUBLIC_*` novo:** o grep no diff do front deu 0 ocorrências.

### A06: Dependência nova ✅

- `@react-native-async-storage/async-storage` **2.2.0** está fixado sem `^` e é **a versão que o `expo` ~57 traz em `bundledNativeModules.json`**.
- O lockfile acrescenta só essa dependência e as transitivas `merge-options` 3.0.4 e `is-plain-obj` 2.1.0. **Nenhuma das três tem advisory.**
- `npm audit` no estado atual: **16 (13 moderate, 3 high, 0 critical)**. No lockfile de `362ecd0`, rodando `npm audit --package-lock-only` com o `package.json` e o lockfile da época: **os mesmos 16 pacotes e a mesma contagem**. **Nada novo veio deste diff.** Os pré-existentes estão em INFO #4.

### A09/A05: Erros sem stack nem detalhe do Prisma ✅

- Os 400 do `checkSessionBody` usam mensagens fixas (`started_at must be on or after 2026-01-01`, `... must not be in the future`). O 404 é `Not found`.
- Erros do Prisma diferentes de P2002, como a violação de FK de uma rotina apagada entre a leitura e o insert, são relançados e caem no `setErrorHandler`, que devolve `500 An unexpected error occurred`.
- Respostas do backend no ar:

  | Request | Status | Corpo |
  |---|---|---|
  | `GET /workouts/sessions` sem token | 401 | `Access token is missing` |
  | `GET /workouts/sessions/:id` sem token | 401 | `Access token is missing` |
  | `GET /workouts/sessions` com token inválido | 403 | `Invalid or expired token` |
  | `POST` com JSON quebrado | 400 | `Body is not valid JSON...` |

  Nenhuma resposta traz stack.

### Contadores do Perfil (`workout_counts`) ✅

`profile.repository.js` conta `activities` com `{ user_id: userId, activity_type: 'STRENGTH' }`. O contador do mês usa o mesmo filtro com `start_time >= início do mês UTC`. O `userId` vem do JWT, então os contadores são só do próprio usuário.

---

## Notas dos implementadores

### (a) `SessionBody` com `Type.Unsafe` (`['integer','null']` e `['string','null']` + `format: 'uuid'`): os limites continuam valendo ✅

Testei o schema real com `inject`. Nos casos marcados "passa o schema", a validação aceitou o corpo e a request parou no auth com 401, sem token.

| Entrada | Resultado |
|---|---|
| `routine_id: null` ou ausente | passa o schema |
| `routine_id: ""`, `123`, `"abc"` | **400** (`""` continua string e falha no `format`; `123` vira `"123"` e falha no `format`) |
| `rest_before_sec: null` | passa |
| `rest_before_sec: 7201`, `-1`, `1.5`, `"abc"`, ausente | **400** |
| `rest_before_sec: ""` | vira `null` (coerção do Ajv, sem efeito) |
| `duration_sec: 21601`; `sets` com 201 itens; `position: 21` | **400** |
| `started_at` sem fuso, `2026-02-30T...` | **400** (formato `date-time` completo) |

Os CHECKs do banco (`workout_sets_duration_sec_check`, `workout_sets_rest_before_sec_check`) são uma segunda barreira.

### (b) Corpo inválido sem token responde 400 antes do 401: **INFO**, sem mudança obrigatória

- **Comprovado ao vivo:** `POST /workouts/sessions` com `{}` e sem token responde `400 body must have required property 'started_at'`. Com um corpo válido e sem token, a resposta é **401**.
- **Não é bypass:** nenhuma request não autenticada chega ao controller nem ao banco. Ela só passa pela validação de schema, que é barata: o corpo é limitado a 1 MB pelo Fastify e a 200 séries pelo schema.
- **O que vaza:** o formato do schema, que já é público no Swagger fora de produção e no próprio app. Nenhum dado é exposto.
- **Fix mínimo, opcional e para todas as rotas de uma vez:** em `workout.routes.js:13`, `diet.routes.js:37` e `profile.routes.js:7`, trocar `fastify.addHook('preHandler', authenticateToken)` por `fastify.addHook('onRequest', authenticateToken)`. O middleware só lê o header, então o 401/403 passa a sair antes do parse do corpo. Convém fazer isso numa mudança própria e rodar a suíte inteira, porque o teste `POST /sessions 400` sem token mudaria de expectativa.

---

## Achados

### #1 LOW: `started_at` e quantidade de sessões confiados ao cliente inflam streak, contadores e ranking (A04, lógica de negócio)

- **Camada:** backend
- **Onde:**
  - `BackEndTorv/src/lib/workoutValidation.js:18-23` (`checkSessionBody`) só exige `started_at` entre 2026-01-01 e agora + 5 min.
  - `BackEndTorv/src/controller/workout.controller.js:134-150` e `BackEndTorv/src/repository/workout.repository.js:172-205` inserem uma nova `activities` para cada `started_at` diferente.
- **Por que importa:** `POST /workouts/sessions` é o **primeiro caminho do app que insere em `activities`**. Por isso ele é o primeiro a acionar os triggers `trg_update_streak_on_activity` e `trg_add_points_to_group_ranking` com dados do cliente.
- **Cenário:** um usuário autenticado chama a API direto, sem o app.
  - **(i)** Envia sessões retroativas, uma por dia, de 2026-01-01 até hoje, em ordem crescente. O trigger soma +1 a cada dia consecutivo, então `current_streak` e `longest_streak` chegam a cerca de 270 em segundos.
  - **(ii)** Envia N sessões com `started_at` separados por 1 ms. Cada uma conta em `total_workouts` e `workouts_in_month` e soma +10 em `group_rankings.total_points`.

  Nada impede sessões sobrepostas no tempo nem um volume sem limite (ver também o LOW #1 da entrega 1: sem rate limit em `/workouts/*`).
- **Por que LOW hoje:**
  - Exige conta e chamada direta à API.
  - Hoje o impacto fica **só nos números do próprio usuário**: não há endpoint de grupos/ranking nem perfil público (`followers`/`following` fixos em 0).
  - **Vira MEDIUM/HIGH quando grupos, ranking ou perfil público forem ao ar**, porque aí afeta outros usuários. **Deve ser corrigido antes disso.**
- **Fix sugerido**, mínimo e no backend:
  1. **Rejeitar sobreposição:** antes do insert, procurar uma `activities` STRENGTH do usuário cujo `[start_time, start_time + duration_sec)` cruze o intervalo novo e responder 409 ou 400. Isso mata o caso (ii).
  2. **Janela de retroatividade:** aceitar `started_at >= now - N` (por exemplo 48 h, para cobrir o reenvio de um rascunho depois de falha de rede). Isso mata o caso (i). O valor de N é decisão de produto e precisa entrar na spec.
  3. O rate limit por `userId` (LOW #1 da entrega 1) reduz o volume.

### #2 INFO: sessão expirada não apaga o rascunho

`setOnSessionExpired` (`AuthContext.tsx:63-66`) só zera o estado e não chama `clearDraft`. O impacto é nulo:

- a chave do rascunho é por `userId`, então outro usuário no mesmo aparelho não vê esse rascunho;
- o conteúdo é só de treino;
- o próximo login do mesmo usuário retoma o rascunho, que é o comportamento desejado.

Nenhuma ação é necessária.

### #3 INFO: o reenvio idempotente ignora um corpo diferente

Um segundo `POST` com o mesmo `started_at` e outras séries devolve 200 com o id antigo e descarta o corpo novo. Do ponto de vista de segurança, esse é o comportamento correto: não sobrescreve nada. Fica registrado só para o QA, porque o cliente não percebe a diferença.

### #4 INFO: advisories pré-existentes no `npm audit` do front, fora deste diff

São 16 advisories (13 moderate, 3 high), iguais aos de `362ecd0`:

- **`axios` (high, dependência direta, `^1.17.0`):** prototype pollution. É o cliente HTTP do app. Recomendo atualizar numa mudança própria com `npm audit fix` ou um bump de minor e rodar a suíte.
- **`form-data` (high) e `shell-quote` (high):** vêm como transitivas de tooling (build e CLI) e não entram no bundle do app.
- **Moderates:** os pacotes `@expo/*` e `expo` (via `xcode` → `uuid`), além de `query-string` e `decode-uri-component` (via `@react-navigation/core`). A correção vem com o SDK.

O padrão `console.log('...', error)` com o objeto de erro do axios, que inclui `config.headers.Authorization`, também é pré-existente: são 13 ocorrências em `362ecd0`, e a de `Home/index.tsx:47` já existia. Vale um passe separado que logue só `error.message` ou `error.response?.status`.

---

## Conclusão

Todos os itens do Step 1 da Task 15 estão verdes. Os limites do `SessionBody` valem com `Type.Unsafe` (nota a), e o 400-antes-do-401 é INFO (nota b). Com Test (round 2) e Security (round 1) verdes, a **feature está pronta** para o Furnace, o Expo e a aprovação do usuário.

O LOW #1 desta entrega e o LOW #1 da entrega 1 ficam como **pré-requisito de qualquer feature social ou de ranking**.
