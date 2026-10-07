# Grupos e competição — Design

**Data:** 2026-10-06 · **Branch:** `feat/workout-module` · **Base:** `activities` / `workout_sets` (módulo de treinos), tabelas `groups`, `group_members` e `group_rankings` já existentes no schema (hoje sem nenhum uso no código).

## Objetivo

1. Usuários criam **grupos** com **foto de capa**, e outros entram por convite dentro do app, por pedido de entrada ou por link/código.
2. Dentro do grupo, os membros **competem pela constância**: o ranking conta os dias em que cada um treinou, dentro do período definido pelo grupo. Sem data de término, a competição segue para sempre.
3. Treinos já salvos passam a poder ser **editados e excluídos**, o que obriga o ranking a ficar correto quando um treino é apagado.

## Decisões

| Tema | Decisão |
|---|---|
| Pontuação | 1 ponto por **dia local** com pelo menos uma atividade (de qualquer `activity_type`). Vários treinos no mesmo dia valem 1. |
| Janela de cada membro | Atividades com `start_time >= joined_at` **e** dia local entre `starts_at` e `ends_at` (inclusivo; `ends_at` nulo = sem fim). Quem entra tarde começa zerado. |
| Dia local | `(start_time AT TIME ZONE 'UTC') + tz_offset_min`, com `tz_offset_min` gravado no grupo na criação (offset do admin). Todos os membros usam a mesma régua. Mesma fórmula do `strengthDays`. |
| Ranking | **Materializado em `group_rankings`**, sem cache em memória. Ordem: `total_points` desc, `activities_count` desc, `joined_at` asc. Posições sequenciais, sem empate. |
| Manutenção da tabela | **Recalcula**, não incrementa. `recomputeRanking` refaz a linha a partir de `activities` com `INSERT … ON CONFLICT DO UPDATE`, idempotente. |
| Admin | Só o criador (`owner_id`). Vários admins e transferência de posse ficam de fora. |
| Visibilidade | `PUBLIC` (aparece na busca, aceita pedido de entrada) ou `PRIVATE` (só convite ou link), escolhida pelo admin. |
| Entrada | Link/código entra **direto**. Convite aceito pelo convidado entra direto. Pedido de entrada precisa de aprovação do admin. |
| Grupo encerrado | Continua visível, com o ranking congelado (a janela fechou). **Não aceita novos membros** (convite, pedido e link retornam 409). |
| Data do treino | **Fixa**: o `PUT` de uma sessão não altera `started_at`. Evita voltar a data para ganhar ponto. |
| Capa | Upload multipart, mesmas validações da foto de perfil. Arquivo em disco, servido por `/uploads`; URLs absolutas montadas no backend. |
| Link de convite | Fase 1: `torv://join/<token>` + código digitável. O link `https` universal é a fase 2 e depende de domínio e backend públicos. |
| Dono apaga a conta | O grupo é apagado junto (`owner_id` com `onDelete: Cascade`). |

## Banco de dados

Migration do `torv-database` (Postgres/Supabase). O Prisma só reflete o schema; a migration é SQL.

**`groups`** — altera:
- `+ owner_id uuid NOT NULL` → `users(id)` `ON DELETE CASCADE`
- `+ visibility varchar(10) NOT NULL` com `CHECK (visibility IN ('PUBLIC','PRIVATE'))`
- `+ cover_url varchar(500) NULL` (guarda o nome do arquivo, como `user_profiles.photo_url`)
- `+ starts_at date NOT NULL`
- `+ ends_at date NULL` com `CHECK (ends_at IS NULL OR ends_at >= starts_at)`
- `+ tz_offset_min int NOT NULL` com `CHECK (tz_offset_min BETWEEN -840 AND 840)`
- `+ invite_token varchar(12) NULL UNIQUE`
- `+ created_at timestamptz DEFAULT now()`
- `- period_type`

**`group_members`** — sem mudança. O dono entra como membro na criação.

**`group_rankings`** — fica, sem mudança de colunas:
- `total_points` = dias locais distintos na janela do membro.
- `activities_count` = atividades brutas na mesma janela (desempate).
- `+ índice (group_id, total_points DESC, activities_count DESC)`.

**`group_invitations`** — nova:

