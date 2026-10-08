# Revisar 3 — Cargas por série, período no Histórico, senha, boas-vindas e API no celular

Branch `feat/workout-module` (sem push). Spec: `docs/superpowers/specs/2026-10-02-loads-period-welcome-design.md`. Plano: `docs/superpowers/plans/2026-10-02-loads-period-welcome.md`, com o código de cada passo como patch validado em `docs/superpowers/plans/2026-10-02-loads-period-welcome/`.

**Status:** pronto. Rodou em sequência (um recruit por vez), com teste ao fim de cada etapa, teste completo e Security. Os recruits rodaram em Sonnet [high], e as decisões ficaram comigo.

| Etapa | Resultado |
|---|---|
| Database | Pronto, teste da etapa PASS |
| Backend | Pronto. O teste da etapa passou com um LOW de desempenho, que corrigi; o round 2 passou |
| Frontend | Pronto (com `/frontend-design`), teste da etapa PASS 9/9 |
| Teste completo | PASS, incluindo a regressão do módulo de treinos e do histórico |
| Security | PASS com 1 LOW (UUID), corrigido. O round 3 do backend e o round 2 do Security passaram |

- **Automatizados:** backend 92/92 (eram 83), front 32/32 (eram 18), `tsc` sem erros.
- **Arquivos:** 44 alterados.
  - Backend: 18.
  - `BancoDeDadosTorv`: 2.
  - Frontend: 24, contando `package.json` e o lock.
  - 1 migration.

## O que mudou para o usuário

- **Carga no treino:**
  - o treino começa com as cargas da rotina;
  - a carga da série atual vira um controle **− valor +** (passos de 2,5 kg), e tocar no valor deixa digitar ("7,5");
  - só a série atual muda, como você escolheu;
  - a carga feita fica gravada em cada série.
- **Resumo:**
  - cada série mostra a carga ("62,5 kg");
  - se alguma série ficou diferente da rotina, aparece o card **"Cargas diferentes da rotina"**, com a lista "Supino · série 2: 60 kg → 65 kg" e os botões **Atualizar rotina** / **Manter**;
  - "Atualizar rotina" aplica tudo de uma vez.
- **Histórico:**
  - nova linha de chips **Tudo · 7 dias · 30 dias · 3 meses · Personalizado**;
  - o Personalizado pede o início e depois o fim, e o chip passa a mostrar "dd/mm – dd/mm";
  - o período combina com Todos / Musculação.
- **Senha:** aparecem bolinhas em vez de quadradinhos, no Login e no Cadastro.
- **Boas-vindas:** a mensagem aparece uma vez por conta, em qualquer aparelho, com o primeiro nome e os 3 pontos combinados. As contas atuais também veem, e **a sua vai aparecer no próximo acesso**.
- **Celular:** o app no Expo Go passou a chamar a API sem precisar do `.env`.

## Causas encontradas

- **Celular sem API:** com o `.env` vazio, o app usava `http://127.0.0.1:3000`. No PC isso é o próprio PC, mas no celular é o próprio celular, então a requisição nem saía.
  - O resto já estava certo: o firewall libera o node, o backend escuta na rede, e o Expo Go recebe `hostUri: 192.168.15.179:8081`.
  - **Correção:** em dev, o app usa o IP do `hostUri`, a mesma máquina onde roda o backend. Continua funcionando se o IP do PC mudar.
- **Quadradinhos na senha:** na fonte Sora, o "•" (U+2022), que o Android e o Chrome usam para esconder a senha, é desenhado como um quadrado. Ela também não tem o "●" que o iOS usa.
  - **Correção:** com a senha oculta, o campo usa a fonte do sistema. Com o olho aberto, continua Sora.

---

## Database

| Arquivo | O quê |
|---|---|
| `BackEndTorv/prisma/migrations/20261002120000_loads_welcome/migration.sql` | **Criado.** `workout_sets.weight_kg DECIMAL(6,2)` com CHECK de 0 a 999,99 e `user_profiles.welcomed_at TIMESTAMPTZ`. As duas são nulas, sem backfill: os treinos antigos ficam sem carga. |
| `BackEndTorv/prisma/schema.prisma` | Os 2 campos. |
| `BancoDeDadosTorv/SQL BANCO DE DADOS.sql`, `Regras BD.sql` | Sync do DDL e do CHECK. |

