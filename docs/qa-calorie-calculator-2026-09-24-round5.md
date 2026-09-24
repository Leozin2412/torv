# QA — Calculadora de Calorias e Macros (rodada 5)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Task:** 9 do plano `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md`
**Rodadas anteriores:** round 1 (FAIL) · rounds 2, 3, 4 (PASS)
**Commits sob teste:** `b69d9de` — *clear remaining tsc errors in Login gradient and MyDiet macros typing* · `af654ee` — *require a uuid for the food log id params*

**Veredito: PASS** — `tsc` zerado, A2 (resto do O1) fechado, UI de Login e MyDiet sem regressão. **Nenhum achado novo.** Fica 1 item carregado do round 4 (A1, teste com data-bomba), ainda aberto e não bloqueante.

---

## Escopo e ambiente

Reteste **só dos dois commits**. Furnace (`:3000`) e Expo já rodando — nada subido. O Expo está em modo celular mas continua servindo web em `localhost:8081` (confirmado com `200` antes de mexer no portal).

Usei **o meu portal `TorvWeb`**, o mesmo das rodadas anteriores. O portal `Torv Web` do usuário não aparece na minha lista de conectados e **não foi tocado**; nenhuma ação desta rodada envolveu a conta pessoal. Tudo rodou na conta de teste `qa.calc.20260924@torvtest.dev` (`50489953-…`). Como `b69d9de` mexe em tela, recarreguei **o meu** portal para pegar o bundle novo (sem subir servidor).

---

## 1. `tsc` e testes ✅

| Check | Resultado |
|---|---|
| `cd FrontEndTorv && npx tsc --noEmit` | ✅ **0 erros**, saída vazia, exit 0 |
| `cd BackEndTorv && npm test` | ✅ **21/21 pass**, 0 fail (224 ms) |

Os 3 erros que vinham sendo carregados como “pré-existentes” desde o round 1 (`Login:65`, `MyDiet:132`, `MyDiet:134`) **sumiram**. A partir daqui a baseline do `tsc` é zero — qualquer erro em rodada futura é regressão de verdade, sem exceção a conferir.

---

## 2. Revisão do diff

### `b69d9de` — Frontend

**`Login/index.tsx:65` — `StyleSheet.absoluteFillObject` → `StyleSheet.absoluteFill`.** São a mesma declaração de estilo; `absoluteFill` é a versão registrada (`{position:'absolute', top:0, right:0, bottom:0, left:0}`) e `absoluteFillObject` é o objeto cru. Trocar um pelo outro não muda geometria — confirmado medindo no browser (seção 4.1), não só pela documentação.

**`MyDiet/index.tsx:30-38, 133` — nova `interface MealMacros`.** É só anotação de tipo num `let` local; o corpo do `map` não mudou uma linha. As chaves seguem sendo lidas com fallback (`macros.protein || macros.proteins || 0`, idem gordura), então registros gravados no singular (o que o app manda, `MyDiet/index.tsx:206`) e no plural (registros antigos/externos) continuam os dois funcionando. Todos os campos da interface são opcionais, então nenhum acesso passa a exigir presença. Sem `as`/cast escondendo erro. **Runtime idêntico** — verificado na UI (seção 4.2).

### `af654ee` — Backend

`logIdParams` passou de `Type.String()` para `Type.String({ format: 'uuid' })`. Esse é o **único** `params:` schema de toda a camada de rotas (`grep "params:" src/routes/*.js` → só `diet.routes.js:150` e `:170`), e os dois usos são `PUT /diet/:logId` e `DELETE /diet/:logId`. Ou seja: uma mudança cobre os dois endpoints e não sobra nenhum parâmetro de path sem validação no projeto.

O `format` é aplicado de fato (`ajv-formats` via `@fastify/ajv-compiler`, já comprovado no round 4) e o 400 sai pelo ramo `err.validation` do error handler corrigido no round 2 — status e mensagem corretos, sem stack.

Isso fecha o **A2**, a metade do O1 que tinha ficado aberta desde o round 1. **O1 agora está 100% fechado** (data no round 4, id nesta rodada).

---

## 3. HTTP ao vivo ✅

### 3.1 Validação do `logId`

| Request | Round 4 | Round 5 |
|---|---|---|
| `PUT /diet/abc` | `500 Internal server error updating food log` | ✅ `400 params/logId must match format "uuid"` |
| `DELETE /diet/abc` | `500 Internal server error deleting food log` | ✅ `400 params/logId must match format "uuid"` |
| `PUT /diet/123` | — | ✅ `400` |
| `PUT /diet/not-a-uuid` | — | ✅ `400` |
| `PUT /diet/11111111-1111-1111-1111-11111111111` (um dígito a menos) | — | ✅ `400` |
| `PUT` e `DELETE /diet/11111111111111111111111111111111` (sem hífens) | — | ✅ `400` |
| `PUT /diet/<uuid válido inexistente>` | — | ✅ `404 Food log not found` |
| `DELETE /diet/<uuid válido inexistente>` | — | ✅ `404 Food log not found` |

