# QA — Calculadora de Calorias e Macros (rodada 1)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Task:** 9 do plano `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md`
**Spec:** `docs/superpowers/specs/2026-09-24-calorie-macro-calculator-design.md`
**Diff:** `git diff main...feat/calorie-macro-calculator` (excluídos `FrontEndTorv/src/services/api.ts` e `FrontEndTorv/tsconfig.json` — alterações antigas, não relacionadas)

**Veredito: FAIL** — 1 falha HIGH na camada **Frontend** (fluxo 2). Backend/Database sem falha bloqueante. Não avança para a Task 10 (Security) nesta rodada.

---

## Ambiente da rodada

| Item | Valor |
|---|---|
| Backend | instância única já rodando no terminal Furnace, `:3000` (não foi subida outra) |
| Front | Expo **web** já rodando em `localhost:8081` (não foi subida outra instância) |
| Usabilidade | **navegador**, via portal Maestri `TorvWeb` (`maestri portal create http://localhost:8081 --size 412x915`) — **não** foi usado emulador Android, conforme ajuste do plano |
| Conta de teste | criada pelo próprio fluxo de cadastro do app: `qa.calc.20260924@torvtest.dev`, `50489953-506a-4e57-bcbd-f051c58e6bec` |
| Envelhecimento | `UPDATE user_profiles SET birth_date = birth_date - interval '1 year'` via script Prisma, **somente nessa conta** |

**Limitação da rodada:** `maestri portal screenshot` retornou `screenshot timed out — the page is not rendering (its window may be minimized)` durante toda a sessão. Toda a verificação de UI foi feita por **accessibility snapshot** (`maestri portal snapshot`) e leitura de DOM (`maestri portal evaluate`), que expõem texto, papéis ARIA, bounding boxes e sobreposição real (`elementFromPoint`). Nenhuma verificação puramente pixel-a-pixel (cor, sombra, alinhamento fino) foi possível.

---

## Step 1 — Automatizado ✅

| Check | Resultado |
|---|---|
| `cd BackEndTorv && npm test` | ✅ **16/16 pass**, 0 fail (`node --test`, 189 ms) |
| `cd FrontEndTorv && npx tsc --noEmit` | ✅ apenas os **3 erros pré-existentes** combinados: `Login/index.tsx:65`, `MyDiet/index.tsx:132`, `MyDiet/index.tsx:134`. Nenhum erro novo. |

Testes cobrem `nutritionCalculator` (exemplo da planilha, conflito de objetivos, abaixo do peso, faixa Lipschitz 65+, feminino/iniciante, fallbacks, `Decimal` como string, dado faltando, `ageOn` no aniversário, `diffBasis`) e `profileValidation` (todos os campos e faixas).

---

## Step 2 — Contrato HTTP ✅ (1 achado MEDIUM)

Token da sessão real do app, usado **dentro do navegador** (`fetch` via `portal evaluate`) — o token nunca saiu do browser.

| # | Check do plano | Resultado |
|---|---|---|
| 1 | `GET /diet/summary` em conta sem `nutrition_targets` → linha criada com `basis_json`, metas ≠ 2000/150/250/65 | ✅ `2643 / 198 / 281 / 81`. Dump do banco confirma `basis_json = {age:31, goals:["Ganhar Massa Muscular","Perder Peso"], gender:"Masculino", height_cm:175, weight_kg:85, fitness_level:"AVANÇADO"}`. Bate com o cálculo à mão (BMR 1793,75 × 1,55 − 137,5). |
| 2 | `GET /diet/targets/suggestion` logo depois → `has_suggestion: false` | ✅ |
| 3 | `PUT /profile { fitness_level: 'AVANÇADO' }` → `has_suggestion: true`, `changed: ['fitness_level']` | ✅ `changed:["fitness_level"]`, sugerido `3271/245/348/100` (= TDEE 3408,125 − 137,5) |
| 4 | `POST .../dismiss` → meta igual; novo `GET .../suggestion` → `false` | ✅ meta segue `2643`, `has_suggestion:false` |
| 5 | `PUT /profile { goal: 'Perder Peso, Ganhar Massa Muscular' }` → `changed:['goals']`, `warnings:['GOAL_CONFLICT']` | ✅ (adaptação: a conta já nascera com o objetivo em conflito, então o objetivo foi antes trocado para `Melhorar Condicionamento` — que devolveu `changed:["goals"]`, `warnings:[]` — e depois de volta para o par em conflito) |
| 6 | `POST .../accept` com body `{"daily_calories": 1}` → meta = `suggested`, ignora o body | ✅ meta aplicada `3271/245/348/100`; o `1` do cliente foi ignorado |
| 7 | `PUT /profile { weight_kg: 19 }` → 400 | ✅ `weight_kg must be between 20 and 300` |
| 8 | `PUT /profile { height_cm: 175.5 }` → 400 | ✅ `height_cm must be an integer between 50 and 250` |
| 9 | `PUT /profile { goal: 'Voar' }` → 400 | ✅ `goal must list one or more valid goals` |
| 10 | `PUT /profile { fitness_level: 'PRO' }` → 400 | ✅ `fitness_level must be INICIANTE, INTERMEDIÁRIO or AVANÇADO` |
| 10b | `PUT /profile {}` → 400 (extra) | ✅ `No fields provided for update` |
| 11 | `PUT /profile { weight_kg: 75 }` → nova linha em `user_measurements` com a altura anterior copiada | ✅ duas linhas: `{w:85,h:175}` e `{w:75,h:175}` — altura copiada, linha antiga preservada |
| 12 | `GET /profile` → `weight_kg`, `height_cm`, `age` corretos | ✅ `75 / 175 / 31` (e `85 / 175 / 31` antes da troca) |
| 13 | Envelhecimento (`birth_date - 1 year`) → `GET .../suggestion` com `changed: ['age']` | ✅ `changed:["age"]`, sugerido `3159` (= idade 32) |

