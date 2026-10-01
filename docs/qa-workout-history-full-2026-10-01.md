# QA — Histórico de treinos — TESTE COMPLETO — 2026-10-01

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, HEAD `941c394` · **Plano:** Task 5 de `docs/superpowers/plans/2026-10-01-workout-history.md`
- **Step 1:** Tasks 2 e 4 refeitas sobre o estado final.
- **Step 2:** regressão do módulo de treinos.
- **Review Focus:** 1–5.

**Spec:** `docs/superpowers/specs/2026-10-01-workout-history-design.md`

Tudo foi refeito do zero com **contas novas** desta rodada (todas `@torvtest.dev`); nada foi reaproveitado das rodadas anteriores:

| Uso | Contas |
|---|---|
| Contrato do `/activities` | `qa.full.A.1790892551235` (F/Ini), `qa.full.B.1790892551235` (M/Ini) e `qa.full.C.1790892551235` (M/Ini/Ganhar Massa) |
| Regressão do contrato | `qa.full.D.1790892596988` (F/Ini/Perder Peso) |
| Usabilidade | Ver abaixo |

Contas de usabilidade, semeadas via `POST /workouts/sessions`:
- `qa.fullfe.H.1790892624310`: 23 treinos.
  - Hoje 17:10: Dia 1.
  - Ontem 19:00: Treino livre, 1 série.
  - **ter 29/09 às 23:30 local** (`2026-09-30T02:30Z`): Dia 2.
  - 20 de 8 a 27 dias atrás: Dia 3.
- `qa.fullfe.E.1790892624310`: exatamente 20 treinos.
- `qa.fullfe.N.1790892624310`: sem treinos.

## Ambiente

- Backend no Furnace (`localhost:3000`) e Expo web em 8081. Nenhum dos dois foi reiniciado e nenhuma outra instância foi aberta.
- O `FrontEndTorv/.env` está vazio e não foi editado. As mudanças locais em `api.ts`/`Login/index.tsx` não foram tocadas.
- **Shim só na página**, reinstalado a cada reload: um hook em `XMLHttpRequest` reescreve o host (o bundle sai em `127.0.0.1:3000`) para `localhost:3000` e registra cada chamada. Também aceita regras de uso único:
  - atrasar a request;
  - trocar a query;
  - falha de rede (`localhost:1`);
  - **resposta perdida**: a request real vai ao servidor por `fetch` e o XHR da página falha.
- **Contrato:** `fetch` na página, com os tokens só em variáveis da página.
- **Navegador:** portal "Torv Mobile #2", em 412×915 e 320×915. Layout medido pelo DOM (`getBoundingClientRect`, `scrollWidth`, `getComputedStyle`); não precisei de screenshot nem do agent-browser.
- **Sessão original do portal:** salva numa chave separada do `localStorage`. Para trocar de conta apaguei só `torv.session`, sem `/auth/logout`. No fim ela foi restaurada (Home logada, 412×906).
- **Fuso do navegador:** `America/Sao_Paulo` (UTC−3). Data da rodada: qui 01/10/2026, por volta das 19h.

## Veredito: PASS (100% verde)

Nenhuma falha. Os 3 LOW da Task 4 foram corrigidos e verificados. Só sobram observações INFO, no fim.

## Automatizado

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 83/83 |
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 17/17 |

## Backend — Task 2 de novo (contas `qa.full.A/B/C`)

