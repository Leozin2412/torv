# QA — Calculadora de Calorias e Macros (rodada 4)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Task:** 9 do plano `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md`
**Rodadas anteriores:** round 1 (FAIL) · round 2 (PASS) · round 3 (PASS)
**Commits sob teste:** `6638c0f` — *validate date and logged_date as real calendar dates* · `79eef56` — *restamp targets basis when the recalculated numbers match*

**Veredito: PASS** — O1 (parte `date`) e F5 fechados e verificados ao vivo, incluindo o cenário exato que o usuário reportou. Sem regressão. 1 achado **LOW** novo (teste com data-bomba) e 1 item carregado ainda aberto (`logId` não-uuid), nenhum bloqueante.

---

## Escopo e ambiente

Reteste **só dos dois commits**, backend-only. Furnace (`:3000`) já rodando — nada subido. O Expo está em modo celular e o servidor web parou; **não** naveguei nem recarreguei o portal. O contexto JS da aba `TorvWeb` continuava vivo da rodada anterior (`window.__api` e a sessão da conta de teste ainda presentes em memória), então as chamadas HTTP saíram de lá sem precisar de servidor web — o token nunca foi extraído para o shell. Leituras de banco pelo script Prisma somente-leitura, restritas à conta de teste (`qa.calc.20260924@torvtest.dev`, `50489953-…`).

---

## 1. Testes automatizados ✅

`cd BackEndTorv && npm test` → **21/21 pass**, 0 fail (184 ms) — 18 do round 3 mais os 3 novos de `nutritionSuggestion.test.js`:

- `basis velho com números iguais: sem sugestão, mas o basis é recarimbado`
- `basis igual ao atual: nada a recarimbar`
- `números diferentes: sugestão normal, sem recarimbar`

São os primeiros testes de `nutritionSuggestion.js` — fecha a lacuna de cobertura que o round 1 tinha registrado para esse arquivo. Usam `t.mock.method` do `node:test` para stubar o repository, sem banco e sem dependência nova.

---

## 2. Revisão do diff

### `6638c0f` — `format: 'date'`

Os dois únicos campos de data que entram por request em `diet.routes.js` ganharam `format: 'date'`: o `date` do querystring (compartilhado por `GET /diet/summary` e pelo alias `GET /diet`, pois `summaryQuerystring` é reusado nos dois) e o `logged_date` do corpo do `POST /diet`. Varri o resto das rotas: os outros `Type.String()` com cara de data/id (`diet.routes.js:7,27,28`, `profile.routes.js:15,69`) são **schema de resposta**, não de entrada — não validam nada do cliente e não precisam de `format`.

`ajv-formats` está instalado (via `@fastify/ajv-compiler`), então o `format` é de fato aplicado — confirmado ao vivo na seção 3, não só por inspeção.

**Sobra do O1:** `logId: Type.String()` (`diet.routes.js:143`) continua sem `format: 'uuid'` — ver item **A2**.

### `79eef56` — recarimbo do basis

A mudança é o ramo `sameNumbers` de `buildSuggestion` chamando `updateTargetsBasis(userId, calc.basis)` antes de devolver `has_suggestion:false`. Pontos revisados:

- **Só o basis é gravado**, nunca os números — `updateTargetsBasis` mexe em `basis_json`/`updated_at`. Os testes novos cobrem isso assertando `upsertNutritionTargets.length === 0`.
- **Idempotente:** depois do primeiro recarimbo o basis passa a ser igual ao atual, `diffBasis` volta vazio e o código retorna antes de chegar nesse ramo. Verificado ao vivo (seção 3).
- **Escrita em GET:** `GET /diet/targets/suggestion` agora pode gravar. É a mesma natureza do `ensureTargets`, que já gravava em GET por desenho do plano, e no caminho normal (números diferentes) **não grava** — confirmado ao vivo por `updated_at` inalterado após dois GETs seguidos.
- **Corrida:** duas chamadas simultâneas escreveriam o mesmo basis; sem efeito colateral.
- **`saved` nulo:** só aconteceria se `ensureTargets` não tivesse criado a linha, o que só ocorre quando `calc` é nulo — e nesse caso a função já retornou antes. Sem caminho novo de erro.

Ressalva: o *fixture* dos testes novos depende da data real do sistema — ver item **A1**.

---

## 3. HTTP ao vivo no Furnace

