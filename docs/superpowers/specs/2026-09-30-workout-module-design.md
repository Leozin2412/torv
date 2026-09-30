# Módulo de Treinos (rotinas default, rotinas próprias e execução com cronômetros) — Design

Branch: `feat/workout-module`.

## Contexto

O schema já tem `exercises`, `workout_routines`, `routine_exercises` e `activities`, mas nada usa as três primeiras (só dados de teste, confirmados pelo usuário como descartáveis). `activities` tem dois triggers `AFTER INSERT` que já atualizam `user_streaks` e `group_rankings`. Na Home, o card "Treino de hoje" é mock; no Perfil, "Atividade Física" é mock e `total_workouts`/`workouts_in_month` voltam fixos em `0` (`profile.controller.js`).

Fonte das regras do treino padrão: `BackEndTorv/treino_padrao_referencia.xlsx` (abas `Algoritmo`, `Niveis`, `Objetivos`, `Sessoes`, `Exercicios`, `Gerador`).

Dados do perfil usados (já existem): `user_profiles.gender` (`'Masculino'` | `'Feminino'`), `fitness_level` (`'INICIANTE'` | `'INTERMEDIÁRIO'` | `'AVANÇADO'`), `goal` (objetivos separados por `", "`).

Escopo: só musculação.

## Decisões (via brainstorm)

| Pergunta | Decisão |
|---|---|
| Quando gerar o treino padrão | Lazy: na primeira leitura das rotinas após o login (mesmo padrão das metas de nutrição). Vale para contas existentes. Gera uma vez; apagar as rotinas não recria |
| O que a sessão registra por série | **Só tempos**: duração da série, descanso antes dela, tempo total do treino. Carga e reps feitas não são registradas |
| Onde fica a carga | Na rotina, **por série** do exercício (`routine_exercise_sets.weight_kg`). Reps (faixa mín–máx) e descanso ficam por exercício |
| Perfil muda (nível/objetivo/sexo) | **Sugere** regerar (banner na aba Treinos). Aceitar apaga as rotinas default (inclusive editadas) e gera de novo; rotinas próprias intactas. Recusar some até a próxima mudança |
| App morto no meio do treino | Rascunho local no aparelho (AsyncStorage) a cada mudança de estado; envio ao servidor só ao finalizar. Rascunho some após o servidor confirmar, ao descartar e no logout |
| Onde mora o gerador | JS puro no backend (`workoutGenerator.js`), igual `nutritionCalculator.js`. Descartadas: plpgsql (difícil de testar) e parâmetros em tabelas (sem tela de admin que justifique) |
| Catálogo no banco | Só nome, grupo muscular e slug. **Tipo** (Composto/Isolado) e **nível mínimo** vivem só dentro do gerador (o algoritmo precisa deles para casar slots e definir descanso). Equipamento e grupos secundários ficam de fora |
| Histórico | Resumo ao finalizar + seção "Atividade Física" do Perfil com treinos recentes (tocar abre o resumo) + contadores reais do Perfil |

## Fora do escopo

Cardio (inclusive o cardio semanal da planilha), RIR, progressão de carga, checagem de volume semanal, streak real no card da Home, notificação/vibração no fim do descanso, manter a tela acesa, reordenar rotinas, carga/reps realizadas na sessão.

## Banco — torv-database

Uma migration Prisma, Postgres puro. RLS + policy `torv_api_full_access` na tabela nova, igual às demais (`20260925180000_lock_down_public_schema`).

**Antes de alterar:** `DELETE` das linhas atuais de `routine_exercises`, `workout_routines` e `exercises` (dados de teste, confirmado pelo usuário).

### `exercises` (alterada)

| Coluna | Mudança |
|---|---|
| `slug` VARCHAR(80) NULL UNIQUE | nova. Chave estável do catálogo; NULL em exercício próprio |
| `owner_user_id` UUID NULL → `users(id)` ON DELETE CASCADE | nova. NULL = catálogo global; preenchida = exercício próprio, visível só ao dono |
| `muscle_group` | vira NOT NULL + CHECK nos 12 grupos: `Peito`, `Costas`, `Ombros`, `Bíceps`, `Tríceps`, `Quadríceps`, `Posterior de coxa`, `Glúteos`, `Panturrilha`, `Abdômen`, `Lombar`, `Antebraço` |
| CHECK | `slug IS NULL OR owner_user_id IS NULL` |
| índice | `(owner_user_id)` |

