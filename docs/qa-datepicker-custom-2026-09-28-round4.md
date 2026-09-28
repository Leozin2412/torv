# QA: DatePicker custom TORV (rodada 4, v3 com navegação por anos)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (código da feature ainda **não commitado**)
**Escopo:** v3 pedida pelo usuário, com uma grade de anos no mesmo estilo da grade de meses. Desde o round 3 (PASS, `docs/qa-datepicker-custom-2026-09-28-round3.md`), só mudaram `FrontEndTorv/src/components/DatePickerModal/{index.tsx,styles.ts}`.

**Veredito: PASS.**
- Os 8 itens do roteiro passaram, conferidos no código e ao vivo.
- Não há achado bloqueante.
- Ficam **2 LOW, ambos só em telas de 320 pt**. Veja a tabela abaixo.
- A **correção dos 320 px pedida pelo usuário no round 3 não está neste diff**: `styles.ts:30` continua com `day: { width: 38, height: 38 }`.

---

## Achados

| # | Sev. | Onde | Achado |
|---|---|---|---|
| 1 | LOW (aberto desde o round 1; o usuário pediu a correção) | `FrontEndTorv/src/components/DatePickerModal/styles.ts:30` | **Continua igual ao round 3.** Em 320 px, o botão do dia (38 px) é maior que a célula (32,9 px), e os dias vizinhos se sobrepõem **5,1 px**. Sugestão: `day: { width: '100%', maxWidth: 38, aspectRatio: 1 }`. |
| 2 | LOW (**entrou no v2/round 3** e eu não peguei lá; segue no v3) | `FrontEndTorv/src/components/DatePickerModal/styles.ts:22` (`modeToggle` com `padding: 8`, `gap: 4` e o chevron de 16 px) + `styles.ts:20-21` | Em 320 px, **no modo dias**, o rótulo `Setembro de 2026 ▾` fica com 189 px e não cabe entre as setas (sobram 154 px). A seta **"Próximo mês" passa da borda direita do card em 14 px** (seta 272..310, card até 296). Com `Fevereiro de 2026`, passa 9 px. Nos modos meses e anos a seta fica em 237..275, então **ela anda 35 px ao alternar de modo** em 320 px, e a garantia de "setas fixas" do round 2 quebra nessa largura. Em 360 px e 390 px cabe (a seta fica em 277..315 e 308..346 nos três modos). No round 3 eu medi só as grades em 320 px, não a linha de navegação. **Sugestão:** o toggle com `flexShrink: 1` e o `Text` com `numberOfLines={1}`, ou menos padding horizontal no toggle e nas setas em telas estreitas. Vale corrigir junto com o #1, no mesmo passe de 320 px. |
| INFO | só web | `index.tsx:185` e `:220` | (Igual ao round 3.) `aria-selected` em `role="button"` não é previsto no ARIA. No nativo é anunciado. |
| INFO | contrato | `index.tsx:29` e `:94` | Sem `maxDate`, `anchor` vira o ano de hoje e "Próximos anos" fica desabilitado a partir da página que termina nele. Os modos dias e meses, sem `maxDate`, deixam ir para o futuro. É inconsistente, mas o único chamador (MyDiet) sempre passa `maxDate`. Não há ação agora. |

## 1. Revisão de código ✅

