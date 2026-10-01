# QA — Histórico de treinos — etapa frontend — 2026-10-01

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `630f70f` (diff `a5fa731..630f70f`); backend já aprovado em `a5fa731` · **Plano:** Task 4 de `docs/superpowers/plans/2026-10-01-workout-history.md` + Review Focus 1, 2, 3 e 5 · **Spec:** `docs/superpowers/specs/2026-10-01-workout-history-design.md`

Contas **novas**, criadas pelo `POST /auth/register` a partir da página e semeadas via `POST /workouts/sessions` (todas `@torvtest.dev`):
- `qa.histfe.H.1790891556443`: 23 treinos.
  - Hoje 16:52: Dia 1, 3 séries.
  - Ontem 19:00: Treino livre, 1 série.
  - **ter 29/09 às 23:30 local**: Dia 2. Em UTC é `2026-09-30T02:30Z`.
  - 20 antigos (8 a 27 dias atrás): Dia 3.
- `qa.histfe.E.1790891556443`: exatamente 20 treinos (RF1).
- `qa.histfe.N.1790891556443`: sem treinos (estado vazio).

## Ambiente

- Expo web em 8081, backend no Furnace (`localhost:3000`). Nenhum dos dois foi reiniciado e nenhuma outra instância foi aberta.
- O `FrontEndTorv/.env` está vazio e **não** foi editado. O bundle cai em `127.0.0.1:3000`, por causa da mudança local do usuário em `api.ts`.
- **Shim só na página**, reinstalado a cada reload:
  - um hook em `XMLHttpRequest` reescreve o host para `localhost:3000` e registra cada chamada com o status;
  - ele também aceita regras de uso único para atrasar uma request, trocar a query ou simular falha de rede (host `localhost:1`).
- Portal "Torv Mobile #2" em 412×915 e 320×915. Login de H, E e N pela tela de Login. As medidas de layout foram feitas pelo DOM (`getBoundingClientRect`, `scrollWidth`, `getComputedStyle`), sem depender de screenshot; o agent-browser não foi necessário.
- A sessão original do portal ficou salva numa chave separada do `localStorage`. Para trocar de conta apaguei só `torv.session`, sem `/auth/logout`. No fim ela foi restaurada (Home logada, 412×906).
- Fuso do navegador: `America/Sao_Paulo` (UTC−3). Data da rodada: qui 01/10/2026, por volta das 19h.

## Veredito: PASS (100% verde)

Nenhuma falha bloqueante. As observações estão no fim (2 LOW e algumas INFO), junto com a avaliação das notas (a) e (b) do implementador.

## Step 1 — Automatizado

| Item | Resultado |
|---|---|
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 17/17 |

## Step 2 — Usabilidade