**Seed:** os 71 exercícios da aba `Exercicios` (nome, grupo principal). Regra do slug: nome em minúsculas, sem acento, todo trecho não alfanumérico vira `-`, sem `-` nas pontas. Ex.: `Barra fixa (pull-up)` → `barra-fixa-pull-up`; `Extensão lombar (banco 45°)` → `extensao-lombar-banco-45`.

### `workout_routines` (alterada)

- `+ is_default` BOOLEAN NOT NULL DEFAULT false — rotina gerada pelo plano padrão.
- `+ position` INT NOT NULL — ordem. Default: 1..N; própria: `max(position do usuário) + 1`.
- `+ created_at` TIMESTAMPTZ DEFAULT now().
- `- day_of_week` (não usada).

### `routine_exercises` (alterada)

- `+ position` INT NOT NULL — ordem na rotina.
- `+ reps_min`, `+ reps_max` INT NOT NULL — CHECK `1..100` e `reps_min <= reps_max`.
- `+ rest_sec` INT NOT NULL — CHECK `0..600`.
- `- sets`, `- reps`.
- FK `exercise_id` continua ON DELETE CASCADE (apagar exercício próprio remove das rotinas).

### `routine_exercise_sets` (nova)

| Coluna | Tipo |
|---|---|
| `id` | UUID PK `gen_random_uuid()` |
| `routine_exercise_id` | UUID NOT NULL → `routine_exercises(id)` ON DELETE CASCADE |
| `set_number` | INT NOT NULL, CHECK `1..10` |
| `weight_kg` | DECIMAL(6,2) NULL, CHECK `0..999.99` |

UNIQUE `(routine_exercise_id, set_number)`. Nº de séries = nº de linhas.

### `user_profiles` (alterada)

- `+ workout_plan_basis` JSONB NULL — `basis` da última geração/decisão. NULL = plano nunca gerado.

### `activities` (alterada)

- `+ routine_id` UUID NULL → `workout_routines(id)` ON DELETE SET NULL.
- Índice único parcial `(user_id, start_time) WHERE activity_type = 'STRENGTH'` — idempotência do `POST /workouts/sessions`. Como o Prisma 6 não modela índice parcial, ele vai por SQL na migration (mesma situação do `ix_food_logs_user_id_date ... INCLUDE` que já existe).

### `workout_sets` (nova)

| Coluna | Tipo |
|---|---|
| `id` | UUID PK `gen_random_uuid()` |
| `activity_id` | UUID NOT NULL → `activities(id)` ON DELETE CASCADE |
| `exercise_id` | UUID NULL → `exercises(id)` ON DELETE SET NULL |
| `exercise_name` | VARCHAR(100) NOT NULL — cópia do nome no momento do treino |
| `position` | INT NOT NULL — ordem do exercício no treino |
| `set_number` | INT NOT NULL |
| `duration_sec` | INT NOT NULL, CHECK `0..3600` |
| `rest_before_sec` | INT NULL, CHECK `0..7200` — NULL na primeira série do treino |

Índice `(activity_id)`.

## Backend — torv-backend

Plugin novo `src/routes/workout.routes.js` registrado com prefixo `/workouts`, `authenticateToken` no `preHandler`, schemas TypeBox. Camadas `controller/workout.controller.js` → `repository/workout.repository.js`. `node --test` para os testes.

### Gerador — `src/lib/workoutGenerator.js`

Função pura, sem I/O:

```
generatePlan({ gender, fitnessLevel, goals })
  → { basis, routines: [{ name, position, exercises: [{ slug, position, reps_min, reps_max, rest_sec, set_count }] }] }

buildBasis({ gender, fitnessLevel, goals }) → { fitness_level, goals, gender }
```

#### Constantes (espelho da planilha)