| Coluna | Tipo |
|---|---|
| `id` | uuid PK, `gen_random_uuid()` |
| `group_id` | uuid → `groups(id)` cascade |
| `user_id` | uuid → `users(id)` cascade. O convidado, ou quem pediu para entrar |
| `kind` | `CHECK IN ('INVITE','REQUEST')` |
| `status` | `CHECK IN ('PENDING','ACCEPTED','DECLINED','CANCELED')` |
| `created_by` | uuid → `users(id)` cascade |
| `created_at`, `resolved_at` | timestamptz |

Índice único parcial `(group_id, user_id) WHERE status = 'PENDING'` impede duplicados.

`workout_sets.activity_id` já tem `ON DELETE CASCADE` (confirmado no schema), então excluir a atividade leva as séries junto.

## Backend

Padrão atual: Fastify + Typebox, `routes → controller → repository`, JWT em todas as rotas, `userId` sempre do token. Quem não pode ver um grupo recebe **404**. Toda query de membro, dono e atividade filtra por `userId` (anti-IDOR).

### Rotas de grupos — novo `groups.routes.js`, `prefix: '/groups'`

| Rota | Quem | Efeito |
|---|---|---|
| `POST /` | autenticado | cria o grupo (`name`, `visibility`, `starts_at`, `ends_at` nullable, `tz_offset_min`); insere o dono em `group_members` e a linha zerada em `group_rankings`, numa transação |
| `GET /` | autenticado | meus grupos, com nº de membros, minha posição e meus pontos |
| `GET /discover?q=&cursor=` | autenticado | busca por nome entre grupos `PUBLIC`, ainda não encerrados e dos quais não sou membro; `cursor` é o deslocamento (20 por página) e a resposta traz `next_cursor` |
| `GET /:id` | membro; qualquer um se `PUBLIC` | detalhes e capa |
| `PATCH /:id` | dono | `name`, `visibility`, `starts_at`, `ends_at`. Mudou o período → `recomputeGroup` |
| `DELETE /:id` | dono | apaga o grupo (cascade) e o arquivo da capa |
| `POST /:id/cover` | dono | multipart, campo `photo`; troca e apaga a capa anterior |
| `GET /:id/ranking` | membro | lê `group_rankings` + nome e foto, ordenado, com a flag "sou eu" |
| `DELETE /:id/members/:userId` | dono remove; o próprio usuário sai | apaga membro e linha de ranking. O dono não sai (só exclui o grupo). Reentrar cria novo `joined_at` e reinicia a contagem |
| `POST /:id/invitations` `{username}` | dono | cria `INVITE`. Username exato; usuário inexistente → 404 genérico |
| `POST /:id/requests` | autenticado | cria `REQUEST` em grupo `PUBLIC` |
| `GET /:id/requests` | dono | pedidos pendentes |
| `GET /invitations/received` | autenticado | convites `INVITE` pendentes para mim |
| `POST /invitations/:id/accept` e `/decline` | convidado (`INVITE`) ou dono (`REQUEST`) | resolve; aceitar cria membro e linha de ranking |
| `DELETE /invitations/:id` | quem criou | `CANCELED` |
| `POST /:id/invite-link` | dono | gera ou regenera o `invite_token`. `DELETE` revoga (`NULL`) |
| `GET /join/:token` | autenticado | prévia: nome, capa, nº de membros |
| `POST /join/:token` | autenticado | entra direto |

`/groups/invitations/*` e `/groups/join/*` são segmentos estáticos e têm prioridade sobre `/:id` no roteador.

Regras comuns: já é membro → 409; grupo encerrado → 409; convite ou pedido `PENDING` duplicado → 409.

### Token de convite

8 caracteres de um alfabeto de 31 símbolos sem ambiguidade (sem `0/O/1/I/L`, ~8,5e11 combinações), comparado em maiúsculas, gerado com `crypto.randomInt`. Em colisão do `UNIQUE`, gera de novo. As rotas `/join/:token` usam `@fastify/rate-limit` (já dependência do projeto) para frear tentativa de adivinhar tokens.

### Ranking

`recomputeRanking(tx, userId)` refaz, para cada grupo do usuário, a linha `(group_id, user_id)`:

```sql
INSERT INTO group_rankings (group_id, user_id, total_points, activities_count)
SELECT gm.group_id, gm.user_id,
       COUNT(DISTINCT d.local_day), COUNT(d.local_day)
FROM group_members gm
JOIN groups g ON g.id = gm.group_id
LEFT JOIN LATERAL (
  SELECT ((a.start_time AT TIME ZONE 'UTC') + make_interval(mins => g.tz_offset_min))::date AS local_day
  FROM activities a
  WHERE a.user_id = gm.user_id AND a.start_time >= gm.joined_at
) d ON d.local_day >= g.starts_at AND (g.ends_at IS NULL OR d.local_day <= g.ends_at)
WHERE gm.user_id = $1
GROUP BY gm.group_id, gm.user_id
ON CONFLICT (group_id, user_id) DO UPDATE
  SET total_points = EXCLUDED.total_points, activities_count = EXCLUDED.activities_count;
```