Todos os valores sugeridos conferidos à mão contra Mifflin-St Jeor + fator de atividade + ajuste médio dos objetivos, incluindo a trava de IMC (com 85 kg/175 cm → IMC 27,8 “over”, `Ganhar Massa` cai de +350 para +175; com 75 kg → IMC 24,5 “normal”, volta a +350).

---

## Step 3 — Usabilidade no navegador (portal `TorvWeb`) — **1 FALHA**

> Tudo neste bloco é **verificação só por browser** (Expo web), sem emulador e sem screenshot — ver “Limitação da rodada”.

### Fluxo 1 — Cadastro com objetivos em conflito ✅
- Cadastro completo pelo app (e-mail → nome/username/nascimento → peso/altura → sexo → nível → objetivos).
- Ao marcar **Perder Peso + Ganhar Massa Muscular**, o aviso aparece como `role="alert"` com o texto “Perder peso e ganhar massa ao mesmo tempo são metas opostas — recomendamos focar em um objetivo por vez.” e **não bloqueia** — o botão “Continuar” segue habilitado e o cadastro conclui. ✅
- Metas personalizadas: primeiro `GET /diet/summary` da conta devolveu `2643/198/281/81` (≠ 2000/150/250/65) e `GET /diet/targets/suggestion` no mesmo momento devolveu `has_suggestion:false` → **sem banner**. ✅ *(essa parte foi confirmada pelo contrato HTTP no instante do cadastro, não por leitura da tela do MyDiet)*

### Fluxo 2 — Perfil → Nível físico → Aplicar → MyDiet reflete ❌ **FALHA (HIGH)**
- Perfil mostra as seções novas “Nível físico” (`Avançado`) e “Peso e altura” (`75 kg · 175 cm`). ✅
- Editar nível → modal de nível abre, seleção funciona, “ATUALIZAR NÍVEL” salva. ✅
- Modal de sugestão abre com o motivo correto **“Seu nível físico mudou”** e as linhas `Calorias: de 3271 para 2568 kcal`, `Proteína: 245 → 193`, `Carboidrato: 348 → 273`, `Gordura: 100 → 78`. ✅
- **“Aplicar nova meta” → o MyDiet NÃO reflete.** ❌ Ver achado **F1**.

### Fluxo 3 — Perfil → Peso e altura ✅
- Peso `10` → erro inline “Peso deve estar entre 20 e 300 kg.” ✅
- Altura `175.5` → erro inline “Altura deve ser um número inteiro entre 50 e 250 cm.” ✅
- Valores válidos (`80 / 175`) → modal de sugestão com motivo **“Seu peso mudou”**, `2568 → 2558`. ✅
- **“Manter atual”** → `GET /diet/summary` segue `2568/193/273/78` e `GET /diet/targets/suggestion` volta `has_suggestion:false`; MyDiet sem banner. ✅

