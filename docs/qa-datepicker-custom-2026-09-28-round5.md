# QA: DatePicker custom TORV (rodada 5, passe de telas estreitas)

**Data:** 2026-09-28
**Recruta:** Torv Review and Tests
**Branch:** `perf/api-latency` (código da feature ainda **não commitado**)
**Escopo:**
- Passe de 320 pt sobre os 2 LOW do round 4 (`docs/qa-datepicker-custom-2026-09-28-round4.md`), decidido pelo Maestro. O usuário não pediu esse passe.
- Desde o round 4, só mudaram `FrontEndTorv/src/components/DatePickerModal/{index.tsx,styles.ts}`:
  - `day` com `width: '100%'`, `maxWidth: 38` e `aspectRatio: 1`.
  - Setas com `navPrev`/`navNext` (4 px do lado da borda, margem −4 do lado do rótulo, 22 px na linha).
  - Toggle sem padding horizontal, com `flexShrink: 1`, `numberOfLines={1}` e `hitSlop` top/bottom 4.

**Veredito: FAIL, com 1 achado MEDIUM de usabilidade.**
- Os dois LOW do round 4 **estão corrigidos**: em 320 px, as setas ficam inteiras no card, nenhum rótulo trunca e os dias não se sobrepõem.
- O que falha: a correção **encolheu a área de toque das setas de 38 para 26 px de largura em todas as larguras**, não só em 320.
  - Em 360/390 px, toques a 2–12 px do ícone, que antes contavam, agora não fazem nada.
  - Em 320 px, com rótulo longo, um toque 6 px à direita da seta **abre a grade de meses** em vez de mudar o mês.
