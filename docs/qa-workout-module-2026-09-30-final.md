# QA — Módulo de treinos — rodada FINAL completa — 2026-09-30

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, HEAD `cb2112a` (último código: `d6bdbc1`) · **Plano:** Task 8 (Steps 1–3) e Task 14 (Steps 1–3) de `docs/superpowers/plans/2026-09-30-workout-module.md` + Review Focus 1–5 + re-checagem dos fixes anteriores · **Spec:** `docs/superpowers/specs/2026-09-30-workout-module-design.md`

Tudo foi refeito do zero, com **contas novas** desta rodada:
- `qa.workout.FA.1790815851298@torvtest.dev` (F/Iniciante)
- `qa.workout.FB.1790815852913@torvtest.dev` (M/Avançado/Ganhar Massa)
- `qa.workout.FC.1790815853135@torvtest.dev` (F/Intermediário)
- `qa.workout.FD.1790815942605@torvtest.dev` (usabilidade)
- `qa.workout.GA.1790815909119@torvtest.dev` e `qa.workout.GB.1790815909404@torvtest.dev` (contrato de sessões)

Ambiente:
- Backend no terminal "Backend Server", Expo web em 8081, login pelo app **sem shim**.
- Portal "Torv Mobile #2", 412×915; visuais repetidos em 320.
- Contrato por `fetch` na página, com o token só no navegador.
- Backend fora do ar e resposta perdida simulados **só na página**, com hook de XHR; o servidor não foi parado.

## Veredito: PASS (100% verde)

Nenhuma falha bloqueante. Há só observações, listadas no fim.

## Automatizado (Task 8 Step 1 / Task 14 Step 1)

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 80/80 |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 14/14 |
| `FrontEndTorv: npx tsc --noEmit` | ✅ sem erros |

## Entrega 1 — rotinas

### Contrato HTTP (Task 8 Step 2)

| Item | Resultado |
|---|---|
| **RF1** — conta nova FA: 2× `GET /routines` em paralelo | ✅ 3 + 3 rotinas, mesmos ids, 3º GET igual; `next_routine_id` = 1ª; sem sugestão |
| RF1 reforço — FC: 5 GETs em paralelo | ✅ 4 rotinas nas 5 respostas, ids idênticos |
| Smoke Task 4 Step 9: catálogo | ✅ 71 exercícios, todos `is_custom: false`, 12 grupos |
| FB (M/Avançado/Ganhar Massa) = aba `Gerador` | ✅ 5 rotinas, mesmos exercícios e ordem da planilha (Push 7, Pull 8, Pernas 9, Superior 7, Inferior+Core 8), 4 séries, 6–12 reps, 120 s compostos / 60 s isolados |
| **RF2** — `PUT /profile {fitness_level}` → sugestão | ✅ `{has_suggestion: true, changed: ['fitness_level']}` |
| **RF2** — 2× `POST /plan/accept` em paralelo | ✅ 200/200 com 6 rotinas (5 default novas + própria); rotina própria intacta (`[20.5, null]`, 90 s) |
| `accept` sem sugestão pendente | ✅ ids das default iguais (nada muda) |
| Mudar + `dismiss` → nova mudança | ✅ `has_suggestion: false`, defaults iguais; mudança de `goal` → `changed: ['goals']` |
| Nome com espaços (rotina e exercício) | ✅ volta aparado ("Rotina FA", "Meu exercício FA") |
| IDOR FB→FA: GET/PUT/DELETE rotina, PUT/DELETE exercício próprio, PUT/DELETE exercício do catálogo | ✅ todos 404; FA continua com a rotina (200) |
| IDOR: rotina com exercício de outra conta / listagem | ✅ 400 `exercise not found` / FB lista 71, sem o de FA |
| Limites → 400 | ✅ nome vazio, só espaços, 101; 0 e 21 exercícios; 0 e 11 séries; reps 0, 101, 8.5, mín > máx; descanso −1 e 601; carga −1, 1000, "abc"; id não-UUID; UUID inexistente; grupo inválido; exercício com nome em branco / 101; PUT com nome em branco; `GET/PUT /routines/abc`, `DELETE /exercises/abc`. Sem token → 401 |
| Borda válida | ✅ nome 100, 20 exercícios × 10 séries, reps 1–100, descanso 600, carga 999.99 → 201 |
| **Fix** carga NULL | ✅ POST `[null, 0, 5]` → resposta e GET `[null, 0, 5]`; PUT `[5, null]` → `[5, null]` |
| Excluir exercício próprio usado numa rotina | ✅ 204; some da rotina |
| Apagar todas → GET | ✅ 4 × 204 → 0 rotinas, `next_routine_id: null`, segundo GET também 0 (não regera) |

### Usabilidade (Task 8 Step 3) — conta FD, logada pela tela de Login

