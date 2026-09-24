# QA — Calculadora de Calorias e Macros (rodada 2)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Task:** 9 do plano `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md`
**Rodada anterior:** `docs/qa-calorie-calculator-2026-09-24.md` (FAIL — F1 HIGH)
**Rework sob teste:** `b821d39` (Frontend — F1, F3) e `3daa7b4` (Backend — F2, F4)

**Veredito: PASS** — F1, F2, F3 e F4 verificados corrigidos; nenhum achado novo bloqueante. Escopo reteste = só o que mudou, conforme pedido. **Libera a Task 10 (Security).**

---

## Escopo desta rodada

Reteste dirigido, não a suíte completa do round 1:

1. Fluxo 2 no portal web (Perfil aplica meta → MyDiet mostra o valor novo ao voltar) — a falha que reprovou o round 1.
2. F3 — aviso de conflito visível sem rolar no modal de objetivos do Perfil.
3. Sem fetch duplicado ao montar / trocar de data / voltar para a tela (medido por Resource Timing).
4. F2 — `400` com corpo vazio + `Content-Type: application/json`.
5. Regressão rápida: `npm test`, `tsc --noEmit`, e as rotas que passam pelo error handler (bateria de 4xx + tentativa de 5xx).

**Ambiente:** backend já rodando no Furnace `:3000` e Expo web em `localhost:8081` (nenhuma segunda instância subida). Portal Maestri `TorvWeb` (412×915) recarregado no início da rodada para pegar o bundle novo. Mesma conta de teste do round 1 (`qa.calc.20260924@torvtest.dev`, `50489953-…`), sessão preservada.

**Limitação mantida:** `maestri portal screenshot` continua falhando (`the page is not rendering — its window may be minimized`). Toda a verificação de UI é **só browser**, por accessibility snapshot, texto de DOM, `getBoundingClientRect` e `document.elementFromPoint`. Nada de cor/pixel foi verificado.

**F5 não faz parte desta rodada** — mantido de propósito (o GET de sugestão é leitura pura, conforme o plano).

---

## 1. Regressão automatizada ✅

| Check | Resultado |
|---|---|
| `cd BackEndTorv && npm test` | ✅ **16/16 pass**, 0 fail (198 ms) |
| `cd FrontEndTorv && npx tsc --noEmit` | ✅ os mesmos **3 erros pré-existentes** (`Login:65`, `MyDiet:132`, `MyDiet:134`). Nenhum erro novo. |

`styles.goalModalPadded`, usado pelo fix do F3, já existia desde `2b56ef2` — o rework reaproveitou, não criou estilo novo. Árvore de trabalho limpa fora dos dois arquivos excluídos (`api.ts`, `tsconfig.json`).

---

## 2. F1 — MyDiet reflete a meta aplicada no Perfil ✅ **CORRIGIDO**

**Fix:** `FrontEndTorv/src/screens/MyDiet/index.tsx:175-190` — `useFocusEffect` passa a chamar `loadDataForDate(selectedDateRef.current)`, com `selectedDateRef` para manter o callback estável e `skipFirstFocus` para não duplicar a carga da montagem.

**Reteste (o cenário exato que falhou no round 1):**

| Passo | Observado |
|---|---|
| Perfil → Nível físico → `Iniciante` → “ATUALIZAR NÍVEL” | modal de sugestão abre com **“Seu nível físico mudou”**, `2500 → 1637` |
| “Aplicar nova meta” | `GET /diet/summary` → `1637 / 123 / 164 / 55` |
| Voltar para a aba My Diet, esperar 6 s | tela mostra **`1637 kcal`** ✅ |

Valor conferido à mão: BMR 1738,75 × 1,2 (INICIANTE) − 450 (Perder Peso, IMC 26,1 “over”) = 1636,5 → 1637. No round 1 esse mesmo passo deixava a tela congelada no valor antigo por vários minutos.