| # | Item | 412 | 320 |
|---|---|---|---|
| 1 | Segmentado "Meus treinos" / "Histórico" alterna as visões. `tablist` com 2 × `role="tab"`, 44 px de altura | ✅ 181 px cada | ✅ 25–160 / 160–295 |
| 1 | "Meus treinos" igual ao de antes: editor pelo card, "Nova rotina" → editor, banner "Novo treino padrão disponível / Seu nível físico mudou / Regerar / Manter", banner "Treino em andamento" com Continuar/Descartar e ▶ escondido, Descartar com confirmação | ✅ | ✅ |
| 1 | `selected` no tab | ✅ no nativo / ⚠️ no web `aria-selected=null` (ver nota b) | — |
| 2 | Chips "Todos" / "Musculação" | ✅ "Musculação" pede `type=STRENGTH` e "Todos" pede sem `type`. O chip ativo muda (tinta + borda verde). 44 px | ✅ 20–95 / 103–216 |
| 2 | Cabeçalhos | ✅ "Hoje", "Ontem" e depois "ter, 29/09", "qua, 23/09"… "sáb, 05/09" | ✅ |
| 2 | Item | ✅ Hora · duração · séries: "16:52 · 30:30 · 3 séries", "19:00 · 15:00 · **1 série**", "07:00 · 25:08 · 4 séries" | ✅ meta 152/152 px (cabe) |
| 3 | **RF2 — meia-noite** | ✅ O treino das 23:30 local de ter 29/09 aparece em **"ter, 29/09"** como "23:30 · 45:00 · 2 séries". Agrupado por UTC, cairia em "Ontem" (30/09) | — |
| 4 | **Rolagem** — H com 23 treinos | ✅ 1ª página com 20. Rolar até o fim faz **uma** request `before=2026-09-07T10:00:00.000Z` e completa 23 itens, todos únicos e sem aviso de key duplicada no console. O spinner some. Rolar de novo no fim não dispara nenhuma request | — |
| 4 | **RF1** — E com exatamente 20 | ✅ 20 itens. Ao rolar até o fim, **uma** request `before=…` volta vazia com `next_before: null`. Com 6 rolagens a mais: zero requests novas, 20 itens únicos, sem spinner (sem loop) | — |
| 5 | **RF3 — troca rápida de chip**. A request do chip abandonado foi atrasada em 4 s **e trocada para `limit=1`**: se a resposta velha fosse aplicada, a lista cairia para 1 item | ✅ "Todos" atrasado (4181 ms) → toque em "Musculação" (305 ms): lista com 20 e Musculação ativo. Ao contrário: "Musculação" atrasado (4146 ms) → "Todos": 20 itens e Todos ativo. A resposta velha foi descartada nos dois sentidos | — |
| 6 | **RF5 — resumo pelo Histórico** | ✅ Tocar em "Dia 2" abre o resumo (`GET /workouts/sessions/:id` 200, 45:00, 2 séries) → **Concluir** → volta para Treinos com o **Histórico ainda ativo** e o chip mantido. A lista recarrega (`GET /activities?limit=20`) | — |
| 7 | Estado vazio (N) | ✅ "Nenhum treino ainda" + "Ver meus treinos" → volta para "Meus treinos" | ✅ botão 37–283 × 50 |
| 7 | Erro de rede (hook) | ✅ "Não foi possível carregar o histórico." + "Tentar de novo" → 200 e lista de volta (20) | — |
| 7 | Puxar para baixo | ✅ No web não existe o gesto (o `RefreshControl` do react-native-web não puxa), então chamei o `onRefresh` do `refreshControl` pela fiber do React. Resultado: `GET /activities?limit=20` 200, lista mantida. O gesto real fica para o nativo | — |
| 8 | Selo | ✅ **Concluído** em Dia 1 (hoje) e Dia 2 (−2 d); Dia 3 (último treino há 8 d) sem selo. N (sem treino): nenhum selo | ✅ tags quebram linha sem corte |
| 8 | **RF5 — selo após treino pelo app** | ✅ ▶ em Dia 3 → sessão → 1 série → Finalizar → `POST /workouts/sessions` 201 → resumo "Treino concluído" → **Concluir** → "Meus treinos" com **Dia 3 · Concluído** (e Próximo passou para Dia 1). O Histórico mostra o treino novo em "Hoje · 18:58 · 0:25 · 1 série" | — |
| 9 | ▶ em rotina concluída | ✅ Modal com título "Treino já concluído", texto exato da spec e botões "Treinar mesmo assim" / "Cancelar". **Cancelar** não abre a sessão. **Treinar mesmo assim** abre `WorkoutSession` (Dia 1) | ✅ modal 24–296, botões 224 × 50, sem overflow |
| 9 | ▶ em rotina não concluída (Dia 3) | ✅ abre direto, sem modal | — |
| 9 | Home "Iniciar" | ✅ Com o próximo concluído (Dia 2): mesmo modal; Cancelar fica na Home; Treinar mesmo assim abre a sessão de Dia 2 | — |
| 9 | Home "Continuar treino" (rascunho) | ✅ Retoma a sessão **sem** modal | — |
| 10 | Perfil "Atividade Física" | ✅ `GET /activities?limit=5`. Mostra os 5 últimos, do mais recente: "01/10 · 1 min · 1 série", …, "29/09 · 45 min · 2 séries" (data local certa para o das 23:30). Tocar abre o resumo e Concluir volta para o Perfil | — |
| 11 | Layout | ✅ `scrollWidth` = 412 | ✅ `scrollWidth` 320 nas duas visões, no estado vazio e com o modal. Nenhum alvo visível < 44 px. Títulos dos itens com reticências (ver LOW 1) |
| 11 | Console | ✅ Só o aviso de depreciação que já existia (`props.pointerEvents is deprecated`), lido em 5 pontos (depois da rolagem, do erro, do resumo, do Perfil e do descarte) | ✅ |