### Fluxo 4 — Perfil → Objetivo → fechar no X → banner no MyDiet → aplicar ✅
- Modal “Meus Objetivos” traz o `GoalConflictWarning` enquanto os dois objetivos opostos estão marcados, e ele **some** assim que um é desmarcado. ✅
- Salvar → modal de sugestão com motivo **“Seu objetivo mudou”**; fechar no **X** não resolve a sugestão (backend segue `has_suggestion:true`, `changed:["goals"]`). ✅
- Ao entrar no MyDiet, o banner **“Nova meta sugerida — toque para ver”** aparece. ✅
- Tocar → modal abre → **“Aplicar nova meta”** → meta passa a `2245/168/225/75`, o banner some e **a tela do MyDiet atualiza** (2245 kcal exibido). ✅ *(este caminho — aplicar de dentro do próprio MyDiet — funciona; o que falha é aplicar pelo Perfil, achado F1)*

### Fluxo 5 — Editar Metas Diárias manualmente no MyDiet ✅
- Metas alteradas à mão para `2500 / 180 / 260 / 80` → tela mostra `2500 kcal`, `GET /diet/targets/suggestion` volta `has_suggestion:false` e **nenhum banner** aparece. ✅ (`updateNutritionTargets` carimba o `basis_json` atual junto com os números manuais, então a edição manual não se auto-sugere.)

### Fluxo 6 — Console do navegador ✅
- Buffer do console durante todos os fluxos: **1 linha**, `[warn] props.pointerEvents is deprecated. Use style.pointerEvents`.
- **Zero erro JS, zero exceção, zero red box.** ✅ (o warn é de biblioteca RN-web, pré-existente e fora do diff)

---

## Revisão multi-lente do diff

### F1 — HIGH — Frontend — MyDiet não recarrega as metas ao ganhar foco
**Arquivo:** `FrontEndTorv/src/screens/MyDiet/index.tsx:175-178`

```tsx
useFocusEffect(
  useCallback(() => {
    loadSuggestion();        // ← só a sugestão; o /diet/summary não é recarregado
  }, [loadSuggestion])
);
```

`loadDataForDate` só roda no `useEffect([selectedDate])` (linha 161), ou seja, na montagem da tela e quando o usuário troca de dia. Como o tab navigator mantém o MyDiet montado, qualquer mudança de meta feita **fora** dessa tela não aparece.

**Cenário de falha reproduzido (2x, determinístico):**
1. Perfil → Nível físico → `AVANÇADO` → “Aplicar nova meta”.
2. `GET /diet/summary` responde `daily_calories: 2854`.
3. Trocar para a aba My Diet e esperar 6 s → a tela continua mostrando **`2245 kcal`** (o valor anterior).
O primeiro caso observado ficou desatualizado (3271 na tela × 2568/2245 no servidor) por vários minutos e vários fluxos, até uma ação dentro do próprio MyDiet forçar o reload.

Isso é exatamente o item 2 do Step 3 do plano (“**Aplicar** → MyDiet reflete”) → **fluxo 2 reprovado**.

**Correção sugerida (1 linha):** chamar `loadDataForDate(selectedDate)` junto com `loadSuggestion()` no `useFocusEffect` (a dependência precisa incluir `selectedDate`).

### F2 — MEDIUM — Backend — `accept`/`dismiss` devolvem 500 quando o cliente manda `Content-Type: application/json` sem corpo
**Arquivos:** `BackEndTorv/src/routes/diet.routes.js` (rotas `POST /diet/targets/suggestion/accept` e `/dismiss`, sem `body` no schema) + `BackEndTorv/server.js:55-64`

As duas rotas novas são, por desenho, chamadas **sem corpo**. Se o cliente enviar o header `Content-Type: application/json` e corpo vazio, o Fastify levanta `FST_ERR_CTP_EMPTY_JSON_BODY` (statusCode 400), mas o handler global só repassa o status quando existe `err.validation`:

```js
if (err.validation) return reply.status(err.statusCode || 400).send({ error: err.message });
reply.status(500).send({ error: 'An unexpected error occurred' });   // ← engole o 400
```

**Cenário de falha reproduzido:** `fetch('/diet/targets/suggestion/dismiss', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer …' } })` → **`500 {"error":"An unexpected error occurred"}`**. O mesmo request **sem** o header `Content-Type` → `200 {"message":"Suggestion dismissed"}`.

O app atual **não** é afetado (o axios não define `Content-Type` quando não há `data`, e os dois fluxos de UI passaram), mas qualquer cliente que fixe o header — e as próprias rotas são as únicas do projeto pensadas para corpo vazio — recebe 500 em vez de 400. O handler global é pré-existente; o que é novo é a superfície que o expõe.

**Correção sugerida:** no `setErrorHandler`, repassar `err.statusCode` quando for `< 500` (mantendo a mensagem genérica para os 5xx), ou declarar um `body: Type.Optional(...)` nas duas rotas.