| Item | Resultado |
|---|---|
| `GET /activities` sem token / token inválido | ✅ 401 / 403 |
| `type=RUN`, `type=strength`, `limit=0`, `limit=51`, `limit=abc`, `before=ontem`, `before=2026-10-01` + extras `limit=1.5`, `limit=-1`, `type=` | ✅ 10 × 400 |
| Bordas válidas: `limit=1`/`50`, `type=STRENGTH`, `before` com offset `-03:00` e com `Z` | ✅ 200 |
| Conta nova | ✅ `{ activities: [], next_before: null }` |
| A: 5 sessões em 5 dias, `limit=2` | ✅ 3 páginas (2 + 2 + 1), a última com `next_before: null`. 5 ids sem repetição, em ordem decrescente, iguais aos ids dos POSTs. Cursor = `start_time` do último item |
| **RF1** — `limit=5` com exatamente 5 | ✅ A 1ª página traz 5 itens e `next_before` não nulo. A 2ª vem com 200, `[]` e `null` |
| Padrão sem `limit` | ✅ 5 itens, `null` |
| Formato `type=STRENGTH` | ✅ STRENGTH, `set_count` = séries enviadas (1–5), duração, `start_time` e título da rotina; só os 6 campos |
| Isolamento A/B | ✅ B vê só a própria sessão. `?user_id=<A>` é ignorado. Paginando, ou usando o cursor de A, não aparece nada de A. `GET /workouts/sessions/<A>` dá 404 |
| **RF4** — borda dos 7 dias (C) | ✅ Rotina X (−6 d 23 h) `true`, Y (−7 d 1 h) `false`, Z `false`. B gravando com o `routine_id` de C fica "Treino livre" e não marca Z |
| `completed_recently` por conta | ✅ B: só a rotina que B treinou. A: as 3 treinadas há 1–5 dias |
| `plan/accept` | ✅ **Sem sugestão:** mesmos ids; X `true`, Y `false`, Z `false` e a própria `true`. **Com sugestão:** 4 defaults novas `false` e a própria `true`. `dismiss` continua `{ message }` |
| Listagem removida | ✅ `GET /workouts/sessions` e `?limit=5` → 404 |
| `GET /workouts/sessions/:id` | ✅ 200, séries 1, 2, 3 em ordem |
| `POST` repetido | ✅ 200 com o mesmo id; A continua com 5 activities |

## Frontend — Task 4 de novo (usabilidade, itens 1–11 + Review Focus)

| # | Item | 412 | 320 |
|---|---|---|---|
| 1 | Segmentado alterna "Meus treinos" / "Histórico"; `role="tab"` com **`aria-selected` true/false** | ✅ | ✅ 25–160 / 160–295 × 44 |
| 1 | "Meus treinos" igual ao de antes | ✅ **Editor:** "Editar …" abre o editor. **Nova rotina:** abre o editor. **Sugestão** (N, depois de `PUT /profile`): banner "Novo treino padrão disponível / Seu nível físico mudou / Regerar / Manter". **Rascunho** (N): banner "Treino em andamento / Dia 1 / Continuar / Descartar", com ▶ escondido; Descartar com confirmação limpa o rascunho | ✅ |
| 2 | Chips | ✅ "Musculação" → `type=STRENGTH`; "Todos" → sem `type`. `aria-selected` acompanha o chip ativo | ✅ 20–95 / 103–216 × 44 |
| 2 | Cabeçalhos e item | ✅ "Hoje", "Ontem", "ter, 29/09"…; "17:10 · 30:30 · 3 séries", "19:00 · 15:00 · **1 série**" | ✅ |
| 3 | **RF2 — meia-noite** | ✅ 23:30 local de ter 29/09 aparece em **"ter, 29/09"** (em UTC cairia em "Ontem") | — |
| 4 | **Rolagem** (H, 23) | ✅ 20, depois **uma** request `before=2026-09-07T10:00:00.000Z` → 23 itens com keys únicas. Spinner some. Mais rolagens no fim: 0 requests | — |
| 4 | **RF1** (E, exatamente 20) | ✅ 20; **uma** request `before=2026-09-11T13:00:00.000Z` volta vazia/`null`. Mais 6 rolagens: 0 requests, 20 keys únicas, sem spinner | — |
| 5 | **RF3 — troca rápida de chip.** A request do chip abandonado foi atrasada em 4 s **e trocada para `limit=1`** | ✅ "Todos" atrasado (4147 ms) → "Musculação" (147 ms): 20 itens, Musculação ativo. "Musculação" atrasado (4309 ms) → "Todos" (144 ms): 20 itens, Todos ativo | — |
| 6 | **RF5 — resumo pelo Histórico** | ✅ "Dia 2" → resumo (45:00, 2 séries) → **Concluir** → Treinos com o **Histórico ainda ativo** e o chip mantido. A lista recarrega (`GET /activities?limit=20`) | — |
| 7 | Estado vazio (N) | ✅ "Nenhum treino ainda" + "Ver meus treinos" → "Meus treinos" ativo | ✅ sem overflow |
| 7 | Erro de rede (hook) | ✅ "Não foi possível carregar o histórico." + "Tentar de novo" → 200 e lista de volta | — |
| 7 | Puxar para baixo | ✅ `onRefresh` chamado pela fiber, porque o web não tem o gesto → `GET /activities?type=STRENGTH&limit=20` 200 | — |
| 8 | Selo | ✅ **Concluído** em Dia 1 (hoje) e Dia 2 (−2 d); Dia 3 (há 8 d) sem selo. N sem selo | ✅ |
| 8 | **RF5 — selo após treino pelo app** | ✅ ▶ Dia 3 → treino real (ver Regressão) → **Concluir** → "Meus treinos" com **Dia 3 · Concluído**. No Histórico: "Hoje · 19:15 · 2:01 · 2 séries" | — |
| 9 | ▶ em rotina concluída (Dia 1) | ✅ Título, texto e botões exatos. **Cancelar** não abre a sessão. **Treinar mesmo assim** abre `WorkoutSession` | ✅ modal 24–296, botões 48–272 × 50 |
| 9 | ▶ em rotina não concluída | ✅ Dia 3 (H) e Dia 1 (N) abrem direto, sem modal | — |
| 9 | Home "Iniciar" | ✅ Com o próximo concluído (Dia 2): modal. Cancelar fica na Home; Treinar mesmo assim abre Dia 2. Depois de treinar o Dia 3, o próximo virou "Rotina Regressão" (própria, não concluída), que abre direto | ✅ card 166–300, modal 24–296 |
| 9 | Home "Continuar treino" (rascunho) | ✅ Retoma sem modal (0 alerts) | — |
| 10 | Perfil | ✅ **`GET /activities?type=STRENGTH&limit=5`**. Lista os 5 últimos ("01/10 · 2 min · 2 séries"…"29/09 · 45 min · 2 séries"). Tocar abre o resumo e Concluir volta para o Perfil | — |
| 11 | Layout | ✅ `scrollWidth` 412 | ✅ `scrollWidth` 320 nas duas visões, no estado vazio e com os modais. Nenhum alvo visível < 44 px. Nenhum texto cortado |
| 11 | Console | ✅ Só o aviso que já existia (`props.pointerEvents is deprecated`). Ver "Checagens feitas só no navegador" | ✅ |

