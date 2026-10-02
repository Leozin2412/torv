# Security Review: Cargas por série, período do Histórico e boas-vindas (Round 2)

- **Data:** 2026-10-02
- **Branch:** `feat/workout-module`
- **Escopo:** só o rework do **LOW #1** do round 1, no commit `0a82553`. O diff `9ad44ac..HEAD -- BackEndTorv` muda 3 arquivos: `src/routes/workout.schemas.js` (código) e dois arquivos de teste (`workout.routes.test.js`, `workout.sessions.test.js`). Os commits `92416de` e `eb0dd7c` são só plano e relatório de QA.
- **Round 1:** `docs/security-loads-welcome-2026-10-02.md` (`9ad44ac`), PASS com 1 LOW e 4 INFO. O format `uuid` do Ajv aceitava o prefixo `urn:uuid:`, e o `::uuid` do SQL cru do `PATCH /workouts/routines/:id/weights` o recusava, o que dava 500.
- **Pré-condição:** reteste QA verde (`docs/qa-loads-welcome-backend-2026-10-02-round3.md`, `eb0dd7c`).
- **Veredito: PASS.** O **LOW #1 está fechado**. O pattern não rejeita UUID válido (maiúsculas, minúsculas e misto passam) e não abre ReDoS. Há **1 INFO novo**, só de mensagem de erro (#6). Os INFO #2 a #5 do round 1 seguem como estavam, porque o rework não mexe neles.

Não imprimi senha nem token. Eles ficaram em variáveis de scripts descartáveis do scratchpad, fora do repo. Usei duas contas novas, `qa.sec4.a.1790980963169@torvtest.dev` e `qa.sec4.b.1790980963169@torvtest.dev`, criadas por `POST /auth/register` no backend do Furnace (`localhost:3000`). Não subi nem parei nada, e não usei navegador. As contas continuam no banco, porque não existe endpoint para apagar conta. Não toquei no banco além das chamadas da API.

## O fix (`0a82553`)

`workout.schemas.js:8-11` e `:80`:

```js
const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
const Uuid = Type.String({ format: 'uuid', pattern: UUID_PATTERN });
// SessionBody.routine_id: Type.Unsafe({ type: ['string', 'null'], format: 'uuid', pattern: UUID_PATTERN })
```

- O `format: 'uuid'` fica para a documentação OpenAPI, e o `pattern` é o que recusa o prefixo.
- O `Uuid` é usado em todo o módulo: o `IdParams` (`:id` de rotina, de sessão e do `PATCH`), o `exercise_id` do `RoutineBody`, do `SessionBody` e do `RoutineWeightsBody`. O `routine_id` do `SessionBody` ganhou o pattern à parte (`:80`), porque usa `Type.Unsafe`.
- Os testes ganharam `urn:uuid:` como `exercise_id` do `PATCH`, `:id` do `PATCH`, `routine_id` e `exercise_id` da sessão. Todos esperam 400, e o repository fica com `callCount` 0.
- **Cobertura completa:** o único outro `format: 'uuid'` fora do módulo de treinos é o `logId` de `diet.routes.js:143`. Ele passa só por chamadas do Prisma ORM (`getFoodLogById`, `updateFoodLog`, `deleteFoodLog`), que aceitam o prefixo. Não há `::uuid` com valor do cliente nessa rota, e o `urn:uuid:` não quebra nada ali. Isso está fora deste diff.

## LOW #1: fechado ✅

**Ao vivo**, com A (dona) e B (outra conta):

| Request | Round 1 | Round 2 |
|---|---|---|
| `PATCH` com `exercise_id` = `urn:uuid:<id>` | ❌ 500 | ✅ **400** `must match pattern …` |
| `PATCH` com `exercise_id` = `URN:UUID:<id>` (maiúsculo) | não testado | ✅ 400 |
| `PATCH /workouts/routines/urn:uuid:<id da própria rotina>/weights` | ❌ 500 | ✅ **400** |
| O mesmo, com o token de B | não testado | ✅ 400 |
| `exercise_id` com `{uuid}`, sem hífens, com `\n` ou espaço no final | não testado | ✅ 400 |

O 400 sai do Ajv, antes de qualquer SQL, então nenhum desses requests chega ao repository.

**O pattern vale para todo o módulo** (a mesma forma `urn:uuid:` agora dá 400 em todos os pontos):

| Request | Resultado |
|---|---|
| `GET`, `PUT` e `DELETE /workouts/routines/urn:uuid:<id>` | ✅ 400 (antes o ORM aceitava) |
| `GET /workouts/sessions/urn:uuid:<id>` | ✅ 400 |
| `POST /workouts/routines` com `exercise_id` `urn:uuid:` | ✅ 400 |
| `POST /workouts/sessions` com `routine_id` `urn:uuid:` | ✅ 400 |
| `POST /workouts/sessions` com `exercise_id` `urn:uuid:` | ✅ 400 (antes era 201) |

A rejeição agora é mais estrita que a do ORM, e isso é o esperado: uma única forma de UUID, a que o Postgres aceita.

## O pattern não rejeita UUID válido ✅

O `^[0-9a-fA-F]{8}-…{12}$` aceita as duas caixas. Ao vivo, com `exercise_id` e `:id` do mesmo UUID:

