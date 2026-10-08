# Revisar 4 — Grupos e competição

Branch `feat/workout-module` (sem push). Spec: `docs/superpowers/specs/2026-10-06-groups-competition-design.md`. Plano: `docs/superpowers/plans/2026-10-06-groups-competition.md` (18 tarefas).

**Status:** pronto. Rodou em sequência (um recruit por vez), com teste ao fim de cada etapa, teste completo e Security, e uma volta de retrabalho em cada um dos dois ciclos que reprovaram. Os recruits rodaram em Sonnet [high], e as decisões ficaram comigo.

| Etapa | Resultado |
|---|---|
| Database | Pronto, teste da etapa PASS (9/9) |
| Backend | Pronto. Teste da etapa PASS (2 LOW, sem retrabalho). Depois do Security, o retrabalho passou pelo round 2 (**FAIL**: rajada devolvia 500) e pelo round 3 (**PASS**) |
| Frontend | Pronto (com `/frontend-design`). Teste da etapa round 1 **FAIL** (cartão cortado em 320 px, switches < 44 px, texto do convite), round 2 PASS |
| Teste completo | PASS, incluindo a regressão de login, boas-vindas, Home, dieta, treinos, histórico e perfil |
| Security | Round 1 **FAIL** (1 MEDIUM, 2 LOW), corrigido. Round 2 **PASS** (0 MEDIUM; 3 LOW opcionais) |

- **Automatizados:** backend 175/175 (eram 92), front 47/47 (eram 32), `tsc` sem erros.
- **Arquivos:** 69 de código e banco (43 criados e 26 editados), mais 11 em `docs/`, em 35 commits contando a spec.
  - Backend: 28, contando as 2 migrations.
  - `BancoDeDadosTorv`: 5.
  - Frontend: 36, contando `app.json`, `package.json` e o lock.

## O que mudou para o usuário

- **Aba Grupos** (5ª aba, ícone de pessoas):
  - **Meus grupos** e **Descobrir** (busca por nome, só grupos públicos);
  - cada card mostra a capa, o nome, os membros, a minha posição e os pontos, e o estado do período ("Começa em 5 dias", "Sem data de término", "Encerrado em ...");
  - a seção **Convites recebidos** (aceitar ou recusar) só aparece quando há convite;
  - botões **Criar grupo** e **Entrar com código**.
- **Criar e editar grupo:** capa pela galeria, nome, público ou privado, início e fim. O toggle **"Sem data de término"** vem ligado: sem fim, a competição segue para sempre.
- **Ranking do grupo:** 1 ponto por **dia** em que o membro treinou, a partir da entrada dele e dentro do período. Dois treinos no mesmo dia valem 1. O top 3 tem destaque e a minha linha fica marcada. O dia usa o fuso do grupo (o do dono na criação).
- **Entrar num grupo:**
  - convite do dono por username exato;
  - pedido de entrada em grupo público (o dono aprova);
  - link ou código de 8 caracteres (`torv://join/<código>`), que o dono gera, regenera ou revoga.
  - Grupo encerrado não aceita mais ninguém.
- **Gerenciar (dono):** convidar, ver pedidos e convites enviados, compartilhar o link, remover membro e excluir o grupo. O dono não sai do grupo, só o exclui.
- **Editar e excluir treino:** no resumo de um treino salvo. Editar muda o peso e a duração de cada série, ou remove série; **a data não muda**. Excluir pede confirmação, e o ranking cai na hora (apagar 1 de 2 treinos do mesmo dia mantém o ponto, apagar o único tira).
- **Novas regras de salvamento de treino** (vieram do Security, valem para todos): o treino precisa ter começado nas últimas **72 h**, não pode terminar no futuro (5 min de folga) e cada usuário salva no máximo **5 treinos por dia**.

## Causas encontradas

- **Ranking forjável (Security round 1, MEDIUM):** o servidor só recusava datas antes de 2026 ou no futuro. Um membro podia enviar um treino por dia desde a entrada e ganhar 1 ponto por dia, ou postar centenas de treinos no mesmo dia e ganhar o desempate (`activities_count`).
  - **Correção:** janela de 72 h, fim no futuro recusado e teto de 5 por dia UTC, contado na mesma transação do insert.
