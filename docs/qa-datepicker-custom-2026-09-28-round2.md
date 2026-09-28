# QA: DatePicker custom TORV (rodada 2)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (código da feature ainda **não commitado**)
**Escopo:** rework do Torv Frontend sobre o round 1 (`docs/qa-datepicker-custom-2026-09-28.md`). Só mudaram `FrontEndTorv/src/components/DatePickerModal/{index.tsx,styles.ts}`. O resto do diff da feature é igual ao do round 1.

**Veredito: PASS.**
- Os 4 achados do round 1 (1 MEDIUM, 3 LOW) estão corrigidos, conferidos no código e reproduzidos ao vivo.
- Os passos 3a–3e do round 1 continuam passando, sem regressão.
- `tsc` e `expo-doctor` verdes.
- Nenhum achado novo bloqueante. Fica só 1 observação INFO, só no web (seção 1).

---

## 1. Revisão do rework

| Achado round 1 | Mudança | Resultado |
|---|---|---|
| **#1 MEDIUM**: altura do card variava | `styles.ts:4` `CELL_HEIGHT = 44`. `styles.ts:24` `grid.height = 7 * CELL_HEIGHT` (cabeçalho + 6 semanas, o máximo possível). `cell.height` usa a mesma const. | ✅ Corrigido. 6 semanas é o pior caso (mês que começa no sábado com 30/31 dias), então nada transborda. Medido na seção 3. |
| **#2 LOW**: dias da semana sem label | `index.tsx:10`: `WEEKDAYS` com os nomes completos. `index.tsx:85`: `name[0]` com `accessibilityLabel={name}`. `index.tsx:55`: o cabeçalho grande usa `slice(0, 3) + '.'`. | ✅ Corrigido. As 7 abreviações de 3 letras conferem (`Dom`, `Seg`, `Ter`, `Qua`, `Qui`, `Sex`, `Sáb`), e as chaves React (nome completo) seguem únicas. |
| **#3 LOW**: `selected` não chegava ao web | `index.tsx:106-107`: dias com `aria-selected`/`aria-disabled`. `index.tsx:76`: seta de próximo com `aria-disabled`. | ✅ Corrigido. No RN 0.71+ os props `aria-*` são aliases de `accessibilityState`, então o nativo continua anunciando. No DOM web, os valores aparecem (seção 3). |
| **#4 LOW**: 1º frame com a seleção antiga | `index.tsx:28-37`: `useEffect` removido. O reset roda durante o render quando `visible` muda (`prevVisible` em state, o padrão "ajustar state quando um prop muda" da doc do React). | ✅ Corrigido. O `setState` durante o render faz o React descartar a saída e re-renderizar antes do commit, então o DOM nunca recebe o valor antigo. `prevVisible` começa igual a `visible`, e montar já aberto usa o `useState(value)`. Provado ao vivo na seção 3. |

**INFO (não bloqueia, só web):** no react-native-web o `<Text accessibilityLabel>` vira `<div aria-label="Domingo">D</div>`, sem `role`. O ARIA 1.2 não prevê `aria-label` em elemento genérico, então alguns leitores de tela no web podem ler "D". No iOS/Android o label é lido normalmente. Nenhuma ação é necessária para o app mobile.

## 2. Checagens automatizadas ✅

- `cd FrontEndTorv && npx tsc --noEmit` → **exit 0**
- `cd FrontEndTorv && npx expo-doctor` → **21/21 checks passed. No issues detected!**

## 3. Usabilidade no portal "Torv Mobile #2" (390×835, Expo web)

**Ambiente:**
- O Metro foi **reiniciado com `--clear`**. O do round 1 tinha subido com `CI=1`, que desliga o watch, e serviria o código antigo.
- O `BackEndTorv` seguiu rodando em :3000.
- A mesma conta do round 1 foi usada, com a refeição de 31/12/2025 semeada de novo (420 kcal, P30/C40/G12).

**Método:** os estilos e posições vêm do DOM (`getComputedStyle`/`getBoundingClientRect`), porque o screenshot do portal segue dando timeout com a janela minimizada.