## Notas do implementador

**(a) `brandTint` no segmentado ativo e no selo.** O selo **se distingue** de Próximo e de Padrão. Medido pelo `getComputedStyle` no card do Dia 2, que tem as três tags:

| Tag | Estilo | Contraste do texto |
|---|---|---|
| Próximo | fundo verde sólido `#8CC63F`, texto `#121212` | 9,16:1 |
| Padrão | sem fundo, contorno cinza, texto cinza `#8F958A` | 5,54:1 |
| Concluído | fundo tinta `#1F2916`, texto verde `#8CC63F` | 7,40:1 |

- As três têm a mesma altura (17 px).
- **Concluído × Próximo:** o preenchimento é diferente (sólido × tinta).
- **Concluído × Padrão:** a cor do texto é diferente (verde × cinza), e Padrão tem contorno.
- A tinta contra o card dá só 1,12:1, então o selo se lê pelo texto verde, não pela pílula. Como as palavras são diferentes, a informação não depende só de cor.
- O segmentado ativo segue o mesmo padrão: tinta com texto verde × transparente com texto cinza.

OK.

**(b) `aria-selected=null` no web.** Confirmado: o react-native-web 0.21.2 ignora `accessibilityState` e lê só `aria-selected` ou `accessibilitySelected` (`node_modules/react-native-web/dist/cjs/modules/createDOMProps/index.js:130/677`).

- **Severidade: LOW, não bloqueante.**
  - O alvo do produto é o app nativo, onde `accessibilityState` funciona, e a spec pede literalmente `accessibilityState={{ selected }}`.
  - O estado visual é claro.
  - O `ExercisePicker` já tinha o mesmo padrão (`src/components/ExercisePicker/index.tsx:155/173`).
- **Fix mínimo, quando for feito:** trocar por `aria-selected={active}` em `FrontEndTorv/src/screens/Workouts/index.tsx:116` e `FrontEndTorv/src/screens/Workouts/History.tsx:81` (e no ExercisePicker, se quiserem uniformizar). O RN 0.86 aceita `aria-selected` no `TouchableOpacity` e o RNW 0.21 o repassa para o DOM, então funciona nas duas plataformas.

## Step 3 — Revisão do diff (`a5fa731..630f70f`)