- **Teto furado por corrida (achado na revisão do código):** requisições paralelas contavam o mesmo total antes de qualquer insert.
  - **Correção:** `pg_advisory_xact_lock` por usuário dentro da transação.
- **500 na rajada (QA backend round 2, MEDIUM):** com o lock, 10 ou mais salvamentos paralelos do mesmo usuário abriam 10 transações presas esperando, o pool tem só 5 conexões, e as excedentes viravam **500** em vez de 400, deixando também os outros usuários lentos (`GET /groups` de outra conta chegou a 3,6 s).
  - **Correção:** fila por usuário no processo, **antes** da transação (`serializePerUser`). Agora cada usuário segura no máximo 1 conexão.
  - **Resultado (round 3):** 5 rajadas (12, 12, 12, 20 e uma sem grupo) deram sempre 5×201 e o resto 400, **zero 500**, e o `GET /groups` de outro usuário ficou em 0,18–0,32 s.
- **Cartão cortado e alvos pequenos (QA frontend round 1):** o `GroupCard` truncava o texto em 320 px, os switches do editor tinham menos de 44 px de toque, e o convite a quem já era membro mostrava a mensagem errada. Os três foram corrigidos e passaram no round 2.
- **Enumeração de username (Security LOW-1):** o convite responde 404 para usuário inexistente e 201/409 para existente. Mantive assim, porque o dono precisa saber que digitou errado e o username já aparece no ranking. A mitigação é o rate limit de 30 por minuto por IP.

---

## Database

| Arquivo | O quê |
|---|---|
| `BackEndTorv/prisma/migrations/20261006120000_groups/migration.sql` | **Criado.** Altera `groups` (`owner_id`, `visibility`, `cover_url`, `starts_at`, `ends_at` nulo, `tz_offset_min`, `invite_token` único, `created_at`; sai `period_type`) e cria `group_invitations`, com CHECKs, índices (incluindo o único parcial de convite pendente e o do ranking) e RLS com a policy `torv_api_full_access`. Todas as FKs em cascade. |
| `BackEndTorv/prisma/migrations/20261006120100_drop_group_points_trigger/migration.sql` | **Criado.** Remove o trigger e a função antigos de pontos (`trg_add_points_to_group_ranking`), que dariam pontos por atividade e contradiriam a regra de 1 ponto por dia. |
| `BackEndTorv/prisma/schema.prisma` | Modelos `groups` e `group_invitations`, relações e índices. |
| `BancoDeDadosTorv/SQL BANCO DE DADOS.sql` | O DDL de `groups` (novas colunas) e `group_invitations`. |
| `BancoDeDadosTorv/Regras BD.sql` | Os CHECKs novos; sai a função do trigger antigo de pontos. |
| `BancoDeDadosTorv/Gestao_e_Performance.sql` | RLS e policy de `group_invitations` e os índices de grupos. |
| `BancoDeDadosTorv/Mock Dados.sql` | Os grupos de exemplo no schema novo (com dono, período e fuso). |
| `BancoDeDadosTorv/Testes Procedures e Triggers.sql` | Sai o teste do trigger antigo de pontos (agora o backend recalcula). |

`group_rankings` ficou, sem mudança de colunas, como a tabela materializada do ranking.