`LEVELS` (aba `Niveis`; a ordem é o ranking):

| Nível | Frequência (dias) | Séries por exercício |
|---|---|---|
| INICIANTE | 3 | 3 |
| INTERMEDIÁRIO | 4 | 3 |
| AVANÇADO | 5 | 4 |

`GOALS` (aba `Objetivos`):

| Objetivo | Prioridade | Reps mín | Reps máx | Descanso composto (s) | Descanso isolado (s) | Freq. máx | Nível máx |
|---|---|---|---|---|---|---|---|
| Ganhar Massa Muscular | 1 | 6 | 12 | 120 | 60 | 7 | AVANÇADO |
| Perder Peso | 2 | 8 | 15 | 60 | 45 | 7 | AVANÇADO |
| Aumentar Resistência | 3 | 15 | 25 | 45 | 30 | 7 | AVANÇADO |
| Melhorar Condicionamento | 4 | 12 | 20 | 45 | 30 | 7 | AVANÇADO |
| Criar uma Rotina | 5 | 10 | 15 | 75 | 60 | 3 | INICIANTE |
| Saúde & Bem-estar | 6 | 10 | 15 | 75 | 60 | 3 | INTERMEDIÁRIO |

`SLOTS`: todas as linhas da aba `Sessoes`, na ordem, com `{ days, day, session, group, type, minLevel, sex }` (`sex` ∈ `Todos`, `M`, `F`, `N`).

`CATALOG`: as 71 linhas da aba `Exercicios`, na ordem, com `{ slug, group, type, minLevel }` (slug pela regra do seed).

#### Algoritmo (aba `Algoritmo`, passos 1–9)

1. `goals` normalizado: string do banco (`"Perder Peso, Criar uma Rotina"`) ou array; nomes fora de `GOALS` ignorados; lista vazia → `['Saúde & Bem-estar']`.
2. `principal` = objetivo com menor prioridade.
3. `nivel` = `fitnessLevel` se estiver em `LEVELS`, senão `INICIANTE`. `nivelEf` = menor rank entre `nivel` e `principal.nivelMax`.
4. `freq` = `min(LEVELS[nivelEf].frequencia, principal.freqMax)`.
5. `sx` = `'Masculino'` → `M`, `'Feminino'` → `F`, qualquer outro → `N`.
6. `slots` = `SLOTS` com `days == freq`, `rank(minLevel) <= rank(nivelEf)` e `sex ∈ {'Todos', sx}`, na ordem.
7. `elegiveis[group][type]` = `CATALOG` com `rank(minLevel) <= rank(nivelEf)`, na ordem.
8. Para cada slot: `cont[group,type]++`; se passar de `len(elegiveis[group][type])` descarta; senão exercício = `elegiveis[group][type][cont - 1]`.
9. Agrupa por `day` → uma rotina por dia: `name = "Dia {day} — {session}"`, `position = day`. Cada exercício: `set_count = LEVELS[nivelEf].series`, `reps = principal.reps`, `rest_sec = principal.descanso[type]`, `position` = ordem no dia.

`basis` = `{ fitness_level: nivel, goals: goals normalizados ordenados alfabeticamente, gender: sx }`. Ordenar os objetivos evita sugestão falsa por ordem de seleção.

### Repository / regras

- **`ensureDefaultPlan(userId)`** — chamado no `GET /workouts/routines`. Se `workout_plan_basis` não é NULL → nada. Senão, numa transação: `generatePlan` → `UPDATE user_profiles SET workout_plan_basis = $basis WHERE user_id = $id AND workout_plan_basis IS NULL`; se afetou 0 linhas, outra requisição já gerou → sai sem inserir. Senão, resolve slug → id e cria as rotinas (`is_default = true`) com exercícios e séries (`weight_kg` NULL). Plano sem nenhuma rotina: grava o basis mesmo assim (não tenta de novo em loop).
- **`planSuggestion(userId)`** — `buildBasis(perfil atual)` vs `workout_plan_basis` salvo, campo a campo. `changed` = campos diferentes (`fitness_level`, `goals`, `gender`). `has_suggestion = changed.length > 0`.
- **Ordem da lista:** `is_default DESC, position ASC, created_at ASC`.
- **Próximo treino (`next_routine_id`):** pega a `activities` mais recente com `activity_type = 'STRENGTH'` e `routine_id` não nulo; o próximo é a rotina seguinte na ordem da lista (volta ao início depois da última). Sem histórico, rotina apagada ou lista vazia → primeira rotina (ou `null`).
- **Visibilidade de exercício:** `owner_user_id IS NULL OR owner_user_id = userId`.

