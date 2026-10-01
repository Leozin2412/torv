# Histórico de treinos e selo "Concluído" — Design

**Data:** 2026-10-01 · **Branch:** `feat/workout-module` · **Base:** módulo de treinos (`docs/superpowers/specs/2026-09-30-workout-module-design.md`), já entregue nessa branch.

## Objetivo

1. Dividir a aba **Treinos** em duas visões, alternadas por um controle no topo: **Meus treinos** (a tela atual, com as rotinas) e **Histórico** (os treinos já feitos).
2. Criar uma rota de backend que lista as activities do usuário, da mais recente para a mais antiga, com filtro por `activity_type`. Hoje só existe `STRENGTH`, que aparece no app como **Musculação**.
3. Marcar como **Concluído** a rotina feita nos últimos 7 dias. O selo some sozinho depois dos 7 dias. Ao iniciar de novo uma rotina concluída, o app mostra um aviso sugerindo descanso, mas a pessoa pode treinar mesmo assim.

## Decisões

| Tema | Decisão |
|---|---|
| Rota de listagem | Nova e genérica: `GET /activities`, num plugin próprio, fora de `/workouts`, porque vai servir a outros tipos. |
| Listagem antiga | `GET /workouts/sessions` (listagem) é **removida**. O Perfil passa a usar `/activities`. O detalhe `GET /workouts/sessions/:id` e o `POST /workouts/sessions` continuam. |
| Paginação | Cursor por data: `before` = `start_time` do último item recebido. A resposta traz `next_before` (`null` quando acabou). `limit` de 1 a 50, padrão 20. |
| Agrupamento por dia | É feito **no app**, no fuso do aparelho. O servidor só ordena e pagina, o que evita o problema de UTC registrado no Perfil. |
| Janela de "Concluído" | 7 × 24 h corridas, contadas a partir do relógio do servidor. Calculada no servidor: cada rotina vem com `completed_recently: boolean`. |
| Selo | Só o texto **Concluído**, sem "há N dias". |
| Aviso ao refazer | O `ConfirmModal` abre ao tocar ▶ numa rotina concluída, na aba Treinos e também no **Iniciar** do card da Home. Botões: "Treinar mesmo assim" e "Cancelar". |
| Navegação no topo | Um controle segmentado dentro da própria tela, sem dependência nova. A visão escolhida fica guardada enquanto a tela estiver montada. |
| Fora do escopo | Outros tipos de activity, filtro por período, busca, editar ou apagar treino do histórico, e o rate limit (LOW aberto da entrega 1). |

## Backend

### `GET /activities`

- Plugin `src/routes/activities.routes.js`, registrado no `server.js` com `prefix: '/activities'`. Usa o mesmo `preHandler` `authenticateToken`.
- **Querystring:**

| Campo | Regra |
|---|---|
| `type` | Opcional. Enum `['STRENGTH']`; valor fora da lista → 400. |
| `before` | Opcional. String no formato `date-time`. |
| `limit` | Opcional. Inteiro de 1 a 50; o padrão é 20. |

- **Resposta 200:**

```json
{
  "activities": [
    { "id": "uuid", "activity_type": "STRENGTH", "title": "Dia 1 — Corpo todo A",
      "start_time": "2026-10-01T12:00:00.000Z", "duration_sec": 3000, "set_count": 18 }
  ],
  "next_before": "2026-09-28T20:00:00.000Z"
}
```

- **Ordem e cursor:** `start_time DESC`, filtrado por `start_time < before` quando houver `before`. `next_before` traz o `start_time` do último item quando a página veio cheia (`length === limit`); caso contrário, é `null`.
- **Filtros:** `user_id` vem sempre do token, nunca do cliente. `set_count` = quantidade de `workout_sets` da activity (0 em tipos sem séries).
- **Erros:** sem token → 401; token inválido → 403; querystring inválida → 400.
- **Arquivos:** `src/routes/activities.routes.js`, `src/controller/activities.controller.js` e `src/repository/activities.repository.js`.
- `ponytail:` o cursor usa só `start_time`. Hoje é único por usuário em STRENGTH (índice `activities_strength_user_start_key`). Quando entrar outro tipo, o cursor passa a ser `(start_time, id)`.

### `completed_recently`

- Cada item de `routines` em `GET /workouts/routines`, `POST /workouts/plan/accept` e `POST /workouts/plan/dismiss` ganha `completed_recently: boolean`. Todas essas rotas devolvem o mesmo `RoutineList`.
- **Repository:** novo `recentRoutineIds(userId, since)`, com uma query só: `activities` STRENGTH desse usuário com `routine_id` não nulo e `start_time >= since`, `distinct` por `routine_id`, `select { routine_id }`.
- **Controller:** `routinesPayload` passa a chamar `recentRoutineIds(userId, new Date(Date.now() - 7 * 24 * 3600 * 1000))` junto com as outras duas queries (`Promise.all`). `completed_recently = ids.has(r.id)`.

### Remoção

- Saem a rota `GET /workouts/sessions` (listagem), `WorkoutController.listSessions`, `WorkoutRepository.listSessions`, o schema `SessionSummary` (se não for usado em outro lugar) e os testes deles.

### Testes (node:test, com mock no singleton do repository e stub do auth, como hoje)

- `src/routes/activities.routes.test.js`:
  - 200 com o formato e `next_before` (página cheia e página incompleta);
  - o repository recebe o `userId` do token e os valores certos de `type`, `before` e `limit`;
  - limites: `type` inválido, `limit` 0 e 51, `before` inválido → 400.
- `workout.routes.test.js`:
  - `completed_recently` true/false, pelo `recentRoutineIds` mockado;
  - a janela passada ao repository é de ~7 dias.
