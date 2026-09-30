# QA — Módulo de treinos, entrega 1 (rotinas) — 2026-09-30

**Owner:** Torv Review and Tests (Loupe) · **Plano:** Task 8 de `docs/superpowers/plans/2026-09-30-workout-module.md` · **Diff:** `git diff main...feat/workout-module` (edb6a51..a74895a) · **Spec:** `docs/superpowers/specs/2026-09-30-workout-module-design.md`

## Veredito: FAIL (não avança para Security)

Duas falhas bloqueantes:

| # | Falha | Camada | Arquivo:linha |
|---|---|---|---|
| F1 | `weight_kg: null` (série sem carga) é gravado como **0**. O Ajv do Fastify roda com `coerceTypes`, testa o primeiro ramo do `Union([Number, Null])` e converte `null` em `0` antes de chegar no controller. A spec pede NULL ou 0–999,99. Na UI, a série deixada em branco volta como "0" ao reabrir a rotina. | backend | `BackEndTorv/src/routes/workout.schemas.js:22` (fix provável: `Type.Union([Type.Null(), Type.Number(...)])`, com o Null primeiro, ou desligar a coerção nesse campo) |
| F2 | Com a lista completa (71+ exercícios), o `ScrollView` horizontal dos chips de grupo encolhe para **6 px** de altura no picker. Os chips ficam invisíveis e um toque na posição deles cai em "Criar exercício"/cabeçalho (`elementFromPoint` no centro do chip devolve outro elemento). Só voltam a aparecer quando a busca reduz a lista. Reproduz em 412 e em 320 px. | frontend | `FrontEndTorv/src/components/ExercisePicker/styles.ts:12` (`chipsScroll` sem `flexShrink: 0`), usado em `FrontEndTorv/src/components/ExercisePicker/index.tsx:166` |

Lacuna de teste ligada à F1: `BackEndTorv/src/routes/workout.routes.test.js:27` envia `weight_kg: null`, mas não confere o que chega ao repository mockado. A F1 só apareceu ao vivo.

Não bloqueantes (LOW, ficam a critério):
- `FrontEndTorv/src/screens/Workouts/index.tsx:106`: sem singular, aparece "1 exercícios · 1 séries".
- `FrontEndTorv/src/screens/RoutineEditor/index.tsx:49/53`: a mensagem "Adicione pelo menos um exercício." continua na tela depois que os exercícios são adicionados, até o próximo salvar.
- `FrontEndTorv/src/utils/routineForm.ts:30`: carga digitada "7,5" volta como "7.5" ao editar (`String(n)`). A validação aceita as duas formas.
- `FrontEndTorv/src/screens/Workouts/index.tsx:46`: toque duplo no "Regerar" da confirmação envia dois `POST /plan/accept`. O backend segura (ver RF2), então é só uma request a mais.

## Bloqueio de ambiente (não é código)

O Expo web foi iniciado com `FrontEndTorv/.env` → `EXPO_PUBLIC_API_URL=http://192.168.15.179:3000`, mas o IP LAN atual da máquina é `192.168.29.69`. Por isso o login pelo app dava timeout (XHR status 0 após 21 s, "Falha ao realizar login"). O Expo não foi reiniciado. Nos testes de UI foi instalado um shim **só na página** que reescreve o host do XHR para `localhost:3000`. O `.env` precisa ser atualizado antes de levar o Expo para o celular.

## Step 1 — Automatizado: PASS

- `BackEndTorv: npm test` → 72/72.
- `FrontEndTorv: node --test src/utils/*.test.mjs` → 7/7; `npx tsc --noEmit` → sem erros.

## Step 2 — Contrato HTTP (fetch via `maestri portal evaluate`, tokens só na memória da página)

Contas criadas pelo `POST /auth/register` do próprio backend, disparado da página: `qa.workout.A.1790811439957@torvtest.dev` (F/Iniciante/Perder Peso), `qa.workout.B.1790811441763@torvtest.dev` (M/Avançado/Ganhar Massa), `qa.workout.C.<ts>@torvtest.dev` (F/Intermediário) e `qa.workout.D.1790811644843@torvtest.dev` (UI).