### Endpoints (`/workouts`)

| Rota | Comportamento |
|---|---|
| `GET /routines` | `ensureDefaultPlan`; retorna `{ routines: [{ id, name, is_default, exercise_count, set_count }], next_routine_id, plan_suggestion: { has_suggestion, changed } }` |
| `GET /routines/:id` | `{ id, name, is_default, exercises: [{ id, exercise_id, name, muscle_group, position, reps_min, reps_max, rest_sec, sets: [{ set_number, weight_kg }] }] }`. 404 se não for do usuário |
| `POST /routines` | Corpo `{ name, exercises: [{ exercise_id, reps_min, reps_max, rest_sec, sets: [{ weight_kg }] }] }` (a ordem do array vira `position`/`set_number`). Cria com `is_default = false`. 201 com o detalhe |
| `PUT /routines/:id` | Mesmo corpo. Numa transação: atualiza `name`, apaga os `routine_exercises` da rotina (cascade nas séries) e recria. Mantém `is_default`. 200 com o detalhe. 404 se não for do usuário |
| `DELETE /routines/:id` | 204. 404 se não for do usuário |
| `POST /plan/accept` | Numa transação: `UPDATE user_profiles SET workout_plan_basis = $novo WHERE user_id = $id AND workout_plan_basis IS DISTINCT FROM $novo`; se afetou 0 linhas → nada a fazer (sem sugestão pendente ou clique duplo). Senão apaga as rotinas `is_default` do usuário e cria as novas. Retorna o mesmo corpo do `GET /routines` |
| `POST /plan/dismiss` | Grava só o basis atual. Retorna `{ message }` |
| `GET /exercises` | `{ exercises: [{ id, name, muscle_group, is_custom }] }` — catálogo + próprios, ordem `muscle_group, name` |
| `POST /exercises` | `{ name, muscle_group }` → cria com `owner_user_id = userId`. 201 |
| `PUT /exercises/:id` | Edita nome/grupo de exercício próprio. 404 se for do catálogo ou de outro usuário |
| `DELETE /exercises/:id` | Apaga exercício próprio (sai das rotinas por cascade; histórico mantém `exercise_name`). 204. 404 como acima |
| `POST /sessions` | Corpo `{ routine_id?, started_at, duration_sec, sets: [{ exercise_id, position, set_number, duration_sec, rest_before_sec }] }`. Numa transação cria `activities` (`activity_type = 'STRENGTH'`, `title` = nome da rotina, `start_time`, `duration_sec`, `routine_id`) e as `workout_sets` com `exercise_name` lido do banco (nunca do cliente). Rotina não encontrada para o usuário (apagada no meio do treino, ou alheia) → grava com `routine_id` NULL e `title = "Treino livre"`. Exercício não visível ao usuário (próprio apagado no meio do treino, ou alheio) → série gravada com `exercise_id` NULL e `exercise_name = "Exercício removido"`. Assim o rascunho nunca fica preso e nada alheio é vinculado nem tem o nome exposto. 201 `{ activity_id }`. Se já existir STRENGTH do usuário com o mesmo `start_time` (índice parcial) → 200 `{ activity_id }` existente, sem inserir |
| `GET /sessions` | Query `limit` (padrão 10, máx 50). `{ sessions: [{ id, title, start_time, duration_sec, set_count }] }`, só STRENGTH do usuário, mais recente primeiro |
| `GET /sessions/:id` | `{ id, title, start_time, duration_sec, sets: [{ exercise_name, position, set_number, duration_sec, rest_before_sec }] }`. 404 se não for do usuário |