## Repositórios

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/repository/groups.repository.js` | **Criado.** Grupos, membros, ranking e `recomputeRanking` / `recomputeGroup`, que **refazem** a linha do membro a partir de `activities` (idempotente), em vez de incrementar. |
| `BackEndTorv/src/repository/groupInvitations.repository.js` | **Criado.** Convites, pedidos e link de convite. |
| `BackEndTorv/src/repository/workout.repository.js` | **Editado.** `createSession` agora tem a fila por usuário, o advisory lock, o teto de 5 por dia e o `recomputeRanking` na mesma transação. Novos `updateSession` e `deleteSession`. |
| `BackEndTorv/src/repository/tests/groups.repository.test.js` (novo), `workout.repository.test.js` | Testes do recálculo, da fila (rajada de 12 = 5 criados e 7 recusados, no máximo 1 transação por usuário), de usuários diferentes que não se bloqueiam e de erro que não trava a fila. |

## Controller e lib

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/controller/groups.controller.js`, `groupInvitations.controller.js` | **Criados.** |
| `BackEndTorv/src/controller/workout.controller.js` | **Editado.** `updateSession`, `deleteSession` e o 400 (não 409) para o teto diário. |
| `BackEndTorv/src/controller/profile.controller.js` | **Editado.** Usa a nova `imageUpload`. |
| `BackEndTorv/src/lib/imageUpload.js` | **Criado.** Validação de tipo e de assinatura da imagem, gravar, apagar e URL absoluta, extraídas do perfil e usadas também pela capa. |
| `BackEndTorv/src/lib/groupRules.js` | **Criado.** Regras puras: dia local, grupo encerrado, datas, token (alfabeto sem `0 O 1 I L`), `rankRows`. |
| `BackEndTorv/src/lib/workoutValidation.js` | **Editado.** Janela de 72 h e fim no futuro. |
| `BackEndTorv/src/lib/tests/groupRules.test.js`, `imageUpload.test.js` (novos), `workoutValidation.test.js` | Testes. |

## Routes

| Arquivo | O quê |
|---|---|
| `BackEndTorv/src/routes/groups.routes.js`, `groupInvitations.routes.js`, `groups.schemas.js` | **Criados.** 14 rotas em `/groups`: CRUD, capa, ranking, membros, convites, pedidos, link e `join`. Rate limit de 30 por minuto nos convites e de 20 por minuto nas rotas `join`, por IP. |
| `BackEndTorv/src/routes/workout.routes.js` | **Editado.** `PUT` e `DELETE /workouts/sessions/:id` (só o dono; o `PUT` nunca muda `started_at`). |
| `BackEndTorv/src/routes/workout.schemas.js` | **Editado.** `SessionEditBody` (só duração e carga, por id de série) e `id` em cada série do `SessionDetail`. |
| `BackEndTorv/server.js` | **Editado.** Registra os 2 plugins em `/groups`. |
| `groups.routes.test.js`, `groupInvitations.routes.test.js` (novos), `workout.routes.test.js`, `workout.sessions.test.js` | Testes de papel, visibilidade, 404 vs 403, convites, link, capa, `PUT`/`DELETE` e os limites de sessão. |

## Frontend (`FrontEndTorv/`)

- **Novos:**
  - `src/components/GroupCard/`, `GroupCover/`: card e capa.
  - `src/screens/Groups/` (a aba), `GroupDetail/`, `GroupEditor/`, `GroupManage/`, `JoinGroup/`, `WorkoutEdit/`.
  - `src/services/groups.ts`: `groupsApi` e os tipos.
  - `src/utils/groupPeriod.ts`, `groupLink.ts`, `groupErrors.ts`, `setEdit.ts` (cada um com teste `.test.mjs`), mais `pendingJoin.ts` (guarda o código quando o link abre deslogado) e `sessionsVersion.ts` (faz o Histórico recarregar depois de editar ou apagar um treino).
- **Editados:**
  - `src/routes/PrivateRoutes/index.tsx`, `routes/index.tsx` e `routes/types.ts`: a 5ª aba (`minWidth` do ícone de 64 para 56) e as telas empilhadas. O `linking` abre `join/:token`.
  - `app.json`, `package.json` e o lock: `scheme: "torv"` e `expo-linking`.
  - `src/services/workouts.ts`: `updateSession` e `deleteSession`.
  - `src/screens/WorkoutSummary/index.tsx` e `Workouts/History.tsx`: **Editar** e **Excluir**, e recarregar o Histórico.
- **Visual (`/frontend-design`):**
  - **Cartões:** o texto quebra em vez de truncar em 320 px. O nome muito longo é cortado em 2 linhas com `…` por desenho (o nome inteiro fica no detalhe e no rótulo de acessibilidade).
  - **Alvos:** os switches do editor viraram linhas inteiras de 52 px, alvos de 44 px.
  - **Confirmação:** a exclusão usa o `ConfirmModal` (o `Alert.alert` não funciona no Expo web).