| Ponto | Resultado |
|---|---|
| Modos | `mode: 'days' \| 'months' \| 'years'` (`:33`). `toggleMode` (`:66-72`): dias → meses, meses → anos (calcula a página), anos → dias sem mexer em `month`. Tocar num mês (`:109-112`) vai para dias, e tocar num ano (`:124-127`) vai para meses. |
| Páginas de anos | `anchor` é o ano de `maxDate` (`:29`). Ao entrar, `yearPageEnd = anchor - 12*floor((anchor - year)/12)` (`:69`) sempre dá a página `[end-11..end]` que contém `year` (verificado de 1900 a 2026). As setas somam ±12 (`:62`). `nextDisabled = yearPageEnd >= anchor` (`:94`) desabilita só a última página. `isDisabled = y > anchor` (`:123`) nunca dispara em página alcançável. |
| Clamp | `clampToMax` (`:58`) é usado pelas setas dos modos dias e meses (`:63`) e pela escolha de ano (`:125`). Com o mês exibido depois de `maxDate`, ele prende no mês de `maxDate`. |
| JSX compartilhado | O array `pills` (`:99-129`) gera meses e anos. O render (`:171-194`) é o mesmo `monthPill` + `dayToday`/`daySelected`/`disabled` do v2. Os meses saem com o mesmo texto, label e estados do round 3 (seção 3, item 8). |
| Reabrir | O reset durante o render força `setMode('days')` (`:43`). `yearPageEnd` não precisa de reset, porque é recalculado ao entrar em anos. |
| Labels | Setas: `Mês anterior`/`Próximo mês`, `Ano anterior`/`Próximo ano`, `Anos anteriores`/`Próximos anos`. Toggle: `Escolher mês e ano, atual: …`, `Escolher ano, atual: 2026` e `Voltar para os dias de …`. O texto visível está contido em cada label. |
| Script de edge cases (modo anos) | `date-edge-years.mts` espelha `:29, :58, :62, :69, :94, :115-128` e importa o `utils/date.ts` real. Casos cobertos: a página contém o ano para todo ano de 1900 a 2026; 2026 e 2015 → 2015–2026; 2014 e 2003 → 2003–2014; 2002 → 1991–2002; próximos desabilitado só na última página; nenhum ano desabilitado; 2010 mantém setembro; dez/2026 → set/2026; 1/mar/2010 numa segunda com 31 dias; `maxDate` num novo ano move a âncora. **6/6 fusos OK.** Os scripts dos rounds 1 e 3 rodaram de novo e seguem 6/6. |

## 2. Checagens automatizadas ✅

- `cd FrontEndTorv && npx tsc --noEmit` → **exit 0**
- `cd FrontEndTorv && npx expo-doctor` → **21/21 checks passed. No issues detected!**

## 3. Usabilidade no portal "Torv Mobile #2" (390×835, Expo web)