| Arquivo | Resultado |
|---|---|
| `services/activities.ts` | ✅ Contrato igual à spec (`ActivityItem`, `ActivityPage`, `ACTIVITY_TYPES`, `list` com `params`). O axios omite `type` indefinido, como visto ao vivo: `limit=20` × `type=STRENGTH&limit=20` |
| `services/workouts.ts` | ✅ `completed_recently` em `RoutineSummary`. Saíram `listSessions` e `SessionSummary`, sem referência restante (`tsc` limpo) |
| `utils/activities.ts`, `utils/historyGroups.ts` (+ teste) | ✅ Função pura no fuso local, com dias da semana em tabela fixa e o ano só fora do ano atual. Os testes cobrem Hoje/Ontem, virada de mês e de ano, e lista vazia |
| `Workouts/History.tsx` | ✅ **Corrida:** o contador `request` descarta a resposta de filtro antigo, tanto na 1ª página quanto na paginação (provado no RF3). **Paginação:** `loadMore` exige `nextBefore` e `status === 'ready'`; o `VirtualizedList` só chama `onEndReached` uma vez por tamanho de conteúdo (RF1/rolagem sem request duplicada). **Erro:** uma falha ao paginar não apaga a lista. **Toque:** só STRENGTH é tocável, o que evita 404 no resumo de outros tipos. **Recarga:** o `useFocusEffect` recarrega ao refocar e ao trocar de chip |
| `Workouts/index.tsx` | ✅ **Visão:** o estado `view` vive na tela montada, então o Histórico continua aberto depois do resumo. **Aviso:** `startRoutine`/`confirmRepeat` com o `ConfirmModal` que já existia. **Mudança visual leve e intencional:** o título e o segmentado ficaram fixos, fora do `ScrollView` |
| `Home/index.tsx` | ✅ O rascunho tem prioridade (sem aviso); depois vem o aviso para `completed_recently`; senão abre direto. Mesmo texto do modal da aba Treinos |
| `Profile/index.tsx` | ✅ Usa `activitiesApi.list({ limit: 5 })`, conforme a spec (ver LOW 2) |
| Estilos | ✅ Chips e segmentos com 44 px; `doneTag` com borda da cor do fundo para manter a altura. Nada de dependência nova; nada fora de `FrontEndTorv/src` |

## Observações

- **LOW 1 (frontend, layout 320):** o título do item do Histórico tem `numberOfLines={1}` (`FrontEndTorv/src/screens/Workouts/History.tsx:123`). Em 320, o texto tem 152 px, e os nomes padrão (por exemplo "Dia 3 — Corpo todo C", 160–163 px) saem com reticências, como "Dia 3 — Corpo todo…". Perdem a letra final, mas o "Dia N" ainda identifica a rotina. Nomes maiores, como "Dia 5 — Inferior + Core", cortam mais. Não quebra o layout e não cria rolagem horizontal; é o mesmo tratamento com reticências já aceito em "A seguir …" na sessão. **Fix sugerido:** `numberOfLines={2}`.
- **LOW 2 (frontend, Perfil):** antes, o Perfil usava `listSessions`, que só trazia STRENGTH. Agora `activitiesApi.list({ limit: 5 })` (`FrontEndTorv/src/screens/Profile/index.tsx:63`) traz todos os tipos, e `:383` abre o resumo para qualquer item.
  - **Quando afeta:** uma conta com activity de outro tipo (hoje só o `Mock Dados.sql` cria) veria o item no Perfil, e o toque daria 404 no resumo. O Histórico já se protege disso.
  - **Hoje:** o app só grava STRENGTH, então ninguém é afetado agora. A chamada segue a spec.
  - **Fix sugerido:** `type: 'STRENGTH'` na chamada do Perfil, ou o mesmo guarda do Histórico.
- **INFO (web):** o "puxar para baixo" não tem gesto no react-native-web. O handler foi validado pela fiber; o gesto real precisa ser visto no nativo (Teste completo ou celular).
- **INFO (ambiente):** o `.env` vazio continua sendo decisão do usuário (`revisar.md`). As mudanças locais em `api.ts`/`Login/index.tsx` não foram tocadas e não afetaram o teste.
- **Dados de teste:** as contas `qa.histfe.{H,E,N}.1790891556443@torvtest.dev` continuam no banco, porque não existe endpoint para apagar conta.
  - **H:** 24 treinos (23 semeados + 1 feito pelo app).
  - **E:** 20 treinos.
  - **N:** nível mudou para Intermediário via `PUT /profile`, para mostrar o banner; a sugestão ficou pendente.
  
  Os rascunhos abertos durante os testes foram descartados. Nenhum dado do usuário foi lido nem alterado.
