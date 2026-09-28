# QA: DatePicker custom TORV (rodada 7, v4 com data mínima 2026-01-01)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (código da feature ainda **não commitado**)
**Escopo:** regra de negócio do usuário: nenhum registro de dieta antes de 2026-01-01. A feature toca **duas camadas**:
- `BackEndTorv/src/controller/diet.controller.js`: `MIN_DIET_DATE`, com 400 no `addFoodLog`.
- `FrontEndTorv/src/components/DatePickerModal/index.tsx`: prop `minDate`, `isOutside`, `prevDisabled` e `clampMonth`.
- `FrontEndTorv/src/screens/MyDiet/index.tsx`: `MIN_DIET_DATE`, `minDate` no modal e faixa filtrada.

**Veredito: PASS.**
- Os 5 itens do roteiro passaram, nas duas camadas.
- Não há achado bloqueante.
- O LOW de 320 pt do round 6 (critério 1c, aceito pelo Maestro como limitação conhecida) continua igual. Esta rodada não mexe nele.

---

## Achados

| # | Sev. | Onde | Achado |
|---|---|---|---|
| INFO | teste | `BackEndTorv/src/controller/diet.controller.js:99-102` | Nenhum teste do `npm test` (45/45) cobre o limite mínimo. Um caso em `node --test` com 2025-12-31 → 400 e 2026-01-01 → 201 fixaria a regra. |
| INFO | defesa em profundidade | banco (`food_logs.logged_date`) | A regra só existe no `POST /diet`. Um `CHECK (logged_date >= '2026-01-01')` no banco garantiria a regra para qualquer caminho de escrita. Antes, seria preciso checar se já existem linhas antigas de contas de teste. |
| INFO | cobertura | `DatePickerModal/index.tsx:68-73` (`clampMonth`) | Com o intervalo atual [2026-01-01, 2026-09-28], **nenhum caminho da UI leva a um mês fora do intervalo**, porque as setas e as pílulas de fora ficam desabilitadas. Por isso não dá para exercitar o clamp no portal. Ele foi coberto pelo script (seção 1). |
| INFO | pré-existente, fora do escopo | `MyDiet/index.tsx` (estado vazio) | (Igual ao round 6.) Numa data passada vazia, o texto diz "…nada **hoje**." |

## 1. Revisão de código e checagens ✅

| Ponto | Resultado |
|---|---|
| Backend | Os 400 vêm em ordem: `Invalid logged_date`, depois o **mínimo**, depois o futuro (+1 dia). Comparar strings é seguro porque o schema Ajv (`format: 'date'`, `diet.routes.js:77`) garante `YYYY-MM-DD`. Sem `logged_date`, o valor padrão é hoje (≥ mínimo). O `PUT /diet/:logId` não aceita `logged_date` (`diet.routes.js:152-154`), então o `POST` é o único caminho de escrita da data. O `GET /diet/summary` não mudou (leitura). |
| `isOutside(first, last)` | O intervalo fica inteiramente fora de [min, max]. Ele é usado pelos dias (`iso, iso`), pelas pílulas de mês (`monthRange`), pelas de ano (`yearRange`) e pelas setas (`prevDisabled`/`nextDisabled`). Em anos, a seta anterior testa a página inteira anterior (`end-23 .. end-12`). |
| `clampMonth` | Prende em `firstOfMonth(maxDate)` se o mês estiver todo depois do máximo, e em `firstOfMonth(minDate)` se estiver todo antes do mínimo. |
| MyDiet | `displayedDates` passa por `.filter(fullDate >= MIN_DIET_DATE)`, e o modal recebe `minDate`. A constante fica duplicada no front e no back (aceitável: dois deploys). |
| Script `date-edge-min.mts` (novo) | Espelha `index.tsx:19-20, :65-73, :95-112, :126, :141, :229` e o filtro do MyDiet. Casos cobertos: setas de jan e fev/2026; dias 2025-12-31 e 2026-09-29 fora do intervalo; meses Out–Dez desabilitados; ano 2025 desabilitado; página 2015–2026 com só 2026 habilitado e a seta anterior desabilitada; clamp nas duas pontas; mínimo no meio do mês; semana de 01/01 → [1, 2, 3]; faixa de 5 dias com "hoje" em 02/01/2026 → [1, 2]. **6/6 fusos OK.** Os scripts dos rounds 1, 3 e 4 também rodaram de novo e seguem 6/6. |
| `npx tsc --noEmit` (FrontEndTorv) | ✅ exit 0 |
| `npx expo-doctor` (FrontEndTorv) | ✅ 21/21 |
| `npm test` (BackEndTorv) | ✅ 45/45 pass, 0 fail |

