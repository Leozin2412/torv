# QA — Regras do gerador de treino no banco — 2026-10-01

**Owner:** Torv Review and Tests · **Branch:** `feat/workout-module`, HEAD `6981c9d` · **Diff:** `git diff 40be50a..6981c9d`
- `6389ce3`: migration `20261001150000_workout_generator_rules`.
- `193b4f6`: sync de `BancoDeDadosTorv/`.
- `6981c9d`: o gerador lê o catálogo e os slots do banco; o `savePlan` usa `exercise_id`.

A API não mudou e o frontend não foi tocado. Contas **novas** desta rodada (todas `@torvtest.dev`):
- `qa.wgr.A.1790881499190`: F / Iniciante / Perder Peso
- `qa.wgr.B.1790881499190`: M / Avançado / Ganhar Massa
- `qa.wgr.C.1790881499190`: F / Avançado / Ganhar Massa
- `qa.wgr.U.1790881499190`: M / Iniciante / Perder Peso, usada na usabilidade

## Ambiente

- **Backend:** no Furnace (`localhost:3000`, nodemon). Não foi reiniciado e nenhuma outra instância foi aberta. **Expo web:** porta 8081. **Navegador:** portal "Torv Mobile #2", em 412×915 e 320×915.
- **Contrato:** feito por `fetch` dentro da página. Os tokens ficaram só em variáveis da página e nunca passaram pelo terminal.
- **Banco:** acessado via Prisma com o `DATABASE_URL` do `.env`, conectado como `torv_api`. Só usei `SELECT` em catálogo/metadados e `INSERT`/`UPDATE` dentro de transações que sempre terminam em ROLLBACK. Não li nenhum dado de usuário. A única leitura de linhas foi de exercícios próprios criados nesta rodada, buscados pelo id.
- **`FrontEndTorv/.env`:** está vazio e não foi editado.
  - O bundle servido agora não tem `EXPO_PUBLIC_API_URL`, então cai no fallback do `api.ts`.
  - Por causa da **mudança local do usuário em `FrontEndTorv/src/services/api.ts`**, esse fallback é `http://127.0.0.1:3000`, e não `10.0.2.2:3000`. O commit tem `localhost:3000`.
  - A aba que já estava aberta antes do reload tinha chamadas para `10.0.2.2:3000` e para `127.0.0.1:3000`.
- **Shim:** instalado **só na página** (hook em `XMLHttpRequest.open`). Ele reescreve `10.0.2.2:3000` e `127.0.0.1:3000` para `localhost:3000` e registra cada chamada com o status. Todas as chamadas do app vieram de `127.0.0.1:3000` e foram reescritas; nenhuma veio de `10.0.2.2`.
- **`FrontEndTorv/src/screens/Login/index.tsx`:** a mudança local só adiciona um espaço antes de `)` numa mensagem. Não afetou nada.
- **Sessão original do portal:** salvei uma cópia numa chave separada do `localStorage`. Para trocar de conta apaguei só `torv.session`, sem `/auth/logout`, para não revogar o token. No fim restaurei a sessão e o portal voltou à Home, logado, em 412×906.

## Veredito: PASS (100% verde)

Nenhuma falha. Só há observações, listadas no fim.

## (1) Automatizado

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ 80/80 |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ 14/14 |
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |

### Equivalência antes/depois (script fora do repo)

| Item | Resultado |
|---|---|
| `CATALOG`/`SLOTS` de `40be50a` × banco ao vivo (via `workoutRepository.getGeneratorRules()` real) | ✅ **Catálogo:** 71 itens com mesma ordem, grupo, tipo e nível (`C`/`I` → `COMPOSTO`/`ISOLADO`, rank → nome). **Slots:** os 101 iguais (`Todos` → `TODOS`). `position` vai de 1 a n em cada um dos 12 dias |
| `generatePlan` antigo × novo com as regras do banco | ✅ Saída idêntica para **460 entradas**: 4 sexos (M, F, outro, null) × 5 níveis (3 válidos + inválido + null) × 23 combinações de objetivos (nenhum, inválido, 1 e 2 objetivos). Em todas, `exercise_id` = id do catálogo para o slug |

## (2) Banco (só leitura + ROLLBACK)