**Sem falso positivo:** o `format` não é mais restrito que o parser de `uuid` do Postgres — uuid em **maiúsculas** e uuid fora do padrão v4 (`…-1111-1111-…`) passam pela validação e chegam ao repositório, devolvendo `404` e não `400`. Ou seja, nenhum id legítimo do banco corre risco de ser rejeitado na borda.

### 3.2 CRUD de refeição com id real ✅

Via HTTP, na conta de teste:

| Passo | Resultado |
|---|---|
| `POST /diet` (`QA round5`, 300 kcal, `{protein:20, carbs:30, fat:10}`) | ✅ `201`, `consumed = {calories:300, protein_g:20, carbs_g:30, fat_g:10}`, id `12fc59e2-…` |
| `PUT /diet/<id>` (450 kcal, `{protein:35, carbs:40, fat:15}`) | ✅ `200`, nome/kcal/macros atualizados, `consumed` recalculado |
| `DELETE /diet/<id>` | ✅ `200`, `logs: 0`, `consumed` zerado |

---

## 4. UI no portal `TorvWeb` ✅

### 4.1 Login — gradiente cobrindo igual

Após o logout, a tela de landing voltou com **as mesmas coordenadas do round 1** (antes da mudança): `img [0,0 412x501]`, “Registre-se” em `y=726`, “Login” em `y=808`. Layout idêntico.

Medição do próprio gradiente no DOM:

| Propriedade | Valor |
|---|---|
| `background-image` | `linear-gradient(rgba(0,0,0,0), rgb(18,18,18))` — `transparent → colors.background` |
| `position` | `absolute` |
| `top / right / bottom / left` | `0px / 0px / 0px / 0px` |
| `getBoundingClientRect` | `0, 0, 412×501` |
| Container pai | `0, 0, 412×501` → **cobre 100%** |
| `<img>` de fundo | `0, 0, 412×501` → mesma área |

O gradiente cobre exatamente a imagem, com inset zero nos quatro lados — o mesmo que `absoluteFillObject` produzia.

O fluxo de autenticação foi exercitado de ponta a ponta nessa verificação: **logout** → landing → **login** com a conta de teste → Home. Tudo funcionando; o portal ficou logado na conta de teste ao final.

### 4.2 MyDiet — macros das refeições

Refeição criada **pela UI** (`Adicionar refeição`, “Frango QA”, 320 kcal, P 38 / C 12 / G 9):

- Lista renderizou **`Frango QA · P: 38g · C: 12g · G: 9g · 320 kcal`** ✅
- **Editar** pela UI (400 kcal, P 45) → lista passou a `P: 45g · C: 12g · G: 9g · 400 kcal` ✅
- **Excluir** pela UI (com o modal de confirmação) → `Nenhuma refeição ainda` na tela e `logs: 0`, `consumed` zerado no backend ✅

O editar e o excluir pela UI também são a prova de que o id real que o app manda passa pelo novo `format: 'uuid'` — o risco principal do `af654ee` era justamente rejeitar id legítimo, e não rejeita.

### 4.3 Console

Buffer do console capturado do recarregamento até o fim da rodada (reload, CRUD na UI, logout, login): **vazio**. Zero erro JS, zero red box.

---

## Achados desta rodada

**Nenhum achado novo.**

### Estado dos itens carregados

| ID | Origem | Status |
|---|---|---|
| **A2** — `logId` sem validação (metade do O1) | round 4 | ✅ **Fechado** por `af654ee` |
| **O1** — 400 em vez de 500 para entrada inválida | round 1 | ✅ **Fechado por completo** (data no round 4, id agora) |
| **A1** — fixture de `nutritionSuggestion.test.js` depende da data real | round 4 | ⚠️ **Ainda aberto** — `birthDate: '1996-01-15'` e `2711` continuam no arquivo, sem `today` pinado. Os 3 testes passam hoje e quebram a partir de **2027-01-15**. LOW, não bloqueia. Fix de uma linha: `today: new Date('2026-09-24T12:00:00Z')` no `INPUTS` do stub. |
| **F5** | round 1 | ✅ Fechado no round 4 |
| **A3** — `?date=` vazio agora 400 | round 4 | Informativo, sem impacto no app |

---

## Estado final da conta de teste

Objetivo `Perder Peso`, nível `AVANÇADO`, 78 kg / 175 cm, idade 32, meta `2214/166/221/74` com a sugestão pendente do round 4 (`changed:["fitness_level"]`) intacta. Nenhum registro de refeição de teste ficou para trás (os três criados nesta rodada — dois via HTTP, um via UI — foram apagados). Portal `TorvWeb` logado na conta de teste.

---

## Decisão

**PASS.** `b69d9de` zera o `tsc` sem mudar comportamento — gradiente do Login medido cobrindo exatamente a mesma área e macros do MyDiet renderizando certo em criar/editar/excluir. `af654ee` fecha o A2 com 400 para id malformado e 404 para uuid válido inexistente, sem rejeitar id legítimo.

Só A1 fica em aberto, LOW e com data para estourar em 2027 — acompanhamento, não bloqueio.

Task 9 **verde nesta rodada** → pronto para a re-revisão do Security sobre o delta `b69d9de` + `af654ee`.