---

## Ciclo e relatórios (`docs/`)

| Etapa | Resultado | Relatório |
|---|---|---|
| Teste da etapa Database | PASS 9/9. Migrations aplicadas com checksum, CHECKs, cascade, RLS e trigger antigo removido, tudo testado dentro de uma transação desfeita | `qa-groups-competition-database-2026-10-06.md` |
| Teste da etapa Backend | PASS, 159 testes. Contrato ao vivo (CRUD, capa, convite, pedido, link, ranking, `PUT`/`DELETE`) e cenários A e B do ranking, com a consulta de consistência em 0 linhas | `qa-groups-competition-backend-2026-10-06.md` |
| Teste da etapa Frontend (round 1) | **FAIL**, 1 MEDIUM e 3 LOW: `GroupCard` cortado em 320 px, switches < 44 px, texto errado no convite | `qa-groups-competition-frontend-2026-10-06.md` |
| Reteste Frontend | PASS | `qa-groups-competition-frontend-2026-10-06-round2.md` |
| **Teste completo** | **PASS**, 2 LOW pré-existentes e fora da feature | `qa-groups-competition-full-2026-10-06.md` |
| Security (round 1) | **FAIL**: MEDIUM ranking forjável, LOW enumeração de username, LOW capa de grupo privado em `/uploads` (aceito) | `security-groups-competition-2026-10-06.md` |
| Reteste Backend após o Security (`40803bb`, `adec806`, `4abda0e`) | **FAIL**: a rajada paralela dava 500 e deixava os outros usuários lentos | `qa-groups-competition-backend-2026-10-06-round2.md` |
| Reteste Backend após a fila por usuário (`556f09d`) | **PASS** | `qa-groups-competition-backend-2026-10-06-round3.md` |
| **Security round 2** | **PASS** (0 MEDIUM; 3 LOW opcionais) | `security-groups-competition-2026-10-06-round2.md` |

## Para você decidir (não bloqueia)

1. **O ranking por dias é autodeclarado (LOW do Security).** Com as regras novas, uma conta nova, sem treino real, ainda ganhou 4 pontos em 2 grupos com 4 treinos falsos enviados à API (1 ponto por dia, nas últimas 72 h). Nenhuma regra de servidor fecha isso, porque o app é quem informa o treino. Aceitei o risco por escrito na spec. As saídas são encurtar a janela de 72 h (24 a 48 h), contar com o dono removendo membro suspeito (já existe) ou, numa fase 2, validar por dispositivo ou GPS.
2. **Desempate forjável (LOW R2-2).** O teto de 5 treinos é por dia **UTC**, mas o ranking conta por dia **local**. Num grupo com fuso −180, 5 treinos num dia UTC mais 5 no seguinte caem no mesmo dia local e dão 1 ponto com 10 atividades, e quem treina uma vez por dia perde o desempate. A correção é pequena: contar no máximo 2 atividades por dia local no recálculo, ou tirar `activities_count` do desempate e usar quem entrou primeiro.
3. **Fila sem limite de profundidade (LOW R2-3, e LOW R3-1 do round 3).** Uma rajada de 60 POSTs do mesmo usuário demorou até 45 s para ser toda respondida (a maior parte das respostas é 400). Zero 500, a memória ficou plana e o Map não vaza. Só quem faz a rajada espera, mas um cliente com timeout curto veria erro de rede. As correções sugeridas são checar o teto antes de entrar na fila, limitar a fila (ex.: mais de 3 pendentes dá 429) e pôr rate limit por usuário em `POST /workouts/sessions`. Para derrubar o pool seria preciso rajada de cerca de 5 contas ao mesmo tempo, e isso foi concluído por análise, **não por teste**.
4. **Credencial no log do Security.** Uma checagem do `.env` pelo recruit Torv Security imprimiu a `DATABASE_URL` no terminal dele por engano. Ela não foi gravada em arquivo nem no relatório. **Se o log desse terminal for retido, vale rotacionar a senha do usuário `torv_api`.**
5. **Capa de grupo privado sem autenticação (LOW aceito).** `/uploads/` serve a capa como serve a foto de perfil. O nome do arquivo tem o UUID do grupo e cerca de 30 bits aleatórios. Resolve com a migração do storage (URL assinada).
6. **Deploy:** o rate limit é por `request.ip`, e o `server.js` não tem `trustProxy`. Atrás de proxy ou balanceador, todos os clientes dividiriam um balde só. Ao ligar o `trustProxy`, use o número de saltos (`trustProxy: 1`), nunca `true`.
7. **Pré-existentes encontrados pelo teste completo, fora da feature:**
   - "Adicionar refeição" fica sob a barra de baixo em 320×691 (só a faixa de 667 a 691 é tocável);
   - o Perfil mostrou "Nenhuma refeição ainda" entre 23:51 e 23:59 locais enquanto a Home e a My Diet mostravam a refeição, por causa do dia do servidor (UTC) contra o dia local.