| # | Item | 412 | 320 |
|---|---|---|---|
| 1 | Home "Treino de hoje: Dia 1 — Corpo todo A" (botão **Iniciar**, desde a entrega 2) → aba Treinos lista as rotinas | ✅ | ✅ card 166–300 |
| 2 | **Próximo** na 1ª, **Padrão** em todas; 4 abas cabem | ✅ | ✅ abas 20–300, `scrollWidth` 320 |
| 3 | Nome vazio / só espaços → "Dê um nome para a rotina."; **fix:** o erro some ao digitar | ✅ | — |
| 3 | Sem exercício → "Adicione pelo menos um exercício."; **fix:** some ao adicionar | ✅ | — |
| 3 | **Fix chips:** 44 px, `elementFromPoint` acerta o chip; toque real em "Costas" filtra (busca "remada" → só Costas; chip + busca combinam) | ✅ | ✅ (72 linhas na lista) |
| 3 | Exercício próprio criado no picker (tag **Meu**), adicionado à rotina | ✅ | — |
| 3 | Reps, descanso ±15 s (`m:ss`: 1:15 / 0:45), cargas "22,5"/"0"/"7,5"/vazio, −Série, Subir → salvar → "QA Final · 2 exercícios · 5 séries" | ✅ | editor ✅ sem overflow |
| 4 | Editar → valores iguais: reps 12–15/6–10, 0:45/1:15, **"7,5"**, **""**, **"22,5"**, **"0"** (fix vírgula/null) | ✅ | — |
| 4 | Excluir → "Excluir rotina? Ela sai da sua lista. O histórico de treinos continua." → some | ✅ | — |
| 5 | Perfil → Intermediário → banner "Novo treino padrão disponível / Seu nível físico mudou" → Regerar → confirmação → **toque duplo** → 4 padrão novas + "Minha FD" | ✅ | — |
| 5 | Avançado → **Manter** → banner some; Home → Treinos (refoco) → não volta | ✅ | — |
| 6 | Console sem erros vermelhos | ✅ | — |

## Entrega 2 — execução do treino

### Contrato HTTP (Task 14 Step 2) — contas GA/GB

| Item | Resultado |
|---|---|
| **RF3** — POST válido; o mesmo corpo de novo | ✅ 201 → 200 com o **mesmo** `activity_id`; `total_workouts` 0→1, `streak` 0→1 |
| 2 POSTs iguais em paralelo | ✅ 201 + 200, mesmo id; `total` +1 só (1→2), streak 1 |
| Detalhe da sessão | ✅ título, duração, séries em ordem, 1º descanso `null` |
| `next_routine_id` após o Dia 1 | ✅ Dia 2 |
| **RF5** — rotina apagada + exercício próprio apagado | ✅ 201, "Treino livre", "Exercício removido" (o do catálogo mantém o nome) |
| IDOR: GB com rotina e exercício de GA | ✅ 201 sem vínculo ("Treino livre"/"Exercício removido"), nomes de GA não aparecem |
| IDOR: GB `GET /sessions/<GA>` / lista | ✅ 404 / só a sessão de GB |
| Limites → 400 | ✅ `started_at` 2025-12-31, +10 min, inválido; `duration_sec` 0 e 21601; 0 e 201 séries; série 3601; descanso 7201 e −1; `position` 0/21; `set_number` 11; ids não-UUID; descanso `"60x"` |
| Bordas válidas | ✅ `rest_before_sec: null`, `routine_id` null/ausente, `started_at` +4 min → 201 |
| `limit=51` / `limit=0` / sem limit / `limit=2` / sem token / id inválido | ✅ 400 / 400 / até 10, mais recente primeiro / 2 / 401 / 400 |

### Usabilidade (Task 14 Step 3) — conta FD

