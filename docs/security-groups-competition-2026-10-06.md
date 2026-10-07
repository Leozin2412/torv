# Security — Grupos e competição (Task 17) — 2026-10-06

**Escopo:** `git diff 67b53dc~1..HEAD -- BackEndTorv BancoDeDadosTorv FrontEndTorv` (HEAD `119abe4`). Fora: `CLAUDE.md`, `revisar*.md`, `Login/index.tsx` (não commitados, alheios). Spec e plano lidos (Task 17 e Global Constraints).
**Método:** leitura integral do código novo (rotas, controllers, repositories, libs, migrations, front de grupos) + consultas SELECT somente leitura no banco do projeto via Prisma (`BackEndTorv/.env`). Nenhum código nem dado alterado. Conector Supabase do ambiente não usado (aponta para outro projeto).

## Veredito: FAIL (1 MEDIUM, 2 LOW, 6 INFO) — 0 CRITICAL, 0 HIGH

- Controle de acesso, injeção, upload, RLS, registro e frontend: sem falha.
- **MEDIUM-1** (ranking forjável por backdating) é a razão do FAIL. Correção pequena. O Maestro pode também aceitar o risco por escrito; nesse caso o resultado vira PASS com ressalva.
- Retrabalho: **Task 6** (MEDIUM-1) e **Task 5** (LOW-1). Testar de novo só o que mudar (nova rodada, `-round2`).

## Achados

### MEDIUM-1 — Ranking forjável: treino fabricado vale 1 ponto por dia desde `joined_at` (A04 / integridade)
- **Onde:** `src/lib/workoutValidation.js:19-22` (`checkSessionBody`), `src/controller/workout.controller.js:147-163`, `src/repository/groups.repository.js:18-30`.
- **O que:** a regra só recusa `started_at` < 2026-01-01 ou > agora+5 min. Qualquer membro pode enviar `POST /workouts/sessions` com `started_at` em qualquer instante entre `joined_at` e agora, `duration_sec: 1`, 1 série de 0 s, e cada dia local distinto vira 1 ponto. A "data imutável" e o `start_time >= joined_at` do spec só impedem editar depois e contar o que veio antes da entrada. Não impedem forjar o que veio depois.
- **Repetição com `start_time` diferente:** a idempotência é por `started_at` exato (ms). Sessões com `started_at` diferente no mesmo dia dão 1 ponto, mas **`activities_count` cresce sem limite** (cada POST cria 1 atividade). `activities_count` é o 1º desempate do ranking (`rankRows`), então empate de pontos se decide por forjamento.
- **Exploração:** membro há 20 dias, 3 treinos reais → 20 POSTs com `started_at` de cada dia → 20 pontos. Ou 500 POSTs no mesmo dia para ganhar todo desempate.
- **Correção sugerida (decisão do Maestro, em camadas):** (1) janela de backdating em `checkSessionBody` (ex.: `started_at` ≥ agora − 48 h; app cliente envia ao concluir o treino); (2) `started_at + duration_sec` ≤ agora + tolerância; (3) piso de plausibilidade (ex.: `duration_sec` ≥ 300 e ao menos 1 série com `duration_sec` > 0); (4) teto de sessões por dia local (ex.: 5) no `createSession`, na mesma transação do `recomputeRanking`. Limite de taxa fica fora de escopo; o teto por dia é regra de integridade.
- **Reabrir:** Task 6 (`workoutValidation.js`, `createSession`) + teste em `workout.sessions.test.js`.

### LOW-1 — Convite por username diferencia usuário existente de inexistente (A01/A04, desvio do spec)
- **Onde:** `src/repository/groupInvitations.repository.js:20-32`, `groupInvitations.controller.js:12-17`.
- **O que:** spec diz "resposta genérica para inexistente". Hoje existente → 201 (ou 409 `Already a member`/`Already pending`) e inexistente → 404. Qualquer usuário cria um grupo (sem limite) e passa a testar usernames. Efeito colateral: spam de convites na caixa da vítima, com nome de grupo livre (até 100 caracteres) e o username de quem convidou.
- **Atenuante:** username já é exibido no ranking de grupos e é `@unique` (listável por quem entra em grupos).
- **Correção sugerida:** responder igual nos dois casos (201 `{ id }` falso ou 202 sem corpo quando não existe) e tratar `already_member`/`duplicate` também com a mesma resposta; ou aceitar o desvio e documentar no spec.
- **Reabrir:** Task 5.