## Ajustes do `941c394`

| Item | Resultado |
|---|---|
| `aria-selected` no segmentado (`Workouts/index.tsx:117`) | ✅ No DOM: `Meus treinos` `aria-selected="true"` / `Histórico` `"false"`; inverte ao trocar. Continua `role="tab"` |
| `aria-selected` nos chips (`History.tsx:82`) | ✅ `Todos` true/false e `Musculação` false/true, sempre acompanhando o chip ativo (inclusive depois do RF3 e do erro → retry) |
| Título do item em até 2 linhas (`History.tsx:124`, `numberOfLines={2}`) | ✅ Em 320: "Dia 1 — Corpo todo A", "Dia 2 — Corpo todo B" e "Dia 3 — Corpo todo C" quebram em 2 linhas (37 px), **sem reticências** (`scrollHeight` = `clientHeight`, `-webkit-line-clamp: 2`). "Treino livre" fica em 1 linha (18 px) |
| Perfil só musculação (`Profile/index.tsx:63`) | ✅ Request ao vivo: `GET /activities?type=STRENGTH&limit=5` 200 |

## Regressão do módulo de treinos (Step 2)

| Item | Resultado |
|---|---|
| Plano padrão gerado do banco (D, F/Iniciante/Perder Peso) | ✅ 3 rotinas (Corpo todo A/B/C, 6 exercícios cada), **iguais exercício por exercício** ao `generatePlan` com as regras lidas do banco (`workoutRepository.getGeneratorRules`): `exercise_id`, reps 8–15, descanso 60/45 s, 3 séries |
| RF1 da entrega 1 — 2 × `GET /workouts/routines` em paralelo | ✅ 200/200, 3 rotinas com os mesmos ids; o 3º GET é igual |
| RF2 da entrega 1 — `PUT /profile` + 2 × `plan/accept` em paralelo | ✅ Sugestão `changed: ['fitness_level']` → 200/200. 4 defaults novas + "Própria D" intacta (90 s, `[20.5, null]`). `completed_recently` booleano em todas. `accept` sem sugestão não muda nada |
| Editor: carga em branco e com vírgula | ✅ Nova rotina "Rotina Regressão" com cargas "7,5", "" e "22,5" → salvar (201). Ao reabrir: **"7,5"**, **""** e **"22,5"**. API: `[7.5, null, 22.5]` |
| Execução: cronômetros | ✅ Total corre (0:00 → 0:04 em 4 s; 0:10 ao terminar a 1ª série). Descanso "0:02 · alvo 1:00" |
| Descanso vermelho | ✅ Antes do alvo, caixa `rgb(28, 28, 30)`. Em 1:15 (> 1:00), caixa e borda **`rgb(255, 69, 58)`**. "Acabou o descanso — iniciar série 2" disponível |
| **Reload no meio do descanso** (página recarregada aos ~75 s) | ✅ A Home mostra "Treino em andamento / Continuar treino". Continuar retoma o descanso em **1:34**, que bate com os 94 s desde o `phase_started_at` do rascunho (`localStorage`). Continua vermelho e sem modal |
| Resumo | ✅ 2:01 · 2 séries · descanso médio 1:44. "descanso 1:44" em `rgb(255, 69, 58)` no resumo ao vivo |
| **Reenvio idempotente** (resposta perdida) | ✅ O `POST /workouts/sessions` chegou ao servidor (**201**, id `09099d59…`), mas a página recebeu falha de rede: "Não foi possível salvar. O treino continua guardado no aparelho." + Tentar de novo / Voltar depois, **sem selo**. **Tentar de novo** → **200** e selo "Treino concluído". H ficou com 24 activities (23 + 1), uma só sessão de hoje do Dia 3, com o **mesmo id** |
| Descartar treino sem séries | ✅ "Descartar treino?" → o rascunho sai do `localStorage` |