## 2. Execução

**Ambiente:**
- **Backend reiniciado** com o código novo: o PID 8772 (código antigo, do round 1) foi encerrado e o `npm start` subiu o **PID 32588** em :3000.
- O reaper de memória do Claude Code matou depois o wrapper de shell, mas o processo `node` seguiu vivo e respondendo.
- Metro com watch (PID 25212).
- A RAM livre ficou baixa durante a rodada (0,5–1,8 GB).
- Conta usada: `qa.datepicker.1790604006@torvtest.dev`.

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | Backend em :3000: `POST /diet` | ✅ **PASS** | Com `2025-12-31`: **400** `{"error":"logged_date cannot be before 2026-01-01"}`. Com `2026-01-01`: **201** (log `6b2ffa18-…`), apagado depois (`DELETE` 200). |
| 2a | Modo dias: jan/2026 e fev/2026 | ✅ **PASS** | Em jan/2026, "Mês anterior" tem `aria-disabled="true"` e todos os 31 dias estão habilitados. Em fev/2026 a seta anterior está habilitada. |
| 2b | Modo meses 2026 | ✅ **PASS** | "Ano anterior" e "Próximo ano" desabilitados. Jan–Set habilitados; **Out, Nov e Dez** desabilitados. Set com borda de "hoje". |
| 2c | Modo anos "2015 – 2026" | ✅ **PASS** | **2015–2025 desabilitados** e **só 2026 habilitado** (em pílula). **As duas setas** ficam desabilitadas: "Anos anteriores" e "Próximos anos" com `aria-disabled="true"`. |
| 3a | Confirmar 01/01/2026 | ✅ **PASS** | A faixa mostra **só QUI 1 · SEX 2 · SÁB 3** (sem 28–31/12/2025), com o **1 ativo** e o chip "Hoje". |
| 3b | Adicionar refeição em 01/01/2026 | ✅ **PASS** | Pelo formulário da UI, o `POST /diet` volta **201** com `logged_date: "2026-01-01"` (capturado por hook de XHR). O `GET /diet/summary?date=2026-01-01` volta 200, e a tela mostra **250 / 2232 kcal, P20/C25/G8** com "QA R7 01-01-2026" na lista. Excluída pela UI: `DELETE` 200, e o dia voltou a 0 kcal. |
| 4a | Fluxo normal com data de 2026 | ✅ **PASS** | Meses → Março → 15 → Confirmar: a faixa mostra **DOM 15 … SÁB 21** com o 15 ativo e o chip "Hoje". |
| 4b | Cancelar/reabrir | ✅ **PASS** | A reabertura vem em `Dom., 15 de mar.` / "Março de 2026". Depois de marcar o 20, cancelar e reabrir, volta em 15/mar. |
| 4c | Chip "Hoje" e faixa dos 5 dias | ✅ **PASS** | Com "Hoje": **QUI 24 · SEX 25 · SÁB 26 · DOM 27 · SEG 28** (intacta, nada filtrado), e o chip some. |
| 4d | Toques repetidos na seta (fev → jan param) | ✅ **PASS** | 4 toques na mesma coordenada (52,263), a partir de mar/2026: Fevereiro → **Janeiro (seta desabilitada)** → Janeiro → Janeiro. Para em janeiro. |
| 4e | Clamp no maxDate | ➖ não exercitável na UI | Veja INFO. Coberto pelo script. |
| 4f | 320 e 390 px | ✅ **PASS** | Em "Janeiro de 2026" e "2015 – 2026", nas duas larguras: setas de **38×38** inteiras no card, nas mesmas posições do round 6 (prev 32,8..70,8; next 249,2 / 319,6), sem truncar. As setas desabilitadas mantêm a mesma caixa. |
| 5 | `tsc` e `expo-doctor` | ✅ **PASS** | Seção 1. |

**Console:** nenhum warning de DateTimePicker. Só o pré-existente `props.pointerEvents is deprecated` do carregamento.

## 3. Gate

**PASS.** Libera para o **Torv Security** com o diff completo da feature, agora com backend + frontend. Os INFO são opcionais: teste do limite no `npm test` e `CHECK` no banco.

Não coberto (igual aos rounds anteriores): execução em iOS/Android nativo.

## 4. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` | API (item 1) e portal (itens 2–4) | 0 refeições. As duas criadas em 2026-01-01 (`6b2ffa18-…` via API, `c2064c86-…` via UI) foram apagadas. O portal voltou a 390×835. |
| `claude.dietmin.1790614803689@torvtest.dev` | Criada pelo Torv Backend (verificação em :3001) | Não usada nesta rodada. |