`GET /profile`: `total_workouts` = nº de `activities` STRENGTH do usuário; `workouts_in_month` = idem no mês corrente (UTC, mesmo critério de data do trigger de streak).

### Validação (400)

- Rotina: `name` 1–100 caracteres (trim); `exercises` 1–20; `sets` 1–10 por exercício; `reps_min`/`reps_max` inteiros 1–100 com mín ≤ máx; `rest_sec` inteiro 0–600; `weight_kg` NULL ou 0–999.99; todo `exercise_id` visível ao usuário (senão 400 — impede usar exercício próprio de outra pessoa).
- Exercício: `name` 1–100 caracteres (trim); `muscle_group` ∈ os 12 grupos.
- Sessão: `duration_sec` inteiro 1–21600; `sets` 1–200; `position` 1–20; `set_number` 1–10; `duration_sec` da série 0–3600; `rest_before_sec` NULL ou 0–7200; `started_at` ISO válido, não maior que agora + 5 min e não anterior a 2026-01-01; `routine_id` e `exercise_id` UUIDs válidos (visibilidade tratada no endpoint, sem 400).
- Recurso de outro usuário ou do catálogo usado como próprio → **404** (não 403, para não revelar existência).

## Front — torv-frontend

Telas visuais construídas com o skill `/frontend-design`, seguindo `src/theme/tokens.ts` (fundo `#121212`, marca `#8CC63F`, Sora). Dependência nova: `@react-native-async-storage/async-storage` (instalar pela versão compatível do Expo).

### Navegação

Nova aba **Treinos** (ícone `Dumbbell`, rótulo "Treinos") entre Home e My Diet. A aba é um native-stack:

- `Workouts` (lista) → `RoutineEditor` → `ExercisePicker` (modal)
- `WorkoutSession` (sem tab bar) → `WorkoutSummary`

### Workouts (`src/screens/Workouts/`)

- Banner **"Treino em andamento"** quando há rascunho: **Continuar** (abre `WorkoutSession` a partir do rascunho) / **Descartar** (apaga o rascunho).
- Banner de sugestão quando `plan_suggestion.has_suggestion`: motivo a partir de `changed` (`fitness_level` → "Seu nível físico mudou", `goals` → "Seu objetivo mudou", `gender` → "Seus dados mudaram"). **Regerar** abre confirmação: *"Suas rotinas padrão serão substituídas, inclusive edições. As rotinas que você criou não mudam."* → `POST /plan/accept`. **Manter** → `POST /plan/dismiss`.
- Cards de rotina: nome, "N exercícios · M séries", selo **Próximo** em `next_routine_id`, tag **Padrão** em `is_default`. Toque → `RoutineEditor`; botão ▶ → `WorkoutSession`.
- Botão **Nova rotina** → `RoutineEditor` vazio.
- Recarrega ao focar a tela.

### RoutineEditor (`src/screens/RoutineEditor/`)

- Campo de nome.
- Card por exercício: nome + grupo; reps mín–máx (inputs numéricos); descanso com botões −15s/+15s (0–600) exibido em `m:ss`; lista de séries `Série N · [__ kg]` (carga opcional, decimal) com adicionar/remover série (1–10); setas ↑↓ para reordenar; remover exercício.
- **Adicionar exercício** → `ExercisePicker`. Exercício novo entra com 3 séries sem carga, reps 8–12, descanso 60s.
- **Salvar** → `POST` ou `PUT /routines`. **Excluir rotina** (só em edição) → confirmação → `DELETE`.
- Mesmos limites da validação do backend também no cliente.

### ExercisePicker (`src/components/ExercisePicker/`, modal)

- Busca por nome + chips dos 12 grupos.
- Lista do `GET /exercises`; próprios com tag **Meu** e ações editar/excluir (excluir avisa que o exercício sai das rotinas).
- **Criar exercício**: nome + grupo → `POST /exercises`.
- Toque em um exercício adiciona à rotina e fecha.

### WorkoutSession (`src/screens/WorkoutSession/`)

Topo com dois cronômetros:

