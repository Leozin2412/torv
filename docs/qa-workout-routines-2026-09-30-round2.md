# QA — Módulo de treinos, entrega 1 (rotinas) — round 2 — 2026-09-30

**Owner:** Torv Review and Tests (Loupe) · **Round anterior:** `docs/qa-workout-routines-2026-09-30.md` (FAIL: F1 carga NULL virava 0, F2 chips do picker colapsados) · **Rework:** backend `690c02f`, frontend `3d2e995`.

**Escopo:** só o que mudou no rework. O resto do round 1 (RF1, RF2, IDOR, limites, plano vs planilha, fluxos 1–5) não foi refeito; esses commits não tocam esse código.

## Veredito: PASS (100% verde) → pode seguir para Security

| # | Checagem | Resultado |
|---|---|---|
| 1 | `BackEndTorv: npm test` | ✅ 73/73 |
| 1 | `FrontEndTorv: node --test src/utils/*.test.mjs` / `npx tsc --noEmit` | ✅ 7/7 / sem erros |
| 2 | `POST` com `sets [null, 0, 5]` → resposta e `GET` | ✅ `[null, 0, 5]` nos dois |
| 2 | `PUT` com `[5, null]` | ✅ 200, `[5, null]` |
| 2 | carga −1 / 1000 / `"abc"` | ✅ 400 / 400 / 400 (999.99 → 201) |
| 3 | UI: série 1 "7,5", série 2 em branco, série 3 "0" → salvar → reabrir | ✅ campos voltam `"7,5"`, `""`, `"0"`; `GET` confirma `[7.5, null, 0]` |
| 4 | Chips com a lista completa, 412 px | ✅ chips com 44 px e ScrollView com 44 px; `elementFromPoint` no centro de Todos/Peito/Costas/Ombros acerta o próprio chip; "Criar exercício" desce para y=210 |
| 4 | Toque real (coordenada) no chip "Costas" | ✅ lista filtra só Costas |
| 4 | Mesmo em 320 px | ✅ mesmas medidas, toque em "Peito" filtra só Peito, sem scroll horizontal (`scrollWidth` 320) |
| 5 | Singular | ✅ "1 exercício · 1 série" (plural nas demais: "7 exercícios · 21 séries") |
| 5 | Erro "Dê um nome para a rotina." some ao digitar o nome | ✅ |
| 5 | Erro "Adicione pelo menos um exercício." some ao adicionar exercício | ✅ |
| 6 | Console durante os fluxos | ✅ sem erros (nenhuma mensagem além do aviso antigo `pointerEvents`) |

## Ambiente

Expo web reiniciado com `EXPO_PUBLIC_API_URL=http://192.168.29.69:3000`. O login pelo app (conta `qa.workout.D.1790811644843@torvtest.dev`) funcionou **sem o shim**: as chamadas foram direto para `192.168.29.69:3000`, todas 200. Desta vez só foi usado um hook de XHR que registra as chamadas, sem reescrever o host.

## Checagens feitas só no navegador

Itens 3 (preenchimento e releitura no editor), 4 (medição e toque nos chips), 5 e 6. O item 3 também foi conferido pela API. Os itens 1 e 2 rodaram no terminal (testes) e via `fetch` na página (contrato).

Obs.: o `screenshot` do portal falhou ("page is not rendering", janela minimizada). Por isso as checagens visuais do item 4 foram feitas por medição de DOM (`getBoundingClientRect` + `elementFromPoint`) e por toque real em coordenada, não por imagem.

Dados de teste: a rotina "QA R2" foi criada e apagada no fim. A sessão original do portal foi restaurada.
