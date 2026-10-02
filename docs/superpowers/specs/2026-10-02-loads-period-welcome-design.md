# Cargas por série, filtro de período, senha, boas-vindas e API no celular — Design

**Data:** 2026-10-02 · **Branch:** `feat/workout-module` · **Base:** módulo de treinos (`2026-09-30-workout-module-design.md`) e histórico (`2026-10-01-workout-history-design.md`), já entregues nessa branch.

## Objetivo

1. **Cargas:**
   - a carga de cada série feita fica registrada no treino;
   - o treino começa com as cargas da rotina, e a pessoa pode mudar a carga durante o treino;
   - ao concluir, ela pode atualizar a rotina com as cargas que ficaram diferentes (tudo ou nada).
2. **Histórico:** filtro por período, com os chips Tudo · 7 dias · 30 dias · 3 meses · Personalizado.
3. **Senha oculta:** bolinhas em vez de quadradinhos.
4. **Boas-vindas:** uma vez por conta, para contas novas e existentes.
5. **Celular:** o app no Expo Go passa a chamar a API.

## Decisões

| Tema | Decisão |
|---|---|
| Ajuste de carga no treino | Só a série atual muda. As próximas continuam com a carga da rotina. |
| O que conta como "diferente" | A carga feita, comparada com a carga com que o treino começou (snapshot no início), não com a rotina no fim. |
| Atualizar a rotina | Tudo ou nada: um card no resumo com "Atualizar rotina" / "Manter". |
| Rota de atualização | Nova: `PATCH /workouts/routines/:id/weights`. Muda só as séries que ainda batem com a rotina (posição + exercício + série); o resto é ignorado. Não reaproveita o `PUT` da rotina, que regrava a rotina inteira e perderia uma edição feita no meio do treino. |
| CORS | Entra `PATCH` em `methods` no `server.js`. Hoje a lista só tem GET/POST/PUT/DELETE, e o preflight do web falharia. |
| Treinos antigos | Ficam com `weight_kg` nulo. Não há backfill (a rotina pode ter mudado desde então). No resumo, carga nula não mostra texto. |
| Período | Calculado no app, no fuso do aparelho. O servidor ganha só `from` (`start_time >= from`); o fim do período é o `before` da primeira página. |
| Senha | Bolinhas nativas: fonte do sistema no campo mascarado com texto. Na Sora, o "•" (U+2022), que o Android e o Chrome usam na máscara, é desenhado como um quadrado (4 pontos retos), e ela não tem o "●" (U+25CF) do iOS. |
| Boas-vindas | Fica no servidor (`user_profiles.welcomed_at`), uma vez por conta, em qualquer aparelho. Sem backfill: as contas atuais também veem a mensagem uma vez. |
| API no celular | Em dev, o host da API vem do `hostUri` do Expo (o IP do PC na rede, onde também roda o backend). `EXPO_PUBLIC_API_URL` continua sobrepondo. |
| Fora do escopo | Repetições por série, carga no item da lista do histórico, e a carga ajustada empurrar as séries seguintes. |

## Database

Uma migration, `BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql`:

```sql
ALTER TABLE "workout_sets" ADD COLUMN "weight_kg" DECIMAL(6,2);
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_weight_kg_check"
  CHECK ("weight_kg" IS NULL OR "weight_kg" BETWEEN 0 AND 999.99);
ALTER TABLE "user_profiles" ADD COLUMN "welcomed_at" TIMESTAMPTZ;
```

- `schema.prisma`:
  - `workout_sets.weight_kg Decimal? @db.Decimal(6, 2)`;
  - `user_profiles.welcomed_at DateTime? @db.Timestamptz`.
- `BancoDeDadosTorv/`: as duas colunas e o CHECK no DDL, no mesmo padrão do sync `193b4f6`.
- **RLS:** as tabelas já têm RLS e a policy `torv_api_full_access`; coluna nova não muda policy.

## Backend

### Carga nas séries

- **`SessionBody.sets[]`** ganha `weight_kg` opcional:
  - `Type.Optional(Type.Unsafe({ type: ['number', 'null'], minimum: 0, maximum: 999.99 }))`;
  - nunca `Type.Union`, por causa do `coerceTypes` do Ajv.
  - Um app antigo, sem o campo, grava `null`.