- **Total**: desde o início do treino, sempre correndo.
- **Descanso** `m:ss / m:ss` (decorrido / alvo do exercício) — fica em `colors.error` quando decorrido > alvo e permanece vermelho até o usuário iniciar a série. Durante a série, o mesmo espaço mostra **Série** `m:ss`.

Centro: exercício atual, "Série X de Y", reps alvo `mín–máx`, carga da série (se houver).

Máquina de estados do botão principal:

| Estado | Botão | Ao tocar |
|---|---|---|
| `ready` (início do treino) | **Iniciar série** | vai para `set`; `rest_before_sec` da série = NULL |
| `set` | **Terminei a série** | grava `duration_sec` da série; vai para `resting` (ou `done` se era a última série do último exercício) |
| `resting` | **Acabou o descanso — iniciar série N** | grava `rest_before_sec` da próxima série; vai para `set` |

Depois da última série de um exercício, o descanso conta contra o `rest_sec` desse exercício e a próxima série é a 1ª do exercício seguinte.

Ações secundárias: **Pular série** (não grava a série), **Próximo exercício** (pula as séries restantes), lista dos próximos exercícios, **Finalizar treino** (confirmação; permite terminar cedo; com 0 séries feitas apenas descarta o rascunho).

Cronômetros derivados de timestamps (`Date.now() - fase.iniciadaEm`); um `setInterval` de 1s só re-renderiza. Assim continuam corretos após tela apagada ou app em background.

### WorkoutSummary (`src/screens/WorkoutSummary/`)

- Tempo total, séries feitas, descanso médio; por exercício, cada série com tempo e descanso anterior (descanso acima do alvo em vermelho — alvo vem do rascunho).
- Dispara `POST /sessions` ao abrir após finalizar. Sucesso (201/200) → apaga o rascunho. Falha de rede/5xx → "Não foi possível salvar — Tentar de novo", rascunho mantido. 400 (payload inválido, bug) → "Não foi possível salvar este treino" com **Descartar**, para não prender o usuário.
- Antes do envio, valores acima dos tetos do backend são limitados ao teto (`duration_sec` total 21600, série 3600, descanso 7200) — cobre rascunho retomado horas ou dias depois.
- Aberto a partir do histórico (`GET /sessions/:id`), mostra os mesmos dados sem o destaque vermelho (alvo não é gravado).
- **Concluir** → volta para `Workouts`.

### Rascunho — `src/utils/workoutDraft.ts`

- AsyncStorage, chave `torv.workoutDraft.<userId>`.
- Conteúdo: cópia da rotina (exercícios, reps, descanso, cargas), `started_at`, estado da máquina, índice atual, timestamp da fase atual e as séries já gravadas. Editar a rotina durante o treino não afeta a sessão.
- Salvo a cada mudança de estado (não a cada tick).
- Apagado: após 201/200 do `POST /sessions`, ao **Descartar**, e no `logout` explícito do `AuthContext`. Expiração de sessão (token) **não** apaga — o mesmo usuário volta e continua.

### Home

Card "Treino de hoje": nome da rotina `next_routine_id` (do `GET /workouts/routines`); **Iniciar** → `WorkoutSession`. Com rascunho → **Continuar treino**. Sem rotinas → "Monte seu treino" → aba Treinos.

### Perfil

- Seção "Atividade Física": troca o mock pelos `GET /workouts/sessions?limit=5` (título, data, tempo total, nº de séries). Toque → `WorkoutSummary` do histórico. Sem treinos → "Nenhum treino ainda".
- Contadores "treinos" e "treinos no mês" passam a vir reais do `GET /profile`.

## Entregas

Cada entrega percorre o ciclo completo do projeto (Edit → Test → Security), com sticky note no canvas.

| Entrega | Database | Backend | Frontend |
|---|---|---|---|
| **1 — Rotinas** | Migration inteira + seed | Gerador, `ensureDefaultPlan`, `/routines`, `/exercises`, `/plan/accept`, `/plan/dismiss` | Aba Treinos, `Workouts`, `RoutineEditor`, `ExercisePicker`, banner de sugestão |
| **2 — Execução** | — | `POST/GET /sessions`, `GET /sessions/:id`, contadores do `GET /profile` | `WorkoutSession`, rascunho, `WorkoutSummary`, card da Home, "Atividade Física" do Perfil |

