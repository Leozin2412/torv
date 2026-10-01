# Security Review: Histórico de treinos (Round 2)

- **Data:** 2026-10-01
- **Branch:** `feat/workout-module`
- **Escopo:** só o rework do **LOW #1** do round 1, no commit `e7312da`. O diff `e06e6f1..29104b9` muda dois arquivos de código, `BackEndTorv/src/controller/activities.controller.js` e `BackEndTorv/src/routes/activities.routes.test.js`, e acrescenta o relatório de QA. O `29104b9` é só esse relatório.
- **Round 1:** `docs/security-workout-history-2026-10-01.md` (`e06e6f1`), PASS com 1 LOW.
  - O `before` passava no `date-time` do Ajv sem que o `Date` do JS conseguisse parseá-lo: fuso só com hora ou segundo bissexto.
  - Isso virava `Invalid Date` → `PrismaClientValidationError` → 500 em vez de 400.
- **Pré-condição:** reteste PASS (`docs/qa-workout-history-backend-2026-10-01-round2.md`, `29104b9`).
- **Veredito: PASS.** O **LOW #1 está fechado**. Não há achado novo. As 3 INFO do round 1 (rate limit, precisão do cursor, 400 antes de 401) continuam como estavam, porque o rework não mexe nelas.

Não imprimi nenhum segredo e não usei token no shell. Também não criei conta, não gravei nada no banco, não abri portal e não subi outra instância do backend. Repeti as provas do round 1:

- **`inject` com o mesmo script do round 1:** a rota, o controller e o Ajv padrão do Fastify são reais, e o error handler é cópia literal de `server.js:58-73`.
  - Na fase do `before`, usei o **repository real (Prisma real)** com um `userId` fictício, que não tem nenhuma linha.
  - Nas demais fases, o repository foi mockado.
- **`curl` sem token válido no backend do Furnace (`localhost:3000`):** 6 requests.
- **Testes:** backend `npm test` com **83/83**.

---

## O fix (`e7312da`)

`activities.controller.js:8-13`:

```js
// O date-time do schema aceita formas que o Date do JS não parseia (fuso só com hora, segundo bissexto).
const beforeDate = before ? new Date(before) : undefined;
if (beforeDate && Number.isNaN(beforeDate.getTime())) {
  return reply.status(400).send({ error: 'querystring/before must match format "date-time"' });
}
const rows = await activitiesRepository.listActivities(request.user.userId, { type, before: beforeDate, limit });
```

- É o mesmo guarda que o `checkSessionBody` usa para o `started_at` (`workoutValidation.js:19-20`), aplicado no único ponto que converte o `before`.
- O teste `GET /activities 400` ganhou os 3 formatos, com `callCount 0` no repository (`activities.routes.test.js:64-68`).

## LOW #1: fechado ✅

**`inject` com o Prisma real** (as mesmas requests do round 1):

| `before` | Round 1 | Round 2 |
|---|---|---|
| `2026-10-01T10:00:00-03` (fuso só com hora) | `Invalid Date` → `PrismaClientValidationError` → **500** | **400** `querystring/before must match format "date-time"`. O repository **não foi chamado** e nada foi logado |
| `2026-06-30T23:59:60Z` (segundo bissexto) | **500** | **400**, idem |
| `2026-10-01T02:59:60+03:00` (bissexto com offset) | **500** | **400**, idem |
| Controles: `2026-10-01t10:00:00z`, `2026-10-01 10:00:00Z`, `0000-01-01T00:00:00Z` | 200 | **200**. O `Date` parseia esses três, e o repository real recebe o `Date` certo |

**Ao vivo, sem token:**

| Request | Resposta |
|---|---|
| Os 3 formatos do fix | **401** `Access token is missing` |
| `before=2026-10-01T10:00:00Z` | **401** |
| `before=2026-10-01T10:00:00` (sem fuso) | **400** do Ajv, como antes |
| `Bearer x.y.z` + `before=…-03` | **403** `Invalid or expired token` |

O guarda está no controller, que roda depois do `preHandler` de auth. Por isso, sem token, os 3 formatos continuam em 401, e o fix não cria resposta nova antes da autenticação.

**O 400 ao vivo com token foi provado pelo QA round 2.** Ele usou `fetch` na página, com o token só numa variável da página. Os 3 formatos e `2016-12-31T23:59:60Z` deram **400**, e `before` válido com `Z`, `.000Z`, `-03:00` e `+03:00` deu **200**. Isso também confirma que o Furnace está rodando `e7312da`.

## O fix não abre nada novo ✅

- **Não reflete entrada.** A mensagem do 400 é um literal fixo, igual à do Ajv. O valor do `before` não volta na resposta, então não há como injetar conteúdo pelo corpo do erro.
- **Não há oráculo novo antes do auth.** O 400 novo só aparece para requests autenticadas, como vimos acima.
- **Nada muda para entradas válidas.** O `before` válido chega ao repository como o mesmo `Date` de antes. Os controles deram 200 e o contrato do QA round 2 também.
  - O `user_id` continua vindo de `request.user.userId`.
  - `type` e `limit` não mudaram.
  - O schema de resposta não mudou, e os 6 campos continuam sendo os únicos. Conferi de novo via `inject`.
- **Não há caminho novo para 500.** Todo valor que passa no `date-time` do Ajv tem um ano de 4 dígitos, então qualquer `Date` válido fica entre os anos 0000 e 9999, dentro da faixa do `timestamptz`. O que o JS não parseia agora cai no 400.
  - Os demais erros do Prisma continuam virando 500 genérico. Repeti P2022 e `InitializationError` via `inject`.
- **O escopo ficou contido.** São só 2 arquivos, sem migration, sem dependência e sem front.

---

## Pendências (sem mudança neste round)

- **INFO #2 do round 1:** `/activities` não tem rate limit. Faz parte do LOW #1 da entrega 1 (`security-workout-routines-2026-09-30.md`), que segue aberto.
- **INFO #3 do round 1:** o cursor tem precisão de ms, sem impacto de segurança.
- **INFO #4 do round 1:** 400 antes de 401 por validação de querystring. Isso não muda, porque o fix fica depois do auth.
- **LOW #1 da entrega 2:** `started_at` e o volume de sessões ficam a cargo do cliente.

As duas LOW das entregas 1 e 2 continuam como **pré-requisito de qualquer feature social ou de ranking**.

## Conclusão

O LOW #1 está fechado: os 3 formatos que davam 500 agora dão 400 antes do repository, e os formatos válidos continuam iguais. O fix é mínimo e não abre superfície nova. Com o QA backend round 2 e este Security round 2 verdes, o **histórico de treinos está pronto**.
