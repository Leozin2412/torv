# Revisar — Módulo de Treinos

Branch `feat/workout-module` (sem push). Spec: `docs/superpowers/specs/2026-09-30-workout-module-design.md`. Plano: `docs/superpowers/plans/2026-09-30-workout-module.md`.

**Status:** as 15 tasks do plano estão feitas. As entregas 1 (rotinas) e 2 (execução do treino) passaram em Test e em Security, e uma rodada final completa saiu 100% verde. Em 01/10, a seu pedido, o **gerador passou a ler as regras do banco**: as constantes `CATALOG` e `SLOTS` saíram do código, e esse refactor também passou em Test e em Security. O `BancoDeDadosTorv/` foi sincronizado.

- **Automatizados:** backend 80/80, front 14/14, `tsc` sem erros.
- **Arquivos da feature:** 55. Fora isso, o diff `main...HEAD` também traz o seu commit `425bbe8` "alerta despesas" (`.claude/agents`, `graphify-out`, `docs/politica-*`, `tsconfig`), que não faz parte da feature.

---

## Database

| Arquivo | O quê |
|---|---|
| `BackEndTorv/prisma/migrations/20260930200000_workout_module/migration.sql` | **Criado.** Catálogo de 71 exercícios, exercícios próprios do usuário e tabelas `routine_exercise_sets` e `workout_sets`. Também cria a coluna `workout_plan_basis` no perfil, `activities.routine_id` e o índice que impede gravar o mesmo treino duas vezes. RLS + policy nas tabelas novas. Apaga os dados de treino antigos, que eram de teste. |
| `BackEndTorv/prisma/migrations/20261001150000_workout_generator_rules/migration.sql` | **Criado (01/10).** `exercises` ganha `type` (COMPOSTO/ISOLADO), `min_level` e `catalog_order`. Os 71 do catálogo vêm preenchidos; nos exercícios próprios as três colunas ficam NULL, garantido por CHECK. Cria a tabela `workout_template_slots` com 101 linhas (a aba Sessoes da planilha), CHECKs, PK `(days_per_week, day, position)`, RLS + policy. |
| `BackEndTorv/prisma/schema.prisma` | **Editado.** Modelos novos e alterados. |
| `BackEndTorv/treino_padrao_referencia.xlsx` | **Commitado.** Planilha de referência do treino padrão. |
| `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`, `Regras BD.sql`, `Gestao_e_Performance.sql`, `Mock Dados.sql` | **Editados (01/10).** Documentação sincronizada com as duas migrations: tabelas e colunas, CHECKs, RLS e índices (inclusive o parcial). O mock foi migrado para o schema novo. `Testes Procedures e Triggers.sql` não mudou, porque nenhuma das duas migrations mexe em function ou trigger. |

## Repositórios

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/repository/workout.repository.js` | **Criado.** Rotinas, exercícios, gravação do plano padrão (transação) e sessões: gravar, listar e detalhe. Desde 01/10 tem `getGeneratorRules()`, que carrega o catálogo e os slots do banco. O `savePlan` usa o `exercise_id` direto, então a transação tem uma query a menos. |
| `BackEndTorv/src/repository/profile.repository.js` | **Editado.** Conta os treinos: total e do mês. |

## Controller e lib

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/controller/workout.controller.js` | **Criado.** Rotinas, exercícios, plano (aceitar/dispensar) e sessões idempotentes. |
| `BackEndTorv/src/controller/profile.controller.js` | **Editado.** Usa os contadores reais de treino. |
| `BackEndTorv/src/lib/workoutGenerator.js` | **Criado.** Gera o treino padrão por nível, objetivo e sexo. Desde 01/10 recebe as regras do banco, com `generatePlan(perfil, { catalog, slots })`. No código só ficaram `LEVELS` (3 linhas) e `GOALS` (6 linhas); o arquivo foi de 267 para 91 linhas. |
| `BackEndTorv/src/lib/workoutPlan.js` | **Criado.** Regras de quando gerar o plano e de quando sugerir regerar. Carrega as regras do banco antes de gerar. |
| `BackEndTorv/src/lib/workoutValidation.js` | **Criado.** Limites de rotina, exercício e sessão. |
| `BackEndTorv/src/lib/tests/` | **Testes.** Criados `workoutGenerator.test.js`, `workoutPlan.test.js`, `workoutValidation.test.js` e `workoutRules.js`. Este último é um helper que lê as regras direto da migration, então os testes não usam banco nem fixture duplicada. Em 01/10, os 4 testes que já existiam em `src/lib` também vieram para esta pasta (commit `40be50a`). |