| Item | Resultado |
|---|---|
| Catálogo (`owner_user_id IS NULL`) | ✅ 71 linhas. As 71 têm `type`, `min_level` e `catalog_order`. `catalog_order` vai de 1 a 71, com 71 valores distintos. 35 compostos e 36 isolados. Níveis: 42 INICIANTE, 25 INTERMEDIÁRIO, 4 AVANÇADO |
| Colunas novas em `exercises` | ✅ `type varchar(10)`, `min_level varchar(20)` e `catalog_order smallint`, todas nullable. Índice único `exercises_catalog_order_key` |
| `workout_template_slots` | ✅ **Linhas:** 101 (3 dias: 28; 4 dias: 30; 5 dias: 43). Por sexo: TODOS 83, M 6, F 6, N 6. **Colunas:** 8, todas NOT NULL e com os tipos da migration. **Chave:** PK (`days_per_week`, `day`, `position`) |
| Constraints | ✅ Todas com `convalidated = true`: as 5 CHECKs de `exercises` (muscle_group, catalog_or_owned, type, min_level, catalog_rules) e as 6 de slots (day, position, muscle_group, type, min_level, sex) |
| Exercício próprio | ✅ Os exercícios criados por A e B pela API ficaram com `slug`, `type`, `min_level` e `catalog_order` todos NULL |
| RLS | ✅ `relrowsecurity = true` em `workout_template_slots` (e em `exercises`). Policy única `torv_api_full_access`, com `TO torv_api`, `ALL`, `USING true` e `WITH CHECK true` |
| Privilégios | ✅ `anon`, `authenticated` e `public` não têm nenhum privilégio (`has_table_privilege` falso para os 7 tipos) nas duas tabelas. `torv_api` tem SELECT, INSERT, UPDATE e DELETE |

**Controles positivos:** dois INSERTs válidos foram aceitos e desfeitos com ROLLBACK: uma linha de catálogo com ordem 72 e um slot (3,1,11). Isso prova que as recusas abaixo vêm das regras, e não de falta de permissão.

**Recusas** (cada caso numa transação própria, sempre com ROLLBACK):

| Caso | Barrado por |
|---|---|
| Catálogo com `type`, `min_level` ou `catalog_order` NULL; `UPDATE` do catálogo com `type = NULL` | `exercises_catalog_rules_check` |
| Exercício próprio com `type`, `min_level` ou `catalog_order` preenchido | `exercises_catalog_rules_check` (avaliada antes da FK) |
| `type` `'OUTRO'` ou `'composto'` / `min_level` `'INTERMEDIARIO'` (sem acento) | `exercises_type_check` / `exercises_min_level_check` |
| `catalog_order` duplicado (1), `slug` duplicado | 23505 (`exercises_catalog_order_key` / `exercises_slug_key`) |
| Slot com PK duplicada (3,1,1) | 23505 (`workout_template_slots_pkey`) |
| Slot com `day` 0 ou `day` 4 em `days_per_week` 3 | `workout_template_slots_day_check` |
| Slot com `position` 0 / `muscle_group` `'Pescoço'` / `type` `'X'` / `min_level` `'X'` / `sex` `'Todos'` (grafia antiga) ou `'X'` | a CHECK correspondente |
| Slot com `session_name` ou `position` NULL / `session_name` de 51 caracteres | 23502 (NOT NULL) / `varchar(50)` |

**Depois dos testes:** o banco continua com 101 slots e 71 itens de catálogo (máximo 71). Nada vazou dos ROLLBACKs.

## (3) Contrato ao vivo (contas novas)

