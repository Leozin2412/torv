# QA: DatePicker custom TORV (rodada 1)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (alterações **não commitadas** no working tree)
**Diff avaliado:**
- NOVO `FrontEndTorv/src/utils/date.ts` (`toISODate` e `parseLocalDate`, movidos do MyDiet)
- NOVO `FrontEndTorv/src/components/DatePickerModal/{index.tsx,styles.ts}`
- `FrontEndTorv/src/screens/MyDiet/index.tsx`: o `DateTimePicker` nativo e o `<input type="date">` do web foram trocados pelo `DatePickerModal`
- `FrontEndTorv/app.json`, `package.json` e `package-lock.json`: sai o `@react-native-community/datetimepicker`, `expo ~57.0.25`, `expo-image-picker ~57.0.20`

**Fora do escopo** (alterações do usuário): `BancoDeDadosTorv/Gestao_e_Performance.sql` e `FrontEndTorv/tsconfig.json`.

**Veredito: FAIL, com 1 achado MEDIUM de usabilidade.**
- O modal abre escuro, com a identidade TORV, em pt-BR. As datas estão corretas em todos os edge cases, sempre em data local.
- O filtro funciona de ponta a ponta. O warning do DateTimePicker sumiu, porque o pacote saiu por completo.
- O que falha: a altura do card varia com o número de semanas do mês e as setas de navegação mudam de lugar. Um segundo toque no mesmo ponto erra a seta (achado #1).
- A correção é de uma linha. O resto é LOW e não bloqueia.

---

## Achados (por severidade)

| # | Sev. | Onde | Achado |
|---|---|---|---|
| 1 | **MEDIUM** (bloqueia) | `FrontEndTorv/src/components/DatePickerModal/styles.ts:21` (`grid`) + `styles.ts:5` (`overlay` centralizado) | A altura do card varia com as semanas do mês e as setas pulam 22 px. Detalhe abaixo. |
| 2 | LOW | `FrontEndTorv/src/components/DatePickerModal/index.tsx:79-81` | Os cabeçalhos dos dias da semana são só `D S T Q Q S S`, sem label acessível. O leitor de tela lê "Q" e "S" duas vezes, sem distinguir. |
| 3 | LOW (só web) | `FrontEndTorv/src/components/DatePickerModal/index.tsx:102` | `accessibilityState.selected` não vira `aria-selected` no react-native-web (medido: `null` no dia selecionado). No iOS/Android é anunciado normalmente. |
| 4 | LOW (cosmético) | `FrontEndTorv/src/components/DatePickerModal/index.tsx:29-33` | O reset de `selected`/`month` roda num `useEffect` depois do render com `visible=true`. Se o usuário cancelou com outro dia marcado, o 1º frame da reabertura ainda mostra o dia antigo. O fade começa em opacidade 0, então não foi perceptível no teste. |

**#1: as setas de navegação mudam de lugar a cada mês**
- **Causa:** o grid tem 4, 5 ou 6 linhas conforme o mês e o card é centralizado verticalmente (`justifyContent: 'center'`). Cada linha a mais ou a menos desloca o topo do card em ±22 px, e as setas, o cabeçalho e os botões Cancelar/Confirmar vão junto.
- **Alturas medidas:** 446 px em fev/2026 (4 linhas), 490 px em set/2026 (5 linhas) e 534 px em ago/2026 (6 linhas).
- **Reprodução no portal:** a seta "Mês anterior" em set/2026 ocupa y=266..304. Foram 3 toques em (64,285), o centro da seta:
  - 1º toque: foi para ago/2026, e a seta passou para y=244..282.
  - 2º e 3º toques: **não fizeram nada**, porque o ponto 285 ficou fora da seta.
- **Frequência:** voltando de set/2026 a dez/2025, a contagem de linhas muda em **7 de 9 transições** (5→6→5→5→6→5→5→4→5→5). Quem toca a seta em sequência para voltar vários meses, que é o uso principal do filtro retroativo, perde toques com frequência.
- **Correção sugerida:** fixar o grid em 7 linhas (cabeçalho + 6 semanas), com `grid: { flexDirection: 'row', flexWrap: 'wrap', height: 7 * 44 }`. Outra opção é completar `cells` até 42. O dialog Material que foi substituído também mantém a altura fixa.

---

## 1. Revisão multi-lente ✅ (exceto os achados acima)

| Ponto | Resultado |
|---|---|
| **Fuso** | Tudo passa por `new Date(y, m, d)` + getters locais (`toISODate`) ou por `parseLocalDate`. Não existe `toISOString` nem `new Date('YYYY-MM-DD')` (que seria lido como UTC) no MyDiet, no DatePickerModal ou em `utils/date.ts`, conferido por grep. As comparações `iso > maxDate` são entre strings `YYYY-MM-DD`, então a ordem lexicográfica é a ordem cronológica. |
| **Script de edge cases** | Importa o `utils/date.ts` real e espelha a matemática do grid (`index.tsx:12-40`). Rodado com `TZ` = America/Sao_Paulo, UTC, Pacific/Kiritimati (UTC+14), Pacific/Pago_Pago (UTC−11), America/New_York e Asia/Kolkata: **6/6 OK**. |
| Round-trip `toISODate(parseLocalDate(x)) === x` | Todos os dias de 1999 a 2101 passam. Isso inclui os anos em que o horário de verão do Brasil começava à meia-noite, quando 00:00 não existe e `new Date` cai em 01:00 do mesmo dia. |
| Dias no mês | Fev/2026: 28. Fev/2024: 29. Fev/2000: 29. Fev/2100: 28. Abril: 30. Jan/Ago/Dez: 31. Todos corretos (`new Date(y, m+1, 0).getDate()`). |
| Dia 1 em domingo ou sábado | Fev/2026 começa no domingo (0 células vazias). Ago/2026 começa no sábado (6 células vazias, 6 linhas). Dez/2025 começa na segunda. As colunas foram conferidas no DOM (seção 3). |
| Virada de mês e de ano | `new Date(y, m±1, 1)` normaliza: jan/2026 → dez/2025, dez/2025 → jan/2026, 24 voltas → set/2024. |
| `nextDisabled` / dias futuros | Com `maxDate` = hoje (28/09): a seta de próximo fica desabilitada em set/2026 e habilitada em ago/2026. Só 29 e 30/09 ficam desabilitados. Com max em 31/12, a seta desabilita em dezembro. |
| Chaves React | `iso` é único por mês, as vazias usam `empty-${i}` e os cabeçalhos usam o nome completo (`Dom.`/`Seg.`…). Sem colisão. |
| Cabeçalho | `Seg., 28 de set.`, `Dom., 1 de mar.`, `Sáb., 1 de ago.`, `Qua., 31 de dez.` e o mês `Setembro de 2026` estão corretos. |
| Integração MyDiet | `value={filterDate ?? selectedDate}` abre na data filtrada ou no dia ativo da faixa. `onConfirm` seta `filterDate` e `selectedDate` juntos, então a data escolhida carrega sem segundo toque (mesmo contrato do round 2 do filtro retroativo). `onClose` só fecha. O chip "Hoje" não mudou. |
| Cancelar / voltar do Android | `onRequestClose={onClose}` cobre o botão voltar do Android e o Escape no web. A seleção suja é descartada no próximo `visible=true` (com a ressalva do achado #4). |
| `Button` reutilizado | `outline`, `style` e `accessibilityLabel` passam pelo `...rest`. O `width: undefined` anula o `width: '100%'` base: os dois botões ficaram com 145 e 144 px. |
| Tokens | `colors.surface`, `border`, `brand`, `textSecondary`, `background`, `radius.xl`/`pill` e `fontFamily.*` existem em `theme/tokens.ts`. Nenhum hex solto no componente. |
| Remoção do datetimepicker | Nenhuma referência sobrou em `src/`, `app.json`, `package.json` ou `package-lock.json` (0 ocorrências), e o pacote sumiu de `node_modules/@react-native-community/`. O projeto roda no Expo Go (sem `expo-dev-client`, sem `android/`/`ios/`), então tirar o módulo nativo não exige rebuild. |
| Lockfile | Além da remoção, só patch bumps do SDK 57 (expo 57.0.24→25, expo-image-picker 57.0.19→20 e deps internas do expo). O `babel-preset-expo` deixou de ter uma cópia aninhada do hermes-parser. |

## 2. Checagens automatizadas ✅

- `cd FrontEndTorv && npx tsc --noEmit` → **exit 0** (a baseline segue zerada).
- `cd FrontEndTorv && npx expo-doctor` → **21/21 checks passed. No issues detected!**

## 3. Usabilidade no portal "Torv Mobile #2" (390×835, Expo web) ❌ (só o item 3b)

**Ambiente:** o Metro (`npx expo start --web --port 8081`) e o `BackEndTorv` (`npm start`, :3000 via LAN `192.168.15.179`) foram subidos por esta rodada, porque nenhum dos dois estava rodando.

**Preparação:** conta nova e uma refeição semeada via API em **31/12/2025** (420 kcal, P30/C40/G12). A data foi escolhida porque a semana dela atravessa o ano.

**Observação:** o `screenshot` do portal deu timeout (janela minimizada). A verificação visual foi feita com os estilos computados do DOM (`getComputedStyle`) e as posições (`getBoundingClientRect`).

| # | Passo | Resultado | Evidência |
|---|---|---|---|
| 3a | Login → Minha Dieta → ícone de calendário | ✅ **PASS** | O modal abre com 28/09/2026 selecionado. Cabeçalho `2026` / **`Seg., 28 de set.`**, mês **`Setembro de 2026`**. Identidade: card `rgb(28,28,30)` = `#1C1C1E`, borda `#2C2C2E`, overlay `rgba(0,0,0,0.7)`, dia selecionado e Confirmar `rgb(140,198,63)` = `#8CC63F` com texto `#121212`. Fontes: Sora 800 (28 px) no cabeçalho, Sora 600 no mês e nos dias da semana, Sora 400 nos dias. |
| 3b | Navegar meses para trás, virando o ano | ❌ **FAIL** (achado #1) | A navegação em si está correta: 9 toques na seta foram de set/2026 a **dez/2025** (Agosto, Julho, … Janeiro de 2026, Dezembro de 2025). As colunas conferem: dez/2025 dia 1 na segunda (x=90) e 31 na quarta; fev/2026 dia 1 no domingo (x=47), 28 dias, 4 linhas; ago/2026 dia 1 no sábado (x=305), 6 linhas. **Mas os toques repetidos no mesmo ponto erram a seta quando a contagem de linhas muda:** de 3 toques em (64,285), só o 1º avançou. |
| 3c | Seta de próximo mês desabilitada no mês atual | ✅ **PASS** | `Próximo mês`: `aria-disabled=true` em set/2026 e habilitada de ago/2026 para trás. |
| 3d | Dias futuros desabilitados | ✅ **PASS** | Só 29 e 30/09/2026 ficam `disabled` (opacidade 0.3). Em outros meses: 0 desabilitados. |
| 3e | Escolher dia passado → Confirmar | ✅ **PASS** | Com 31/12/2025, o cabeçalho do modal atualiza para `2025` / `Qua., 31 de dez.` e o dia fica verde. Depois de Confirmar, a faixa mostra **DOM 28, SEG 29, TER 30, QUA 31\*, QUI 1, SEX 2, SÁB 3**: a semana domingo–sábado certa, atravessando o ano, com o 31 ativo (borda `#8CC63F`). Chip **"Hoje"** visível. Dados do dia carregados: **420 / 2232 kcal, P 30 / C 40 / G 12**, e a refeição "QA DatePicker 31-12" aparece na lista. |
| 3f | Reabrir → modal na data filtrada | ✅ **PASS** | Reabre em `2025` / `Qua., 31 de dez.` / `Dezembro de 2025`. |
| 3g | Cancelar não altera nada | ✅ **PASS** | Escolhido 15/nov/2025 e depois Cancelar: a faixa segue com 31/12 ativo e 420 kcal, e o chip continua. Reabrindo, volta em 31/12 (a seleção suja foi descartada). O modal sai do topo em <0,3 s. O nó continua no DOM por ~2 s durante o fade e depois é desmontado. |
| 3h | Escape (web) | ✅ **PASS** | Com um `keyup` de Escape, o modal fecha sem alterar nada. O comando `key` do portal não gera `keyup`, então esse caminho foi testado com um evento sintético. |
| 3i | Tocar "Hoje" → volta ao normal | ✅ **PASS** | A faixa volta a QUI 24 … SEG 28, com o **28 ativo**. **0 / 2232 kcal**, "Nenhuma refeição ainda", e o chip some. Reabrindo o modal, ele vem em `Seg., 28 de set.` / `Setembro de 2026`. |
| 3j | Sem filtro, dia da faixa → abrir modal | ✅ **PASS** | Tocando SEX 25 na faixa e abrindo o modal, ele vem em `Sex., 25 de set.` (usa `selectedDate` quando não há filtro). |
| 3k | Nenhum warning de DateTimePicker no console | ✅ **PASS** | Nenhuma ocorrência no console do portal nem no log do Metro. A única entrada foi `props.pointerEvents is deprecated`, e **ela não vem do modal**: com a página recém-carregada, ir ao MyDiet, abrir e cancelar o modal gerou **0** entradas. O warning dispara antes, no carregamento de Home/navegação (é pré-existente, e `src/` não usa `pointerEvents`). O Metro também mostra o pré-existente `"shadow*" style props are deprecated`. |

**Não coberto nesta rodada:** a execução em iOS/Android nativo (LogBox no device, `onRequestClose` pelo botão voltar físico). O LogBox do DateTimePicker não tem mais origem possível, porque o pacote e o plugin saíram. O achado #1 também vale no nativo, porque o layout é o mesmo.

## 4. Gate

**FAIL.** Não libera para Security. O rework fica no **Torv Frontend** e é só o achado #1 (altura fixa do grid em `DatePickerModal/styles.ts:21`). Os achados #2–#4 são LOW, opcionais no mesmo passe. O round 2 só precisa repetir os passos 3a–3e.

## 5. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` | Fluxo completo no portal | 0 refeições. A refeição semeada em 31/12/2025 (`6cabc731-…`) foi apagada via `DELETE /diet/:id` (200), e o summary de 31/12/2025 voltou a 0 kcal / 0 logs. |
