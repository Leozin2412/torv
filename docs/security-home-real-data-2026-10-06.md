# Security Review: Home com dados reais (`GET /activities/summary`)

- **Data:** 2026-10-06
- **Branch:** `feat/workout-module`
- **Escopo:** commits `688de02` (backend: rota, controller, repository), `23072d2` e `6b6b510` (Home e `services/activities.ts`). O `b20508f` é só o relatório de QA. O diff `688de02^..6b6b510` tem 6 arquivos: 3 de backend, 1 teste, 2 de frontend. Sem migration, dependência ou mudança de schema.
- **Pré-condição:** QA verde (`docs/qa-home-real-data-2026-10-06.md`, PASS com 3 LOW de produto, sem achado de segurança).
- **Método:** revisão estática do código (`activities.routes.js`, `activities.controller.js`, `activities.repository.js`, `auth.middleware.js`, `server.js`, `schema.prisma`, migration do índice, `services/activities.ts`, `Home/index.tsx`). Não subi backend, não chamei a API, não usei navegador e não toquei no banco.
- **Veredito: PASS.** 0 CRITICAL, 0 HIGH, 0 MEDIUM, 0 LOW. 3 INFO (#1 a #3).

## Resultado por foco

### 1. Injeção no SQL cru: sem achado ✅

`activities.repository.js:25-29` usa `prisma.$queryRaw` como **tagged template**. O Prisma manda cada `${}` como parâmetro ligado (`$1`, `$2`, `$3`), nunca por concatenação. Não há `$queryRawUnsafe`, `Prisma.raw` nem `Prisma.sql` com texto montado.

| Valor | Origem | Tratamento |
|---|---|---|
| `userId` | `request.user.userId` (`sub` do JWT) | parâmetro + `::uuid` |
| `tzOffsetMin` | query | parâmetro + `::int`; Ajv exige inteiro entre -840 e 840 |
| `before` | calculado no controller | `Date` do JS, parâmetro + `::timestamptz` |
| `'STRENGTH'`, `'UTC'`, `'YYYY-MM-DD'`, `1000` | literais no SQL | fixos |

- `make_interval(mins => $n::int)`: o valor entra como parâmetro, não como texto. O QA já provou que o cast explícito não dá 500 (seção 1.1 do relatório de QA).
- `date` (string do cliente) **não chega ao SQL**. O controller só a usa em `Date.parse` e `isoDay`, e daí sai um `Date` calculado.
- `caloriesBetween` usa `prisma.activities.aggregate` (ORM, parametrizado).

### 2. Validação da query: sem achado ✅

- `date`: `pattern` ancorado `^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$` + ida e volta `isoDay(dateMs) !== date` no controller. Rejeita `2026-02-31`. O regex tem tamanho fixo, sem backtracking (sem ReDoS).
- `tz_offset_min`: `Type.Integer` com minimum/maximum. Ajv rejeita decimal e não numérico.
- Os dois campos são obrigatórios (`Type.String` e `Type.Integer` sem `Optional`), então não existe caminho com `undefined` indo para o SQL.
- Parâmetros extras na query não são usados em lugar nenhum.
- Os 400 vêm do schema ou do literal do controller (`querystring/date must be a valid calendar date`). Nenhum reflete a entrada.

### 3. Autenticação e isolamento (IDOR): sem achado ✅

- `fastify.addHook('preHandler', authenticateToken)` (`activities.routes.js:26`) vale para o plugin inteiro, então `/summary` está coberta. A rota nova está no mesmo plugin, dentro do prefixo `/activities`.
- A rota **não aceita `user_id` nem `id` do cliente**. O dono vem só do token verificado por JWKS do Supabase com `issuer` conferido.
- Os dois acessos a dados filtram por `user_id = userId`: `strengthDays` no WHERE do SQL cru, `caloriesBetween` no `where` do ORM. Não há leitura de outro usuário, então não existe vetor de IDOR.
- O índice parcial `activities_strength_user_start_key (user_id, start_time) WHERE activity_type='STRENGTH'` (migration `20260930200000`) casa com a consulta do streak.
- Sem token: 401. Token inválido: 403. Mesmo contrato do `GET /activities`.

### 4. DoS por range e carga (streak sem limite de dias): sem achado, ver INFO #1

- O streak lê no máximo **1000 linhas** (`LIMIT 1000`, marcado com `ponytail:`). O loop em `streakFrom` roda no máximo 1000 vezes, e o `break` sai na primeira lacuna.
- Não há range controlado pelo cliente. O intervalo de calorias é sempre 1 dia (`before = from + DAY_MS`). A janela do streak é "tudo antes de `before`", mas o teto é o `LIMIT`.
- Os dados varridos são só os do próprio usuário, então um usuário não degrada a consulta de outro além da carga normal do banco.

### 5. Vazamento de informação em erros: sem achado

- Erro de banco ou Prisma cai no `setErrorHandler` de `server.js:58-73` e vira `{ error: 'An unexpected error occurred' }` com 500. O erro completo só vai para o log do servidor.
- O 400 do Ajv devolve a mensagem do schema, sem eco do valor.
- Resposta com `additionalProperties` filtrado pelo schema `Summary` (`streak_days`, `calories_burned`). Nada de campo interno.

### Frontend (`23072d2`, `6b6b510`)

- `activitiesApi.summary` chama só a rota própria (`/activities/summary`) pela instância `api`, com o token no interceptor. Sem host externo, sem segredo, sem `dangerouslySetInnerHTML` (React Native).
- Os valores renderizados são `Integer` do backend em `<Text>`, e `toLocaleString('pt-BR')` não interpreta marcação.
- `console.log('Failed to load activity summary', error)` registra o erro do axios no dispositivo. Já é o padrão das outras chamadas da tela e não inclui token no objeto de erro impresso aqui. Sem achado.
- `6b6b510` só troca a data do `GET /diet/summary` para a data local. Sem impacto de segurança.

---

## Achados

### #1 INFO: `strengthDays` não tem teto de data e o `DISTINCT` por expressão ordena tudo que casa

- **Camada:** backend
- **Onde:** `activities.repository.js:25-29`
- **Cenário:** `SELECT DISTINCT to_char(...) ... ORDER BY day DESC LIMIT 1000` precisa calcular o dia de **todas** as linhas STRENGTH do usuário antes de `before` para deduplicar e ordenar. O `LIMIT` só corta o resultado, não a varredura. Um usuário com muitas sessões gravadas faz a consulta ficar mais cara a cada chamada da Home (cada foco da tela).
- **Impacto:** só carga, e só do próprio usuário. Não vaza dado, não cruza usuário. Fica dentro do rate limit já listado como pendência (LOW #1 da entrega 1, sem rate limit em `/workouts/*`).
- **Fix (se um dia importar):** limitar a janela, por exemplo `start_time >= before - interval '1000 days'`, ou limitar a varredura com subconsulta `ORDER BY start_time DESC LIMIT N` antes do `DISTINCT`.

### #2 INFO: `date` com ano 0000 ou perto de 9999 pode virar 500 em vez de 400

- **Camada:** backend
- **Onde:** `activities.routes.js:50` (`\d{4}`) e `activities.controller.js:47-53`.
- **Cenário (não testado, só leitura do código):** `date=0000-01-01` ou `date=9999-12-31` com `tz_offset_min` extremo passa no regex e na ida e volta do `Date`, mas o `Date` resultante (`from`/`before`) pode ficar fora do que o Postgres aceita como `timestamptz` (ano 0, ano 10000), e o Prisma ou o banco recusam.
- **Impacto:** no pior caso, um 500 genérico (`An unexpected error occurred`) com a pilha só no log. Sem vazamento e sem execução. Só afeta quem está autenticado, e só a própria chamada.
- **Fix:** estreitar o ano no schema, por exemplo `^(19[7-9]\d|20\d\d|21\d\d)-...`, ou comparar `dateMs` com limites no controller e devolver 400.

### #3 INFO: o `preHandler` de auth roda depois da validação do schema

- **Camada:** backend (padrão do projeto, não é da rota nova)
- **Onde:** `activities.routes.js:26`
- **Cenário:** no ciclo do Fastify a validação da querystring acontece antes do `preHandler`. Um cliente sem token com `date` inválida recebe 400 (mensagem do schema) em vez de 401. Com a query válida, recebe 401.
- **Impacto:** nenhum. O 400 só confirma o formato do contrato, que já é público no Swagger fora de produção. A rota não toca banco antes da auth.
- **Fix:** nenhum necessário. Se quiser 401 primeiro, mover o hook para `onRequest`.

---

## Pendências (sem mudança neste round)

- **LOW #1 da entrega 1 (sem rate limit em `/workouts/*`):** a falta de limite por usuário vale também para `/activities/summary`, o que alimenta o INFO #1.
- **LOW #1 da entrega 2 (`started_at`, volume e carga vêm do cliente):** continua sendo pré-requisito de qualquer feature social ou de ranking. Aqui ele pesa um pouco mais: o streak da Home sai de `start_time` enviado pelo cliente, então o número é auto-declarado. Sem impacto de segurança enquanto o valor aparecer só para o próprio usuário.
- **INFO #2 a #5 do round de cargas e boas-vindas (CORS `*`, `hostUri` só de dev, etc.):** sem mudança.
- **LOW de produto do QA (calorias nunca gravadas, card mockado de 180 kcal, refresh na virada da meia-noite):** não são de segurança.

## Conclusão

A rota nova é segura: o SQL cru é parametrizado, todo valor do cliente é validado antes de chegar ao banco, o usuário vem só do JWT e as duas consultas filtram por `user_id`, então não há IDOR. O streak tem teto de 1000 linhas e o intervalo de calorias é de 1 dia. Os erros de servidor viram mensagem genérica. O frontend só chama a API própria e não renderiza HTML. Com QA e Security verdes, a feature Home com dados reais está liberada. Os 3 INFO são endurecimento opcional.