| # | Item | 412 | 320 |
|---|---|---|---|
| 1 | Home **Iniciar** → sessão; Total corre | ✅ | — |
| 2 | Série → Terminei → "Descanso … alvo 1:00"; >1:00 → caixa vermelha (`rgb(255,69,58)`); "Acabou o descanso — iniciar série 2" → volta ao cinza | ✅ | — |
| 3 | **RF4** — reload com 73 s de descanso → Home "Treino em andamento / Continuar treino"; Treinos: banner + ▶ escondidos → Continuar → descanso **1:24**, seguindo do timestamp original, vermelho | ✅ | — |
| 4 | Pular série + Próximo exercício → o resumo só tem as séries feitas | ✅ | — |
| 5 | **RF5** — rotina com exercício próprio, apagado via `fetch` após a 1ª série → salvo; histórico "Exercício removido" ×2 + catálogo | ✅ | — |
| 6 | Resumo (1:50, 3 séries, descanso médio 0:49; "1:34" vermelho, "0:04" cinza), **selo "Treino concluído" com saved** → Concluir → Treinos; **Próximo** → Dia 2 | ✅ | resumo sem overflow ✅ |
| 7 | Perfil: "3 treinos", "Este mês 3", streak 1 (= API); lista "1 série" / "3 séries"; histórico abre sem selo e sem vermelho | ✅ | ✅ |
| 8 | Finalizar sem séries → "Descartar treino?" → nada salvo, rascunho apagado | ✅ | — |
| 8b | **Fix** pular tudo com 0 séries → "Descartar treino?"; **Cancelar** mantém (botão principal acessível); Descartar → **sem POST**, rascunho apagado | ✅ | — |
| 9 | Treino em andamento → Sair da conta (`localStorage` vazio) → login → sem banner, ▶ visíveis | ✅ | — |
| 10 | Rede fora no POST → "Não foi possível salvar. O treino continua guardado no aparelho." + Tentar de novo / Voltar depois; **sem selo**; rascunho `done` guardado. Voltar depois → banner → Continuar → tenta de novo (falha). Hook removido → Tentar de novo ×2 → 201 + 200, mesmo id, **1** sessão a mais, selo aparece | ✅ | — |
| 10b | **RF3 resposta perdida** — POST real 201 com erro entregue à página → Tentar de novo (rascunho mantido, sem selo) → 200 com o mesmo id; sessões 3, `total` 3, streak 1 | ✅ | — |
| 10c | **Fix selo** — `invalid` (hook troca o corpo por `{}` → 400 real) → "Não foi possível salvar este treino." + Descartar, **sem selo**; Descartar → nada salvo | ✅ | — |
| 11 | Console sem erros vermelhos (lido em 3 pontos, inclusive repetindo sessão → falha → retry → histórico) | ✅ | — |
| — | **Fix ▶ fora do card:** nenhum `[role=button]` dentro de `[role=button]`; toque real no card → editor, no ▶ → só a sessão | ✅ ▶ 327–375 | ✅ ▶ 235–283, card → editor, ▶ → sessão |
| — | Sessão em 320: Total/Descanso empilhados 20–290, botão "Acabou o descanso — iniciar série 2" sem corte, "A seguir … · 3 séries"; banner Continuar/Descartar 40–157 / 165–283 | — | ✅ |
| — | **Fix singulares:** "1 exercício · 1 série" (lista), "· 1 série" (Perfil e "A seguir") | ✅ | — |

## Checagens feitas só no navegador

Todo o Step 3 das duas entregas. Também foram só no navegador:
- a prova de RF4 (timestamp do rascunho no `localStorage` + valor do cronômetro após o reload);
- as cores (por `getComputedStyle`);
- os cenários de rede fora, resposta perdida e 400 (hooks de XHR na página);
- a ausência de POST no descarte (log de XHR);
- a altura e o acerto dos chips (`getBoundingClientRect` / `elementFromPoint`);
- o aninhamento de botões (DOM);
- o console.

O `screenshot` do portal não renderiza com a janela minimizada, então o layout em 412/320 foi validado por medição de DOM (`scrollWidth`, posições, overflow das folhas visíveis). A única folha fora da largura é o chip "Parques" do feed da Home, que já existia e rola na horizontal.

## Observações (não bloqueantes)

- **Spec/produto (MEDIUM, sem mudança de código pedida):** `workouts_in_month` usa o mês em UTC (spec l. 181, `BackEndTorv/src/repository/profile.repository.js`) e o trigger de streak usa `start_time::date` no fuso do banco. Ao vivo (≈21h–22h BRT de 30/09 = 01/10 UTC):
  - na conta GA, o 1º treino não entrou em "Este mês";
  - treinos da mesma noite local somaram **streak 2**;
  - o Perfil mostra "30/09" (data local) e conta esses treinos em outubro.

  Vale definir o fuso antes do streak real na Home.
- **LOW (frontend, pré-existente, fora do escopo):** "+0 vs mês passado" fixo no Perfil (`FrontEndTorv/src/screens/Profile/index.tsx:306`).
- **LOW (frontend):** toque duplo em "Tentar de novo" e em "Regerar" envia duas requests. É inofensivo, porque o backend é idempotente nos dois casos (confirmado).
- **Ambiente:** como não existe endpoint para apagar conta, as contas `qa.workout.FA/FB/FC/FD/GA/GB.*@torvtest.dev` continuam no banco, com rotinas default e sessões de teste. Todas as rotinas e exercícios **próprios** criados nesta rodada foram apagados via API (FC, GA, FD). A sessão original do portal (conta do usuário) **não foi restaurada**, por um erro do harness: o backup do `localStorage` não foi gravado antes da troca de conta. O portal ficou deslogado na tela de Login; basta logar de novo. Nenhum dado do usuário foi alterado.