**Checagem extra do mesmo fix:** com uma sugestão pendente criada fora da tela (`PUT /profile { weight_kg: 78 }`), ao focar o MyDiet o **banner aparece** e a meta exibida continua a correta (`1637`, pois sugestão pendente não altera meta). ✅

---

## 3. Sem fetch duplicado (Resource Timing) ✅

Contagem via `performance.getEntriesByType('resource')`, com `clearResourceTimings()` antes de cada medição.

| Transição | `/diet/summary` | `/diet/targets/suggestion` | Esperado |
|---|---|---|---|
| Montagem do MyDiet (primeiro foco) | **1** | **1** | 1 / 1 — `skipFirstFocus` evita a segunda ✅ |
| Trocar de data (dia 24 → 23) | **+1** | **+0** | o efeito de foco não re-dispara ✅ |
| Trocar de data de volta (23 → 24) | **+1** | **+0** | ✅ |
| MyDiet → Perfil | **+1** | **+0** | chamada **do próprio Perfil** (`Profile/index.tsx:53`, pré-existente, fora do diff) ✅ |
| Perfil → MyDiet (refoco) | **+1** | **+1** | ✅ |

Nenhuma duplicação em nenhum dos caminhos. O `+1` do Perfil é comportamento antigo da tela de Perfil, não do rework.

---

## 4. F3 — aviso de conflito visível sem rolar ✅ **CORRIGIDO**

**Fix:** `FrontEndTorv/src/screens/Profile/index.tsx:484-492` — o `<GoalConflictWarning>` saiu de dentro do `goalScrollView` e passou a ficar entre o ScrollView e o `modalFooter`, dentro de um `View` com `styles.goalModalPadded`.

**Medição sem nenhum scroll**, com os dois objetivos opostos marcados (viewport 906 px):

| | round 1 | round 2 |
|---|---|---|
| Alerta | `y 662 – 760` | `y 626 – 723` |
| Botão “ATUALIZAR OBJETIVOS” | `y 719 – 769` | `y 772 – 790` |
| Sobreposição | **sim**, ~40 px cobertos | **não** (`r.bottom < b.top`) |
| `elementFromPoint` no meio do alerta | botão | **o próprio alerta** ✅ |
| `elementFromPoint` no fim do alerta | botão | **o próprio alerta** ✅ |

**Regressão do modal reestruturado:** ao desmarcar um dos objetivos o alerta some (`[role=alert]` → 0) e “ATUALIZAR OBJETIVOS” continua salvando normalmente (`GET /profile` → `goal: "Perder Peso"`, sem sugestão espúria). ✅

---

## 5. F2 — 4xx do Fastify preservado ✅ **CORRIGIDO**

**Fix:** `BackEndTorv/server.js:63-67` — erros com `err.statusCode < 500` mantêm status e mensagem da lib; só os 5xx caem na mensagem genérica.

| Request | round 1 | round 2 |
|---|---|---|
| `POST /diet/targets/suggestion/dismiss`, `Content-Type: application/json`, corpo vazio | **500** `An unexpected error occurred` | ✅ **400** `Body cannot be empty when content-type is set to 'application/json'` |
| `POST /diet/targets/suggestion/accept`, idem | (mesmo defeito) | ✅ **400**, mesma mensagem |
| `POST .../dismiss` sem `Content-Type` (caminho do app) | 200 | ✅ **200** `Suggestion dismissed` |

**Bateria de regressão nas rotas que passam pelo error handler** (o fix é global, não só nas rotas novas):

| Caso | Resultado |
|---|---|
| Sem token | ✅ `401 {"error":"Access token is missing"}` |
| Token inválido | ✅ `403 {"error":"Invalid or expired token"}` |
| Rota inexistente | ✅ `404 {"message":"Route GET:/nao-existe not found","error":"Not Found","statusCode":404}` (404 handler próprio do Fastify, inalterado) |
| JSON malformado com `Content-Type: application/json` | ✅ `400 Body is not valid JSON but content-type is set to 'application/json'` (novo ramo) |
| `Content-Type: text/plain` em `POST /diet` | ✅ `400 body must be object` |
| TypeBox: `POST /diet {food_name:'x'}` | ✅ `400 body must have required property 'calories'` (ramo `err.validation`, intacto) |
| Controller: `PUT /profile {}` | ✅ `400 No fields provided for update` |
| Controller: `PUT /diet/<uuid inexistente>` | ✅ `404 Food log not found` |