### LOW-2 — Capa de grupo PRIVATE servida sem autenticação em `/uploads/`
- **Onde:** `server.js:21-24` (`@fastify/static`), `groups.controller.js:111` (nome do arquivo).
- **O que:** quem tiver a URL baixa a capa, mesmo de grupo privado. Nome `group-<uuid>-<Date.now()>-<randomInt(1e9)>.<ext>`: o UUID do grupo (não adivinhável) mais ~30 bits aleatórios. URL só chega a membros, convidados e quem tem o código. Não há listagem de diretório.
- **Risco real baixo.** Pior caso: capa vaza se a URL for compartilhada. Resolve quando o storage migrar (Supabase Storage com RLS/URL assinada). Nenhum caminho de foto chega ao Supabase Storage nesta feature (nada a verificar de RLS de bucket agora).
- **Reabrir:** nenhuma. Registrar no backlog da migração de storage.

### INFO
- **INFO-1** Convite/link sem expiração: o link vale até o dono revogar ou regenerar. Membro removido pode entrar de novo pelo mesmo link enquanto ele existir. Sem lista de banidos. Aceitável: o link equivale a convite do dono.
- **INFO-2** Rate limit de `/groups/join/*` é por IP (20/min). Espaço do código: 31^8 ≈ 8,5e11. Com 20 tentativas/min por IP, adivinhar um código é inviável. Atrás de proxy sem `trustProxy`, todos os clientes cairiam no mesmo balde (disponibilidade, fora de escopo). Código inválido de formato responde 404 sem tocar o banco.
- **INFO-3** `publicUrl` monta a URL com `request.headers.host`. A resposta só volta a quem enviou o header; nada é gravado nem cacheado (o banco guarda só o nome do arquivo). Padrão herdado da foto de perfil. Não explorável.
- **INFO-4** `uploadCover` grava o arquivo antes de `setCover`. Falha entre os dois deixa arquivo órfão em `profilePhotos/` (ignorado no git). Sem impacto de segurança.
- **INFO-5** Deep link `torv://` é esquema customizado: no Android outro app pode registrar o mesmo esquema e ler o código. O código só dá entrada num grupo (mesmo poder de um convite). Universal/App Links ficam para depois da publicação.
- **INFO-6** `GET /groups/join/:token` revela nome, capa, período e contagem de membros a quem tem o código (inclusive de grupo PRIVATE). É o propósito do link.

## Checklist por item

### A01 — Controle de acesso: PASS
| Item | Resultado |
|---|---|
| Toda rota filtra por `userId` do token (`jwtVerify` com JWKS + issuer; `userId = sub`) | PASS. `preHandler` em ambos os plugins; nenhum `userId` vem de corpo/params exceto `:userId` de `removeMember`, que é validado como alvo e comparado ao ator. |
| `GET /groups/:id` privado a não membro → 404 | PASS (`getForViewer` devolve `null`). `invite_token` só sai para o dono (`detail`). |
| PATCH / DELETE / cover / invite-link (POST/DELETE) / `GET :id/requests` só do dono | PASS (`getOwned`, `deleteGroup`, `setInviteToken`, `listPending` filtram `owner_id`; resposta 404). |
| `POST :id/invitations` só do dono | PASS (`findFirst` com `owner_id`). |
| `POST :id/requests` só em grupo PUBLIC | PASS (privado/inexistente → 404). |
| accept/decline: INVITE só o convidado, REQUEST só o dono | PASS (`decider` em `resolve`; qualquer outro → 404; `not_pending` → 409). |
| cancel só do criador e pendente | PASS (`updateMany` com `created_by`). |
| `removeMember`: dono remove outro, membro sai, dono não sai, terceiro → 404 | PASS. |
| Ranking só para membro | PASS (`getRanking` exige membership). Pedido de entrada em grupo público exige aprovação, então ranking não vaza para fora. |
| `PUT /workouts/sessions/:id` só do dono, série de outra atividade → 400 | PASS (`findFirst` por `id` + `user_id` + STRENGTH; `own.has` antes de qualquer escrita; `deleteMany` preso a `activity_id`). 404 para de outro usuário. |
| `DELETE /workouts/sessions/:id` só do dono | PASS (`deleteMany` com `user_id`). |
| IDOR em todos os `:id` | PASS. Todos usam `Uuid` com `pattern` estrito. Corpos sem campo de `owner_id`/`group_id`; controllers escolhem campos explicitamente (mass assignment: PASS). |

