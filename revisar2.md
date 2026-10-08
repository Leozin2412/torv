# Revisar 2 — Histórico de treinos e selo "Concluído"

Branch `feat/workout-module` (sem push). Spec: `docs/superpowers/specs/2026-10-01-workout-history-design.md`. Plano: `docs/superpowers/plans/2026-10-01-workout-history.md`.

**Status:** pronto. Rodou do jeito combinado, em sequência (um recruit por vez), com teste ao fim de cada etapa e um teste completo no final.

| Etapa | Resultado |
|---|---|
| Backend | Pronto, teste da etapa PASS |
| Frontend | Pronto, teste da etapa PASS |
| Teste completo | PASS, incluindo regressão do módulo de treinos |
| Security | PASS. O único LOW foi corrigido e confirmado no round 2 |

- **Automatizados:** backend 83/83, front 17/17, `tsc` sem erros (conferido por mim no fim).
- **Arquivos:** 22 alterados (11 backend, 11 frontend). Não teve migration.

## O que mudou para o usuário

- **Aba Treinos com duas visões no topo:**
  - **Meus treinos:** a tela de antes.
  - **Histórico:** os treinos feitos, agrupados por dia ("Hoje", "Ontem", "seg, 28/09"), com chips **Todos** / **Musculação**. A lista carrega mais conforme você rola e recarrega ao puxar para baixo. Tocar num treino abre o resumo; ao voltar, o Histórico continua aberto.
- **Selo "Concluído":** aparece na rotina feita nos últimos 7 dias e some sozinho depois.
- **Aviso ao refazer:** ▶ numa rotina concluída abre "Treino já concluído" com "Treinar mesmo assim" / "Cancelar". O mesmo aviso aparece no **Iniciar** da Home; "Continuar treino" não mostra aviso.
- **Perfil:** a lista "Atividade Física" passou a usar a rota nova, só com musculação.

---

## Database

Nenhuma mudança. O schema já tinha o necessário: `activities.routine_id` e o índice `activities_strength_user_start_key`.

## Repositórios

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/repository/activities.repository.js` | **Criado.** `listActivities(userId, { type, before, limit })`. Ordena da mais recente para a mais antiga, usa cursor por `start_time` e filtra sempre pelo usuário. |
| `BackEndTorv/src/repository/workout.repository.js` | **Editado.** Novo `recentRoutineIds(userId, since)`, uma query para as rotinas treinadas nos últimos 7 dias. O `listSessions` saiu. |

## Controller e lib

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/controller/activities.controller.js` | **Criado.** Monta a página e o `next_before`. Um `before` que o JS não consegue ler vira 400; era o LOW do Security. |
| `BackEndTorv/src/controller/workout.controller.js` | **Editado.** O `routinesPayload` adiciona `completed_recently` em cada rotina, com a janela de 7 dias. O `listSessions` saiu. |

Nenhuma mudança em `src/lib`.