8. **Pontos menores (INFO):**
   - o teto de 5 conta só `STRENGTH`, e o ranking soma qualquer tipo; hoje só existe `STRENGTH`, mas o tipo novo precisa entrar no teto;
   - reenviar o mesmo treino enquanto o primeiro ainda está na fila pode dar 400 com o treino já salvo;
   - o nome muito longo de grupo é cortado no card (inteiro no detalhe);
   - o chip **Personalizado** do Histórico fica fora da tela em 320 px até rolar;
   - "Pedido enviado" aparece duas vezes no `GroupDetail`;
   - o erro de `GroupManage` não tem `role=alert`;
   - os dias do `DatePickerModal` seguem com 33×33 px.
9. **Itens ainda abertos** dos `revisar*.md` anteriores: sem rate limit geral, `started_at` vem do app (agora com janela de 72 h), mês e streak em UTC e "+0 vs mês passado" fixo no código.

## Ambiente

- **Backend e Expo:** o backend roda no Furnace. Eu o reiniciei com `npm run dev` depois do `556f09d`, e ele está com o código novo. O Expo no terminal "Expo" não foi mexido.
- **Spec e plano:** no começo desta sessão sobrescrevi a spec com uma versão antiga e deixei o plano marcado como apagado na árvore. Restaurei os dois com `git checkout` do HEAD. Nada se perdeu, porque o HEAD já tinha as versões certas e alinhadas.
- **Sem commit (de propósito):** `CLAUDE.md`, `FrontEndTorv/src/screens/Login/index.tsx`, `revisar.md`, `revisar2.md`, `revisar3.md` e este `revisar4.md`.
- **Texto solto nos recruits:** sobrou texto digitado, mas não enviado, na linha de entrada de dois terminais: "Rode o Security no diff do 556f09d" no Torv Review and Tests e "Task 17 round 2 aceito, feche a feature" no Torv Security. Nenhum foi executado. Vale limpar os dois campos antes de usar esses recruits de novo.
- **MCP do Supabase:** segue ligado a outro projeto. Todas as conferências do banco foram pelo Prisma.
- **Contas de teste:** as contas e os grupos de QA desta feature foram apagados e conferidos por SQL em todas as rodadas (`users 77`, `groups 0`, `activities 408`, mesmos 8 arquivos em `profilePhotos`). Ficaram só as de ciclos anteriores.

**Falta:**
- testar no celular (Expo Go na mesma rede do PC). Não foram verificados: o link `torv://` com o app fechado (no Expo Go o esquema é `exp://`, e o teste real exige build de desenvolvimento), o compartilhamento nativo (`Share`) e o teclado cobrindo campos. Todas as telas foram testadas no Expo web, em 320 px, sem capturas de tela (o portal não renderiza `screenshot`; a evidência é a árvore de acessibilidade, estilos medidos e SQL);
- decidir os itens 1 a 3 acima, se quiser endurecer o ranking;
- aprovar a branch;
- o push fica para quando você pedir.