| Forma | Resultado |
|---|---|
| minúsculas (a que a API devolve) | ✅ 200 |
| `MAIÚSCULAS` | ✅ 200 `updated: 1` |
| misto (`2Ae8…`) | ✅ 200 |
| `:id` da rotina em maiúsculas (`PATCH`, `GET`) | ✅ 200 |
| `GET /workouts/sessions/<id em maiúsculas>`, pela dona | ✅ 200 |
| `POST` de rotina com `exercise_id` em maiúsculas | ✅ 201 |
| `POST` de sessão com `routine_id` e `exercise_id` em maiúsculas | ✅ 201 |
| `routine_id` `null` e `routine_id` ausente | ✅ 201 (o `Type.Unsafe` nullable continua valendo) |

O Postgres normaliza a caixa, então os pesos gravados com o `exercise_id` em maiúsculas batem com a rotina (`[[25,50],[null]]` depois dos 4 casos válidos).

**Direto no Ajv do projeto** (`coerceTypes: 'array'`, `ajv-formats` 3.0.1), com o schema do `Uuid`:

| Entrada | Resultado |
|---|---|
| minúsculas, MAIÚSCULAS, misto, UUID nulo (`0000…`) | aceita |
| `urn:uuid:`, `URN:UUID:`, `{…}`, sem hífens, `\n` no fim, `\n` no começo, espaço, não-hex, dígito de largura total, vazio | recusa |

O `$` do JS não casa antes de um `\n` final (diferente do PCRE), então `<uuid>\n` é recusado.

## O pattern não abre ReDoS ✅

- **Teoria:** o regex é ancorado nas duas pontas, só tem quantificadores de tamanho fixo (`{8}`, `{4}`, `{12}`) sobre uma classe de caracteres simples, e não tem grupo repetido nem alternância. O tempo é linear no tamanho da entrada, sem backtracking.
- **Medido direto no Ajv**, com 10 milhões de caracteres: `a`×n, hex×n, `<uuid>`+zeros, só hífens e `urn:uuid:<uuid>` repetido, todos entre 3 e 7 ms.
- **Ao vivo**, com strings de 900 mil caracteres (o corpo máximo é 1 MB):

  | Campo | Resposta |
  |---|---|
  | `exercise_id` = `a`×900k | 400 em 43 ms |
  | `exercise_id` = `0`×900k | 400 em 34 ms |
  | `exercise_id` = `-`×900k | 400 em 23 ms |
  | `exercise_id` = `<uuid>`+`0`×900k | 400 em 57 ms |
  | `routine_id` da sessão = `0`×900k | 400 em 28 ms |
  | `:id` de 5.000 caracteres | 414 em 4 ms (o limite de parâmetro do Fastify corta antes) |

  Em seguida, o backend respondeu normalmente (`GET /activities` 200).

## Nada de novo ✅

- **IDOR intacto.** B na rotina de A dá **404** `Not found`, em minúsculas e em maiúsculas, e a rotina de A fica igual (conferida pela leitura da dona). Sem token, com corpo válido, dá 401. O `user_id` continua vindo só do token, o `findFirst` do dono roda antes do SQL, e o dono segue no WHERE do UPDATE.
- **Os 400 não refletem a entrada.** A mensagem é do schema, e `exercise_id: "urn:uuid:<script>"` não volta na resposta.
- **Mudança de contrato, só de texto:** o 400 de UUID inválido passa de `must match format "uuid"` para `must match pattern "^[0-9a-fA-F]{8}-…"`. O status é o mesmo (400), e o corpo continua `{ error: string }`. Ver INFO #6.
- **Escopo contido:** o diff não tem migration, dependência, rota, SQL nem frontend. O código tem 3 linhas e 1 constante.
- **Testes:** backend `npm test` com **92/92** (as asserções novas entraram nos testes existentes, por isso o total não muda).
- **Frontend e banco:** não fazem parte deste diff, e não mudaram desde o round 1.

---

## Achados novos

### #6 INFO: o 400 de UUID inválido agora mostra o regex

- **Camada:** backend
- **Onde:** `workout.schemas.js:11` (a mensagem do Ajv inclui o pattern).
- **Cenário:** qualquer UUID inválido autenticado em `/workouts/*` devolve `{"error":"body/sets/0/exercise_id must match pattern \"^[0-9a-fA-F]{8}-…\""}`.
- **Impacto:** nenhum. O regex é o mesmo que a API publica no schema OpenAPI, e a mensagem é um literal do schema, sem eco da entrada. É só ruído de texto para o cliente.
- **Fix:** nenhum. Encurtar a mensagem exigiria o plugin `ajv-errors`, e não compensa.

---

## Pendências (sem mudança neste round)

- **INFO #2 a #5 do round 1:** a coerção do Ajv no `weight_kg`, o CORS `*`, o `hostUri` só de dev e o `expo-constants`/`axios`.
- **LOW #1 da entrega 1 (sem rate limit em `/workouts/*`):** vale também para o `PATCH …/weights` e o `POST /profile/welcome`.
- **LOW #1 da entrega 2 (`started_at`, volume e carga vêm do cliente):** continua sendo **pré-requisito de qualquer feature social ou de ranking**.
- **INFO #1 do gerador:** os privilégios de escrita do `torv_api` em `workout_template_slots`.

## Conclusão

O LOW #1 está fechado. As formas que davam 500 (`urn:uuid:` no `exercise_id` e no `:id` do `PATCH`) agora dão 400 antes do SQL. O mesmo vale para todo o módulo de treinos, inclusive o `routine_id` da sessão. O UUID válido continua passando em qualquer caixa. O regex é linear e ancorado, e 900 mil caracteres são recusados em menos de 60 ms, sem afetar o backend. O IDOR do `PATCH` está intacto. Com o QA round 3 e este Security round 2 verdes, a feature de cargas, período e boas-vindas está pronta, com as INFO e as pendências acima.