### A02 / A04 — Projeto e criptografia: PASS
- Código: 8 caracteres via `crypto.randomInt` (`generateInviteToken`), alfabeto de 31 símbolos sem `0 O 1 I L`. UNIQUE no banco; colisão tratada (`P2002`, 5 tentativas).
- Rate limit: só `GET/POST /groups/join/:token` (20/min/IP, `@fastify/rate-limit` no plugin de convites; `onRequest` roda antes da autenticação). Bastam por IP para este espaço (INFO-2).
- Revogação e regeneração: `setInviteToken(null | novo)` invalida o antigo; QA mostrou 404 no antigo.
- O link entra direto como convite do dono (INFO-1). Grupo encerrado → 409 em convite, pedido, aceite e link.
- Token no banco hoje: 0 grupos (QA limpou); formato validado por teste de rota.

### A03 — Injeção: PASS
- SQL cru: `recomputeRanking`/`recomputeGroup` usam `Prisma.sql` com `${userId}::uuid` / `${groupId}::uuid`. `discover` usa `$queryRaw` tagged template (`${like}`, `${userId}`, `${limit + 1}`, `${offset}` viram parâmetros). `workout.repository` `$executeRaw` pré-existente, parametrizado.
- Nenhum identificador (tabela, coluna, `ORDER BY`) vem do cliente.
- `ILIKE`: `q.replace(/[\\%_]/g, '\\$&')` + `ESCAPE '\\'`. QA backend (a) provou `%`, `_`, `\` literais; `q` com 101 caracteres → 400. Não repeti ao vivo.
- `userId` é `sub` de JWT verificado; `::uuid` quebraria em 500 genérico se algo estranho passasse (não passa).

### A05 — Configuração: PASS
- Migration `20261006120000_groups`: CHECKs (`visibility`, período, fuso), FKs com cascade, índice único parcial de pendente, `ENABLE ROW LEVEL SECURITY` + `torv_api_full_access` em `group_invitations`.
- **Banco ao vivo (SELECT):** `relrowsecurity = true` em `groups`, `group_members`, `group_rankings`, `group_invitations`, `activities`; policies só para `torv_api` (`cmd ALL`) nas 4 tabelas; `information_schema.role_table_grants` sem nenhum privilégio para `anon`/`authenticated`/`PUBLIC` nas tabelas `group%`. `torv_api`, `anon`, `authenticated`: `rolbypassrls = false`.
- `profilePhotos/` ignorado (`.gitignore:19`). Um arquivo antigo ainda rastreado, pré-existente e fora desta feature.
- `/uploads/` serve só `profilePhotos`, sem listagem (LOW-2 sobre autenticação).
- Swagger fora de produção (pré-existente).

### A08 — Integridade e upload: PASS
- Tipo declarado (`image/jpeg|png|webp`, SVG fora) + assinatura de bytes (`hasValidImageSignature`); extensão vem do mapa do servidor, não do nome enviado.
- Limite de 5 MB na capa (`maxBytes` repassado ao multipart; `FST_REQ_FILE_TOO_LARGE` e `truncated` → 413). QA: PNG + 5 MB → 413 e capa atual intacta. Foto de perfil segue no limite do `@fastify/multipart` (1 MiB, `bodyLimit`).
- Nome gerado no servidor (`group-<uuid>-<ts>-<randomInt>`); `filename` do cliente nunca entra no caminho.
- `deleteImage` usa `path.basename`: sem path traversal; ignora nulo e ausente. Teste cobre.
- Troca e exclusão apagam o arquivo antigo (falha de `deleteImage` só vira `log.warn`).
- Arquivo salvo com extensão de imagem e servido por tipo MIME da extensão: polyglot (assinatura válida + conteúdo extra) não vira HTML.
- Dono verificado antes de ler o multipart (`getOwned` primeiro).

### A09 — Registro e erros: PASS
- `setErrorHandler`: 5xx → `{ error: 'An unexpected error occurred' }` sem detalhe; 4xx do Fastify mantêm mensagem curta da lib. Respostas de grupo usam `FAILURES` (mensagens fixas).
- Nada sensível em log nos arquivos novos: sem token, sem corpo, sem JWT. `request.log.warn(err)` só em falha de `deleteImage`.
- Log de uso (`onResponse`) pré-existente: método, URL, status. A URL de `/groups/join/:token` leva o código no log do servidor (URL assumida segura; token só dá entrada em grupo).

### Trapaça no ranking: FAIL (MEDIUM-1), resto PASS
| Item | Resultado |
|---|---|
| Data do treino imutável | PASS. `SessionEditBody` com `additionalProperties:false` (Ajv `removeAdditional` descarta `started_at`); `updateSession` nunca grava `start_time`. |
| Contagem só com `start_time >= joined_at` | PASS no SQL (`a.start_time >= gm.joined_at`). Reentrada reinicia (`joined_at` novo, linha zerada). |
| `started_at` futuro ou anterior a 2026-01-01 recusado | PASS (`checkSessionBody`, tolerância de 5 min no futuro). |
| Dia local e janela `starts_at`/`ends_at` | PASS, mesma conta de `groupToday`. |
| Apagar treino recalcula na mesma transação | PASS. `createSession` e `deleteSession` chamam `recomputeRanking` dentro da `$transaction`. Não há outro caminho que crie, apague ou mude data de `activities` (grep: só `workout.repository`). |
| Inflar com POST de datas arbitrárias entre `joined_at` e agora | **FAIL — MEDIUM-1.** |
| Repetição de treino com `start_time` diferente | **FAIL — MEDIUM-1** (`activities_count` ilimitado). |
| Trigger legado `+10` | PASS (ver abaixo). |
| Dono altera período e refaz o ranking | PASS por desenho: o dono controla o período do próprio grupo (`recompute` só na janela). Não é escalonamento. |

### Decisão de DROP do trigger legado: PASS
`20261006120100_drop_group_points_trigger` remove `trg_add_points_to_group_ranking` e `trg_fn_add_points_to_group_ranking()` (`IF EXISTS`). Correto: o trigger somava +10/+1 em **todas** as linhas de `group_rankings` do usuário, ignorando janela, fuso e `joined_at`, e deixava qualquer INSERT em `activities` inflar o ranking. Banco ao vivo: único trigger em `activities` é `trg_update_streak_on_activity`; nenhuma função `%group%` em `public`. Os `.sql` de `BancoDeDadosTorv/` foram sincronizados sem recriá-lo.

### Frontend: PASS
- Sem segredo: o diff não traz chave, JWT nem `EXPO_PUBLIC_*`; nenhum cliente Supabase. Só `api` (axios da nossa API) em `services/groups.ts`; sem `fetch` com URL externa. `package.json`: só `expo-linking` novo.
- `joinTokenFromUrl`: extrai `join/<x>`, decodifica, normaliza e **só devolve o código se casar `^[ALFABETO]{8}$`**; senão `null`. Teste em `groupLink.test.mjs`.
- Sem navegação para destino arbitrário: `handleUrl` só chama `navigate('JoinGroup', { token })` com código validado. Abrir o link só mostra a **prévia**; entrar exige toque em "Entrar no grupo".
- Sem `Alert.alert`; erros passam por `describeError`, que mapeia mensagens fixas e **nunca exibe texto bruto do servidor**.
- Texto de servidor (nome de grupo, nome/username de membro) renderizado por componentes RN (`Text`): sem HTML, sem `dangerouslySetInnerHTML`/WebView.
- Deep link `torv://` declarado em `app.json` (`scheme: "torv"`). Ver INFO-5.

## Pontos fora do diff verificados
- `server.js`: rotas novas sob o mesmo `setErrorHandler`; sem mudança de CORS, multipart ou estático.
- `profile.controller.js`: usa `readImage`/`saveImage`; remove os `console.log` que imprimiam caminho de arquivo (ganho de A09). Mesmo limite de antes.

## Retrabalho
| Achado | Severidade | Task | Escopo |
|---|---|---|---|
| MEDIUM-1 ranking forjável | MEDIUM | **Task 6** (Backend) | `workoutValidation.js`, `createSession`; testes de rota |
| LOW-1 oráculo de username | LOW | **Task 5** (Backend) | `inviteByUsername` / controller `invite` |
| LOW-2 capa privada pública | LOW | nenhuma | backlog da migração de storage |

Depois do retrabalho: nova rodada de testes só nas camadas tocadas (Backend), depois Security `-round2` só nos arquivos alterados. A feature só fecha com Testing e Security verdes na mesma rodada.