A migration da entrega 1 já inclui `activities.routine_id`, o índice parcial e `workout_sets`, para a entrega 2 não precisar de migration. Dentro de cada entrega, backend e front rodam em paralelo depois da migration aplicada (contrato fixado nesta spec).

## Testes

### Unitários (`node --test`)

- `workoutGenerator`:
  - Masculino, AVANÇADO, Ganhar Massa Muscular → 5 rotinas, 4 séries, reps 6–12, descanso 120 (composto) / 60 (isolado), exercícios exatamente como a aba `Gerador`:
    - Dia 1 — Empurrar (Push): Supino reto com barra, Supino inclinado com barra, Desenvolvimento militar com barra, Crossover na polia, Elevação lateral com halteres, Supino fechado, Tríceps pulley (corda ou barra)
    - Dia 2 — Puxar (Pull): Remada curvada com barra, Barra fixa (pull-up), Puxada frontal na polia, Pullover na polia (braços estendidos), Crucifixo inverso na máquina (deltoide posterior), Rosca direta com barra, Rosca alternada com halteres, Rosca de punho
    - Dia 3 — Pernas: Agachamento livre com barra, Agachamento frontal, Cadeira extensora, Stiff com barra, Mesa flexora, Elevação pélvica (hip thrust) com barra, Glúteo na polia (coice), Panturrilha em pé na máquina, Panturrilha sentado
    - Dia 4 — Superior: Supino reto com halteres, Remada baixa na polia (triângulo), Desenvolvimento com halteres, Rosca martelo, Tríceps testa, Abdominal na polia (ajoelhado), Crucifixo com halteres
    - Dia 5 — Inferior + Core: Hack squat, Levantamento terra convencional, Ponte de glúteos (peso do corpo), Cadeira flexora, Cadeira abdutora, Elevação de pernas na barra fixa, Extensão lombar (banco 45°), Panturrilha no leg press
  - INICIANTE → 3 rotinas, 3 séries, nenhum exercício com nível mínimo acima de Iniciante.
  - AVANÇADO + "Criar uma Rotina" → plano de Iniciante (3 dias, reps 10–15, descanso 75/60).
  - Feminino vs Masculino no mesmo nível → difere só nos slots de sexo.
  - Gênero nulo → código `N`; objetivos vazios → Saúde & Bem-estar; nível desconhecido → INICIANTE.
  - `"Perder Peso, Ganhar Massa Muscular"` e a ordem inversa → mesmo `basis`; principal = Ganhar Massa Muscular.
  - `CATALOG` tem 71 slugs únicos; todo slot da aba `Sessoes` casa com pelo menos um grupo+tipo do catálogo.
- Validadores de rotina e de sessão: bordas de cada limite da seção Validação.

### Review and Tests

- Testes de API por rota, incluindo: IDOR (rotina, exercício próprio e sessão de outro usuário → 404; exercício próprio alheio numa rotina → 400; rotina/exercício alheio no `POST /sessions` → gravado como "Treino livre"/"Exercício removido", sem vínculo nem nome alheio); duas chamadas paralelas ao `GET /routines` de um usuário novo não duplicam o plano; `POST /sessions` repetido com o mesmo `started_at` → 200 e streak não incrementa de novo; `accept` duplo não duplica rotinas.
- Usabilidade no browser (Expo web): criar rotina com exercício próprio; treinar deixando o descanso passar do alvo (vermelho aparece e some ao iniciar a série); recarregar a página no meio do treino e continuar; finalizar e ver no Perfil; logout apaga o rascunho.
- Relatórios: `docs/qa-workout-routines-2026-09-30[-roundN].md` (entrega 1) e `docs/qa-workout-session-YYYY-MM-DD[-roundN].md` (entrega 2).

### Security

OWASP Top 10 sobre o diff de cada entrega, com foco em IDOR nas rotas `/workouts/*`, limites de entrada e `exercise_name` vindo só do servidor.