### 3.1 Validação de data ✅

`GET /diet/summary?date=…`:

| Valor | Resposta |
|---|---|
| `2026-13-45` | ✅ `400 querystring/date must match format "date"` |
| `abc` | ✅ `400` |
| `2026-02-30` | ✅ `400` — calendário real, não só o formato |
| `2026-09-31` | ✅ `400` — idem |
| `24/09/2026` | ✅ `400` |
| `2026-9-24` (sem zero à esquerda) | ✅ `400` |
| `2026-09-24T00:00:00Z` | ✅ `400` |
| `` (vazio) | ✅ `400` — ver nota **A3** |
| omitido | ✅ `200`, `date: "2026-09-24"` |
| `2026-09-23` | ✅ `200`, `date: "2026-09-23"` |

Alias `GET /diet`: `?date=2026-13-45` → ✅ `400`; `?date=2026-09-24` → ✅ `200`. O querystring compartilhado cobre as duas rotas.

`POST /diet` com `logged_date` inválido: `2026-13-45`, `2026-02-30`, `abc` → ✅ `400 body/logged_date must match format "date"` nos três. Com `logged_date: "2026-09-24"` → ✅ `201`, resumo devolvido; o registro de teste foi apagado em seguida (`DELETE /diet/<id>` → 200), deixando o dia zerado.

Isso fecha a **parte `date` do O1**: o que antes era `500 Internal server error fetching diet summary` agora é `400` com mensagem de validação.

### 3.2 Cenário reportado pelo usuário (F5) ✅

Conta de teste, objetivo A = `Perder Peso`, B = `Aumentar Resistência`, meta salva `2214/166/221/74`.

| Passo | Resposta / banco |
|---|---|
| 1. Baseline `GET /diet/targets/suggestion` | `{"has_suggestion":false}`; banco: `basis_json.goals = ["Perder Peso"]` |
| 2. `PUT /profile {goal:'Aumentar Resistência'}` | `has_suggestion:true`, `changed:["goals"]`, sugerido `2814/141/387/78` |
| 3. `POST .../dismiss` | `200`; banco: meta segue `2214/…`, `basis_json.goals = ["Aumentar Resistência"]` |
| 4. `PUT /profile {goal:'Perder Peso'}` (volta pro A) | ✅ `has_suggestion:false` **e** banco: `basis_json.goals = ["Perder Peso"]` — **recarimbado** |
| 5. `PUT /profile {fitness_level:'AVANÇADO'}` | ✅ `has_suggestion:true`, **`changed:["fitness_level"]`** — sem `"goals"` |

O passo 5 é exatamente o sintoma relatado: antes do fix o basis teria ficado preso em `["Aumentar Resistência"]` no passo 4, e o passo 5 devolveria `changed:["fitness_level","goals"]`, fazendo o modal dizer “Seu objetivo mudou” sem o objetivo ter mudado. Agora vem só o motivo certo.

Número do passo 5 conferido à mão: peso 78, altura 175, idade 32, `AVANÇADO`, `Perder Peso` com IMC 25,5 (“over”) → BMR 1718,75 × 1,9 − 450 = 2815,6 → **2816**. Bate com o `suggested.daily_calories` devolvido.

### 3.3 Sem escrita espúria no caminho normal ✅

Com uma sugestão pendente (números diferentes), dois `GET /diet/targets/suggestion` seguidos: ambos `200 has_suggestion:true` e o `updated_at` da linha permaneceu `2026-09-24T19:36:52.373Z` nos dois — o recarimbo só dispara no ramo `sameNumbers`, como projetado.

---

## Achados desta rodada

### A1 — LOW — Backend (teste) — o fixture de `nutritionSuggestion.test.js` depende da data real e quebra em 2027-01-15
**Arquivo:** `BackEndTorv/src/lib/nutritionSuggestion.test.js` (`INPUTS.birthDate = '1996-01-15'` + `SAME_NUMBERS_ROW = 2711/169/305/90`)

`buildSuggestion` → `computeForUser` → `calculateTargets(inputs)` e o stub não passa `today`, então o `today = new Date()` default usa o relógio real. A idade sai de `birthDate`, e os números fixos do `SAME_NUMBERS_ROW` só batem enquanto a idade for 30.

**Verificado rodando `calculateTargets` com `today` pinado:**

