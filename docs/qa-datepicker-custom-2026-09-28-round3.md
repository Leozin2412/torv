# QA: DatePicker custom TORV (rodada 3, v2 com navegação por mês/ano)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (código da feature ainda **não commitado**)
**Escopo:** v2 pedida pelo usuário, com um atalho de mês/ano em vez de navegar mês a mês. Desde o round 2 (PASS, `docs/qa-datepicker-custom-2026-09-28-round2.md`), só mudaram `FrontEndTorv/src/components/DatePickerModal/{index.tsx,styles.ts}`.

**Veredito: PASS.**
- Os 8 itens do roteiro passaram, conferidos no código e ao vivo.
- Não há achado bloqueante.
- Há 1 LOW **pré-existente desde o round 1**, não introduzido pela v2: em telas de 320 pt os botões de dia se sobrepõem.
- Há 2 notas INFO, só do web.

---

## Achados

| # | Sev. | Onde | Achado |
|---|---|---|---|
| 1 | LOW (pré-existente, não bloqueia) | `FrontEndTorv/src/components/DatePickerModal/styles.ts:30` (`day: { width: 38, height: 38 }`) + `:26` (`cell` = 1/7 da largura) | Em viewport de **320 px**, a célula tem 32,9 px e o botão do dia tem 38 px. Os dias vizinhos se sobrepõem em **5,1 px**, tanto a pílula verde do selecionado quanto a área de toque. Em 360 px sobra 0,6 px, e em 390 px está ok. 320 pt não é só o iPhone SE de 1ª geração: é também a largura lógica do SE 2/3 e dos iPhone mini com "Zoom de Tela" ligado. **Sugestão:** `day: { width: '100%', maxWidth: 38, aspectRatio: 1 }` (ou `height` igual à largura). A grade de meses está ok em 320 px (gap de 4,8 px). |
| INFO | só web | `index.tsx:123` e `:159` | `aria-selected` em `role="button"` não é previsto no ARIA. Leitores de tela no web podem ignorá-lo (`aria-pressed` ou `aria-current` seriam os equivalentes para botão). No iOS/Android, o RN mapeia para `accessibilityState.selected` e é anunciado. |
| INFO | só web | `index.tsx:138` | (Igual ao round 2.) `aria-label` no `div` sem `role` dos dias da semana. |

## 1. Revisão de código ✅

| Ponto | Resultado |
|---|---|
| Alternância dias/meses | `mode` em state (`index.tsx:30`). O rótulo é um `TouchableOpacity` que alterna o modo (`:80-88`). Alternar não mexe em `month` nem em `selected`, então tocar no rótulo de novo volta aos dias do mesmo mês. |
| Setas | `shift(delta)` (`:52-55`): ±1 mês no modo dias, ±1 ano no modo meses (`new Date(year+delta, monthIndex, 1)`). As labels acessíveis trocam junto (`Mês anterior`/`Ano anterior`, `Próximo mês`/`Próximo ano`). |
| Próximo desabilitado | `nextStart` (`:48`) é o 1º de janeiro do ano seguinte no modo meses, e o 1º do mês seguinte no modo dias. Comparar com `maxDate` desabilita "Próximo ano" exatamente no ano de `maxDate`. |
| Clamp | Se o novo 1º do mês passar de `maxDate`, a data é presa em `firstOfMonth(maxDate)` (`:54`). No modo dias isso nunca acontece, porque a seta já está desabilitada. Voltar no tempo nunca prende. |
| Meses desabilitados, exibido e hoje | O mês fica desabilitado quando o seu 1º dia é maior que `maxDate` (`:106`). O mês exibido tem `daySelected` (pílula verde). O mês de hoje fica com `dayToday` (borda) quando não é o exibido (`:117`). Tocar num mês faz `setMonth` + `setMode('days')` e não mexe em `selected`. |
| Reabrir | O reset durante o render inclui `setMode('days')` (`:39`), no mesmo commit que `visible=true`. |
| Altura fixa | `monthCell.height = 7*CELL_HEIGHT/4` (`styles.ts:27`), e 4 linhas × 77 = 308, a mesma altura da grade de dias (`styles.ts:25`). |
| Chaves e labels | Os meses usam o nome como chave (único). A label é `Março de 2024` (`capitalize` + ano). O rótulo do toggle contém o texto visível ("Setembro de 2026" / "2026"), o que atende "label in name". |
| Script de edge cases (modo meses) | `date-edge-months.mts` espelha `:48-55` e `:104-106` e importa o `utils/date.ts` real. Casos cobertos: meses desabilitados em 2026 = [Out, Nov, Dez]; próximo ano desabilitado em 2026 e habilitado em 2025; 2× ano anterior = set/2024, com 0 meses desabilitados; 1/mar/2024 numa sexta com 31 dias; clamp dez/2025+1 ano = set/2026; mar/2025+1 = mar/2026 (sem clamp); clamp com max em 31/01; max no dia 1 (permitido); sem `maxDate`, sem clamp. **6/6 fusos OK** (Sao_Paulo, UTC, Kiritimati +14, Pago_Pago −11, New_York, Kolkata). O script do round 1 rodou de novo e segue 6/6. |

## 2. Checagens automatizadas ✅

- `cd FrontEndTorv && npx tsc --noEmit` → **exit 0**
- `cd FrontEndTorv && npx expo-doctor` → **21/21 checks passed. No issues detected!**

## 3. Usabilidade no portal "Torv Mobile #2" (390×835, Expo web)

