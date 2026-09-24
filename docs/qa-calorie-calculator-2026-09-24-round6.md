# QA — Calculadora de Calorias e Macros (rodada 6)

**Data:** 2026-09-24
**Recruta:** Torv Review and Tests
**Task:** 9 do plano `docs/superpowers/plans/2026-09-24-calorie-macro-calculator.md`
**Rodadas anteriores:** round 1 (FAIL) · rounds 2–5 (PASS)
**Commit sob teste:** `c39bb9d` — *test(diet): pin today in the suggestion stub so the clock cannot break it*

**Veredito: PASS** — A1 fechado e comprovado com relógio falso. **Nenhum achado novo. Nenhum item aberto.**

---

## Escopo

Reteste só do `c39bb9d`: `npm test`, revisão do diff e prova de que o teste deixou de depender da data real. Sem UI e sem HTTP, conforme pedido — nada foi subido e nenhum portal foi tocado.

---

## 1. Testes ✅

`cd BackEndTorv && npm test` → **21/21 pass**, 0 fail (205 ms).

---

## 2. Revisão do diff ✅

`git show c39bb9d --stat` → **1 arquivo, +3 −1**:

```
BackEndTorv/src/lib/nutritionSuggestion.test.js | 4 +++-
```

**Só arquivo de teste. Nenhuma linha de código de produção.** A mudança efetiva é uma linha no stub `INPUTS`:

```js
+  today: new Date('2026-09-24T12:00:00Z'),
```

mais duas linhas de comentário explicando que o `today` atravessa `getCalcInputs → computeForUser → calculateTargets`.

Pontos conferidos:

- **É exatamente o fix recomendado no round 4** (item A1), com o mesmo valor sugerido.
- **Não vaza para produção:** `dietRepository.getCalcInputs` (`diet.repository.js:95`) devolve só `gender`, `birthDate`, `fitnessLevel`, `goals`, `weightKg`, `heightCm` — nunca `today`. Em produção `calculateTargets` continua caindo no default `today = new Date()`. O `today` só existe no objeto do stub.
- **Meio-dia UTC** é uma escolha boa: `ageOn` compara partes UTC, então nenhum fuso empurra a data para o dia anterior/seguinte.
- Os números esperados do fixture (`2711/169/305/90`, idade 30) continuam os mesmos — o commit não remexeu em asserção nenhuma, só tornou determinística a entrada que as produzia.

---

## 3. Prova de independência do relógio ✅

Rodei a suíte inteira com o `Date` global substituído por um preload que finge datas futuras (arquivo no scratchpad, fora do repositório; sanity check confirmou `new Date()` devolvendo a data falsa antes de rodar):

| Relógio fingido | Resultado |
|---|---|
| **2027-01-15** (o dia exato em que o A1 previa a quebra) | ✅ **21/21 pass**, 0 fail |
| 2028-06-01 | ✅ **21/21 pass**, 0 fail |
| 2031-12-31 23:00 | ✅ **21/21 pass**, 0 fail |

### Controle negativo — o harness pega mesmo a falha

Para o verde acima não ser falso negativo (preload sem efeito), rodei uma **cópia** do mesmo arquivo de teste no scratchpad com a linha `today:` removida, sob o relógio de **2027-01-15**:

```
ℹ tests 3
ℹ pass 0
ℹ fail 3
```

Os três testes quebram sem o `today` pinado, exatamente como o round 4 tinha previsto — e passam com ele. O relógio falso funciona, e o fix é o que faz a diferença.

Vale registrar que **nenhum dos 21 testes** depende do relógio: a suíte completa passa em 2027, 2028 e 2031, não só os três de `nutritionSuggestion.test.js`.

---

## Achados

**Nenhum achado novo.**

### Estado de todos os itens das rodadas anteriores

| ID | Origem | Status |
|---|---|---|
| F1 — MyDiet não recarregava a meta no foco | round 1 | ✅ Fechado (round 2) |
| F2 — 4xx do Fastify virando 500 | round 1 | ✅ Fechado (round 2) |
| F3 — aviso de conflito atrás do rodapé | round 1 | ✅ Fechado (round 2) |
| F4 — fallback do diet summary | round 1 | ✅ Fechado (round 2) |
| F5 — basis não recarimbado | round 1 | ✅ Fechado (round 4) |
| Vuln 1 (Security) — enum via prototype chain | Security round 1 | ✅ Fechado (round 3) |
| S1 — `ALLOWED_IMAGE_TYPES[mimetype]` | round 3 | Pré-existente, LOW, não explorável — fora do escopo da feature |
| O1 — 500 em vez de 400 para entrada inválida | round 1 | ✅ Fechado por completo (data no round 4, `logId` no round 5) |
| A1 — fixture dependente do relógio | round 4 | ✅ **Fechado nesta rodada** |
| A3 — `?date=` vazio agora 400 | round 4 | Informativo, sem impacto no app |

**Não há nenhum item aberto atribuído a esta feature.** O único LOW que sobra (S1) é código pré-existente de upload de foto, fora do diff da calculadora, e está registrado no relatório do round 3 para a Torv Security decidir se entra nesta branch ou vira tarefa à parte.

---

## Nota de ambiente

`git status` mostra `BackEndTorv/package-lock.json` como modificado, mas `git diff` do arquivo vem **vazio** — é só normalização de fim de linha (LF→CRLF) do Git no Windows, não alteração de conteúdo. Registrado para ninguém perder tempo investigando.

---

## Decisão

**PASS.** `c39bb9d` fecha o A1 com uma linha, mexe só em arquivo de teste, não toca produção, e a independência do relógio está comprovada com controle negativo. 21/21 verde hoje e em 2027, 2028 e 2031.

Task 9 **verde nesta rodada**, sem item aberto → pronto para a re-revisão do Security sobre o delta `c39bb9d` (que é só teste).