## Routes

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/routes/workout.routes.js` | **Criado.** Rotas `/workouts/*`: routines, exercises, plan e sessions. |
| `BackEndTorv/src/routes/workout.schemas.js` | **Criado.** Schemas TypeBox. Os campos que aceitam null usam `type: [X, 'null']`, por causa do `coerceTypes` do Ajv. |
| `BackEndTorv/src/routes/workout.routes.test.js`, `workout.sessions.test.js` | **Criados.** Testes. |
| `BackEndTorv/server.js` | **Editado.** Registra `/workouts`. |

## Frontend (`FrontEndTorv/src/`)

O refactor de 01/10 não mexeu no frontend, porque a API não mudou.

- **Telas novas:**
  - **Treinos** (`screens/Workouts`): lista de rotinas com os selos Próximo e Padrão, ▶ para iniciar, aviso de treino em andamento e sugestão de regerar o padrão.
  - **Editor de rotina** (`screens/RoutineEditor`): reps, descanso e carga por série.
  - **Execução** (`screens/WorkoutSession`): cronômetro total e cronômetro de descanso, que fica vermelho quando passa do alvo.
  - **Resumo** (`screens/WorkoutSummary`).
- **Componentes novos:** `ExercisePicker` (busca, filtro por grupo e criação de exercício próprio) e `ConfirmModal`.
- **Base nova:**
  - contrato da API em `services/workouts.ts`;
  - tipos de navegação em `routes/types.ts`;
  - utilitários com testes em `utils/`: `workoutSession` (máquina de estados do treino), `workoutDraft` (rascunho no aparelho), `routineForm` e `clock`.
- **Editados:**
  - **Home:** card "Treino de hoje" com Iniciar ou Continuar.
  - **Perfil:** seção "Atividade Física" com histórico e contadores reais.
  - **Navegação** (`routes/PrivateRoutes`): aba Treinos e as telas novas.
  - **`AuthContext`:** o logout apaga o rascunho do treino.
  - **`package.json` e `package-lock.json`:** a única dependência nova é `@react-native-async-storage/async-storage` 2.2.0.

---

## Ciclo e relatórios (`docs/`)

| Etapa | Resultado | Relatório |
|---|---|---|
| Entrega 1, Test rodada 1 | FAIL: carga em branco gravada como 0; chips do seletor sumindo | `qa-workout-routines-2026-09-30.md` |
| Entrega 1, Test rodada 2 | PASS | `qa-workout-routines-2026-09-30-round2.md` |
| Entrega 1, Security | PASS (1 LOW) | `security-workout-routines-2026-09-30.md` |
| Entrega 2, Test rodada 1 | FAIL: botão dentro de botão na aba Treinos; pular tudo sem série mandava treino vazio | `qa-workout-session-2026-09-30.md` |
| Entrega 2, Test rodada 2 | PASS | `qa-workout-session-2026-09-30-round2.md` |
| Entrega 2, Security | PASS (1 LOW) | `security-workout-session-2026-09-30.md` |
| Rodada final completa | PASS, 100% verde | `qa-workout-module-2026-09-30-final.md` |
| **Refactor das regras no banco, Test** | **PASS**. O gerador antigo e o novo dão o mesmo resultado em 570 combinações de perfil. | `qa-workout-generator-rules-2026-10-01.md` |
| **Refactor das regras no banco, Security** | **PASS** (2 INFO) | `security-workout-generator-rules-2026-10-01.md` |

## Decisões suas (não bloqueiam)

1. **Fuso do mês e do streak:** hoje são calculados em UTC. Um treino às 21h de 30/09 conta em outubro, e uma mesma noite pode somar 2 no streak.
2. **Datas e volume de treinos vêm do app:** isso permite inflar o streak e os contadores com treinos retroativos ou em massa. Corrigir antes de grupos e ranking, com uma janela de retroatividade (ex.: 48h) e rate limit.
3. **Sem limite** de rotinas e exercícios por usuário, e sem rate limit em `/workouts`.
4. **`npm audit` do front:** 16 alertas (3 altos), todos anteriores a esta branch. Sugestão: atualizar o axios numa mudança separada.
5. **"+0 vs mês passado" no Perfil:** é um valor fixo que já existia; ficou fora do escopo.
6. **Novo (Security de 01/10, INFO):** o papel `torv_api`, usado pela API em produção, consegue escrever em `workout_template_slots`, mas só precisa ler. Endurecimento opcional: uma migration de 1 linha com `REVOKE INSERT, UPDATE, DELETE ON workout_template_slots FROM torv_api`. A consequência é que ajustar o treino padrão passa a exigir migration, não mais um `UPDATE` direto.

## Ambiente

- **Backend:** no **Furnace** (porta 3000). Durante a noite de 30/09 rodou num terminal temporário, "Backend Server", que já foi fechado.
- **Expo:** roda no terminal "Expo" (web + Metro para o celular).
- **Login não funciona no web nem no celular, porque o `FrontEndTorv/.env` está VAZIO.**
  - **Causa:** sem `EXPO_PUBLIC_API_URL`, o app usa o endereço reserva da sua cópia local do `api.ts`, que não está commitada. Hoje esse reserva é `http://127.0.0.1:3000`; antes era `10.0.2.2:3000`. No celular ele nunca chega ao backend, e no web também falhou. Os testes usaram um ajuste que vale só dentro da página.
  - **Correção pendente, a seu critério:** colocar `EXPO_PUBLIC_API_URL=http://192.168.15.179:3000` no `.env` e reiniciar o Expo com `--clear`.
- **Mudanças locais suas, não commitadas:** `FrontEndTorv/src/services/api.ts` e `FrontEndTorv/src/screens/Login/index.tsx` (um espaço numa mensagem). Ninguém mexeu nelas.
- **`prisma generate`:** em 01/10 o client JS foi regenerado, mas a cópia da DLL deu EPERM porque o Furnace a mantém aberta. A DLL é a mesma versão, então funciona. Para deixar tudo limpo, rode `npx prisma generate` com o Furnace parado.
- **Portal "Torv Mobile #2":** está logado na sua sessão.
- **Contas de teste:** as `qa.*@torvtest.dev` ficaram no banco, porque não existe endpoint para apagar conta. As rotinas e os exercícios próprios criados nos testes foram apagados.

**Falta:** aprovar a branch. O push fica para quando você pedir.