| Item | Resultado |
|---|---|
| **RF1** — A: 2× `GET /workouts/routines` em paralelo | ✅ 200/200. As duas respostas têm 3 rotinas com os mesmos ids; um 3º GET devolve o mesmo. `next_routine_id` = 1ª rotina, sem sugestão |
| A (Iniciante) = `generatePlan` com as regras do banco | ✅ 3 rotinas (Corpo todo A/B/C, 6 exercícios cada) com os mesmos `exercise_id`, ordem, reps 8–15, descanso 60/45 s e 3 séries |
| B (M/Avançado/Ganhar Massa) = aba `Gerador` | ✅ 5 rotinas, iguais ao esperado exercício por exercício: Push 7, Pull 8, Pernas 9, Superior 7, Inferior + Core 8 |
| **RF1 reforço** — C: 5 GETs em paralelo | ✅ 5× 200, 5 rotinas, ids idênticos em todas as respostas |
| C (F/Avançado) × B (M/Avançado) | ✅ Diferem **só** nos slots de sexo: 1 exercício trocado no Dia 4 (Superior) e 1 no Dia 5 (Inferior + Core). Os outros dias e os nomes das rotinas são iguais. O plano de C = `generatePlan` |
| Criar exercício próprio (A) | ✅ 201 com `is_custom: true` e nome aparado ("Meu exercício WGR A") |
| `GET /workouts/exercises` | ✅ A: 72 (71 do catálogo + o próprio). B: 72 (71 + o próprio de B, **sem** o de A). C: 71 |
| IDOR exercício | ✅ B: `PUT`/`DELETE` no exercício de A → 404/404. B criando rotina com o exercício de A → 400 `exercise not found` |
| Rotina com exercício próprio + catálogo (A) | ✅ 201. Cargas `[20.5, null]` e `[40]` |
| **RF2** — B: `PUT /profile {fitness_level: INTERMEDIÁRIO}` | ✅ `{has_suggestion: true, changed: ['fitness_level']}`. A sugestão sozinha não troca nenhuma rotina |
| **RF2** — 2× `POST /plan/accept` em paralelo | ✅ 200/200 (as duas respostas com 5 rotinas). Resultado: 4 rotinas default **novas** (ids diferentes) + "Minha B". Plano = `generatePlan(M/Intermediário/Ganhar Massa)`: Superior A 7, Inferior A 6, Superior B 6, Inferior B 7. Rotina própria idêntica byte a byte (90 s, `[20.5, null]`) |
| `accept` sem sugestão pendente | ✅ 200; ids iguais (nada muda) |
| Mudar `goal` → `dismiss` | ✅ `changed: ['goals']` → dismiss 200 → `has_suggestion: false`, defaults iguais. Nova mudança de nível → `changed: ['fitness_level']` |
| **Sessão** — A: POST válido e o mesmo corpo de novo | ✅ 201 → 200, com o mesmo `activity_id` |
| **Sessão** — 2 POSTs iguais em paralelo | ✅ 201 + 200 com o mesmo id; só +1 sessão (3 → 4) |
| `next_routine_id` após treinar o Dia 1 | ✅ Dia 2 — Corpo todo B |
| Sem token | ✅ 401 |

O 1º disparo do teste em paralelo saiu com 201 + 201. A causa foi um erro do script de QA: cada request calculou o seu próprio `started_at` (ms diferentes), então eram duas sessões legítimas. O teste foi refeito com o mesmo `started_at` e passou (linha acima). Esse 1º disparo deixou uma sessão a mais na conta A.

## (4) Usabilidade — conta U, logada pela tela de Login

| # | Item | 412 | 320 |
|---|---|---|---|
| 1 | Login pelo app (POST `/auth/login` 200) → Home com "Treino de hoje · Dia 1 — Corpo todo A · **Iniciar**". O 1º acesso gerou o plano pelo app (2 GETs de rotinas, ambos 200) | ✅ | ✅ card 166–300 ("Dia 1 — Empurrar (Push)", depois de regerar) |
| 2 | Aba Treinos: **Próximo** na 1ª rotina, **Padrão** nas 3; "6 exercícios · 18 séries" | ✅ `scrollWidth` 412 | ✅ cards 21–235, ▶ 235–283, "Nova rotina" 20–300, `scrollWidth` 320 |
| 3 | Abrir rotina padrão no editor (Dia 1: Leg press 45°, Supino reto com halteres, Puxada frontal, Desenvolvimento, Crucifixo peck deck (slot M), Abdominal crunch). Reps 8–15, descanso 1:00 / 0:45, 3 séries | ✅ | ✅ Dia 2 "Inferior A", inputs 20–290, sem overflow |
| 4 | Nova rotina → picker (71 do catálogo) → **Criar exercício** "Meu exercício WGR U" / Costas → 201 → aparece com a tag **Meu**. A busca "WGR" mostra só o de U (os de A e B não aparecem) | ✅ | ✅ chips num scroller horizontal (`overflow-x: auto`, 1354/320) |
| 4 | Adicionar o próprio + Leg press, carga "22,5" → salvar → "Rotina QA WGR · 2 exercícios · 6 séries". Ao reabrir: "22,5" mantido | ✅ | ✅ "Rotina 320 · 1 exercício · 3 séries" |
| 5 | Perfil → Intermediário → Treinos: banner "Novo treino padrão disponível / Seu nível físico mudou" → **Regerar** → confirmação → `POST /plan/accept` 200 → 4 rotinas padrão (Superior A 7 / Inferior A 6 / Superior B 6 / Inferior B 7) + a rotina própria. Banner some; Home passa a mostrar "Dia 1 — Superior A" | ✅ | — |
| 5 | Perfil → Avançado → banner (Regerar 37–155, Manter 163–283) → Regerar → confirmação (alert 24–296) → 5 rotinas Avançado (4 séries: "7 exercícios · 28 séries"…) + as 2 próprias | — | ✅ |
| 6 | Console | ✅ só 1 aviso `props.pointerEvents is deprecated` | ✅ vazio |