**5xx forçado:** não foi possível provocar um 5xx que passasse pelo **error handler global** sem mexer em código — todos os caminhos de erro do app são capturados pelos `try/catch` dos controllers antes de chegar lá. O que deu para verificar é que os 5xx continuam genéricos, sem stack nem detalhe de Prisma:

- `GET /diet/summary?date=2026-13-45` → `500 {"error":"Internal server error fetching diet summary"}`
- `DELETE /diet/abc` (id não-uuid) → `500 {"error":"Internal server error deleting food log"}`

Por leitura de código, o novo ramo não muda esses casos: erros de Prisma e `TypeError` não têm `statusCode`, então caem direto no `reply.status(500).send({ error: 'An unexpected error occurred' })`.

---

## 6. F4 — fallback único do diet summary ✅ **CORRIGIDO**

`BackEndTorv/src/controller/diet.controller.js` — `EMPTY_SUMMARY` virou constante de módulo e `formatDietSummaryResponse` aplica `spResult || EMPTY_SUMMARY` internamente, então `getDietSummary`, `acceptTargetsSuggestion`, `updateNutritionTargets`, `addFoodLog`, `updateFoodLog` e `deleteFoodLog` passam a compartilhar o mesmo fallback (antes só o `getDietSummary` tinha).

Verificado por leitura do diff e exercitado indiretamente: `accept` (`1637`), `updateTargets` (round 1, `2500`) e `summary` continuam respondendo 200 com o corpo correto. Não foi possível forçar `fn_get_diet_summary` a não devolver linha — o valor do fix é defensivo, como o próprio comentário no código diz.

---

## 7. Console do navegador ✅

Buffer do console capturado do recarregamento do portal até o fim da rodada: **vazio**. Zero erro JS, zero exceção, zero red box, e nem o `[warn] props.pointerEvents is deprecated` do round 1 reapareceu nas telas exercitadas.

---

## Achados desta rodada

Nenhum achado novo **bloqueante**. Duas observações registradas para acompanhamento:

| ID | Severidade | Camada | Observação |
|---|---|---|---|
| O1 | LOW (pré-existente, fora do diff) | Backend | Entrada inválida em parâmetro de rota/query vira **500** em vez de 400: `GET /diet/summary?date=2026-13-45` e `DELETE /diet/<id não-uuid>`. A resposta é genérica (não vaza stack nem detalhe de Prisma), mas o status está errado. Só ficou visível agora porque a bateria de erros desta rodada exercitou esses caminhos. |
| O2 | Informativo | Backend | O novo ramo do error handler ecoa `err.message` para qualquer 4xx. Hoje são só mensagens curtas do Fastify/TypeBox (verificadas acima, sem vazamento), mas vale a Torv Security confirmar isso na Task 10 junto com o resto do diff. |

Além disso: o Perfil dispara um `GET /diet/summary` próprio a cada foco (`Profile/index.tsx:53`) — pré-existente, fora do diff, sem duplicação, apenas registrado para não ser confundido com o fetch do MyDiet em medições futuras.

**F5** segue não corrigido por decisão de projeto (o GET de sugestão é leitura pura) — não é achado.

---

## Decisão

**PASS.** F1, F2, F3 e F4 corrigidos e verificados; sem regressão em testes, tipos, contagem de requests ou tratamento de erro. O fluxo 2 — a falha que reprovou o round 1 — passa.

A Task 9 fica **verde nesta rodada**. Libera a **Task 10 (Security)** sobre o diff completo da branch, incluindo os dois commits de rework e a observação O2.