## Repositórios

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/repository/workout.repository.js` | **Editado.** `weight_kg` no `createSession` e no `getSession`. Novo `updateRoutineWeights`, com **um UPDATE só** (`FROM (VALUES …)`, parametrizado): muda a série que ainda bate com a rotina atual (posição + exercício + nº da série), com o dono no `WHERE`. |
| `BackEndTorv/src/repository/activities.repository.js` | **Editado.** `from` (inclusivo) junto do `before` (exclusivo). |
| `BackEndTorv/src/repository/profile.repository.js` | **Editado.** `markWelcomed`, que grava só a 1ª vez. |
| `BackEndTorv/src/repository/tests/workout.repository.test.js` | **Criado.** Testa o UPDATE único e a rotina de outra conta. |

## Controller e lib

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/controller/workout.controller.js` | **Editado.** `updateRoutineWeights` (rotina de outra conta ou inexistente → 404). O `getSession` converte a carga para número. |
| `BackEndTorv/src/controller/activities.controller.js` | **Editado.** Valida o `from` como o `before`: data ilegível → 400. |
| `BackEndTorv/src/controller/profile.controller.js` | **Editado.** `welcome_pending` no `GET /profile` e `markWelcomed` (204). |

Nenhuma mudança em `src/lib`.

## Routes

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/routes/workout.schemas.js` | **Editado.** Carga nula compartilhada (`Weight`), `weight_kg` em `SessionBody`/`SessionDetail`, `RoutineWeightsBody` (1–200 itens). **UUID estrito**: o `format: 'uuid'` do Ajv aceitava `urn:uuid:`, que dava 500 no SQL; esse era o LOW do Security. |
| `BackEndTorv/src/routes/workout.routes.js` | **Editado.** `PATCH /workouts/routines/:id/weights` → `{ updated }`. |
| `BackEndTorv/src/routes/activities.routes.js` | **Editado.** `from` (date-time). |
| `BackEndTorv/src/routes/profile.routes.js` | **Editado.** `welcome_pending` e `POST /profile/welcome` (204, idempotente). |
| `BackEndTorv/server.js` | **Editado.** `PATCH` no CORS. Sem ele, o navegador barrava a rota nova. |
| `workout.sessions.test.js`, `workout.routes.test.js`, `activities.routes.test.js`, `profile.routes.test.js` (novo) | Testes de carga, PATCH, `from`, boas-vindas e UUID. |

## Frontend (`FrontEndTorv/`)

- **Novos:**
  - `src/components/WelcomeModal/`: a mensagem de boas-vindas.
  - `src/utils/historyPeriod.ts` + teste: limites dos períodos no fuso do aparelho. O teste roda em 5 fusos.
- **Editados:**
  - `src/services/api.ts` + `package.json`/lock: o host da API vem do `hostUri` do Expo. A dependência nova `expo-constants` está em `~57.0.20`, a versão que o `expo install` escolheu.
  - `src/components/Input/`: bolinhas na senha.
  - `src/contexts/AuthContext.tsx`: `welcome_pending` e `dismissWelcome`.
  - `src/screens/Home/index.tsx`: mostra o modal.
  - `src/utils/workoutSession.ts` + teste:
    - `planned_weights`, a cópia das cargas no início do treino;
    - as funções `setWeight`, `stepWeight`, `formatWeight`, `weightChanges` e `upgradeState`.
    - `upgradeState` deixa um rascunho antigo continuar sem quebrar.
  - `src/utils/workoutDraft.ts` e `src/services/workouts.ts`: contrato e `updateRoutineWeights`.
  - `src/screens/WorkoutSession/`: controle de carga.
  - `src/screens/WorkoutSummary/`: carga por série e o card.
  - `src/services/activities.ts`: `from`.
  - `src/components/DatePickerModal/`: título opcional ("Desde quando?" / "Até quando?").
  - `src/screens/Workouts/History.tsx` + `historyStyles.ts`: chips de período e o Personalizado.
- **Visual (`/frontend-design`):**
  - **Card de cargas:** "Atualizar rotina" usa contorno e tinta verde, porque o verde sólido fica só no "Concluir".
  - **Chips de período:** ficaram discretos (sem contorno até ficarem ativos), para não competir com os de tipo.
  - **Medidas:** alvos de 44 px; cabe em 320 e 412.
- **O "7.5" com ponto da tela de treino** (item do `revisar2.md`) virou "7,5".

---

## Ciclo e relatórios (`docs/`)

| Etapa | Resultado | Relatório |
|---|---|---|
| Teste da etapa Database | PASS. O CHECK foi testado numa tabela temporária, sem tocar no banco | `qa-loads-welcome-database-2026-10-02.md` |
| Teste da etapa Backend | PASS com 1 LOW: o PATCH fazia 1 UPDATE por série (10 séries = 2,5 s; acima de ~90, erro por tempo) | `qa-loads-welcome-backend-2026-10-02.md` |
| Reteste Backend após o UPDATE único (`d61fc7c`) | PASS. O PATCH leva ~0,45 s de 10 a 200 séries | `qa-loads-welcome-backend-2026-10-02-round2.md` |
| Teste da etapa Frontend | PASS 9/9 | `qa-loads-welcome-frontend-2026-10-02.md` |
| **Teste completo** | **PASS** | `qa-loads-welcome-full-2026-10-02.md` |
| Security | PASS com 1 LOW: `urn:uuid:` dava 500 no PATCH | `security-loads-welcome-2026-10-02.md` |
| Reteste Backend após o UUID estrito (`0a82553`) | PASS | `qa-loads-welcome-backend-2026-10-02-round3.md` |
| **Security round 2** | **PASS, LOW fechado** | `security-loads-welcome-2026-10-02-round2.md` |

## Para você decidir (não bloqueia)

1. **Carga só na série atual:** no plano padrão as rotinas vêm sem carga, então cada série começa em "Sem carga" e precisa ser ajustada uma a uma. Se preferir, a carga ajustada pode passar a valer também para as séries seguintes do exercício. É uma mudança pequena.
2. **"Personalizado" escondido em 320:** a linha de chips de período rola na horizontal. Em 412 o "Personalizado" aparece cortado, o que indica que dá para rolar; em 320 ele fica fora da tela.
3. **Reabrir o Personalizado:** a data final começa igual à inicial, então só confirmar reduz o período a um dia.
4. **axios 1.17.0** tem alertas de segurança. São anteriores a esta feature, e a atualização seria à parte (`npm update axios`).
5. **Pontos registrados pelo Security, sem ação necessária:**
   - o Ajv converte `weight_kg` `true` em 1 e `''` em `null`, mas só afeta dado da própria pessoa;
   - o CORS continua `*`, e só entrou o `PATCH` na lista;
   - série repetida no mesmo PATCH: não há garantia de qual valor vence, mas o app manda cada série uma vez;
   - a mensagem de erro de UUID mostra o pattern inteiro.
6. **Erro do "Atualizar rotina":** o estado de erro não foi testado na tela, porque não dá para forçar a falha sem mexer na página. O código é simples: mostra "Não foi possível atualizar." e "Tentar de novo".
7. **Itens ainda abertos** do `revisar.md`/`revisar2.md`:
   - sem rate limit;
   - `started_at` vem do app;
   - mês e streak em UTC;
   - "+0 vs mês passado" fixo no código.

## Ambiente

- **`FrontEndTorv/.env`:** continua vazio e não é mais necessário. Se um dia o celular estiver em outra rede ou o Expo em túnel, coloque `EXPO_PUBLIC_API_URL=http://<IP do PC>:3000`, que tem prioridade.
- **Sua mudança local no `api.ts`:** era o fallback `127.0.0.1` e um comentário com uma URL colada. A correção substituiu as duas e manteve o `127.0.0.1` como padrão; ela entrou no commit `c40c20f`. O seu diff antigo ficou guardado no scratchpad desta sessão. A sua mudança no `Login/index.tsx` continua intocada e fora dos commits.
- **Backend e Expo:**
  - o backend roda no Furnace com nodemon;
  - o Expo roda no terminal "Expo", reiniciado com `--clear`, porque o Metro não achava a dependência nova.