- **`createSession`** grava `weight_kg: s.weight_kg ?? null`.
- **`getSession`** seleciona `weight_kg`. O controller converte o Decimal com `Number(...)` e devolve `null` quando for nulo.
- **`SessionDetail.sets[]`** ganha `weight_kg: Type.Union([Type.Number(), Type.Null()])`. É resposta, então `Union` é ok.

### `PATCH /workouts/routines/:id/weights`

- **Params:** `IdParams` (uuid).
- **Body:**
  ```json
  { "sets": [{ "position": 1, "exercise_id": "uuid", "set_number": 2, "weight_kg": 65 }] }
  ```
  - `position` 1–20, `set_number` 1–10, `weight_kg` número ou nulo de 0 a 999,99 (`Type.Unsafe`);
  - de 1 a 200 itens.
- **Repository `updateRoutineWeights(userId, routineId, sets)`**, numa transação:
  1. Confere que a rotina é do usuário. Se não for, devolve `null`, e o controller responde 404.
  2. Lê os `routine_exercises` da rotina (`id, position, exercise_id`).
  3. Para cada item que bate com posição + exercício, faz `updateMany` em `routine_exercise_sets` com `routine_exercise_id` e `set_number`.
  4. Soma os `count` e devolve.
- **Resposta 200:** `{ updated: <n> }`. Pode ser 0, quando a rotina mudou e nada bateu.
- **Erros:** sem token → 401; token inválido → 403; body ou params inválidos → 400; rotina de outro usuário ou inexistente → 404.
- **`server.js`:** `methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']`.

### `GET /activities?from=`

- **Querystring:** `from` opcional, `date-time`.
- **Repository:** `start_time` passa a combinar `gte: from` (quando houver) com `lt: before` (quando houver), além do `not: null`.
- **Controller:** valida `from` como faz com `before`. Data que o `new Date()` não consegue ler → 400 `'querystring/from must match format "date-time"'`.
- `from` maior que `before` devolve lista vazia, sem erro.

### Boas-vindas

- **`GET /profile`** devolve `welcome_pending: boolean`, verdadeiro quando `welcomed_at` é nulo. Entra no schema de resposta.
- **`POST /profile/welcome`:**
  - faz `updateMany({ where: { user_id, welcomed_at: null }, data: { welcomed_at: new Date() } })` e responde 204;
  - repetir não muda nada (idempotente);
  - sem token → 401.

### Testes (node:test, mock no singleton do repository e stub do auth, como hoje)

- **`workout.sessions.test.js`:**
  - o POST aceita `weight_kg` número, nulo e ausente, e repassa ao repository;
  - `weight_kg` -1 e 1000 → 400;
  - o GET devolve `weight_kg` convertido para número.
- **Rotina (`PATCH .../weights`):**
  - 200 com `updated`;
  - 404 quando o repository devolve `null`;
  - 400 para lista vazia, mais de 200 itens, `position` 0 e carga fora da faixa;
  - o repository recebe o `userId` do token.
- **`activities.routes.test.js`:**
  - `from` repassado ao repository;
  - `from` inválido → 400;
  - `from` junto com `before`.
- **Perfil:**
  - `welcome_pending` true/false;
  - `POST /profile/welcome` → 204 e o repository chamado com o `userId` do token.
  - Arquivo novo: `profile.routes.test.js`, no padrão dos outros.

## Frontend

### API no celular (`services/api.ts`)