## Routes

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/routes/activities.routes.js` | **Criado.** `GET /activities?type=STRENGTH&before=<ISO>&limit=1..50` (padrão 20). |
| `BackEndTorv/src/routes/activities.routes.test.js` | **Criado.** Testes da rota nova: formato, paginação, limites, `before` inválido e `user_id` vindo do cliente sendo ignorado. |
| `BackEndTorv/src/routes/workout.routes.js`, `workout.schemas.js` | **Editados.** O `RoutineList` ganhou `completed_recently`. Saíram a listagem `GET /workouts/sessions` e o schema `SessionSummary`. O `POST /workouts/sessions` e o `GET /workouts/sessions/:id` continuam. |
| `BackEndTorv/src/routes/workout.routes.test.js`, `workout.sessions.test.js` | **Editados.** Testes do `completed_recently` e remoção do teste da listagem antiga. |
| `BackEndTorv/server.js` | **Editado.** Registra `/activities`. |

## Frontend (`FrontEndTorv/src/`)

- **Novos:**
  - `screens/Workouts/History.tsx` + `historyStyles.ts`: a visão Histórico (chips, lista por dia, paginação, puxar para recarregar, estados vazio e de erro). Ela descarta resposta atrasada de filtro antigo.
  - `services/activities.ts`: contrato de `GET /activities`.
  - `utils/activities.ts`: rótulos dos tipos (`STRENGTH` → "Musculação"). Tipo novo é uma linha aqui e uma no backend.
  - `utils/historyGroups.ts` + teste: agrupa por dia no fuso do aparelho. Um treino às 23:30 cai no dia certo.
- **Editados:**
  - `screens/Workouts/index.tsx` + `styles.ts`: segmentado "Meus treinos" / "Histórico", selo "Concluído" e o aviso no ▶.
  - `screens/Home/index.tsx`: aviso no Iniciar.
  - `screens/Profile/index.tsx`: usa `/activities?type=STRENGTH&limit=5`.
  - `services/workouts.ts`: `completed_recently`; saiu `listSessions`.
- **Visual (`/frontend-design`):**
  - a aba selecionada no segmentado e o selo "Concluído" usam o fundo em tinta verde, para não competir com os botões ▶ verdes sólidos;
  - ficam três selos distintos: Próximo sólido, Concluído tinta, Padrão contorno cinza;
  - alvos de 44 px e cabe em 320 px.

---

## Ciclo e relatórios (`docs/`)

| Etapa | Resultado | Relatório |
|---|---|---|
| Teste da etapa backend | PASS | `qa-workout-history-backend-2026-10-01.md` |
| Teste da etapa frontend | PASS (3 LOW, corrigidos no commit `941c394`) | `qa-workout-history-frontend-2026-10-01.md` |
| **Teste completo** (backend + frontend + regressão do módulo de treinos, contas novas) | **PASS** | `qa-workout-history-full-2026-10-01.md` |
| Security | PASS com 1 LOW: `before` em formato raro dava 500 | `security-workout-history-2026-10-01.md` |
| Reteste backend após o fix (`e7312da`) | PASS | `qa-workout-history-backend-2026-10-01-round2.md` |
| **Security round 2** | **PASS, LOW fechado** | `security-workout-history-2026-10-01-round2.md` |

Os LOW da Task 4 eram estes:
- `aria-selected` no web;
- título do item com 2 linhas em 320 px;
- Perfil só com musculação.

## Para você decidir (não bloqueia)

1. **Regerar o treino padrão zera o selo das rotinas padrão.** Elas são recriadas com ids novos, então perdem o "Concluído" mesmo que você tenha treinado ontem. As rotinas próprias mantêm o selo.
2. **"7.5 kg" com ponto na tela de execução** (`WorkoutSession/index.tsx:147`). É da entrega anterior, fora deste diff; o editor já mostra "7,5". A correção é de uma linha, se quiser.
3. **Itens que continuam abertos:** sem rate limit em `/workouts` e `/activities`, e o `started_at` vem do app (retroatividade). São os LOW que já estavam no `revisar.md`.
4. **Detalhes registrados pelo Security, sem ação necessária:**
   - o cursor da paginação tem precisão de milissegundo;
   - requisição sem token e com parâmetro inválido responde 400 antes do 401, como nas outras rotas.

## Ambiente

- **O `FrontEndTorv/.env` continua vazio.** No web e no celular o app não alcança o backend; os testes usaram um ajuste só dentro da página. Para testar de verdade: `EXPO_PUBLIC_API_URL=http://192.168.15.179:3000` no `.env` e reiniciar o Expo com `--clear`.
- O backend está no Furnace, e o Expo web no terminal "Expo".
- Suas mudanças locais em `api.ts` e `Login/index.tsx` continuam intocadas e fora dos commits.
- **Contas de teste:** `qa.hist.*`, `qa.histfe.*`, `qa.full.*`, `qa.fullfe.*` e `qa.r2.*` (`@torvtest.dev`) ficaram no banco com treinos de teste, porque não há endpoint para apagar conta.

**Falta:** aprovar a branch. O push fica para quando você pedir.
