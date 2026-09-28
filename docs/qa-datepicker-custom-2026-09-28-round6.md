# QA: DatePicker custom TORV (rodada 6, reteste da área de toque das setas)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (código da feature ainda **não commitado**)
**Escopo:** reteste do achado #1 MEDIUM do round 5 (`docs/qa-datepicker-custom-2026-09-28-round5.md`). Desde o round 5, só mudou `FrontEndTorv/src/components/DatePickerModal/styles.ts:24-25`, com o estilo validado lá por injeção:
- `navPrev: { paddingLeft: 16, marginLeft: -12, marginRight: -4 }`
- `navNext: { paddingRight: 16, marginRight: -12, marginLeft: -4 }`

**Veredito: FAIL no item 1c (320 px).** O resto está verde:
- A regressão de largura do round 5 **foi corrigida em todas as larguras**: as setas voltam a ter caixa de 38×38 e área de toque de 38 px.
- Os ganhos do round 5 continuam.
- Toques repetidos, regressão, `tsc` e `expo-doctor` passam.

O que falha é o critério pedido para 320 px: **com "Novembro de 2000" ou "Setembro de 2025", um toque 6 px à direita da seta anterior abre a grade de meses.**
- Isso não se resolve mexendo só nas setas: nessa largura o rótulo encosta nelas.
- **Isso é culpa minha:** o estilo que sugeri e validei no round 5 só alargava a seta do lado da borda, e o relatório não deixou isso claro.
- Pelo critério do round 5, o caso de 320 px sozinho é LOW. Ele fica FAIL aqui porque é um critério de aceite explícito desta rodada. **O Maestro/usuário pode decidir aceitá-lo como limitação conhecida**, ou aplicar a correção do achado #1.

---

## Achados

| # | Sev. | Onde | Achado |
|---|---|---|---|
| 1 | **Critério 1c não atendido** (em severidade, é LOW: só 320 pt) | `FrontEndTorv/src/components/DatePickerModal/index.tsx:160` (rótulo `nav.label`) + `styles.ts:24-27` | Em 320 px, os rótulos longos ocupam toda a linha entre as setas. Com "Novembro de 2000", o toggle vai de 68,9 a 251,1 e **sobrepõe as setas em 1,9 px de cada lado**. Com "Setembro de 2025", ele começa em 73,9. Detalhe abaixo. |
| INFO | só web | `index.tsx:20` | (Igual ao round 5.) O `hitSlop` vertical só vale no iOS/Android. No web, as setas têm 38 px de altura e o toggle 36. |
| INFO | fora do escopo, pré-existente | `FrontEndTorv/src/screens/MyDiet/index.tsx` (estado vazio) | Numa data passada sem refeições, o texto diz "Você ainda não registrou nada **hoje**." Visto com 15/11/2000. |

**#1: em 320 px, um toque logo à direita da seta anterior abre a grade de meses**
- **Toques reais em 320 px** (modo dias; a seta anterior vai até x=70,8):

  | Rótulo | x=66 | x=68 | x=69 | x=70 | x=77 (seta + 6 px) |
  |---|---|---|---|---|---|
  | "Novembro de 2000" | volta um mês | volta um mês | **abre meses** | **abre meses** | **abre meses** |
  | "Setembro de 2025" | volta um mês | volta um mês | volta um mês | volta um mês | **abre meses** |

  Com "Dezembro de 2000", x=70 e x=77 também abrem os meses.
- **Por quê:** a correção do round 5 levou o padding para o lado da borda. A caixa foi de 26 para 38 px, mas avançou para a **esquerda** (32,8..70,8). O lado do rótulo continuou onde estava. Em 320 px não sobra espaço: o conteúdo tem 230 px, e "Novembro de 2000" + chevron ocupam 182.
- **Correção possível, validada no portal por injeção** (sem mexer no código): abreviar o mês no rótulo quando a tela for estreita, por exemplo "Nov. de 2000" se `useWindowDimensions().width < 360`. Em 320 px, isso deixa **23,2 px livres de cada lado** entre as setas e o rótulo (hoje −1,9 px).
  - Com esse espaço, a seta pode crescer também do lado do rótulo: `paddingRight`/`hitSlop.right` na anterior, espelhado na próxima.
  - Assim, um toque até +8 px da seta continua nela.
- **Alternativa:** aceitar como limitação conhecida de 320 pt, que é LOW e não afeta 360/390.

## 1. Checagens automatizadas ✅

- `cd FrontEndTorv && npx tsc --noEmit` → **exit 0**
- `cd FrontEndTorv && npx expo-doctor` → **21/21 checks passed. No issues detected!**