## (5) Documentação — `BancoDeDadosTorv/*.sql` × migrations `20260930200000` + `20261001150000`

Comparação automática contra o schema ao vivo, mais leitura do diff:

| Item | Resultado |
|---|---|
| Tabelas e colunas (`SQL BANCO DE DADOS.sql`) | ✅ `exercises` (8), `workout_routines` (6), `routine_exercises` (7), `routine_exercise_sets` (4), `workout_sets` (8) e `workout_template_slots` (8): nome, tipo, tamanho e NOT NULL iguais ao banco. `user_profiles.workout_plan_basis` e `activities.routine_id` documentados. PK composta dos slots documentada |
| CHECKs (`Regras BD.sql`) | ✅ As 17 CHECKs das 5 tabelas do módulo estão documentadas com os **mesmos literais** de `pg_get_constraintdef` (8 do `workout_module` + 9 do `workout_generator_rules`: 3 em `exercises` e 6 nos slots) |
| Constraints por nome | ✅ As 26 constraints c/f/u das tabelas do módulo + `activities` aparecem nos docs |
| Índices | ✅ Os 9 índices não-PK aparecem nos docs. **Únicos** (em `SQL BANCO DE DADOS.sql`): `exercises_slug_key`, `exercises_catalog_order_key` e `routine_exercise_sets_…_key`. **Parcial** `activities_strength_user_start_key` e os 4 `_idx` (passos 2.3 e 2.4) ficam em `Gestao_e_Performance.sql` |
| RLS (`Gestao_e_Performance.sql`) | ✅ ENABLE + `torv_api_full_access` em `routine_exercise_sets`, `workout_sets` e `workout_template_slots`, iguais ao banco (RLS on, 1 policy) |
| `Mock Dados.sql` | ✅ **Coerente com as CHECKs:** só insere exercícios próprios, com as 3 colunas NULL e grupos válidos; usa `is_default`/`position` e reps em faixa. **Slugs:** os 4 usados (`supino-reto-com-barra`, `triceps-testa`, `puxada-frontal-na-polia`, `agachamento-livre-com-barra`) existem no catálogo. **STRENGTH:** usa `routine_id` |
| Cabeçalhos | ✅ Os 3 arquivos listam as duas migrations novas |

## Observações (não bloqueantes)

- **INFO (ambiente):** o pedido dizia que o app cai em `10.0.2.2:3000`, mas o bundle servido hoje cai em `127.0.0.1:3000`, por causa da mudança local em `FrontEndTorv/src/services/api.ts:6`. Com o `api.ts` commitado, o fallback seria `localhost:3000`. O `.env` vazio continua sendo decisão do usuário.
- **INFO (backend/teste):** `BackEndTorv/src/lib/tests/workoutRules.js:24` lê as regras só da migration `20261001150000`. Os testes validam o arquivo da migration, não o banco. Se uma migration futura mudar o catálogo ou os slots, o helper precisa passar a ler a nova (o cabeçalho de `workoutGenerator.js:3` já avisa "atualize… e os testes"). A igualdade com o banco ao vivo foi verificada nesta rodada pelo script de equivalência.
- **INFO (banco):** o comentário de `BackEndTorv/prisma/migrations/20260930200000_workout_module/migration.sql:85` ("Tipo e nível mínimo ficam só em src/lib/workoutGenerator.js") ficou desatualizado. Migration aplicada não se edita; os docs e o `schema.prisma` já explicam o estado atual.
- **Fora do escopo (frontend, já existia):** a Home de uma conta nova mostra "Streak 12", "Caminhada matinal" e o feed mockados, enquanto o Perfil mostra streak 0. Depois de mudar o nível no Perfil abre o modal "Nova meta sugerida" (nutrição). Em 412, o toque seguinte na aba fechou o modal e disparou `POST /diet/targets/suggestion/dismiss` na conta U; em 320 escolhi "Manter atual".
- **Fora do escopo (layout):** em 320, as únicas folhas fora da largura são as do seletor de dias de My Diet ("DOM 27" / "QUI 1"), que fica dentro da aba inativa (`aria-hidden`).
- **Dados de teste:** as contas `qa.wgr.{A,B,C,U}.1790881499190@torvtest.dev` continuam no banco, porque não existe endpoint para apagar conta. Ficaram com:
  - as rotinas default;
  - 4 sessões em A (1 delas do disparo errado descrito em (3));
  - perfis com nível/objetivo alterados (B e U).
  
  Todas as rotinas e exercícios **próprios** criados nesta rodada foram apagados via API (204; as contas voltaram a 71 exercícios). Nenhum dado do usuário foi lido nem alterado.
