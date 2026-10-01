# QA — Módulo de treinos, entrega 2 (execução do treino) — 2026-09-30

**Owner:** Torv Review and Tests (Loupe) · **Plano:** Task 14 de `docs/superpowers/plans/2026-09-30-workout-module.md` · **Diff da entrega 2:** `362ecd0..95ecf6f` (536876f, 9c349aa, b67b3ee, 95ecf6f) + revisão de regressão de `main...feat/workout-module` · **Spec:** `docs/superpowers/specs/2026-09-30-workout-module-design.md`

## Veredito: FAIL (1 falha, Step 3 item 11) → não avança para Security

| # | Falha | Camada | Arquivo:linha |
|---|---|---|---|
| F1 | Console com erro vermelho do React DOM na aba Treinos: `In HTML, <button> cannot be a descendant of <button>. This will cause a hydration error.` O botão ▶ "Iniciar <rotina>" (`TouchableOpacity` com `accessibilityRole="button"`) está dentro do card "Editar <rotina>", que também é `TouchableOpacity` com role button. O HTML gerado é inválido (botão aninhado; leitores de tela anunciam controles sobrepostos). Funcionalmente, o toque no ▶ abre só a sessão, sem abrir o editor junto. | frontend | `FrontEndTorv/src/screens/Workouts/index.tsx:140` (▶), dentro do card de `FrontEndTorv/src/screens/Workouts/index.tsx:121`. Fix provável: tirar o ▶ de dentro do card (os dois lado a lado num `View` em linha) ou trocar o role do card |

Todos os outros itens do Task 14 passaram, inclusive os três obrigatórios (Review Focus 3, 4 e 5).

### Achados não bloqueantes

- **MEDIUM (frontend), `FrontEndTorv/src/screens/WorkoutSession/index.tsx:71`:** "Próximo exercício" / "Pular série" até acabar a rotina **sem nenhuma série feita** leva para o resumo. Lá aparecem "Treino concluído" e "0 séries", e o app dispara `POST /workouts/sessions` com `sets: []`, que volta `400`. A tela então mostra "Não foi possível salvar este treino." + **Descartar**. Nada é salvo e o usuário não fica preso, mas a spec (l. 243: "com 0 séries feitas apenas descarta o rascunho") e o fluxo de 400 (l. 250: "payload inválido, bug") indicam que esse caso deveria ir pelo descarte, como já acontece no "Finalizar treino".
- **Observação de produto (spec, sem falha de código):** `workouts_in_month` usa o mês em **UTC** (spec l. 181, `profile.repository.js`), e o trigger de streak usa `start_time::date` no fuso do banco. Às 20:17–21:20 BRT de 30/09 (já 01/10 em UTC), o efeito ao vivo foi este:
  - um treino iniciado às 20:16 BRT não entrou em "Este mês" (contou como setembro em UTC);
  - o Perfil lista os treinos como "30/09" (data local) enquanto "Este mês" conta como outubro;
  - treinos de 30/09 23:xx UTC e 01/10 00:xx UTC (a mesma noite local) somaram **streak 2** na conta SA.

  Não é regressão (o trigger é anterior), mas vale decidir o fuso antes do streak real na Home.
- **LOW (frontend):** "1 séries" sem singular no Perfil (`FrontEndTorv/src/screens/Profile/index.tsx:394`) e em "A seguir" na sessão (`FrontEndTorv/src/screens/WorkoutSession/index.tsx:165`).
- **LOW (frontend), `FrontEndTorv/src/screens/WorkoutSummary/index.tsx:89-93`:** o selo "Treino concluído" aparece mesmo com status `retry`/`invalid` (não salvo).
- **LOW (frontend), `FrontEndTorv/src/screens/WorkoutSummary/index.tsx:131`:** toque duplo em "Tentar de novo" envia dois POST. Inofensivo, porque o backend é idempotente (201 + 200 com o mesmo id); só registro.

### Notas dos implementadores (para Security, só registradas)

- (a) Task 10 trocou os `Union` nullable do `SessionBody` por `Type.Unsafe` com `type: ['string','null']` (`routine_id`) e `['integer','null']` (`rest_before_sec`), por causa do `coerceTypes`. Ao vivo: `rest_before_sec: null` grava `null`; `"60x"` → 400 `must be integer,null`; `routine_id: null` ou ausente → 201 "Treino livre"; `routine_id: "abc"` → 400 formato uuid.
- (b) `POST` sem token e com corpo inválido dá 400 antes do 401, o mesmo padrão dos outros plugins. Não testado à parte; fica com Security.

## Step 1 — Automatizado: PASS