- `workout.sessions.test.js`: remover o teste da listagem.

## Frontend

### Aba Treinos (`screens/Workouts`)

- **Controle segmentado** no topo, logo abaixo do título, com **Meus treinos** e **Histórico**. É um estado local da tela, com `accessibilityRole="tab"` e `accessibilityState={{ selected }}`.
- **Meus treinos** é o conteúdo atual: rotinas, banner de rascunho, banner de sugestão e "Nova rotina".
- **Histórico** é um componente novo, `screens/Workouts/History.tsx` + `historyStyles.ts`:
  - **Chips de filtro:** "Todos" (sem `type`) e um chip para cada entrada de `ACTIVITY_LABELS` (`{ STRENGTH: 'Musculação' }`, em `utils/activities.ts`). O estilo é o mesmo dos chips de grupo muscular do `ExercisePicker`, com alvo de 44 px.
  - **Lista:** `SectionList` agrupada por dia local, com cabeçalhos "Hoje", "Ontem" e `ddd, dd/mm` (ex.: "qua, 30/09").
  - **Item:**
    - título;
    - hora (`HH:mm`);
    - duração (`formatClock`);
    - "1 série" / "N séries".
  - **Tocar no item:** `navigation.navigate('WorkoutSummary', { sessionId: id })`, o resumo em modo histórico que já existe.
  - **Carregamento:**
    - **Primeira página:** carrega ao entrar na visão e ao refocar a aba.
    - **Puxar para baixo:** recarrega.
    - **Fim da lista** (`onEndReached`): carrega a próxima página com `before = next_before` até vir `null`, com uma página por vez. Rodapé com spinner.
    - **Trocar o chip:** recomeça do zero.
  - **Estado vazio:** "Nenhum treino ainda", com o botão "Ver meus treinos", que volta para a outra visão.
  - **Estado de erro:** "Não foi possível carregar o histórico.", com "Tentar de novo".

### Selo e aviso

- **Selo "Concluído":** aparece no card da rotina com `completed_recently`, ao lado de Padrão e Próximo, em cor de sucesso dos tokens.
- **Aviso:** ▶ numa rotina concluída abre um `ConfirmModal`:
  - título "Treino já concluído";
  - texto "Você já fez esse treino nos últimos 7 dias. O ideal é dar de 48 a 72 horas para o músculo se recuperar.";
  - confirmar: "Treinar mesmo assim", que segue para `WorkoutSession` como hoje;
  - cancelar: "Cancelar".
- **Home:** o card "Treino de hoje" usa o mesmo aviso no **Iniciar** quando a rotina indicada tiver `completed_recently`. "Continuar treino" (rascunho) não mostra aviso.

### Contrato e utilitários

- **`services/activities.ts`:** `ActivityItem`, `ActivityPage`, `ACTIVITY_TYPES` e `activitiesApi.list({ type?, before?, limit? })` → `GET /activities`.
- **`services/workouts.ts`:**
  - `RoutineSummary` ganha `completed_recently: boolean`.
  - Saem `listSessions` e `SessionSummary`. O Perfil passa a usar `ActivityItem`.
- **`utils/activities.ts`:** `ACTIVITY_LABELS`.
- **`utils/historyGroups.ts`:** função pura `groupByDay(items, now)` → `[{ key, title, data }]`, no fuso local, com os rótulos "Hoje", "Ontem" e `ddd, dd/mm`, em pt-BR e sem `Intl` de locale (dias da semana em tabela fixa). Tem teste `historyGroups.test.mjs`.
- **Perfil:** a seção "Atividade Física" passa a usar `activitiesApi.list({ limit: 5 })`, sem mudança visual.
- **`/frontend-design`:** controle segmentado, chips, itens do histórico, cabeçalhos de dia e selo. Precisa caber em 320 px.

## Execução e testes

As etapas rodam em ordem; cada uma só começa com a anterior verde.

1. **Backend** (Torv Backend). **Teste da etapa** (Torv Review and Tests, relatório `docs/qa-workout-history-backend-2026-10-01.md`):
   - `npm test`;
   - contrato ao vivo:
     - limites e `type` inválido;
     - paginação até `next_before: null`;
     - isolamento entre duas contas;
     - `completed_recently` true para treino de 6 dias atrás e false para treino de 8 dias atrás;
     - a listagem `GET /workouts/sessions` não existe mais.
2. **Frontend** (Torv Frontend, com `/frontend-design`). **Teste da etapa** (relatório `docs/qa-workout-history-frontend-2026-10-01.md`):
   - `tsc` e `node --test`;
   - usabilidade no navegador em 412 e 320:
     - alternar as visões;
     - usar os chips;
     - rolar até carregar mais;
     - abrir o resumo e voltar para o Histórico;
     - estados vazio e de erro;
     - selo e aviso no ▶ e na Home;
     - Perfil;
     - console sem erros.
3. **Teste completo** (relatório `docs/qa-workout-history-full-2026-10-01.md`): estado final, contas novas, as duas etapas juntas + regressão do módulo de treinos.
4. **Security** (relatório `docs/security-workout-history-2026-10-01.md`): OWASP no diff inteiro, com foco em IDOR no `/activities` e no `completed_recently`, no cursor e nos limites.

Se algum teste falhar, o rework vai só para a camada responsável, e o teste daquela etapa roda de novo (novo arquivo, `-roundN`).

## Riscos

- **Login no ambiente local:** o `FrontEndTorv/.env` está vazio, então a usabilidade usa um shim só na página (já registrado no `revisar.md`).
- **Retroatividade:** como `started_at` vem do app, uma sessão com data antiga entra no histórico na data informada. O LOW de retroatividade continua aberto.