```ts
import Constants from 'expo-constants';

// Dev: o backend roda na mesma máquina do Metro. O hostUri do Expo ("192.168.x.x:8081") dá o IP
// dela na rede local, que o celular alcança; sem ele (web, simulador) fica 127.0.0.1.
// EXPO_PUBLIC_API_URL sobrepõe (túnel, produção).
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const baseURL = process.env.EXPO_PUBLIC_API_URL || `http://${devHost ?? '127.0.0.1'}:3000`;
```

- **`expo-constants`:** entra no `package.json` com `npx expo install expo-constants`. Ela já está em `node_modules`, como dependência do `expo`.
- **`.env`:** continua vazio e não é necessário.
- **Mudança local do usuário no `api.ts`:** fallback `127.0.0.1` e um comentário com uma URL colada por engano. Ela é absorvida: o fallback continua `127.0.0.1`, e o comentário é substituído.
- `screens/Login/index.tsx` continua fora do commit.

### Senha (`components/Input`)

- **Quando:** com `secureTextEntry`, a senha oculta (`!visible`) e o `value` não vazio.
- **O que muda:** o `TextInput` recebe `fontFamily` do sistema, com nome explícito: `Platform.select({ android: 'sans-serif', default: 'System' })`. No web, o react-native-web traduz `System` para a pilha de fontes do sistema. `undefined` não serve, porque o react-native-web ignora valor indefinido e a Sora continuaria.
- **O que não muda:** o placeholder e a senha visível continuam em Sora.

### Boas-vindas (`components/WelcomeModal` + Home)

- **Dados:**
  - `AuthContext.Profile` ganha `welcome_pending?: boolean`;
  - `AuthContext` expõe `dismissWelcome()`, que faz `POST /profile/welcome` (sem bloquear e ignorando erro) e põe `welcome_pending: false` no `user` local.
- **Quando aparece:** a Home mostra o `WelcomeModal` quando `user?.welcome_pending`.
- **Texto:**
  - título "Bem-vindo(a) ao Torv, {primeiro nome}!";
  - três pontos com ícone:
    1. "Com os dados do seu cadastro, montamos um plano de treinos e metas de calorias e macronutrientes iniciais. Eles são genéricos."
    2. "O ideal é ter o acompanhamento de um profissional (educador físico e nutricionista). Em breve isso estará aqui no app."
    3. "Fique à vontade para editar seus treinos e suas metas quando quiser."
  - botão "Começar".
- **Falha no POST:** o modal fecha mesmo assim e reaparece no próximo login.

### Carga durante o treino (`utils/workoutSession.ts` + `screens/WorkoutSession`)

- **`SessionExercise`:**
  - ganha `planned_weights: (number | null)[]`, a cópia de `weights` feita no `createSession`;
  - `weights` passa a ser a carga atual, que pode mudar.
- **`DoneSet`** ganha `weight_kg: number | null`, gravado no `finishSet` a partir de `exercises[e].weights[set]`.
- **`setWeight(s, value)`:**
  - nova função pura; troca `exercises[exercise_index].weights[set_index]`;
  - só nas fases `ready`, `set` e `resting`; em `done` não muda nada;
  - o valor é limitado a `null` ou ao intervalo 0–999,99 e arredondado a 2 casas.
- **Rascunho antigo**, sem `planned_weights` ou sem `weight_kg` nos `sets`: `planned_weights` cai para `weights`, e `weight_kg` ausente vira `null`.
- **`toSessionPayload`** envia `weight_kg` em cada série.
- **`weightChanges(s)`** (nova, pura):
  - lista as séries feitas em que `weight_kg !== planned_weights[set_number - 1]`;
  - formato `{ position, exercise_id, set_number, name, from, to }`;
  - devolve uma lista vazia em treino livre (`routine_id` vazio).
- **Tela:**
  - o texto "60 kg" vira o controle "−  60 kg  +", em passos de 2,5 kg;
  - de 2,5, o "−" vai para "Sem carga" (`null`); de "Sem carga", o "+" vai para 2,5;
  - tocar no valor abre a digitação (teclado decimal), usando o parse e o formato com vírgula que o `routineForm` já tem;
  - o valor é sempre exibido com vírgula ("7,5 kg").

### Resumo (`screens/WorkoutSummary`)

- **Séries:** cada série mostra a carga ("60 kg", com vírgula). Carga nula não mostra texto. `summaryFromState` e `summaryFromDetail` passam a carga para a `SummaryView`.
- **Card "Cargas diferentes da rotina":** aparece depois do status `saved`, quando `weightChanges(draft)` não está vazio.
  - Itens: "{exercício} · série {n}: {de} → {para}", com "Sem carga" para nulo.
  - **"Atualizar rotina":** chama o `PATCH`, mostra spinner e, ao terminar, "Rotina atualizada". Se `updated` vier 0, mostra "A rotina mudou e as cargas não foram aplicadas". Em erro: "Não foi possível atualizar." + "Tentar de novo".
  - **"Manter":** esconde o card.
  - No modo histórico (`sessionId`), o card nunca aparece.
- **Ajuste do rascunho:** o `draft` usado pelo card é o da tela. O `clearDraft` depois do save não afeta o card.

### Filtro de período (`screens/Workouts/History.tsx`)

- **Chips:** uma segunda linha, Tudo · 7 dias · 30 dias · 3 meses · Personalizado, no mesmo estilo e com o mesmo alvo de 44 px dos chips de tipo.
- **`utils/historyPeriod.ts`** (nova, pura, com teste):
  - `periodRange(period, now)` devolve `{ from?: string; before?: string }` em ISO;
  - "N dias": `from` = hoje 00:00 local − (N−1) dias;
  - "3 meses": `from` = mesmo dia de 3 meses atrás, 00:00 local;
  - "custom" (`{ start, end }` em `YYYY-MM-DD`): `from` = início 00:00, `before` = dia seguinte ao fim, 00:00, ambos locais;
  - "all": `{}`.
- **Busca:**
  - a primeira página usa `from` e `before` do período;
  - as próximas usam o mesmo `from` com `before = next_before`;
  - trocar o período recomeça a lista, como a troca de tipo, com a mesma proteção contra resposta atrasada.
- **Personalizado:**
  - abre o `DatePickerModal` para a data inicial (`maxDate` = hoje) e depois para a final (`minDate` = inicial, `maxDate` = hoje);
  - o chip mostra "dd/mm – dd/mm";
  - cancelar qualquer um dos dois mantém o filtro anterior.
- **Vazio com período diferente de Tudo:** "Nenhum treino nesse período", sem o botão "Ver meus treinos".
- **`services/activities.ts`:** `list({ type?, from?, before?, limit? })`.

### `/frontend-design`

- Controle de carga na tela de treino, card de cargas no resumo, segunda linha de chips e `WelcomeModal`.
- Precisa caber em 320 px, com alvos de 44 px.

## Execução e testes

Estritamente sequencial, um recruit por vez. Cada etapa só começa com a anterior verde.

1. **Database** (Torv Database). **Teste da etapa** (`docs/qa-loads-welcome-database-2026-10-02.md`):
   - a migration aplica;
   - o CHECK recusa -1 e 1000;
   - `prisma validate`;
   - `npm test` do backend continua verde.
2. **Backend** (Torv Backend). **Teste da etapa** (`docs/qa-loads-welcome-backend-2026-10-02.md`):
   - `npm test`;
   - contrato ao vivo com contas novas:
     - POST com e sem carga, e GET devolvendo a carga;
     - PATCH de pesos com 200, 404 em rotina de outra conta e itens que não batem;
     - `from` e `before` combinados;
     - `welcome_pending` true → POST → false;
     - preflight `OPTIONS` com `PATCH` liberado.
3. **Frontend** (Torv Frontend, com `/frontend-design`): API no celular, senha, boas-vindas, carga no treino, resumo com card e filtro de período. **Teste da etapa** (`docs/qa-loads-welcome-frontend-2026-10-02.md`):
   - `tsc` e `node --test`;
   - usabilidade no navegador em 412 e 320:
     - boas-vindas aparece uma vez e não volta;
     - senha com bolinhas;
     - ajustar a carga no treino, inclusive digitando "7,5";
     - resumo com as cargas e o card;
     - "Atualizar rotina" refletido no editor;
     - "Manter";
     - chips de período e Personalizado, incluindo cancelar;
     - console sem erros;
   - **manifest Android do Expo** com `hostUri` e app web apontando para a API certa.
4. **Teste completo** (`docs/qa-loads-welcome-full-2026-10-02.md`): estado final, contas novas, todas as etapas juntas + regressão do módulo de treinos e do histórico.
5. **Security** (`docs/security-loads-welcome-2026-10-02.md`): OWASP no diff inteiro, com foco em:
   - IDOR no `PATCH .../weights` e no `/profile/welcome`;
   - limites do body;
   - `from`;
   - CORS.
6. **`revisar3.md`** na raiz, no formato do `revisar2.md`, sem commit.

Se algum teste falhar, o rework vai só para a camada responsável, e o teste daquela etapa roda de novo (novo arquivo, `-roundN`).

## Riscos

- **Celular fora da rede do PC, ou Expo em modo túnel:** o `hostUri` não leva ao backend. O `EXPO_PUBLIC_API_URL` continua como saída. Isso fica registrado no `revisar3.md`.
- **Teste no celular:** o teste automatizado prova o manifest e o web. A prova final no Expo Go é sua.
- **Rascunho em andamento na hora do update:** a migração de formato é tolerante (`planned_weights` e `weight_kg` ausentes), com teste.