- `BackEndTorv: npm test` → 80/80.
- `FrontEndTorv: node --test src/utils/*.test.mjs` → 14/14; `npx tsc --noEmit` → sem erros.

## Step 2 — Contrato HTTP (fetch via `maestri portal evaluate`, tokens só na página): PASS

Contas criadas pelo próprio `POST /auth/register` do app, a partir da página: `qa.workout.SA.1790813754173@torvtest.dev`, `qa.workout.SB.1790813755431@torvtest.dev`.

| Item | Resultado |
|---|---|
| **RF3** — `POST /sessions` válido; o mesmo corpo de novo | ✅ 201 → 200 com o **mesmo** `activity_id`; `/profile`: `total_workouts` 0→1, `streak` 0→1 (subiu 1, não 2) |
| 2 POSTs iguais em paralelo | ✅ 201 + 200, mesmo `activity_id`; `total` subiu só 1 (1→2), streak seguiu 1 |
| Detalhe | ✅ `GET /sessions/:id`: título da rotina, `duration_sec`, séries em ordem, `rest_before_sec` null na 1ª |
| `next_routine_id` após treino do Dia 1 | ✅ aponta para o Dia 2 |
| **RF5** — `routine_id` de rotina apagada + `exercise_id` próprio apagado | ✅ 201, `title` "Treino livre", série gravada como "Exercício removido"; a série do catálogo mantém o nome |
| IDOR: B envia sessão com rotina e exercício próprio de A | ✅ 201 gravado sem vínculo: "Treino livre" / "Exercício removido"; os nomes "ROTINA SECRETA A" / "SEGREDO de A" não aparecem; o id é diferente do de A |
| IDOR: B `GET /sessions/<id de A>` / `GET /sessions` | ✅ 404 / só a sessão de B |
| Limites → 400 | ✅ `started_at` 2025-12-31, +10 min, "ontem"; `duration_sec` 0 e 21601; 0 e 201 séries; série 3601; descanso 7201 e −1; `position` 0 e 21; `set_number` 11; `exercise_id`/`routine_id` não-UUID |
| Bordas válidas | ✅ `started_at` +4 min → 201; `routine_id` null/ausente → 201 |
| `GET /sessions?limit=51` / `limit=0` / sem limit / `limit=2` | ✅ 400 / 400 / até 10 (6 na conta, mais recente primeiro) / 2 |
| sem token / id inválido | ✅ 401 / 400 |

## Step 3 — Usabilidade no navegador (portal "Torv Mobile #2", 412×915; visuais repetidos em 320)

Conta `qa.workout.SC.1790813845583@torvtest.dev`, logada pela tela de Login do app, **sem shim** (API em `192.168.29.69:3000`). As falhas de rede do item 10 e de RF3 foram simuladas **só na página**, com um hook no `XMLHttpRequest` (o servidor não foi parado).

| # | Item | Resultado |
|---|---|---|
| 1 | Home: card mostra "Dia 1 — Corpo todo A" + **Iniciar** → abre a sessão; Total corre (0:02 → 0:05) | ✅ |
| 2 | Iniciar série → Terminei → "Descanso … alvo 1:00"; depois de 1:00, caixa vermelha (`rgb(255,69,58)`) com números em branco sobre ela; "Acabou o descanso — iniciar série 2" → caixa volta ao cinza | ✅ |
| 3 | **RF4** — reload com 70 s de descanso (já vermelho) → Home "Treino em andamento / Continuar treino"; Treinos mostra o banner (e esconde o ▶ das rotinas) → **Continuar** → descanso em **1:27**, seguindo do timestamp original, ainda vermelho | ✅ |
| 4 | Pular série (3ª do Leg press) e Próximo exercício (Supino inteiro) → o resumo só tem Leg press S1, S2 e Puxada S1 | ✅ |
| 5 | **RF5** — rotina própria; depois da 1ª série, o exercício próprio foi apagado via `fetch` (204) → treino seguiu → resumo salvou (201); no histórico: "Exercício removido" ×2 + "Abdominal crunch (solo)" | ✅ |
| 6 | Finalizar → resumo (2:15, 3 séries, descanso médio 0:54; "descanso 1:37" em vermelho, "0:10" em cinza) → **Concluir** volta para Treinos; **Próximo** passou para o Dia 2 | ✅ |
| 7 | Perfil: "Atividade Física" lista os 4 treinos (título, data, min, séries); abrir → resumo do histórico sem selo e sem vermelho; contadores "4 treinos" / "Este mês 4" / streak 1 batem com a API | ✅ (ver observação UTC e LOW "1 séries") |
| 8 | Iniciar → Finalizar sem séries → "Descartar treino? Nenhuma série foi feita…" → Descartar → nenhuma sessão nova, rascunho apagado | ✅ (a variante "pular tudo" está no MEDIUM acima) |
| 9 | Iniciar, 1 série, sair do treino (rascunho = 1) → **Sair da conta** → `localStorage` sem o rascunho → login de novo → sem banner na Home nem em Treinos | ✅ |
| 10 | Falha de rede no POST (hook redireciona para porta morta) → "Não foi possível salvar. O treino continua guardado no aparelho." + **Tentar de novo** / Voltar depois; rascunho `phase: done` no `localStorage` → hook removido → Tentar de novo (toque duplo) → 201 + 200, mesmo id; 2→3 sessões (uma só), rascunho apagado, Concluir | ✅ |
| 10b | **RF3 resposta perdida** — o hook deixa o POST real chegar (201, `0c587bea…`) mas entrega erro de rede à página → Tentar de novo aparece, rascunho mantido → hook removido → Tentar de novo → **200 com o mesmo id**; 4 sessões, `total_workouts` 4, streak 1 | ✅ |
| 11 | Console sem erros vermelhos | ❌ **F1** (`<button>` dentro de `<button>` na aba Treinos). Nenhum outro erro; só o aviso antigo de `pointerEvents` |