| Item | Resultado |
|---|---|
| **RF1** — conta nova A, 2× `GET /routines` em paralelo | ✅ as duas respostas trazem as mesmas 3 rotinas (mesmos ids); o 3º GET também. Reforço com a conta C, 5 GETs em paralelo → as 5 respostas trazem as mesmas 4 rotinas |
| Smoke Task 4 Step 9: GET 2× não duplica; `GET /exercises` | ✅ `Dia N — …` criadas, sem duplicar; 71 itens, todos `is_custom: false`, 12 grupos |
| Apagar todas → GET | ✅ A e B (5 × 204) → lista vazia em 2 GETs seguidos, `next_routine_id: null` (não regera) |
| B (M/Avançado/Ganhar Massa) = aba `Gerador` | ✅ 5 rotinas (Push 7, Pull 8, Pernas 9, Superior 7, Inferior+Core 8), 4 séries, 6–12 reps, 120 s compostos / 60 s isolados, mesma ordem e exercícios da planilha |
| **RF2** — `PUT /profile {fitness_level}` → sugestão | ✅ `{has_suggestion: true, changed: ['fitness_level']}` |
| **RF2** — 2× `POST /plan/accept` em paralelo | ✅ as duas dão 200 com 6 rotinas (5 default novas + a própria); só um conjunto default. A rotina própria continua intacta (mesmo id, reps/descanso/carga) |
| `accept` sem sugestão pendente | ✅ 200, ids das rotinas default idênticos (nada muda) |
| Mudar de novo + `dismiss` | ✅ `has_suggestion: false`, rotinas iguais; nova mudança (`goal`) → `has_suggestion: true, changed: ['goals']` |
| IDOR A↔B | ✅ B: GET/PUT/DELETE rotina de A → 404; PUT/DELETE exercício próprio de A → 404; PUT/DELETE exercício do catálogo → 404; criar rotina com exercício de A → 400 `exercise not found`; `GET /exercises` de B não lista o de A (71). A continua com a rotina (200) |
| Limites → 400 | ✅ nome vazio / só espaços / 101; 0 e 21 exercícios; 0 e 11 séries; reps 0, 101, 8.5, mín > máx; descanso −1 e 601; carga −1 e 1000; id não-UUID; UUID inexistente; grupo inválido; exercício com nome em branco / 101; `GET/PUT /routines/abc`, `DELETE /exercises/abc` → 400; sem token → 401. Borda válida (nome 100, 20 exercícios × 10 séries, reps 1–100, descanso 600, carga 999.99) → 201 |
| Carga NULL | ❌ **F1**: `POST` com `sets: [{weight_kg: null}, {weight_kg: 5}]` → resposta e GET com `[0, 5]`. As rotinas default (inseridas pelo repository, sem passar pelo schema) mantêm `null` |
| Excluir exercício próprio usado numa rotina | ✅ 204; `GET /routines/:id` fica só com o exercício do catálogo |

## Step 3 — Usabilidade no navegador (portal "Torv Mobile #2", 412×915 e 320)

Conta D, cadastrada via API e logada pela tela de Login do app.

| Item | 412 | 320 |
|---|---|---|
| 1. Login → Home "Treino de hoje: Dia 1 — Corpo todo A" → "Ver treinos" abre a aba Treinos | ✅ | ✅ card sem corte |
| 2. **Próximo** na 1ª, **Padrão** em todas; 4 abas cabem | ✅ | ✅ abas 20–300 px, sem scroll horizontal |
| 3. Nova rotina: nome em branco/espaços → "Dê um nome para a rotina."; sem exercício → "Adicione pelo menos um exercício." | ✅ | — |
| 3. Busca no picker; exercício próprio criado no picker (tag **Meu**) | ✅ | — |
| 3. Chip de grupo | ❌ **F2** (filtro funciona por clique programático, mas o chip não aparece nem recebe toque) | ❌ F2 (altura 6 px) |
| 3. Reps, descanso ±15 s em `m:ss` (1:00→1:30, 1:00→0:45), carga com vírgula, subir/descer, −Série, salvar → aparece "QA Peito · 2 exercícios · 5 séries" | ✅ | layout do editor ✅ |
| 4. Editar → valores carregados | ❌ **F1**: as séries deixadas em branco voltam "0" (o resto bate: reps 12–15/6–10, 0:45/1:30, 7.5/22.5/25, ordem) | — |
| 4. Excluir → confirmação → some da lista | ✅ | — |
| 5. Perfil → nível Intermediário → banner "Novo treino padrão disponível / Seu nível físico mudou" → Regerar → confirmação (toque duplo) → 4 rotinas padrão novas + "Minha D" | ✅ | ✅ |
| 5. Mudar para Avançado → **Manter** → banner some; Home → Treinos (refoco com GET) → não volta | ✅ | — |
| 6. Console sem erros vermelhos | ✅ (só o aviso `props.pointerEvents is deprecated`, já existente) | — |

Smoke Task 7 Step 6 (card `Dia 1 — …`, Próximo/Padrão, rotina do catálogo salva, exercício próprio com **Meu**): ✅ coberto acima.

### Checagens feitas só no navegador

Todo o Step 3. Também foi só no navegador a prova de que a F1 aparece na UI (editar mostra "0") e de que a F2 impede o toque (medição do `getBoundingClientRect` e `elementFromPoint`). Os itens de RF1/RF2 foram feitos pelo contrato HTTP e também na UI (Home + Treinos logo após o login; toque duplo em Regerar).

## Revisão de código (diff)

- RF1/RF2: o `UPDATE … WHERE workout_plan_basis IS NULL` / `IS DISTINCT FROM`, dentro da transação, serializa as requests concorrentes pela trava da linha do perfil. Isso bate com o observado ao vivo.
- Migration: `ENABLE ROW LEVEL SECURITY` + `torv_api_full_access` nas duas tabelas novas (`routine_exercise_sets`, `workout_sets`). As demais tabelas são alteradas, não criadas.
- 404 em recurso alheio: `findFirst`/`updateMany`/`deleteMany` filtram por `user_id`/`owner_user_id`; confirmado ao vivo.

## Retrabalho

- **Backend:** F1 (`workout.schemas.js:22`) + um teste que confira que `null` chega como `null` ao repository.
- **Frontend:** F2 (`ExercisePicker/styles.ts:12`).
- Próxima rodada: `docs/qa-workout-routines-2026-09-30-round2.md`, reexecutando só a carga NULL (API + editar na UI) e os chips do picker (412/320).