(A forma final é decidida no plano e validada por teste; a regra de negócio é a da tabela de decisões.) `recomputeGroup(groupId)` faz o mesmo para todos os membros do grupo. Pontos de chamada:

1. `workoutRepository.createSession`, dentro da transação existente (`workout.repository.js:222`).
2. `DELETE /workouts/sessions/:id`, dentro da transação.
3. `PATCH /groups/:id` quando `starts_at` ou `ends_at` mudam (`recomputeGroup`).
4. Entrada de membro: insere a linha zerada (nada a recalcular, `joined_at = now()`).

O `PUT` de sessão **não** recalcula, porque não muda `started_at`. Qualquer novo ponto que crie, apague ou mude a data de uma atividade passa a chamar `recomputeRanking`; isso fica comentado no código.

### Editar e excluir atividade — `workout.routes.js`

- `GET /workouts/sessions/:id` passa a devolver o `id` de cada série.
- `PUT /workouts/sessions/:id`: corpo `{ duration_sec, sets: [{ id, duration_sec, weight_kg }] }`. Atualiza `duration_sec` da atividade e, para cada série listada, `duration_sec` e `weight_kg`; **as séries não listadas são apagadas** (é assim que se remove uma série; mínimo de 1). Nunca cria série. Todo `id` precisa pertencer à atividade, senão 400. `started_at`, `routine_id`, título, exercício, posição e descanso não mudam. Tudo numa transação, só o dono (`user_id` na query).
- `DELETE /workouts/sessions/:id`: apaga a atividade e chama `recomputeRanking`, na mesma transação. Só o dono.

### Imagem

A validação de tipo e de assinatura hoje está em `profile.controller.js`. Passa para `lib/imageUpload.js` e é usada pelos dois controllers. A gravação em disco fica atrás de uma função do mesmo módulo, o ponto de troca quando o storage de fotos migrar. Capa: prefixo `group-<id>-`.

### Validação (Typebox)

- UUIDs com o padrão estrito de `workout.schemas.js` (o formato `uuid` do Ajv aceita `urn:uuid:`).
- Campos nullable, como `ends_at`: `type: ['string','null']`, **não** `Type.Union` (bug do Ajv `coerceTypes` já registrado no projeto).
- Datas `YYYY-MM-DD`; `ends_at >= starts_at`; `name` de 1 a 100 caracteres; `username` com o mesmo limite do perfil.

## Frontend

`FrontEndTorv` (Expo/React Native). O `AGENTS.md` do frontend exige ler a doc versionada do Expo antes de codar; é um passo do plano.

### Navegação

- Nova aba **Grupos** (ícone `Users`) como 5ª aba; `minWidth` do `TabIcon` cai de 64 para ~56 para caber em telas estreitas.
- Empilhadas acima das abas, em `AppStackParamList`: `GroupDetail {groupId}`, `GroupEditor {groupId?}`, `GroupManage {groupId}`, `JoinGroup {token?}` e `WorkoutEdit {sessionId}`.

### Telas (`screens/<Nome>/index.tsx` + `styles.ts`)

1. **Groups (aba):** segmentos **Meus grupos** e **Descobrir** (busca, só públicos). Card com capa, nome, nº de membros, minha posição e pontos, e o estado do período (ativo, "começa em X dias", encerrado). Seção **Convites recebidos** (aceitar ou recusar), visível só com convite pendente. Ações: **Criar grupo** e **Entrar com código**.
2. **GroupDetail:** capa grande, nome, período, ranking (posição, foto, nome, pontos; top 3 em destaque; minha linha marcada), pull-to-refresh. Membro: **Sair**. Não-membro de grupo público: **Pedir para entrar**. Dono: **Editar** e **Gerenciar**.
3. **GroupEditor:** capa (`expo-image-picker`, já instalado; upload com `FormData` como no Profile), nome, visibilidade, início e fim com o toggle **"Sem data de término"**. Reaproveita o date picker custom.
4. **GroupManage (dono):** convidar por username exato; pedidos pendentes e convites enviados (cancelar); link de convite (compartilhar pelo `Share` nativo, regenerar, revogar); membros com remover; **Excluir grupo** no fim, com confirmação.
5. **JoinGroup:** abre por link ou por código digitado; prévia e botão **Entrar**.