### F3 — LOW — Frontend — aviso de conflito fica atrás do rodapé no modal de objetivos do Perfil
**Arquivo:** `FrontEndTorv/src/screens/Profile/index.tsx` (o `<GoalConflictWarning>` dentro do `goalScrollView`, logo antes do `modalFooter`)

Ao abrir “Meus Objetivos” com os dois objetivos opostos marcados, o alerta ocupa `y 662–760` e o botão “ATUALIZAR OBJETIVOS” ocupa `y 719–769` — `document.elementFromPoint(206, 690)` devolve o botão, ou seja, ~40 px do final do aviso ficam cobertos. Um scroll de 200 px resolve (alerta passa para `589–687`), então o texto é alcançável, mas na primeira visualização ele aparece cortado. Não reproduz no cadastro (lá o aviso é o último item de uma tela rolável sem rodapé fixo).

### F4 — LOW — Backend — `accept` e `updateTargets` sem o fallback de `spResult` que o `getDietSummary` tem
**Arquivo:** `BackEndTorv/src/controller/diet.controller.js` (`acceptTargetsSuggestion` e `updateNutritionTargets`)

`getDietSummary` faz `formatDietSummaryResponse(date, spResult || { GoalCalories: 2000, … }, …)`. Os dois handlers novos/alterados chamam `formatDietSummaryResponse(date, spResult, …)` sem o `||`. Se `fn_get_diet_summary` algum dia não devolver linha, vira `TypeError` e 500 em vez de resposta degradada. Não foi possível provocar em runtime (a função sempre devolveu linha), por isso LOW.

### F5 — LOW — Backend — `basis_json` não é recarimbado quando só os números arredondados coincidem
**Arquivo:** `BackEndTorv/src/lib/nutritionSuggestion.js` (`buildSuggestion`, ramo `sameNumbers`)

Quando a base mudou (`changed` não vazio) mas as metas arredondadas dão exatamente os mesmos números, a função devolve `has_suggestion:false` sem atualizar `basis_json`. O `changed` continua não vazio indefinidamente e a comparação é refeita a cada request até que uma mudança real de número apareça. Comportamento correto do ponto de vista do usuário (nada é sugerido), só desperdiça trabalho e mantém a base defasada.

### Observações sem achado
- **IDOR:** todas as rotas novas (`/diet/targets/suggestion`, `/accept`, `/dismiss`) e o `PUT /profile` usam exclusivamente `request.user.userId`; nenhum id vem do cliente. (A análise formal de OWASP é da Task 10.)
- **Integridade do `accept`:** confirmado em runtime que o payload do cliente é ignorado (item 6 do Step 2).
- **Mass assignment:** `updateProfile` só grava o que `validateProfileUpdate` monta em `profileData`/`measurement`.
- **Efeito colateral em GET:** `GET /diet/summary` e `GET /diet/targets/suggestion` criam a linha de metas quando ela não existe (`ensureTargets`). É o comportamento *lazy* pedido pelo plano, e a corrida entre os dois é tratada pelo `catch (P2002)`. Confirmado que as duas chamadas concorrentes do primeiro load não geraram erro.
- **Cobertura de testes:** os testes novos cobrem bem as duas funções puras (`nutritionCalculator`, `profileValidation`). `nutritionSuggestion.js` (`ensureTargets`/`buildSuggestion`) e as três rotas novas não têm teste automatizado — foram cobertas manualmente no Step 2. Nenhuma rota/tabela existente foi substituída nesta feature, então não há regressão de cobertura em relação às migrações Express→Fastify / MSSQL→Postgres.

---

## Resumo dos achados

| ID | Severidade | Camada | Achado |
|---|---|---|---|
| F1 | **HIGH** | Frontend | MyDiet não recarrega `/diet/summary` no foco → meta aplicada pelo Perfil não aparece (fluxo 2 reprovado) |
| F2 | MEDIUM | Backend | `accept`/`dismiss` com `Content-Type: application/json` e corpo vazio → 500 em vez de 400 |
| F3 | LOW | Frontend | Aviso de conflito parcialmente coberto pelo rodapé do modal de objetivos do Perfil |
| F4 | LOW | Backend | `accept`/`updateTargets` sem o fallback de `spResult` |
| F5 | LOW | Backend | `basis_json` não recarimbado quando os números arredondados coincidem |

## Decisão

**FAIL.** Rework vai para a camada **Frontend** (F1 obrigatório; F3 opcional na mesma passada). F2/F4/F5 são do **Backend** e podem entrar na mesma rodada de rework — nenhum é bloqueante por si só.

Depois do rework, nova rodada da Task 9 em `docs/qa-calorie-calculator-2026-09-24-round2.md`, focada no que mudou. **Task 10 (Security) não roda nesta rodada.**
