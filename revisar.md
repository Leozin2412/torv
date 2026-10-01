# Revisar — Módulo de Treinos

Branch `feat/workout-module` (sem push). Spec: `docs/superpowers/specs/2026-09-30-workout-module-design.md`. Plano: `docs/superpowers/plans/2026-09-30-workout-module.md`.

**Status:** todas as 15 tasks do plano foram feitas. As entregas 1 (rotinas) e 2 (execução do treino) passaram em Test e em Security. Depois disso, uma rodada final completa passou com 100% verde, sem precisar mudar código.

- **Automatizados:** backend 80/80, front 14/14, `tsc` sem erros.
- **Tamanho:** 53 arquivos alterados.

---

## Database

| Arquivo | O quê |
|---|---|
| `BackEndTorv/prisma/migrations/20260930200000_workout_module/migration.sql` | **Criado.** Catálogo com 71 exercícios, exercícios próprios do usuário e tabelas `routine_exercise_sets` e `workout_sets`. Também cria a coluna `workout_plan_basis` no perfil e o índice que impede gravar o mesmo treino duas vezes. RLS + policy nas tabelas novas. Apaga os dados de treino antigos, que eram de teste. |
| `BackEndTorv/prisma/schema.prisma` | **Editado.** Modelos novos e alterados. |
| `BackEndTorv/treino_padrao_referencia.xlsx` | **Commitado.** Planilha de referência do treino padrão. |

## Repositórios

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/repository/workout.repository.js` | **Criado.** Rotinas, exercícios, gravação do plano padrão (transação) e sessões: gravar, listar e detalhe. |
| `BackEndTorv/src/repository/profile.repository.js` | **Editado.** Conta os treinos: total e do mês. |

## Controller e lib

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/controller/workout.controller.js` | **Criado.** Rotinas, exercícios, plano (aceitar/dispensar) e sessões idempotentes. |
| `BackEndTorv/src/controller/profile.controller.js` | **Editado.** Usa os contadores reais de treino. |
| `BackEndTorv/src/lib/workoutGenerator.js` | **Criado.** Gera o treino padrão por nível, objetivo e sexo, conforme a planilha. |
| `BackEndTorv/src/lib/workoutPlan.js` | **Criado.** Regras de quando gerar o plano e de quando sugerir regerar. |
| `BackEndTorv/src/lib/workoutValidation.js` | **Criado.** Limites de rotina, exercício e sessão. |
| `BackEndTorv/src/lib/workoutGenerator.test.js`, `workoutPlan.test.js`, `workoutValidation.test.js` | **Criados.** Testes. |

## Routes

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/routes/workout.routes.js` | **Criado.** Rotas `/workouts/*`: routines, exercises, plan e sessions. |
| `BackEndTorv/src/routes/workout.schemas.js` | **Criado.** Schemas TypeBox. Os campos que aceitam null usam `type: [X, 'null']`, por causa do `coerceTypes` do Ajv. |
| `BackEndTorv/src/routes/workout.routes.test.js`, `workout.sessions.test.js` | **Criados.** Testes. |
| `BackEndTorv/server.js` | **Editado.** Registra `/workouts`. |

## Frontend (`FrontEndTorv/src/`)

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
| **Rodada final completa** | **PASS, 100% verde** | `qa-workout-module-2026-09-30-final.md` |

## Decisões suas (não bloqueiam)

1. **Fuso do mês e do streak:** hoje são calculados em UTC. Um treino às 21h de 30/09 conta em outubro, e uma mesma noite pode somar 2 no streak.
2. **Datas e volume de treinos vêm do app:** isso permite inflar o streak e os contadores com treinos retroativos ou em massa. Corrigir antes de grupos e ranking, com uma janela de retroatividade (ex.: 48h) e rate limit.
3. **Sem limite** de rotinas e exercícios por usuário, e sem rate limit em `/workouts`.
4. **`npm audit` do front:** 16 alertas (3 altos), todos anteriores a esta branch. Sugestão: atualizar o axios numa mudança separada.
5. **"+0 vs mês passado" no Perfil:** é um valor fixo que já existia; ficou fora do escopo.

## Ambiente

- **Backend:** roda no terminal Maestri **"Backend Server"** (porta 3000). O Furnace virou uma sessão do Claude, e trocar de volta para um terminal foi bloqueado.
- **Expo web:** roda no terminal "Expo".
- **`FrontEndTorv/.env`:** atualizado para o IP atual, `192.168.29.69`. Assim já dá para abrir no celular na mesma rede.
- **Portal "Torv Mobile #2":** ficou deslogado depois dos testes. Basta logar de novo; nenhum dado seu foi alterado.
- **Contas de teste:** as `qa.*@torvtest.dev` ficaram no banco, porque não existe endpoint para apagar conta. As rotinas e os exercícios próprios criados nos testes foram apagados.

**Falta:** aprovar a branch. O push fica para quando você pedir.