**Ambiente:**
- O Metro foi **reiniciado com `--clear` e agora com watch**, sem `CI=1`. Nos rounds 1 e 2 ele estava em modo CI.
- O `BackEndTorv` seguiu em :3000.
- Mesma conta dos rounds anteriores. Uma refeição foi semeada em **15/03/2024** (510 kcal, P35/C55/G14).
- As medições vêm do DOM (`getComputedStyle`/`getBoundingClientRect`).

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | Abrir → tocar no rótulo do mês | ✅ **PASS** | O rótulo mostra `2026` (label "Voltar para os dias de Setembro de 2026"). Grade 3×4 com **Set** em pílula `rgb(140,198,63)` e `aria-selected="true"`. **Out, Nov e Dez** com `aria-disabled="true"` e opacidade 0.3. **"Próximo ano"** com `aria-disabled="true"` e opacidade 0.3. |
| 2 | Ano anterior 2× → 2024 → Mar → 15 → Confirmar | ✅ **PASS** | Depois de 1× a grade mostra 2025 com tudo habilitado, e depois de 2× mostra **2024** com os 12 meses habilitados e "Próximo ano" habilitado. Ao tocar em Mar, os dias ficam com o rótulo **"Março de 2024"**: 31 dias, **1/mar na coluna de sexta** (x=262) e 31/mar no domingo (x=47). O cabeçalho continua `Seg., 28 de set.` até tocar num dia. Com o 15 tocado, o cabeçalho vira `2024` / **`Sex., 15 de mar.`** (`aria-selected="true"`). Depois de Confirmar, a faixa mostra **DOM 10 · SEG 11 · TER 12 · QUA 13 · QUI 14 · SEX 15\* · SÁB 16**, **510 / 2232 kcal, P 35 / C 55 / G 14**, a refeição "QA DatePicker R3 15-03-2024" e o chip **"Hoje"**. |
| 3 | Clamp: Dez/2025 nos dias → meses → Próximo ano → volta aos dias | ✅ **PASS** | Em dez/2025, o modo meses mostra `2025` com **Dez** destacado. Depois de "Próximo ano", mostra **`2026`** com **Set** destacado (label "Voltar para os dias de **Setembro** de 2026"), Out–Dez desabilitados e "Próximo ano" desabilitado. Voltando aos dias sem escolher mês, aparece **"Setembro de 2026"**, 30 dias, "Próximo mês" desabilitado. **Nunca dez/2026.** |
| 4 | Altura do card e posição das setas iguais nos dois modos | ✅ **PASS** | Iguais nos modos dias (set/2026, mar/2024) e meses (2026, 2024): card `24,150 342×534`, grade h=308, seta esquerda `45,244 38×38`, seta direita `308,244 38×38`, Confirmar `202,614 144×50`. São os mesmos números do round 2. |
| 5 | Cancelar no modo meses → reabrir | ✅ **PASS** | O teste passou por mar/2026 no modo dias, voltou ao modo meses, recuou 2 anos (rótulo "2024", label "…Março de 2024") e cancelou. Na reabertura, com `MutationObserver` ativo, **o único commit foi o modo dias em "Setembro de 2026"**, com 30 dias e o cabeçalho `Seg., 28 de set.`. O modo meses e 2024 não apareceram em nenhum commit. |
| 6 | a11y no DOM web | ✅ **PASS** | Os 12 meses têm `aria-label` `Janeiro de 2026` … `Dezembro de 2026` (e `Março de 2024` no item 2) e `role="button"`. `aria-selected="true"` só no exibido, `"false"` nos outros. `aria-disabled="true"` em Out/Nov/Dez e em "Próximo ano". "Ano anterior" não tem o atributo (habilitado). O toggle tem `role="button"`. **Mês de hoje:** com mar/2026 exibido, **Set** fica com borda `rgb(140,198,63)` e Mar fica em pílula. Veja a nota INFO sobre `aria-selected` em botão. |
| 7a | Regressão: toques repetidos na seta (modo dias) | ✅ **PASS** | Foram **9 toques na mesma coordenada (64,263)**, de set/2026 a dez/2025. **Os 9 avançaram**, com a seta fixa em y=244..282. |
| 7b | Regressão 3a–3e | ✅ **PASS** | **3a:** abre em `2026` / `Seg., 28 de set.` / `Setembro de 2026`, card `rgb(28,28,30)`, 28 em `#8CC63F`. **3b:** 7a. **3c:** "Próximo mês" desabilitado em set/2026. **3d:** só 29 e 30/09 com `aria-disabled="true"` (27 habilitado). **3e:** item 2 (data passada → semana, dados, chip). Com "Hoje": QUI 24 … SEG 28, 28 ativo, 0 kcal, chip some. |
| 8 | Telas estreitas (extra, fora do roteiro) | ⚠️ LOW | Em 320 px os dias se sobrepõem 5,1 px (achado #1). Em 360 px, gap de 0,6 px. Meses ok nas duas larguras. O card cabe na tela em 320×568. |

**Console:** nenhum warning de DateTimePicker. Só apareceram os pré-existentes do carregamento: `props.pointerEvents is deprecated` (atribuído no round 2) e `"shadow*" style props are deprecated` (Metro).

## 4. Gate

**PASS.** Libera para o **Torv Security** com o diff completo da feature. O achado #1 é LOW, vem do round 1 e fica opcional. A correção sugerida é de uma linha em `styles.ts:30`.

Não coberto (igual aos rounds anteriores): execução em iOS/Android nativo.

## 5. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` (a mesma dos rounds 1 e 2) | Fluxo completo no portal | 0 refeições. A refeição semeada em 15/03/2024 (`095cce82-…`) foi apagada via `DELETE /diet/:id` (200), e o summary de 15/03/2024 voltou a 0 kcal / 0 logs. |