**320 px:** Treinos (cards + ▶ + banner Continuar/Descartar 40–157 / 165–283), sessão (Total e Descanso empilhados 20–290, botão "Acabou o descanso — iniciar série 2" sem corte), resumo e Perfil: `scrollWidth` 320 e nenhum elemento visível passa da largura. A única folha fora da largura é o chip "Parques" do feed da Home, que já existia e rola na horizontal. ✅

### Checagens feitas só no navegador

Todo o Step 3. Também foi só no navegador:
- a prova de RF4 (timestamp do rascunho + valor do cronômetro após o reload);
- as cores (por `getComputedStyle`);
- o cenário de resposta perdida (hook de XHR);
- o erro de console F1.

O Step 2 foi feito por `fetch` na página. O `screenshot` do portal não renderiza com a janela minimizada, então as checagens visuais foram por medição de DOM e cor computada.

## Regressão da entrega 1 (diff completo)

- `GET /workouts/exercises` = 71; `weight_kg` `[null, 0]` volta `[null, 0]`; chips do picker com 44 px e clicáveis (`elementFromPoint`); plano default gerado para a conta nova (3 rotinas, Próximo/Padrão).
- A aba Treinos e a Home mudaram (banner de rascunho, ▶, card "Continuar treino"); listagem, Nova rotina e Editar continuam funcionando.
- A Home some/atualiza o card ao focar. Na árvore escondida da Home (tab inativa), o texto "Treino em andamento" pode ficar antigo até o próximo foco, mas não é visível.
- Backend: o diff de `profile.repository.js` só acrescenta dois `count`; o resto do perfil fica intacto (nome, streak, peso/altura conferidos na tela).

## Revisão de código (entrega 2)

- Idempotência: `findSessionByStart` + índice único parcial `activities_strength_user_start_key (user_id, start_time) WHERE activity_type='STRENGTH'` + tratamento de `P2002` na corrida. Confirmado ao vivo (paralelo e resposta perdida).
- `createSession` só vincula rotina e exercícios visíveis ao usuário; `exercise_name` vem do banco. Confirmado no IDOR.
- `workoutSession.ts`: todos os tempos derivam de timestamps (`phase_started_at`, `started_at`), a base de RF4; tetos do payload (`MAX_*`) evitam 400 em rascunho retomado horas depois.
- Logout explícito apaga o rascunho (`AuthContext.tsx`); expiração de sessão não apaga (spec l. 260).

## Dados de teste

Removidos: exercícios/rotinas próprios de SA ("SEGREDO de A", "ROTINA SECRETA A", "QA tmp") e de SC ("QA Sessão Própria", "QA Própria Sessão"), e a rotina de regressão "reg". Mantidos: as sessões (`activities`) das contas `qa.workout.SA/SB/SC.*@torvtest.dev`, porque não há endpoint de exclusão de sessão. São só de contas de teste. A sessão original do portal foi restaurada.

## Retrabalho

- **Frontend:** F1 (`Workouts/index.tsx:121/140`). O MEDIUM de "pular tudo" fica recomendado para a mesma rodada, se o Maestro quiser.
- Próxima rodada: `docs/qa-workout-session-2026-09-30-round2.md`, reexecutando o item 11 (console) e o ▶ / Editar na aba Treinos em 412 e 320.