## 2. Usabilidade no portal "Torv Mobile #2" (320, 360 e 390 px, Expo web)

**Ambiente:**
- Metro e `BackEndTorv` seguem de pé.
- O reaper de memória do Claude Code matou os wrappers de shell, mas os processos `node` continuaram vivos: o backend é o PID 8772 do round 1, e o Metro com watch é o do round 3.
- Não houve restart.

**Método:**
- As caixas vêm de `getBoundingClientRect`.
- O "glifo" é o bounding box do `path` do chevron, a parte visível do ícone.
- O hit-test é feito com `elementFromPoint` a cada 1 px, na altura do centro das setas.

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1a | Caixa das setas com 38×38 nos 3 modos | ✅ **PASS** | **24 medições** (3 larguras × 8 rótulos: "Setembro de 2026", "2026", "2015 – 2026", "Fevereiro de 2026", "Novembro de 2025", "1991 – 2002", "2000", "Novembro de 2000"). Em todas, prev fica em **32,8..70,8 (38×38)**, e next também tem 38×38: 249,2..287,2 (320), 289,2..327,2 (360) e 319,6..357,6 (390). |
| 1b | Hit-test cobre o ícone + 8 px de cada lado | ✅ **PASS**, com uma exceção em 320 | O glifo da seta anterior fica em 57..62,5 e **PREV cobre 33..70**: +24 px do lado da borda e +7,5 px do lado do rótulo. O glifo da próxima fica em 257,5..263 (320), e **NEXT cobre 249..287** (+8,5 e +24). Com a caixa inteira (22 px do ícone), o lado da borda tem +16 px e o do rótulo ~0 px. **Exceção:** em 320 px com "Novembro de 2000", PREV vai só até 68 (glifo +5,5 px), porque o toggle sobrepõe a caixa (achado #1). |
| 1c | 320 px: toque 6 px à direita da seta anterior muda o mês e não abre o toggle | ❌ **FAIL** | Tabela do achado #1: com x=77 os dois rótulos abrem a grade de meses. Com "Novembro de 2000", até x=69 e x=70, dentro da caixa, abrem. |
| 2 | Ganhos do round 5 | ✅ **PASS** | As 24 medições mostram setas **inteiras dentro do card**, nenhum rótulo truncado (`scrollWidth == clientWidth`, "Novembro de 2000" com 162 px) e **posição das setas idêntica** nos 3 modos e em todos os rótulos, em cada largura. Em 320 px, os dias têm **32,9 px** (= a célula), o menor gap é **0,0 px** e o selecionado fica dentro da célula. Em 390 px, 38 px com gap de 5 px. |
| 3 | Toques repetidos na mesma coordenada | ✅ **PASS** | Em 320 e 390 px, **9 toques no centro da seta** (52,y) no modo dias foram de Agosto/2026 a **Dezembro/2025**, todos avançando. **4 toques** no modo anos passaram por **2003–2014 → 1991–2002 → 1979–1990 → 1967–1978**, todos avançando. |
| 4 | Regressão do fluxo completo | ✅ **PASS** | Em 390 px: dias → meses → anos → "Anos anteriores" 2× → **2000** → **Novembro** → **15**. O cabeçalho mostra `2000` / `Qua., 15 de nov.`. Depois de Confirmar, a faixa mostra **DOM 12 · SEG 13 · TER 14 · QUA 15\* · QUI 16 · SEX 17 · SÁB 18**, o summary carregou (0 / 2232 kcal) e o chip "Hoje" aparece. Com "Hoje": QUI 24 … SEG 28, e o chip some. `tsc` e `expo-doctor` na seção 1. |

**Console:** nenhum warning de DateTimePicker. Só o pré-existente `props.pointerEvents is deprecated` do carregamento.

## 3. Gate

**FAIL no critério 1c.** O restante está verde. Há dois caminhos:
1. **Rework no Torv Frontend:** rótulo abreviado em telas estreitas + extensão da seta do lado do rótulo. O reteste é só o 1b/1c em 320 px e uma medição rápida em 360/390.
2. **Aceitar o 1c como limitação conhecida de 320 pt** (LOW). Nesse caso o PASS vale para liberar ao Security com o diff completo.

A escolha é do Maestro/usuário.

Não coberto (igual aos rounds anteriores): execução em iOS/Android nativo.

## 4. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` (a mesma dos rounds 1–5) | Fluxos no portal | Nenhuma refeição semeada nesta rodada. O portal voltou a 390×835. |
