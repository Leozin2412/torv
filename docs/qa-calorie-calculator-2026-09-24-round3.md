# QA — Calculadora de Calorias e Macros (rodada 3)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Task:** 9 do plano `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md`
**Rodadas anteriores:** `docs/qa-calorie-calculator-2026-09-24.md` (FAIL) · `-round2.md` (PASS)
**Security:** `docs/security-calorie-calculator-2026-09-24.md` (FAIL — 1 MEDIUM, Vuln 1)
**Commit sob teste:** `9573874` — *fix(security): reject prototype-chain keys in nutrition and profile lookups*

**Veredito: PASS** — o MEDIUM do Security está corrigido e coberto por teste; sem regressão. 1 achado **LOW** novo, pré-existente e não explorável, registrado para acompanhamento (não bloqueia).

---

## Escopo

Reteste **só do `9573874`**, backend-only, sem UI. Furnace (`:3000`) e Expo já rodando — nenhuma instância nova subida. Chamadas HTTP feitas de dentro do portal `TorvWeb` com a sessão real da conta de teste (`qa.calc.20260924@torvtest.dev`), token nunca extraído para o shell.

---

## 1. Testes automatizados ✅

`cd BackEndTorv && npm test` → **18/18 pass**, 0 fail (124 ms). Os 2 testes novos:

- `chaves da prototype chain não viram nível/sexo/objetivo válidos` (`nutritionCalculator.test.js`) — cobre `fitnessLevel: 'constructor'` (cai no `INICIANTE` e devolve números finitos), `gender: 'constructor'` e `'toString'` (→ `null`), e `goals: 'constructor, toString'` (→ `['Saúde & Bem-estar']`, números finitos).
- `fitness_level da prototype chain → erro` (`profileValidation.test.js`) — `'constructor'` e `'toString'` → erro.

Node **v24.11.1** — `Object.hasOwn` disponível (Node ≥ 16.9), sem risco de `ReferenceError` em runtime.

---

## 2. Revisão do diff — cobertura dos lookups ✅

Varri todos os acessos por colchete com chave dinâmica em `BackEndTorv/src` e classifiquei cada um pela origem da chave:

| Local | Chave vem de | Status |
|---|---|---|
| `profileValidation.js:19` — `ACTIVITY_FACTORS[fitness_level]` | **input do cliente** | ✅ corrigido (`Object.hasOwn`) |
| `nutritionCalculator.js:57` — `GENDERS[gender]` | banco (gravado no cadastro) | ✅ corrigido |
| `nutritionCalculator.js:64` — `ACTIVITY_FACTORS[fitnessLevel]` | banco | ✅ corrigido |
| `nutritionCalculator.js:40` — `GOALS[g]` em `parseGoals` | **input/banco** | ✅ corrigido (extra — não era exigido pelo Security, mesma classe) |
| `profileValidation.js:12` — `GOAL_NAMES.includes(g)` | input do cliente | ✅ já seguro (array `.includes`, não anda na prototype chain) |
| `nutritionCalculator.js:50` — `GOALS[goal]` em `effectiveAdjust` | `selected`, já filtrado por `parseGoals` | ✅ seguro por construção |
| `nutritionCalculator.js:71` — `ACTIVITY_FACTORS[level]` | `level`, já validado logo acima | ✅ seguro |
| `nutritionCalculator.js:83-85` — `GOALS[g].protein/carbs/fat` | `selected` (idem) | ✅ seguro |
| `nutritionCalculator.js:98-99` — `saved[key]` / `current[key]` em `diffBasis` | `BASIS_KEYS` (constante) | ✅ seguro |
| `nutritionSuggestion.js:44` — `current[k]` / `suggested[k]` | `Object.keys(current)` (próprias) | ✅ seguro |
| `profile.controller.js:82` — `ALLOWED_IMAGE_TYPES[data.mimetype]` | **input do cliente** (header da parte multipart) | ⚠️ **não coberto** → achado **S1** abaixo |

Conclusão: **todos os lookups do caminho nutrição/perfil** apontados pelo Security estão cobertos, e o commit ainda fechou um quarto (`parseGoals`) que o relatório não tinha pedido. O único lookup por chave de input que continua sem guarda está no upload de foto — código pré-existente, fora do que o Security apontou.

Observação de estilo: o Security recomendou `Object.prototype.hasOwnProperty.call(...)`; o commit usou `Object.hasOwn(...)`, que é a forma moderna equivalente e imune a um objeto com `hasOwnProperty` sobrescrito. Equivalente ou melhor — sem ressalva.

---

## 3. HTTP ao vivo no Furnace ✅

Todas as respostas abaixo vieram do backend rodando no Furnace, já com o código novo.

### Injeção de chave da prototype chain — todas rejeitadas

| Request | Resposta |
|---|---|
| `PUT /profile {"fitness_level":"constructor"}` | ✅ `400 {"error":"fitness_level must be INICIANTE, INTERMEDIÁRIO or AVANÇADO"}` |
| `PUT /profile {"fitness_level":"toString"}` | ✅ `400` (mesma mensagem) |
| `PUT /profile {"fitness_level":"__proto__"}` | ✅ `400` (extra) |
| `PUT /profile {"fitness_level":"hasOwnProperty"}` | ✅ `400` (extra) |
| `PUT /profile {"goal":"constructor"}` | ✅ `400 {"error":"goal must list one or more valid goals"}` |
| `PUT /profile {"goal":"toString"}` | ✅ `400` (extra) |
| `PUT /profile {"goal":"Perder Peso, constructor"}` | ✅ `400` — um objetivo inválido na lista reprova a lista inteira (extra) |