### Link `torv://`

- `scheme: "torv"` no `app.json`, dependência `expo-linking` e `linking` no `NavigationContainer` (`join/:token` → `JoinGroup`).
- Link aberto com o usuário deslogado: guarda o token e processa após o login.
- No Expo Go o esquema é `exp://`; `Linking.createURL` cobre os dois. O teste real do link exige build de desenvolvimento.

### Editar e excluir atividade

- O **WorkoutSummary** com `sessionId` ganha os botões **Editar** e **Excluir**. **Editar** abre a nova tela empilhada `WorkoutEdit {sessionId}`, com peso e duração de cada série em campos editáveis e remover série; não há campo de data. **Excluir** pede confirmação no `ConfirmModal` existente (`Alert.alert` não funciona no Expo web, onde roda o QA de usabilidade).
- Ao voltar, o Home e o Perfil já recarregam no foco. O **Histórico** só traz o que é novo no topo e não notaria um treino apagado; por isso uma versão em memória (`sessionsVersion`) sobe quando um treino é editado ou apagado, e o Histórico e o resumo recarregam do zero ao voltar.

### Serviços e utilitários

- `services/groups.ts`: `groupsApi` e tipos, no estilo de `services/activities.ts`. `workoutsApi` ganha `updateSession` e `deleteSession`.
- `utils/groupPeriod.ts` (rótulo do estado do período e dias restantes), puro, com teste `.test.mjs`.
- O frontend só chama a nossa API; as URLs de capa e de foto dos membros vêm absolutas do backend.

## Segurança

- **IDOR:** toda rota filtra por `userId` do token; recurso de outro usuário ou grupo invisível → 404.
- **Brute force de token:** alfabeto de 8 a 10 caracteres + rate limit nas rotas `/join`; o dono revoga ou regenera.
- **Enumeração de usuários:** convite só por username exato, resposta genérica para inexistente.
- **Upload:** tipo declarado + assinatura do arquivo, nome gerado no servidor, tamanho limitado pelo `@fastify/multipart`.
- **Trapaça no ranking:** data do treino imutável após salvar; a contagem exige `start_time >= joined_at`. A revisão de segurança mostrou que isso não bastava (dava para criar treinos com datas passadas depois da entrada), então `POST /workouts/sessions` agora recusa `started_at` com mais de **72 h**, treino que **termina no futuro** e mais de **5 treinos por dia UTC** por usuário (contados na mesma transação, serializada por `pg_advisory_xact_lock` por usuário). Não há piso de duração, para não recusar treino curto legítimo.
- **Enumeração de username (aceito):** o convite por username responde 404 para inexistente e 201/409 para existente, diferente do "resposta genérica" planejado, porque o dono precisa saber que digitou errado e o username já é público no ranking dos grupos. Mitigação: a rota `POST /groups/:id/invitations` tem rate limit de 30 por minuto (por IP).
- **Capa de grupo privado (aceito):** `/uploads/` serve a capa sem autenticação, como a foto de perfil; o nome do arquivo tem o UUID do grupo e ~30 bits aleatórios. Resolve com a migração do storage (URL assinada).

## Testes

- **Backend** (padrão `*.routes.test.js` do repo): autorização por papel e por visibilidade, 404 vs 403, convites e pedidos (duplicado, já membro, grupo encerrado), token (válido, revogado, regenerado), upload de capa, `PUT` e `DELETE` de sessão (dono, não dono).
- **Ranking:** teste que compara `group_rankings` com a query direta sobre `activities` depois de criar, apagar e mudar o período; casos de borda: fuso, dia com 2 treinos = 1 ponto, treino anterior ao `joined_at`, `ends_at` nulo, `ends_at` no meio, reentrada no grupo.
- **Frontend:** teste do `groupPeriod`; passada de usabilidade no navegador (criar grupo, convidar, aceitar, ver ranking, apagar treino e ver o ranking cair).
- **Execução:** estágios em sequência (banco → backend → frontend), teste a cada estágio e rodada completa no final; depois Security, conforme o ciclo do `CLAUDE.md`.

## Fora do escopo

Notificações push, chat do grupo, card de grupos na Home, mais de um admin, limite de membros ou de grupos por usuário, link `https` universal (fase 2), data de treino editável, cache em memória do ranking (a query de recálculo fica isolada para isso).