- **Modelos:**
  - os recruits foram trocados para Sonnet [high] com `/model` e `/effort`, sem reiniciar;
  - o `/model` gravou `"model": "sonnet"` no seu `~/.claude/settings.json` global, e eu voltei para `"opus"`;
  - o `/effort` salvou `claude-sonnet-5-5: high` nos `modelSettings`, o que só afeta sessões em Sonnet.
  - O jeito de fazer isso ficou registrado no `CLAUDE.md`, seção 7, que ainda está sem commit.
- **MCP do Supabase:** está ligado a outro projeto ("Portal Tradsul"), não ao banco do torv. As conferências do banco foram feitas pelo Prisma, só no catálogo do sistema ou numa tabela temporária.
- **Memória da máquina:** chegou a 1 GB livre, e o sistema encerrou duas esperas por resposta de recruit. Nenhum trabalho se perdeu.
- **Contas de teste:** `qa.lw.*`, `qa.lw2.*`, `qa.lw3.*`, `qa.fe5.*`, `qa.lwf.*`, `qa.lwfull.*`, `qa.sec3.*` e `qa.sec4.*` (`@torvtest.dev`) ficaram no banco, porque não há endpoint para apagar conta.

**Falta:**
- testar no celular (Expo Go na mesma rede do PC);
- aprovar a branch;
- o push fica para quando você pedir.
