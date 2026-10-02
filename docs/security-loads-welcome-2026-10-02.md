# Security Review: Cargas por série, período do Histórico e boas-vindas

- **Data:** 2026-10-02
- **Branch:** `feat/workout-module`
- **Escopo:** `git diff 66c2c12..HEAD -- BackEndTorv FrontEndTorv BancoDeDadosTorv` (44 arquivos, 15 commits de código: `57d5834`, `f218b97`, `60f84ec`, `8386f73`, `fc5924f`, `d61fc7c`, `c40c20f`, `2a7cf11`, `45f48f9`, `7971d90`, `3e3f43c`, `46e8f61`, `214a50d`, `348f2c2`, `d351263`). HEAD = `5d336db`, que é só o relatório de QA.
- **Pré-condição:** QA verde (`docs/qa-loads-welcome-*-2026-10-02*.md`).
- **Veredito: PASS.** Não há CRITICAL, HIGH nem MEDIUM. Há **1 LOW** (#1, backend): o prefixo `urn:uuid:` passa na validação e vira 500 no SQL cru do `PATCH /workouts/routines/:id/weights`. O fix é uma constante no schema. Não bloqueia.

Não imprimi senha nem token. Eles ficaram em variáveis de scripts descartáveis do scratchpad, fora do repo.

**Provas executadas:**

- **Ao vivo:** `fetch` contra o backend do Furnace (`localhost:3000`), sem subir nem parar nada e sem navegador. Usei 4 contas novas, `qa.sec3.{a,b}.1790969557563@torvtest.dev` e `qa.sec3.{c,d}.1790969683807@torvtest.dev`, criadas por `POST /auth/register`. Elas continuam no banco, porque não existe endpoint para apagar conta.
- **Catálogo do banco:** só metadados, como `torv_api`. Nenhuma linha de usuário foi lida. As únicas leituras de dados foram as das minhas contas de teste, pela API.
- **Simulação determinística do `History.tsx` do HEAD**, com o fonte extraído por `git show`.
- **`npm audit` e conferência da integridade no registry.**
- **Testes:** backend `npm test` com **92/92**, frontend `node --test src/utils/*.test.mjs` com **32/32**, `npx tsc --noEmit` com exit 0.

## Resumo

| # | Sev. | Camada | OWASP | Onde | Resumo |
|---|---|---|---|---|---|
| 1 | LOW | Backend | A03/A05 | `workout.schemas.js:8`, `workout.repository.js:161,169` | `urn:uuid:<id>` passa no `format: 'uuid'` e quebra o `::uuid` do SQL cru: 500 genérico, só autenticado |
| 2 | INFO | Backend | A04 | `workout.schemas.js:15` | `weight_kg` aceita `true`→1, `false`→0 e `""`→null (coerção do Ajv) |
| 3 | INFO | Backend | A05 | `server.js:16` | CORS com `*` para qualquer origem, inalterado. Só o `PATCH` entrou na lista |
| 4 | INFO | Frontend | A05 | `services/api.ts:8-9` | `hostUri` é só de dev e falha fechado em release. Em túnel, o host é de terceiros (porta 3000) |
| 5 | INFO | Frontend | A06 | `package.json` | `expo-constants` limpo. O `axios` 1.17.0 tem advisories, mas é anterior a esta feature |

---

## Checklist do plano

### IDOR no `PATCH /workouts/routines/:id/weights` ✅

**Código** (`workout.repository.js:158-174`):

- O `userId` vem só de `request.user.userId` (`workout.controller.js:98`). O corpo não tem `user_id`, e o Fastify remove campos extras.
- O `findFirst({ id: routineId, user_id: userId })` vem **antes** de qualquer escrita, e devolve `null` para rotina alheia ou inexistente.
- O UPDATE também tem o dono no WHERE: `wr.id = ${routineId}` **e** `wr.user_id = ${userId}`, ligados por `re.routine_id = wr.id` e `rs.routine_exercise_id = re.id`. Mesmo sem o `findFirst`, só série de rotina do próprio usuário é alcançável.
- O `exercise_id` do corpo só entra como condição de junção (`re.exercise_id = v.exercise_id`). Ele não escolhe a linha a gravar.

**Ao vivo**, com A (dona da rotina) e B (outra conta):

| Cenário | Resultado |
|---|---|
| B faz `PATCH` na rotina de A (3 séries válidas) | ✅ **404** `Not found`, e a rotina de A **fica igual** (conferida por `GET` da dona) |
| B com `user_id`, `userId` e `routine_id` de A no corpo | ✅ 404, sem efeito |
| B com o header `x-user-id` de A | ✅ 404, sem efeito |
| Corpo do 404: rotina alheia vs UUID inexistente | ✅ **idênticos** (`{"error":"Not found"}`): não há oráculo de existência |
| A nas próprias séries: 3 batem e 3 não (posição 9, série 7, exercício trocado) | ✅ `updated: 3`, e os pesos ficam `[[20,null],[null,null,12.5]]`. As 3 sem correspondência são ignoradas |
| A com campos extras no item e no corpo | ✅ 200, campos descartados |
| Sem token, corpo válido | ✅ 401 |
| Token inválido | ✅ 403 |

### SQL injection ✅

O único SQL cru novo é o `updateRoutineWeights`. Ele usa `Prisma.sql` com `Prisma.join`, e cada valor é um parâmetro (`$1`, `$2`…), com cast explícito (`::int`, `::uuid`, `::numeric`). Não há `Prisma.raw`, `$queryRawUnsafe` nem `$executeRawUnsafe` em `BackEndTorv/src`.

| Entrada | Resultado |
|---|---|
| `exercise_id` = `<uuid>'; DROP TABLE routine_exercise_sets;--` | ✅ 400 `must match format "uuid"` |
| `exercise_id` = `' OR '1'='1` | ✅ 400 |
| `weight_kg` = `5); DELETE FROM routine_exercise_sets;--` | ✅ 400 `must be number,null` |
| `position` = `1 OR 1=1`, `set_number` = `1;--` | ✅ 400 `must be integer` |
| `:id` = `<uuid>'; DROP TABLE x;--` e `<uuid>%00` | ✅ 400 `params/id must match format "uuid"` |
| Tabela depois da bateria | ✅ intacta (`[[21,null],[null,null,12.5]]`) |

A única forma de UUID que passa na validação e não vira parâmetro válido é o `urn:uuid:`. Ver **LOW #1**.

### Limites do corpo ✅

Ao vivo, nos 3 pontos de entrada da carga (`PATCH`, `POST /workouts/sessions` e rotina):

| Caso | Resultado |
|---|---|
| 200 itens / 201 itens / 0 itens / `sets` ausente | ✅ 200 (448 ms, 2 queries) / 400 `must NOT have more than 200 items` / 400 / 400 |
| Corpo com mais de 1 MB | ✅ 413 `Request body is too large` |
| Corpo que não é JSON | ✅ 400 |
| `weight_kg` 0 / 999,99 / 0,001 | ✅ 200. O `numeric(6,2)` arredonda o 0,001 |
| `weight_kg` 1000 / −0,01 / 999,994 / `"abc"` / `"1e3"` / `{}` / `[7]` / ausente | ✅ 400 |
| `position` 0 / 21 / 1,5 | ✅ 400 |
| `set_number` 0 / 11 / −1 | ✅ 400 |
| Sessão: `weight_kg` 1000 / −1 / `"x"` | ✅ 400 |
| Sessão: `weight_kg` ausente (app antigo) / `null` / 55,55 | ✅ 201. A leitura devolve `[55.55, null]` como `number`/`null` |

- **Banco:** o CHECK `BETWEEN 0 AND 999.99` existe em `workout_sets` e em `routine_exercise_sets`. Nenhuma linha está fora da faixa nas duas tabelas. O Ajv é a primeira barreira e o CHECK a segunda.
- **Tamanho do UPDATE:** 200 linhas × 4 parâmetros = 800 parâmetros, bem abaixo do limite do Postgres.
- **Os limites batem com o resto:** 20 exercícios × 10 séries = 200, que é o máximo de séries de um treino.
- **Coerção do Ajv:** ver **INFO #2**.

### `POST /profile/welcome` ✅

`profile.repository.js:29`: `updateMany({ where: { user_id: userId, welcomed_at: null }, data: { welcomed_at: new Date() } })`. O `userId` vem do token, e não há corpo nem parâmetro. Ao vivo:

| Cenário | Resultado |
|---|---|
| Sem token | ✅ 401 |
| B marca, com `user_id` de A no corpo | ✅ 204. **A segue `welcome_pending: true`**, B passa a `false` |
| B marca com o header `x-user-id` de A | ✅ A segue pendente |
| Repetir | ✅ 204, e só a 1ª chamada grava o horário (conferido pelo QA no banco) |
| `GET`/`PUT`/`PATCH`/`DELETE` em `/profile/welcome` | ✅ 404 |

- O 400 que apareceu foi só no teste com `content-type: application/json` e corpo vazio. O app manda `{}` (`AuthContext.tsx:113`), então não afeta o uso.
- O `welcome_pending` no `GET /profile` é um booleano calculado de `welcomed_at == null` (`profile.controller.js:64`). O horário em si não é exposto.

### `from` e `before` em `/activities` ✅

`activities.controller.js:7-16` valida os dois com o mesmo guarda do round 2 do histórico. A mensagem do 400 usa só o literal `from`/`before`, sem refletir a entrada.

| Cenário (com token) | Resultado |
|---|---|
| `from` válido; `from` 0000 até `before` 9999 | ✅ 200 |
| `from` com fuso só de hora (`-03`) / segundo bissexto / sem fuso / `abc` / vazio | ✅ **400** `querystring/from must match format "date-time"`. O Ajv aceita os 2 primeiros e o `Date` do controller os recusa, antes do repository |
| `from` = `…'; DROP TABLE activities;--` | ✅ 400 |
| `from` repetido | ✅ 400 `must be string` |
| `from` > `before` e `from` == `before` | ✅ 200 com lista vazia, sem erro |
| `from` + `limit=51` | ✅ 400 |
| 400 do `from` e payload `<script>` | ✅ o valor **não volta** na resposta |
| Sem token, `from` válido | ✅ 401 |
| Sem token, `from=…-03` | ✅ 401: o guarda fica depois do auth, então não há resposta nova antes do login |

Com um treino real, na fronteira (`start_time` = S):

| Filtro | Retorno |
|---|---|
| `from=S` | 1 (inclusivo) |
| `from=S+1ms` | 0 |
| `before=S` | 0 (exclusivo) |
| `before=S+1ms` | 1 |
| `from=S&before=S+1ms` | 1 |
| B com a mesma janela | **0**: não vê o treino de A |

- A busca continua escopada em `user_id` (`activities.repository.js:9`).
- Os campos do item não mudaram (6 campos, sem `user_id`).
- A condição `gte`/`lt` já exclui `start_time` NULL, e o `limit` continua ≤ 50.

### CORS com `PATCH` ✅ (INFO #3)

`server.js:16` só acrescenta `'PATCH'` à lista de métodos. Não há `origin` nem `credentials` novos.

Preflight ao vivo, com `Origin: http://evil.example` ou `http://localhost:8081`, em `OPTIONS …/weights` com `Access-Control-Request-Method: PATCH`:

- Resposta 204.
- `Access-Control-Allow-Origin: *`.
- `Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE`.
- `Access-Control-Allow-Headers`: os pedidos (`authorization,content-type`).
- Sem `Access-Control-Allow-Credentials`.

É a mesma origem de antes: o `*` que o INFO #8 de `security-supabase-anon-exposure-2026-09-25.md` já registrou. A auth é Bearer em header, sem cookie, então uma página de outra origem não tem o token e não há CSRF.

### `hostUri` no front ✅ (INFO #4)

`services/api.ts:8-9`:

```ts
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
const baseURL = process.env.EXPO_PUBLIC_API_URL || `http://${devHost || '127.0.0.1'}:3000`;
```

- **Só existe em dev.** No `expo-constants` instalado (`Constants.types.ts:198`), o campo está documentado como "Only present during development using @expo/cli". Num build de release o `hostUri` é `undefined`, e o `baseURL` cai em `http://127.0.0.1:3000`. Isso **falha fechado**: nada sai do aparelho, e o app não conversa com host nenhum até ter `EXPO_PUBLIC_API_URL`.
- **O que vaza em dev:** só o IP da máquina de desenvolvimento na rede local, que o Metro já anuncia ao app. O `baseURL` não é logado, não vai para storage nem para o servidor. O diff não tem `console.*`.
- **`EXPO_PUBLIC_API_URL` continua prevalecendo.** Mudou o `??` para `||`, e string vazia agora conta como ausente (antes virava `baseURL` vazio). O `.env` segue no `.gitignore` (`FrontEndTorv/.env`), e o diff não cria nenhum `EXPO_PUBLIC_*` novo.
- **O diff local do `api.ts`, que o plano diz ter sido absorvido,** não está mais modificado: `git status` não lista o arquivo.

**INFO #4: casos de borda de dev, sem impacto em produção.**

- Em **modo túnel**, o `hostUri` traz o host do túnel (um domínio de terceiros), e o app mandaria o `login` e o Bearer para `http://<host-do-túnel>:3000`. O túnel só encaminha o Metro, então a conexão falha e nada é entregue. O comentário do código já manda usar `EXPO_PUBLIC_API_URL` nesse caso.
- Um host IPv6 (`[::1]:8081`) vira `[` e produz uma URL inválida. É só falha de dev.
- O HTTP é em claro. Isso já era assim, e nada no código obriga `https` quando a `EXPO_PUBLIC_API_URL` de produção é definida. É um item de deploy.

### Dependência `expo-constants` ✅ (INFO #5)

- **O que mudou:** `package.json` ganhou `"expo-constants": "~57.0.20"`. O lock tem o mesmo pacote subindo de 57.0.19 para 57.0.20. Ele já estava na árvore, como dependência do `expo`, do `expo-asset` e do `@expo/cli`, e agora é direta. As outras linhas do lock não mudaram: sem pacote novo e sem dependência transitiva nova (a única é `@expo/env ~2.4.3`, inalterada).
- **Integridade:** o `integrity` do lock é **idêntico** ao do registro (`npm view expo-constants@57.0.20 dist.integrity`). A versão foi publicada em 2026-09-29, e os mantenedores são a equipe da Expo. O pacote não tem script de instalação (só `lint`, `test`, `build`, `clean`, `test:rsc`, `expo-module`). A licença é MIT.
- **`npm audit`:** **sem nenhuma entrada** para `expo-constants` nem para o `@expo/env`. `npm ci --dry-run` passa e `npm ls` mostra uma única cópia (57.0.20, deduplicada).
- **INFO #5, fora do diff:** o `npm audit` geral lista 18 advisories (7 high, 11 moderate) em outros pacotes. O lock desta feature só mexeu no `expo-constants`, então são anteriores a ela. O mais relevante é o **`axios` 1.17.0** (faixa vulnerável 1.0.0 a 1.19.0, com fix disponível), porque é o cliente que carrega o Bearer e o refresh token. Os advisories são sobretudo de gadgets de prototype pollution e do adapter Node. Recomendo um `npm update axios` num commit à parte.

### Rascunho de treino (AsyncStorage) com cargas ✅

- **Escopo e ciclo de vida:** a chave é `torv.workoutDraft.<userId>` (`workoutDraft.ts:6`). O rascunho sai depois que o servidor confirma o POST, ao descartar e no logout (`AuthContext.tsx:104`). Duas contas no mesmo aparelho não se misturam.
- **Conteúdo novo:** `weights`, `planned_weights` e `weight_kg` por série: números. O estado não tem token, senha, e-mail nem outro dado de conta. Também não é logado: o grep nas linhas adicionadas não achou `console.`, `Authorization` nem `SecureStore`.
- **Leitura robusta:** o `upgradeState` fica **dentro** do `try` (`workoutDraft.ts:12`). Um rascunho antigo ou corrompido é migrado ou descartado, sem travar a tela. Rascunho antigo sem `planned_weights` usa a carga atual como base e não gera o card de "cargas diferentes".
- O AsyncStorage não é criptografado. Isso já valia para o rascunho (tempos, exercícios e ids), e uma carga em kg não muda a classificação do dado.

### Banco de dados (A01/A05) ✅

Consulta ao catálogo como `torv_api`, só metadados:

| Item | Resultado |
|---|---|
| `workout_sets.weight_kg` | `numeric(6,2)`, nullable, com CHECK `weight_kg IS NULL OR BETWEEN 0 AND 999.99` |
| `user_profiles.welcomed_at` | `timestamptz`, nullable |
| `routine_exercise_sets.weight_kg` | `numeric(6,2)`, com o mesmo CHECK (já existia) |
| RLS | ligada em `workout_sets`, `user_profiles`, `routine_exercise_sets`, `routine_exercises` e `workout_routines` |
| Policies | só `torv_api_full_access`, para `{torv_api}` |
| Privilégios do `anon` e do `authenticated` nas 3 tabelas | **nenhum** (S/I/U/D = 0). A consulta de privilégio por coluna para `anon`, `authenticated` e `PUBLIC` nas colunas novas devolve vazio |
| Linhas fora da faixa 0–999,99 | 0 nas duas tabelas |

- As colunas novas herdam o RLS e o lock-down da tabela. Não houve grant novo.
- O `BancoDeDadosTorv` (`Regras BD.sql` e `SQL BANCO DE DADOS.sql`) só ganhou a coluna, o CHECK e comentários. Não há segredo, e não há dado real.
- O Prisma não registra a migration `20261002120000`: a `_prisma_migrations` aparece vazia para o `torv_api`. As colunas e os CHECKs existem com os nomes da migration. Isto não é do diff, e o QA do banco já tinha aplicado o SQL.

### Frontend: demais pontos ✅

- **Entrada da carga** (`WorkoutSession/index.tsx`, `routineForm.ts:56`): o `parseWeight` só aceita `^\d+(\.\d{1,2})?$` e devolve `NaN` no resto. O `setWeight` limita a 0–999,99 com 2 casas e ignora `NaN`. O campo tem `maxLength=6`. O que sai para a API respeita o schema, e o servidor revalida.
- **`WelcomeModal`:** o nome entra como `<Text>` do React Native, sem HTML nem `dangerouslySetInnerHTML`. O `dismissWelcome` fecha na hora e faz `api.post('/profile/welcome', {})` em melhor esforço, só na instância `api` e sem logar o erro.
- **`WorkoutSummary`:** o `PATCH` usa `draft.routine_id`, que vem do estado local. Quem protege é o servidor (dono no WHERE). O 404 vira "Essa rotina não existe mais", sem mostrar o corpo do erro.
- **Sem chamadas novas além das revisadas:** `PATCH …/weights`, `POST /profile/welcome` e `GET /activities` com `from`/`before`, sempre pela instância `api`. Não há `WebView`, `Linking` externo, `eval` nem `EXPO_PUBLIC_*` novos.
- **Período do Histórico e a corrida do round anterior:** o `History.tsx` agora filtra por tipo **e** período. A mesma linha que fechou o LOW da seta continua no `loadFirst` (`loadedKey.current = null`). Reexecutei a simulação determinística, agora com o `History.tsx` do **HEAD** (extraído por `git show`) e o `periodRange`, o `periodKey` e o `prependNew` reais:

  | | HEAD | HEAD sem a linha do fix (controle) |
  |---|---|---|
  | A→B→A dirigido (B muda só o período, só o tipo, ou os dois; 2 ordens de chegada) | **0/6** misturadas | 6/6 |
  | Fuzz: 4 seeds × 5.000 sequências × 20 ações (tipo, período, foco, `loadMore`, puxar, respostas e falhas fora de ordem) com tela `ready` misturada em algum passo | **0 / 20.000** | 653 / 20.000 |
  | Misturadas no fim | **0 / 20.000** | 1.022 / 20.000 |

  A volta do resumo continua em `refreshTop` (o id do request não muda e não há spinner), e um erro na 1ª carga faz o próximo foco recarregar do zero. O controle prova que a simulação detecta o defeito. O `from` que o `loadMore` recalcula com o relógio atual só pode mudar na virada do dia (afeta só o limite do período, não mistura filtros).

---

## Achados

### #1 LOW: `urn:uuid:<id>` passa na validação e vira 500 no SQL cru do `PATCH …/weights` (integridade de resposta, só autenticado)

- **Camada:** backend
- **Onde:** `BackEndTorv/src/routes/workout.schemas.js:8` (`const Uuid = Type.String({ format: 'uuid' })`) e `:77`, com `BackEndTorv/src/repository/workout.repository.js:161` (`${s.exercise_id}::uuid`) e `:169` (`${routineId}::uuid`).
- **Causa:**
  - O `format: 'uuid'` do `ajv-formats` 3.0.1 aceita o prefixo `urn:uuid:` (`/^(?:urn:uuid:)?[0-9a-f]{8}-…$/i`, em `ajv-formats/dist/formats.js:31`).
  - O Prisma ORM também aceita (o `findFirst` com `urn:uuid:<id>` acha a linha, porque o parser de UUID dele aceita o prefixo). Por isso o resto da API não quebra.
  - O Postgres **não** aceita. O `$executeRaw` com `::uuid` falha com `22P02 invalid input syntax for type uuid`, que o Prisma devolve como `P2010`.
  - Confirmado como `torv_api`: `SELECT 'urn:uuid:<id>'::uuid` → P2010/22P02. Com UUID normal ou em maiúsculas, o mesmo SELECT normaliza e funciona.
- **Prova ao vivo** (token da dona da rotina):

  | Request | Resultado |
  |---|---|
  | `PATCH` com `exercise_id` = `urn:uuid:<id válido>` | ❌ **500** `{"error":"An unexpected error occurred"}` |
  | `PATCH /workouts/routines/urn:uuid:<id da própria rotina>/weights` | ❌ **500**, igual |
  | Os mesmos requests com o UUID em maiúsculas | ✅ 200 `updated: 1` |
  | B com `urn:uuid:<id da rotina de A>` | ✅ 404: o `findFirst` roda antes do SQL cru, então não há 500 nem oráculo |
  | `GET /workouts/routines/urn:uuid:<id>` e `POST /workouts/sessions` com `exercise_id` `urn:uuid:` | ✅ 200 / 201: o ORM aceita |

- **Impacto:**
  - **Só autenticado**, e o corpo da resposta é o genérico, sem detalhe do Prisma.
  - **Nenhuma escrita acontece** e nenhum dado de outro usuário é alcançado.
  - O erro entra no log do servidor como 5xx. Isso polui os alertas, e é da mesma classe do LOW do `before` no histórico (round 1, `Invalid Date` → 500), com a mesma gravidade.
  - **O app não envia essa forma**, então o defeito é latente. Só aparece com um cliente que escreve o `urn:uuid:` de propósito.
- **Fix (1 lugar, 2 linhas):** trocar a validação pela forma que o Postgres aceita. Isso cobre o `IdParams`, o `exercise_id` do `RoutineBody` e do `SessionBody` e o do `RoutineWeightsBody`:

  ```js
  // workout.schemas.js:8. O format 'uuid' do Ajv aceita "urn:uuid:", que o Prisma ORM aceita mas o ::uuid do SQL cru não.
  const UUID_RE = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  const Uuid = Type.String({ pattern: UUID_RE });
  // :77  routine_id: Type.Optional(Type.Unsafe({ type: ['string', 'null'], pattern: UUID_RE })),
  ```

  - **Teste:** um caso no `workout.routes.test.js` com `exercise_id` = `urn:uuid:<uuid>` e `:id` = `urn:uuid:<uuid>`, esperando 400 e o repository com `callCount` 0.
  - **Cuidado:** a mensagem do 400 passa de `must match format "uuid"` para `must match pattern …`. Se algum teste confere o texto, ajustar.
  - **Alternativa mínima**, só no repositório: `String(id).replace(/^urn:uuid:/i, '')` antes do `::uuid`. Eu prefiro o schema, porque corrige a causa em todos os chamadores.

### INFO #2: a coerção do Ajv aceita `true`, `false` e `""` como carga

- **Onde:** `workout.schemas.js:15` (`Weight`, usado no `RoutineBody`, no `SessionBody` e no `RoutineWeightsBody`), com o `coerceTypes` do Fastify.
- **Prova:** no `PATCH`, `weight_kg: true` grava **1**, `false` grava **0** e `""` grava **null** (conferido pela leitura da rotina). Strings numéricas (`"12.5"`) também são coeridas. `"7,5"`, `"abc"`, `"1e3"`, `[7]` e `{}` dão 400.
- **Impacto:** é só dado do próprio usuário, dentro da faixa e com o CHECK do banco por baixo. O app nunca manda esses tipos. Não há ganho para o atacante.
- **Se quiser fechar:** nada a fazer agora. Se a carga virar dado de ranking, vale rejeitar tipos não numéricos.

---

## Pendências (sem mudança neste round)

- **LOW #1 da entrega 1 (sem rate limit em `/workouts/*`):** agora vale também para o `PATCH …/weights`, a rota nova mais pesada (2 queries e um UPDATE de até 200 linhas, ~450 ms), e para o `POST /profile/welcome`.
- **LOW #1 da entrega 2 (`started_at` e volume vêm do cliente):** a carga por série também é confiada ao cliente. As duas LOW continuam **pré-requisito de qualquer feature social ou de ranking**.
- **INFO #1 do gerador:** os privilégios de escrita do `torv_api` em `workout_template_slots`.
- **INFO do padrão do módulo:** o `authenticateToken` roda no `preHandler`, depois da validação. Um `PATCH` sem token e com corpo inválido devolve 400, e não 401. Nenhum dado vaza.

## Conclusão

A feature está bem fechada nos pontos pedidos:

- **IDOR:** o `PATCH …/weights` e o `POST /profile/welcome` usam só o `user_id` do token. Rotina alheia dá 404 idêntico ao de rotina inexistente, sem efeito colateral.
- **SQL injection:** o SQL cru é todo parametrizado, e nenhuma entrada de injeção chega ao banco.
- **Limites:** 200 itens, carga 0–999,99, posição e série têm validação no Ajv e CHECK no banco.
- **`from`/`before`:** validados antes do repository, sem refletir a entrada.
- **CORS, `hostUri` e `expo-constants`:** o CORS ganhou só o método. O `hostUri` é de dev e falha fechado em release. O `expo-constants` não traz advisory e tem integridade confere com o registro.
- **Rascunho local:** só números, por usuário, apagado no logout.

O único defeito é o **LOW #1**: o `urn:uuid:` vira 500 no SQL cru, latente porque o app não o envia. O fix é uma constante de regex em `workout.schemas.js`. Recomendo aplicar antes de qualquer cliente externo usar a API.