- A correção cabe em 2 linhas e **foi validada no portal por injeção de estilo**, sem perder o ajuste de 320 px (achado #1).

---

## Achados

| # | Sev. | Onde | Achado |
|---|---|---|---|
| 1 | **MEDIUM** (bloqueia, regressão deste passe) | `FrontEndTorv/src/components/DatePickerModal/styles.ts:24-25` (`navPrev`/`navNext`) + `index.tsx:20` (`NAV_HIT_SLOP` só top/bottom) | A área de toque horizontal das setas caiu de 38 px (round 4) para **26 px**, e em todas as larguras. Detalhe abaixo. |
| INFO | só web | `index.tsx:20` | O `hitSlop` não aumenta a área de toque inicial no react-native-web: o `Touchable` usa ele só para *press retention*. No portal, as setas medem 38 px de altura e o toggle 36 px. Os ≥44 px verticais (46 nas setas, 44 no toggle) valem **no iOS/Android**, conferidos pelo código. |

**#1: as setas ficaram mais estreitas para tocar**
- **Medição (hit-test com `elementFromPoint` na linha das setas):**

  | | Round 4 (390 px) | Round 5 (320, 360 e 390 px) |
  |---|---|---|
  | Seta "anterior" | x=45..83, **38 px** | x=45..70, **26 px** |
  | Ícone | 53..75 | 49..71 |
  | Margem do ícone até o fim da área, do lado do rótulo | 8 px | ~0 px |

  Em 320 px, com os rótulos longos ("Novembro de 2000/2025"), o toggle começa colado na seta: PREV 45..68, TOG 69..248.
- **Reprodução em 390 px** (modo dias): um toque em x=70 volta um mês. Em x=72, 76 e 80 **não acontece nada**. No round 4, a seta respondia até x=83.
- **Reprodução em 320 px** (rótulo "Setembro de 2025"): um toque em x=70 volta um mês, mas **em x=76 abre o modo meses** ("Ano anterior / 2025"), a ação errada.
- **Por que importa:** é o controle mais usado do picker, tocado em sequência para voltar vários meses (o mesmo tipo de problema do MEDIUM do round 1). Pelo `hitSlop`, a área nativa fica com 26×46 pt, cerca de 4 mm de largura, bem abaixo dos 44 pt do HIG da Apple e dos 48 dp do Material. O round 4 tinha 38×38.
- **Correção sugerida:** levar o padding para o lado da borda e deixar a seta avançar sobre o padding de 20 px do card. A caixa fica com 38 px e a ocupação na linha continua 22 px:

  ```ts
  navPrev: { paddingLeft: 16, marginLeft: -12, marginRight: -4 },
  navNext: { paddingRight: 16, marginRight: -12, marginLeft: -4 },
  ```

  **Validada no portal por injeção de estilo** (não mexi no código), no pior caso "Novembro de 2000":
  - 320 px: PREV 33..68 (caixa 38×38), toggle 68,9..251,1 (igual), texto sem truncar, NEXT 249..287, seta a 8,8 px da borda do card.
  - 390 px: PREV 33..70 e NEXT 319..357.
  - O ajuste de 320 px não muda.
- **Opcional, só nativo:** `hitSlop` com `left`/`right` nas setas, para cobrir o espaço vazio entre a seta e o rótulo em 360/390 px (o toggle, irmão posterior, continua ganhando onde há sobreposição).

## 1. Checagens automatizadas ✅

- `cd FrontEndTorv && npx tsc --noEmit` → **exit 0**
- `cd FrontEndTorv && npx expo-doctor` → **21/21 checks passed. No issues detected!**

## 2. Usabilidade no portal "Torv Mobile #2" (320, 360 e 390 px, Expo web)

| # | Verificação | Resultado | Evidência |
|---|---|---|---|
| 1 | Setas dentro do card, rótulo sem truncar e setas fixas entre os modos | ✅ **PASS** | Foram 3 larguras × 8 rótulos: "Setembro de 2026", "2026", "2015 – 2026", "Fevereiro de 2026", "Novembro de 2025", "1991 – 2002", "2000" e "Novembro de 2000". **As 24 medições** têm as duas setas dentro do conteúdo do card e `scrollWidth == clientWidth` no texto (sem reticências). O mais longo é "Novembro de 2000" com 162 px, e em 320 px o toggle fica em 68,9..251,1. A **posição das setas é idêntica** nos 3 modos e em todos os rótulos: prev 44,8..70,8, e next em 249,2 (320), 289,2 (360) e 319,6 (390), sempre encostada na borda interna. |
| 2 | 320 px: dias sem sobreposição; grades de meses e anos | ✅ **PASS** | Em 320 px o botão do dia tem **32,9×32,9** (= a largura da célula), com raio 999. O menor gap entre vizinhos é **0,0 px**, e a pílula do selecionado fica dentro da célula. Meses: pílula 72×38 com gap de 4,8 px. Anos: 72×38 com gap de 4,3 px. |
| 3 | 390 px como no round 4; card e grade | ✅ **PASS** (visual) | Em 390 px o dia tem **38×38** (célula 43×44, gap de 5 px). Em 360 px, 38×38 com gap de 0,6 px. Card **h=534** e grade **h=308** nas 3 larguras e nos 3 modos. As setas ficaram 4 px mais perto da borda. **A área de toque mudou**: veja o achado #1. |
| 4 | Área de toque ≥44 px na vertical; toques repetidos | ⚠️ **PASS com ressalva** | Vertical: 38 + 4 + 4 = **46** nas setas e 36 + 4 + 4 = **44** no toggle, **só no nativo** (nota INFO). Toques repetidos: **10 toques no centro da seta** (58,y), em 390 e em 320 px, e **os 10 avançaram** (set/2026 → nov/2025). **Horizontal: regressão de 38 → 26 px** (achado #1). |
| 5 | Regressão: dias → meses → anos → ano → mês → dia → Confirmar; clamp; Cancelar/reabrir | ⏸️ **não executado** | O shell ficou sem veredito do classificador de segurança do Claude Code, e nenhum comando pôde rodar depois das medições acima. O fluxo foi coberto no round 6 (item 4), sobre o código seguinte. |

**Console:** não coletado nesta rodada, pelo mesmo motivo.

**Nota adicionada no round 6:** a correção sugerida no achado #1 **só alarga a seta do lado da borda do card**. O fim da área do lado do rótulo continua em x≈68–70. Por isso ela **não resolve** o caso de 320 px com rótulo longo, em que um toque 6 px à direita da seta abre a grade de meses. Os números da validação já mostravam isso ("toggle 68,9..251,1 (igual)"), mas o texto deste relatório não deixou explícito. Veja `docs/qa-datepicker-custom-2026-09-28-round6.md`.

## 3. Gate

**FAIL.** O rework fica no **Torv Frontend** e é só o achado #1 (2 linhas em `styles.ts:24-25`, já validadas). O reteste mede o hit-test das setas em 320 e 390 px e repete o item 1.

Não coberto (igual aos rounds anteriores): execução em iOS/Android nativo, onde o `hitSlop` teria efeito.

## 4. Conta e dados de teste

| Conta | Uso | Estado final |
|---|---|---|
| `qa.datepicker.1790604006@torvtest.dev` (a mesma dos rounds 1–4) | Fluxos no portal | Nenhuma refeição semeada nesta rodada. |