**Ambiente:**
- Metro com watch (do round 3), com a página recarregada.
- `BackEndTorv` em :3000.
- Mesma conta. Uma refeição foi semeada em **15/03/2010** (480 kcal, P32/C50/G13).

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | dias → meses → anos | ✅ **PASS** | O rótulo mostra **`2015 – 2026`** (label "Voltar para os dias de Setembro de 2026"). **2026** em pílula `rgb(140,198,63)` com `aria-selected="true"`. **"Próximos anos"** com `aria-disabled="true"` e opacidade 0.3. **Nenhum ano desabilitado** (12 × `aria-disabled` ausente). |
| 2 | Anos anteriores 1× → 2010 → Mar → 15 → Confirmar | ✅ **PASS** | Depois de 1× o rótulo mostra **`2003 – 2014`** e "Próximos anos" fica habilitado. Ao tocar 2010, o modo meses mostra `2010` com **Set** destacado (mês preservado) e os **12 meses habilitados**. Ao tocar Mar, o rótulo fica **"Março de 2010"**: 31 dias, **1/mar na coluna de segunda** (x=90) e 31/mar na quarta. O cabeçalho continua `Seg., 28 de set.` até tocar no 15, e aí vira `2010` / **`Seg., 15 de mar.`**. Depois de Confirmar, a faixa mostra **DOM 14 · SEG 15\* · TER 16 · QUA 17 · QUI 18 · SEX 19 · SÁB 20**, **480 / 2232 kcal, P 32 / C 50 / G 13**, a refeição "QA DatePicker R4 15-03-2010" e o chip **"Hoje"**. |
| 3 | Clamp: exibindo dez/2015 → anos → 2026 | ✅ **PASS** | O caminho foi anos → 2015 → Dez, até exibir "Dezembro de 2015". Depois: meses (Dez destacado), anos (`2015 – 2026`) e tocar 2026. O modo meses mostra **`2026` com Set destacado**, Out–Dez desabilitados e "Próximo ano" desabilitado. **Nunca dez/2026.** |
| 4 | Página ao entrar em anos | ✅ **PASS** | Exibindo 2014 (via "Ano anterior" 12× no modo meses), abre **`2003 – 2014`** com 2014 em pílula. Exibindo 2015, abre **`2015 – 2026`** com 2015 em pílula e **2026 com borda** `rgb(140,198,63)` (ano de hoje). |
| 5 | Rótulo em anos volta aos dias; Cancelar em anos → reabrir | ✅ **PASS** | Em `2003 – 2014` (exibindo set/2014), o rótulo leva a **"Setembro de 2014"**: 30 dias, o mês não mudou. Depois o caminho foi meses → anos → "Anos anteriores" (`1991 – 2002`) e Cancelar. Na reabertura, com `MutationObserver`, **o único commit foi o modo dias em "Setembro de 2026"**, e o cabeçalho é `Seg., 28 de set.`. |
| 6 | Card e setas iguais nos 3 modos | ✅ **PASS** (390 px) | Iguais nos modos dias, meses e anos: card `24,150 342×534`, grade h=308, setas `45,244 38×38` e `308,244 38×38`, Confirmar `202,614 144×50`. São os mesmos números dos rounds 2 e 3. **Em 320 px não vale no modo dias** (achado #2). |
| 7 | a11y no DOM web | ✅ **PASS** | As setas trocam o label por modo, como listado acima. Os anos têm `aria-label` **"2015"…"2026"**, `role="button"`, `aria-selected="true"` só no exibido e `"false"` nos outros, sem `aria-disabled`. "Próximos anos" tem `aria-disabled="true"` na última página e fica sem o atributo nas outras. |
| 8a | Regressão do modo meses | ✅ **PASS** | "Ano anterior" 12× vai de 2026 a 2014. Clamp pela seta: em dez/2025, "Próximo ano" → **2026 com Set**, e "Próximo ano" fica desabilitado. Out/Nov/Dez 2026 ficam desabilitados. As labels `Janeiro de 2026`… e os estados são idênticos ao round 3. Tocar em Set → "Setembro de 2026". |
| 8b | Toques repetidos na seta (modo dias) | ✅ **PASS** | Foram **9 toques em (64,263)**, de set/2026 a dez/2025. **Os 9 avançaram**, com a seta fixa em y=244. |
| 8c | Passos 3a–3e | ✅ **PASS** | **3a:** `2026` / `Seg., 28 de set.` / `Setembro de 2026`, card `#1C1C1E`, 28 em `#8CC63F` (`aria-selected="true"`). **3c:** "Próximo mês" desabilitado. **3d:** só 29 e 30 com `aria-disabled="true"`. **3e:** item 2. Com "Hoje": QUI 24 … SEG 28, 28 ativo, 0 kcal, chip some. |
| 8d | tsc e expo-doctor | ✅ **PASS** | Seção 2. |
| 9 | Telas estreitas (extra) | ⚠️ LOW | **320 px:** dias sobrepostos 5,1 px (#1). A seta "Próximo mês" passa 14 px do card e anda 35 px entre os modos (#2). As pílulas estão ok (gap de 4,8 px nos meses e 4,3 px nos anos), e o rótulo de meses e anos cabe entre as setas. **360 px:** tudo cabe, com a seta fixa em 277..315 nos modos medidos. |

**Console:** nenhum warning de DateTimePicker. Só o pré-existente `props.pointerEvents is deprecated` do carregamento.

## 4. Gate

**PASS.** Libera para o **Torv Security** com o diff completo da feature.

Recomendação: aplicar a correção de 320 px que o usuário já pediu (achado #1) **junto com o #2**, porque os dois são da mesma largura e o reteste é o mesmo (medir em 320 e 360 px).

Não coberto (igual aos rounds anteriores): execução em iOS/Android nativo.

## 5. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` (a mesma dos rounds 1–3) | Fluxo completo no portal | 0 refeições. A refeição semeada em 15/03/2010 (`3aaaf2a3-…`) foi apagada via `DELETE /diet/:id` (200), e o summary de 15/03/2010 voltou a 0 kcal / 0 logs. O portal voltou a 390×835. |