| `today` | idade | resultado | bate com `2711/169/305/90` |
|---|---|---|---|
| 2026-09-24 | 30 | `2711 169 305 90` | ✅ |
| 2027-01-14 | 30 | `2711 169 305 90` | ✅ |
| **2027-01-15** | 31 | `2703 169 304 90` | ❌ |
| 2028-06-01 | 32 | `2695 168 303 90` | ❌ |

A partir de **2027-01-15** (aniversário do fixture) `sameNumbers` vira falso e os **três** testes novos falham: o 1 e o 2 passam a receber `has_suggestion:true`, e o 3 espera `suggested.daily_calories === 2711`. Hoje passam; é bomba-relógio, não falha atual — por isso LOW e não bloqueante.

**Correção sugerida (uma linha):** incluir `today: new Date('2026-09-24T12:00:00Z')` no objeto `INPUTS` do stub. O `today` atravessa `getCalcInputs` → `computeForUser` → `calculateTargets` sem mudar código de produção. **Verificado:** rodei `buildSuggestion` com stub `today: 2028-06-01` e a linha salva recalculada para essa data → `{"has_suggestion":false}` com o basis recarimbado para `["Criar uma Rotina"]`, ou seja, o teste vira determinístico.

Nota menor no mesmo arquivo: o comentário diz que `Melhorar Condicionamento` e `Criar uma Rotina` “dão o mesmo kcal (ajuste 0)” — verdade para as calorias (2711 nos dois), mas os macros diferem (carbo 0,50 × 0,45; gordura 0,25 × 0,30). A linha do fixture guarda os macros de `Criar uma Rotina`, então o teste está correto; só o comentário é impreciso.

### A2 — LOW (carregado do O1, fora do escopo destes commits) — `logId` ainda sem validação
**Arquivo:** `BackEndTorv/src/routes/diet.routes.js:143` — `logId: Type.String()`

`DELETE /diet/abc` → `500 {"error":"Internal server error deleting food log"}` e `PUT /diet/abc` → `500 {"error":"Internal server error updating food log"}` (reconfirmado ao vivo nesta rodada). Resposta genérica, sem vazar stack nem detalhe de Prisma — só o status está errado. É a metade do O1 que estes commits declaradamente não cobrem.

Agora que ficou provado que o `format` do AJV é aplicado de verdade neste servidor, o fix é simétrico ao do `date`: `Type.String({ format: 'uuid' })` no `logIdParams`.

### A3 — Informativo — `?date=` vazio agora é 400
Antes, string vazia era *falsy* e caía no default “hoje”; com `format: 'date'` virou `400`. Nenhuma tela do app manda `date` vazio (`MyDiet/index.tsx:146` e `Home/index.tsx:35` sempre interpolam uma data completa), então não há impacto — fica só registrado como mudança de comportamento para quem for escrever cliente novo.

### Esclarecimento sobre o `POST /diet` desta rodada
No teste de `logged_date` mandei `macros_json: {proteins, carbs, fats}` e o resumo voltou `protein_g: 0, fat_g: 0`. **Não é bug:** a função do Postgres lê `protein`/`fat` no singular, que é exatamente o que o app envia (`MyDiet/index.tsx:206`). O payload do teste é que estava fora do formato canônico. Registrado para o número 0 na tabela acima não ser lido como defeito.

---

## Estado final da conta de teste

Objetivo `Perder Peso`, nível `AVANÇADO`, 78 kg / 175 cm, idade 32, meta salva `2214/166/221/74` com **uma sugestão pendente** (`changed:["fitness_level"]`, sugerido `2816/211/282/94`) deixada de propósito no passo 5. Nenhum registro de refeição de teste ficou para trás.

---

## Decisão

**PASS.** `6638c0f` fecha a parte `date` do O1 com validação de calendário real nas três entradas (`/diet/summary`, alias `/diet`, `POST /diet`), e `79eef56` fecha o F5 — incluindo o cenário concreto que o usuário reportou, verificado ponta a ponta no HTTP e no banco. 21/21 verde, sem regressão e sem escrita espúria no caminho normal.

A1 e A2 são LOW e não bloqueiam: A1 é um teste que só quebra em 2027, A2 é item pré-existente carregado. Ambos ficam como acompanhamento.

Task 9 **verde nesta rodada** → pronto para a re-revisão do Security sobre o delta `6638c0f` + `79eef56`.
