# QA — Histórico: seta de voltar e posição da lista — round 2 — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `fc01ea3` · **Motivo:** reteste do rework do **LOW #1** de `docs/security-workout-history-backarrow-2026-10-02.md`.
- **O bug:** numa troca rápida de chip A → B → A, a resposta de B era aplicada sob o chip A, porque o atalho do foco (`refreshTop`) não invalidava a carga em voo.
- **O fix:** `loadedType.current = null` no início do `loadFirst` (`FrontEndTorv/src/screens/Workouts/History.tsx:41`).
- **Round 1:** `docs/qa-workout-history-backarrow-2026-10-02.md`.

- **Conta nova:** `qa.arrow2.H.1790952764651@torvtest.dev`, com 23 treinos semeados via `POST /workouts/sessions` (hoje, ontem, um às 23:30 local e 20 antigos). As contas E/N do mesmo seed não foram usadas.
- **Ambiente:**
  - Expo web em 8081 e backend no Furnace, sem reinício e sem outra instância; `.env` intocado.
  - Portal "Torv Mobile #2" em 412×915, com login pela tela de Login.
  - Sessão original do portal salva numa chave separada e restaurada no fim (Home logada, 412×906).

## Como a mistura foi tornada visível

Hoje só existe o tipo STRENGTH, então "Todos" e "Musculação" trazem os mesmos itens, e uma lista trocada não apareceria na tela. Por isso, o shim da página (um hook de XHR) **marca** a resposta que deve ser descartada:
- sobrescreve o `responseText` daquela request;
- injeta no topo um item falso "**MARCA &lt;filtro&gt;**";
- troca o `next_before` por `2001-01-01T00:00:00.000Z`.

Se a resposta marcada fosse aplicada, o item "MARCA" apareceria na lista, ou o `loadMore` seguinte pediria `before=2001-01-01…`. O shim também atrasa as requests escolhidas e registra a URL, o status, o `n` e o `next_before` de cada `/activities`.

**Controle positivo:** um toque normal em "Musculação", com a resposta marcada e sem troca rápida, mostrou **"MARCA CONTROLE"** no topo (21 itens) e `next_before` 2001. Isso prova que a marcação aparece quando a resposta é aplicada. Voltar para "Todos" limpou a lista (20 itens, sem marca).

## Veredito: PASS (100% verde)

O LOW #1 está corrigido: nas 4 sequências (2 ordens de chip × 2 ordens de chegada), a resposta do chip abandonado foi descartada e o `loadMore` usou o cursor e o `type` do chip final. A volta do resumo continua no mesmo ponto.

## (1) Automatizado

| Item | Resultado |
|---|---|
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 18/18 |
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |

## (2) Todos → Musculação → Todos

Base: "Todos" carregado, 20 itens. O cursor de Todos é `2026-09-08T10:00:00.000Z`.

| Ordem de chegada | Resultado |
|---|---|
| **Musculação atrasada 4 s e marcada**; o toque em Todos vem logo em seguida | ✅ "Todos" (`aria-selected=true`) com **20 itens, sem marca** em t ≈ 1 s e também em t ≈ 6 s. A resposta de Musculação chegou em **5589 ms** (n = 21, `next` 2001) e foi **descartada**. O `loadMore` seguinte pediu **`/activities?before=2026-09-08T10:00:00.000Z&limit=20`**, sem `type` e com o cursor de Todos, e trouxe 3. Resultado: 23 itens únicos, sem marca |
| **Musculação marcada chega primeiro** (1,5 s) e **Todos por último** (atrasado 3 s) | ✅ Em t ≈ 3 s, a resposta de Musculação (1780 ms, marcada) já tinha chegado e foi descartada: a tela continua no spinner, sem marca. Em t ≈ 8 s, Todos (3149 ms) aplicado: 20 itens, sem marca. O `loadMore` usou `before=2026-09-08T10:00:00.000Z&limit=20` sem `type` → 23 únicos |

## (3) Musculação → Todos → Musculação

Base: "Musculação" carregado, 20 itens. O cursor é `2026-09-08T10:00:00.000Z`.

| Ordem de chegada | Resultado |
|---|---|
| **Todos atrasado 4 s e marcado** | ✅ "Musculação" (`aria-selected=true`) com 20 itens e sem marca, em t ≈ 1 s e em t ≈ 7 s. A resposta de Todos (4172 ms, marcada) foi descartada. O `loadMore` pediu **`/activities?type=STRENGTH&before=2026-09-08T10:00:00.000Z&limit=20`** → 23 únicos, sem marca |
| **Todos marcado chega primeiro** (1801 ms) e **Musculação por último** (3198 ms) | ✅ Em t ≈ 3 s: spinner, sem marca. Em t ≈ 8 s: 20 itens de Musculação, sem marca. O `loadMore` usou `type=STRENGTH&before=2026-09-08T10:00:00.000Z` → 23 únicos |

## (4) Volta do resumo (2ª página), filtro "Musculação"

Item de referência: o **índice 21** (2ª página), "Dia 3 — Corpo todo C · 07:00 · 25:26 · 4 séries". Antes de abrir: `scrollTop` **2242**, item no topo **591 px**.

| Volta por | Resultado |
|---|---|
| **Seta** | ✅ 2242 / 591 em t ≈ 1 s e em t ≈ 3 s. 23 itens únicos, sem spinner, chip mantido. Requests: só `GET /activities?type=STRENGTH&limit=20` (o `refreshTop` com o filtro atual) e `GET /workouts/routines`. Nenhuma recarga da lista |
| **Concluir** | ✅ 2242 / 591, 23 únicos, sem spinner, mesmas 2 requests leves |

## (5) Console

| Item | Resultado |
|---|---|
| Erros do app | ✅ Nenhum. Só o aviso que já existia (`props.pointerEvents is deprecated`) |
| Erros do harness de teste (não são do app) | 2 × `Uncaught SyntaxError: Failed to execute 'querySelector'…`. **Causa:** na 1ª tentativa do item (4), meu script não achou um item da 2ª página na janela e repassou a mensagem de erro como seletor para o `maestri portal click`. A tentativa foi refeita com o item rolado até a tela; os resultados da tabela (4) são dessa segunda tentativa |

## Observações

- **Ambiente (uma vez, não reproduziu):** na 1ª execução da ordem "Musculação primeiro, Todos por último" de (2), o `GET /activities?limit=20` de Todos voltou **500** depois de 26 s.
  - **Comportamento do app:** correto. Mostrou "Não foi possível carregar o histórico." e "Tentar de novo" recuperou (20 itens).
  - **Na sequência:** requests novas da página deram 200, algumas com latência de 1,5–2 s. A mesma sequência, repetida, passou (linha 2 da tabela 2).
  - **Causa:** não consegui olhar os logs do Furnace, porque o terminal não está conectado a este recruit. O provável é instabilidade passageira do banco ou do pooler. Não há indício de relação com o fix, que é só do front e não muda a request.
- **Dados de teste:** a conta `qa.arrow2.H.1790952764651@torvtest.dev` continua no banco (e também `qa.arrow2.E`/`N`, do mesmo seed, não usadas), porque não existe endpoint para apagar conta. Nenhum dado do usuário foi lido nem alterado.