## Checagens feitas só no navegador

Estas checagens só foram possíveis na página, não pela API:
- **Hook de XHR:**
  - o RF3, com a resposta atrasada e trocada para `limit=1`;
  - o estado de erro e a recuperação;
  - a resposta perdida do `POST /workouts/sessions`, com o 201 real no servidor e a falha na página;
  - a contagem de requests de paginação e as URLs reais (`type=STRENGTH&limit=5` no Perfil, `before=` na rolagem).
- **React:**
  - **Puxar para baixo:** `onRefresh` chamado pela fiber, porque o react-native-web não tem o gesto. O gesto real fica para o nativo.
  - **Duplicatas:** as keys únicas da lista foram conferidas pela fiber.
- **Estilos e DOM:**
  - **Cores:** o descanso vermelho, o selo e o estado ativo do segmentado e dos chips, por `getComputedStyle`.
  - **Atributos:** `aria-selected` e `role` lidos do DOM.
  - **Layout:** 412/320 medido por `getBoundingClientRect` e `scrollWidth`, sem screenshot.
- **Armazenamento:** o RF4 da entrega 1 (`phase_started_at` do rascunho × valor do cronômetro depois do reload) e a limpeza do rascunho ao descartar.
- **Console, lido em 4 trechos:**
  - H depois do reload (execução, resumo, Perfil, editor);
  - E (rolagem);
  - N (vazio, banners, rascunho);
  - H de novo, numa reprise do modal do ▶, das trocas de chip com atraso, da rolagem até o fim e do 320. Essa reprise foi feita porque o primeiro trecho de H, antes do reload no meio do descanso, se perdeu com o reload sem ser lido.
  
  Em todos, só o aviso de depreciação que já existia.

## Observações (INFO, não bloqueantes)

- **Frontend, já existia, fora do diff:** a tela de execução mostra a carga com ponto ("7.5 kg", em `FrontEndTorv/src/screens/WorkoutSession/index.tsx:147`, da entrega 2 `d6bdbc1`), enquanto o editor usa vírgula ("7,5"). É só exibição: o valor salvo está certo.
- **Web:** o gesto de puxar para baixo não existe no react-native-web. O handler foi validado; o gesto real deve ser conferido num celular.
- **Dados de teste:** as contas continuam no banco, porque não existe endpoint para apagar conta.
  - `qa.full.{A,B,C,D}` e `qa.fullfe.{H,E,N}`, com as sessões semeadas.
  - **H:** 24 activities, incluindo o treino feito pelo app, e a rotina própria "Rotina Regressão".
  - **N:** nível mudou para Intermediário, com sugestão pendente.
  - **C e D:** as rotinas próprias "Própria C" e "Própria D".
  
  Todos os rascunhos abertos foram descartados. Nenhum dado do usuário foi lido nem alterado.