### Achados do round 1

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| #1a | Altura do card igual em fev/2026 (4 semanas), set/2026 (5) e ago/2026 (6) | ✅ **PASS** | Linhas contadas pelos `y` distintos dos dias: fev/2026 **4**, set/2026 **5**, ago/2026 **6** e dez/2025 **5**. Nos quatro: **card h=534**, **grid h=308**, card y=150 e Confirmar y=614. O último dia de ago/2026 termina em 595, dentro do grid (bottom 598). As colunas seguem certas: dia 1 em x=47 (dom, fev), 305 (sáb, ago), 133 (ter, set) e 90 (seg, dez). |
| #1b | Toques repetidos no mesmo ponto da seta "Mês anterior", de set/2026 a dez/2025 | ✅ **PASS** | Foram **9 toques na mesma coordenada (64,263)** e **os 9 avançaram**: Agosto, Julho, Junho, Maio, Abril, Março, Fevereiro, Janeiro de 2026 e Dezembro de 2025. A seta ficou em y=244..282 em todos os meses, inclusive nas trocas 5→6→5 semanas que quebravam no round 1. |
| #2 | Labels dos dias da semana no DOM web | ✅ **PASS** | `D=Domingo, S=Segunda-feira, T=Terça-feira, Q=Quarta-feira, Q=Quinta-feira, S=Sexta-feira, S=Sábado` (`aria-label`). Veja a nota INFO na seção 1. |
| #3 | `aria-selected`/`aria-disabled` no DOM web | ✅ **PASS** | Dia 28/09: `aria-selected="true"`. 27/09: `"false"`. 29 e 30/09: `aria-disabled="true"` (dias habilitados omitem o atributo). Seta "Próximo mês" em set/2026: `aria-disabled="true"`, opacidade 0.3. 31/12/2025, depois de selecionado: `aria-selected="true"`. |
| #4a | Escolher outro dia → Cancelar → reabrir (modal já fechado) | ✅ **PASS** | Com 15/jul/2026 marcado (`Qua., 15 de jul.`), Cancelar e 3 s de espera, o modal foi reaberto com um `MutationObserver` ativo. **O único estado commitado foi `Seg., 28 de set. \| Setembro de 2026`.** A seleção antiga não apareceu em nenhum commit. |
| #4b | O mesmo, reabrindo **durante o fade-out** (o DOM antigo ainda montado) | ✅ **PASS** | Marcado 3/set, Cancelar e reabrir logo em seguida. O trace (`MutationObserver` com atributos + listener de clique em captura) mostra `Qui., 3 de set.` até o clique de reabrir, em 1865 ms. Na **1ª mutação depois do clique (1887 ms, +21 ms)**, o conteúdo já é `Seg., 28 de set.` com opacidade 0.00 (início do fade-in), que depois sobe a 1.00. Nenhum frame reaberto mostra o 3/set. |

### Regressão dos passos 3a–3e do round 1

| # | Passo | Resultado | Evidência |
|---|---|---|---|
| 3a | Abrir → cabeçalho e identidade | ✅ **PASS** | `2026` / **`Seg., 28 de set.`** / **`Setembro de 2026`**. Card `rgb(28,28,30)` = `#1C1C1E`. O dia selecionado é `rgb(140,198,63)` = `#8CC63F`. |
| 3b | Navegar para trás, virando o ano | ✅ **PASS** | Coberto pelo #1b: set/2026 → dez/2025, e o round 1 já tinha confirmado as colunas. |
| 3c | Próximo desabilitado no mês atual | ✅ **PASS** | `aria-disabled="true"` e opacidade 0.3 em set/2026. |
| 3d | Dias futuros desabilitados | ✅ **PASS** | Só **29 e 30/09** (`aria-disabled="true"`). |
| 3e | Confirmar data passada → semana, dados e chip "Hoje" | ✅ **PASS** | Com 31/12/2025 (o cabeçalho do modal vira `2025` / `Qua., 31 de dez.`) e Confirmar, a faixa mostra **DOM 28 · SEG 29 · TER 30 · QUA 31\* · QUI 1 · SEX 2 · SÁB 3**, com o 31 ativo. **420 / 2232 kcal, P 30 / C 40 / G 12**, a refeição "QA DatePicker R2 31-12" aparece e o chip "Hoje" também. Com "Hoje": QUI 24 … SEG 28, 0 kcal, e o chip some. |

### Console

- Nenhum warning de DateTimePicker no console do portal nem no log do Metro.
- **`props.pointerEvents is deprecated` (pré-existente) re-atribuído com método correto.** No round 1, o teste de atribuição clicou na aba MyDiet por seletor CSS, e agora ficou claro que esse clique não troca de aba no portal. A conclusão estava certa, mas a evidência não valia. Refeito agora:
  - Com a captura iniciada **depois** de a Home carregar, ir ao MyDiet (via ref do snapshot, título `MyDiet`), abrir e cancelar o modal gerou **0 entradas**.
  - Com a captura iniciada **no começo do carregamento**, sem tocar no MyDiet, o warning aparece antes da Home.
  - Então ele vem do carregamento do app, não do DatePickerModal. `src/` não usa `pointerEvents`.

## 4. Gate

**PASS.** 100% verde nos testes. **Libera para o Torv Security**, com o diff completo da feature: `utils/date.ts`, `DatePickerModal/*`, MyDiet e `app.json`/`package.json`/`package-lock.json`.

Não coberto (igual ao round 1): execução em iOS/Android nativo. Os `aria-*` no nativo dependem do alias do RN 0.71+, e o projeto está no SDK 57.

## 5. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` (a mesma do round 1) | Fluxo completo no portal | 0 refeições. A refeição re-semeada em 31/12/2025 (`e0601ffc-…`) foi apagada via `DELETE /diet/:id` (200), e o summary de 31/12/2025 voltou a 0 kcal / 0 logs. |