Nenhum valor envenenado chegou ao banco: o `fitness_level` da conta seguiu válido em todas as leituras posteriores.

### Regressão com valor válido — 200 e números finitos

`PUT /profile {"fitness_level":"INTERMEDIÁRIO"}` → **200**, `profile.fitness_level = "INTERMEDIÁRIO"`, `nutrition_suggestion.has_suggestion = true`, `changed: ["weight_kg","fitness_level"]`, `current` e `suggested` **todos finitos** (`Number.isFinite` em cada campo).

| Endpoint | Resposta |
|---|---|
| `GET /diet/targets/suggestion` | ✅ `200`, `has_suggestion:true`, `changed:["weight_kg","fitness_level"]`, `suggested` finito |
| `GET /diet/summary` | ✅ `200`, `targets` / `consumed` / `remaining` **todos finitos** |
| `POST /diet/targets/suggestion/accept` (sanity extra) | ✅ `200`, meta aplicada `2214 / 166 / 221 / 74`, finita; `GET .../suggestion` depois → `has_suggestion:false` |

Valor conferido à mão: peso 78 kg, altura 175 cm, idade 32, `INTERMEDIÁRIO`, objetivo `Perder Peso` com IMC 25,5 (“over”) → BMR 1718,75 × 1,55 − 450 = **2214,06 → 2214**. Bate exatamente. Nenhum `NaN` em nenhum ponto — que era o sintoma central do MEDIUM.

---

## Achado desta rodada

### S1 — LOW — Backend — lookup de mimetype no upload de foto ainda anda na prototype chain
**Arquivo:** `BackEndTorv/src/controller/profile.controller.js:82`

```js
const ext = ALLOWED_IMAGE_TYPES[data.mimetype];
if (!ext) return reply.status(400).send({ error: 'File must be a JPEG, PNG, or WebP image' });
```

Mesmo padrão da Vuln 1, com a chave vindo do header `Content-Type` da parte multipart (controlado pelo cliente). É **código pré-existente** — não faz parte da feature da calculadora e o Security não o listou — mas ficou de fora do `9573874`.

**Repro ao vivo (feito nesta rodada, com corpo multipart montado à mão):**

| `Content-Type` da parte | Resposta |
|---|---|
| `application/x-foo` | `400 {"error":"File must be a JPEG, PNG, or WebP image"}` ← barrado no **primeiro** gate |
| `constructor` | `400 {"error":"File content does not match a JPEG, PNG, or WebP image"}` ← **passou** do primeiro gate |
| `image/jpeg` | `200` (caminho normal, continua funcionando) |

A diferença de mensagem prova o bypass: com `constructor`, `ext` recebe a função `Object` (truthy) e o `if (!ext)` não dispara.

**Por que é LOW e não MEDIUM:** `hasValidImageSignature(buffer, mimetype)` só devolve `true` para exatamente `image/jpeg`, `image/png` ou `image/webp`, então qualquer mimetype da prototype chain morre no segundo gate. O `ext` envenenado nunca chega a compor o nome do arquivo, não há gravação em disco e nenhum estado é alterado. É defesa em profundidade acidental, não intencional — hoje **não é explorável**.

**Correção sugerida:** `Object.hasOwn(ALLOWED_IMAGE_TYPES, data.mimetype)`, alinhando com o resto do commit.

---

## Notas

- O probe do S1 gravou **uma** foto de perfil a mais em `BackEndTorv/profilePhotos/` para a conta de teste (o caso `image/jpeg`, que respondeu 200). Arquivo de teste, conta de teste.
- O comportamento de `calculateTargets` com um `fitness_level` inválido **já gravado no banco** (cenário do passo 2 do exploit do Security) não foi reproduzido ao vivo — escrever esse valor direto no banco exigiria um `UPDATE` fora do app. Está coberto pelo teste unitário novo, que chama `calculateTargets({ fitnessLevel: 'constructor' })` e verifica o fallback para `INICIANTE` com números finitos.
- Itens fora do escopo desta rodada, já registrados e ainda abertos: **F5** (não corrigido por decisão de projeto), **O1** (500 em vez de 400 para query/path param inválido, pré-existente) e os itens “Pre-existing, non-blocking” do relatório do Security.

---

## Decisão

**PASS.** `9573874` corrige a Vuln 1 nos três pontos exigidos pelo Security, mais um quarto da mesma classe, com teste automatizado cobrindo cada um. 18/18 verde, comportamento válido intacto e nenhum `NaN` em nenhuma resposta.

S1 é LOW, pré-existente e não explorável — **não bloqueia**. Fica como item de acompanhamento para a Torv Security decidir se entra nesta branch ou vira tarefa à parte.

Task 9 **verde nesta rodada** → pronto para a re-revisão do Security sobre o delta `9573874`.
