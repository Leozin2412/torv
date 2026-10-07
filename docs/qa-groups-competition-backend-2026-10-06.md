# QA — Grupos e competição — etapa BACKEND (2026-10-06)

**Veredito: PASS — sem retrabalho.** Task 7, Steps 2–7, mais os extras (a)–(d). 0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW / 5 INFO. Nenhum item do plano falhou.

Escopo: commits `026b6cf`, `94ac16d`, `c1ffbe5`, `bd75fad`, `18224b9` (Tasks 2–6). Ao vivo contra o Furnace em `http://localhost:3000` (não parado nem reiniciado; `/documentation` lista as 14 rotas `/groups*` e `GET/PUT/DELETE /workouts/sessions/{id}`).

## Método

- Contas QA (A dono, B convidado, C, D, E) registradas por `/auth/register` (corpo válido, `goal` do enum) — dentro do rate limit de auth (10/min). Tokens só em arquivo temporário do teste, apagado no fim.
- Banco: só Prisma/`$queryRaw` (`DIRECT_URL` do `.env`). Conector Supabase **não usado**. SQL só para: empurrar `joined_at` dos dados de teste para trás, conferir `group_rankings`, cascades e a consulta de consistência.
- Relógio do teste: 2026-10-07 ~00:15–00:25 UTC (= 21:15–21:25 locais em `tz_offset_min=-180`; longe da meia-noite local). Cenário A usa `started_at` = agora−5 s / agora−4 s no lugar de "agora" / "agora+1 s" (a API recusa futuro); mesmo dia local, mesmo efeito.
- **Limpeza (verificada):** 7 grupos, 5 contas (`auth.users` → `users` → perfis/treinos/rotinas por cascade), 2 fotos de perfil criadas pelo teste removidas de `BackEndTorv/profilePhotos/`. Antes → depois: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `activities 408→408`, `group_members 0`, `group_rankings 0`; nenhuma linha com `user_id/owner_id/created_by` das contas QA em tabela alguma; `profilePhotos` com os mesmos 8 arquivos do início.

## Step 2 — Automatizados

`npm test` em `BackEndTorv`: **159 testes, 159 PASS, 0 fail, 0 cancelled, 0 skipped** (~5,3 s). Bate com o esperado (159). **PASS**

## Step 3 — Contrato ao vivo

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | CRUD | **PASS** | POST `PUBLIC`, `starts_at`=hoje−3, sem `ends_at`, tz −180 → 201 (`ends_at:null`, `is_owner`, `member_count 1`). `GET /groups` → `my_rank 1, my_points 0`. B abre público → 200 `is_member:false`, `invite_token:null`. PATCH → `PRIVATE`; B → 404. Extras: `visibility:'X'` → 400; `ends_at<starts_at` → 400; `2026-02-30` → 400; PATCH por não-dono → 404; sem token → 401. |
| 2 | Capa | **PASS** | A, PNG → 200, URL `/uploads/group-<id>-….png` abre (200 `image/png`) e o arquivo existe; B → 404; `.txt` com `image/png` → 400 (assinatura); `text/plain` → 400; PNG + 5 MB → 413; as recusas não mexem na capa atual; trocar a capa → arquivo antigo some, novo existe. |
| 3 | Convite por username | **PASS** | A→B 201; B vê em `invitations/received` (grupo, `invited_by`); repetido → 409 "Already pending"; A→A → 409 "Already a member"; username inexistente → 404; B aceita → 200 e `is_member:true`; convidar membro → 409; aceitar de novo → 409 "not pending"; C tenta `accept` → 404 (também 404 para o dono tentando aceitar o próprio convite). |
| 4 | Pedido de entrada | **PASS** | `PRIVATE` → 404; `PUBLIC` → 201; repetido → 409; A lista em `GET /:id/requests`; membro comum não lista/aceita (404); A aceita → C membro (`member_count 4`). |
| 5 | Link | **PASS** | Token com 8 caracteres do alfabeto (sem I/L/O/0/1); só o dono o vê. `GET /join/%20<minúsculas>%20` → prévia 200; `POST` → 200 entra; de novo → 409. Regenerar → token novo ≠ antigo, antigo → 404 (prévia e entrar); revogar → 204, código → 404, `invite_token` do dono volta a `null`; 33 chars → 400; `ABC` → 404; membro comum gera → 404. **Rate limit:** 21 `GET /groups/join/*` seguidos → 20×404 e a **21ª → 429** (`Rate limit exceeded, retry in 57 seconds`, `retry-after`); `GET /groups` segue 200. |
| 6 | Encerrado | **PASS** | `PATCH ends_at`=ontem → 200. Ranking não muda: C com treino de 2 dias atrás = 1/1; novo treino de hoje depois do fim → segue 1/1 (API e `group_rankings`). `POST /join`, `/requests`, `/invitations`, `accept` (convite) e `accept` (pedido) → todos **409** "Group has ended". Some do `discover`; ativo (G2) aparece. `PATCH ends_at<starts_at` → 400. |
| 7 | Sair e remover | **PASS** | B sai → 204, some do ranking e as linhas `group_members`/`group_rankings` dele sumiram (SQL), B não lê mais o ranking (404); dono sair → 409 "Owner cannot leave…"; membro comum remove outro → 404; não-membro remove → 404; remover quem não é membro → 404; dono remove → 204; quem saiu pode pedir de novo (201). |
| 8 | Excluir grupo | **PASS** | Não-dono → 404 (grupo segue); A apaga → 204; `GET` → 404; capa some do disco; SQL: antes `{membros 2, convites 4, rankings 2, grupo 1}` → depois tudo 0 (cascade). |

## Step 4 — Ranking ao vivo (valores esperados × obtidos; API **e** `group_rankings`)

**Cenário A** (G2: tz −180, `starts_at` hoje−3, `ends_at` nulo; B entrou por link):

| Passo | Esperado | Obtido (API / SQL) |
|---|---|---|
| 1 entra | 0/0 | 0/0 · 0/0 **PASS** |
| 2 treino agora−1 h (antes do `joined_at`) | 0/0 | 0/0 · 0/0 **PASS** |
| 3 treino agora | 1/1 | 1/1 · 1/1 **PASS** |
| 4 2º treino, mesmo dia local | 1/2 | 1/2 · 1/2 **PASS** |
| 5 apagar o 1º | 1/1 | 1/1 · 1/1 **PASS** |
| 6 apagar o 2º | 0/0 | 0/0 · 0/0 **PASS** |
| 7 treino de novo / `starts_at`=amanhã / de volta | 1/1 → 0/0 → 1/1 | 1/1 → 0/0 → 1/1 (API e SQL) **PASS** |

**Cenário B** (dia local do grupo, não o UTC). `m=16` → `tz_offset_min=-16`. T1 = agora−10 min (local 23:55 do dia anterior), T2 = agora−2 min (local 00:03): 2 dias locais, `joined_at` de B empurrado 2 dias por SQL.

| Grupo | Esperado | Obtido (API / SQL) |
|---|---|---|
| tz −16 | 2/2 | 2/2 · 2/2 **PASS** |
| tz 0 (T1 e T2 no **mesmo dia UTC**, conferido: 2026-10-07) | 1/2 | 1/2 · 1/2 **PASS** |

Nota: na 1ª leitura veio 2/4 nos dois grupos. Causa: **dado residual do próprio teste** (2 treinos de B do Cenário A — agora−1 h e o do passo 7 — passaram a contar quando o `joined_at` foi empurrado para trás). O ranking estava certo (consistência = 0 linhas). Apagados os 2 treinos residuais por `DELETE /workouts/sessions/:id` (o que também exercita o recálculo ao apagar), o resultado ficou 2/2 e 1/2 como na tabela.

**Consulta de consistência:** **0 linhas** (após o Cenário B e de novo no fim de tudo: 11 membros em 7 grupos conferidos). **PASS**

## Step 5 — Editar e excluir treino ao vivo — **PASS**

`GET /sessions/:id` traz `id` por série · `PUT` (duração 1800, cargas novas, omitindo uma série, com `started_at` no corpo) → 200 e o `GET` seguinte reflete (série omitida apagada; `start_time` **inalterado**) · `PUT` com id de série de **outro** treino → 400 `unknown set id` e nada muda (nem o outro treino) · `sets:[]`, `duration_sec:0`, `weight_kg<0`, id inválido → 400 · `PUT`/`DELETE`/`GET` por outro usuário → 404 · `DELETE` → 204, `GET` → 404, repetido → 404, séries somem (cascade, SQL) · `GET /activities` deixa de listar e `/activities/summary` (Home) volta `streak_days 1 → 0` (com 2 treinos no dia, apagar 1 mantém streak 1).

## Extras

| # | Item | Resultado | Evidência |
|---|---|---|---|
| (a) | `discover` com `%` e `_` literais | **PASS** | Grupos públicos `a%b`, `axb`, `a_b`: `q=a%b` → só `a%b`; `q=a_b` → só `a_b`; `q=%` → só `a%b`; `q=_` → só `a_b`; `q=axb` → só `axb`; `q=\` → 200 e vazio; `q` com 101 chars → 400. |
| (b) | Regressão do upload da foto de perfil | **PASS** | `POST /profile/upload` PNG válido → 200, `photo_url` servida em `/uploads` (200 `image/png`) e refletida em `GET /profile`; `text/plain` → 400 "File must be a JPEG, PNG, or WebP image"; texto com `image/png` → 400 "File content does not match…"; sem token → 401. (Ver achados L2 sobre dois comportamentos **anteriores** à feature.) |
| (c) | Convite por username case-insensitive | **PASS** | Convite com `QA_D_6ITS91` acha `qa_d_6its91` → 201; 2º convite em minúsculas enquanto pendente → 409 (mesma pessoa). |
| (d) | `createSession` idempotente | **PASS** | Mesmo `started_at` de novo → **200 com o mesmo `activity_id`**; 1 só linha em `activities` para esse instante; ranking segue 1/1 (**pontos não duplicam**). |

## Achados

| ID | Sev | Achado |
|---|---|---|
| L1 | LOW | **500 transitório.** No início, o 1º `POST /groups` devolveu 500 `An unexpected error occurred`, mas o grupo **foi criado** (a transação commitou; a falha veio depois dela, na leitura de `getForViewer`). 16 repetições seguintes (8 em sequência, 8 em paralelo) → 201; nada reproduziu. Mais tarde o pooler do Supabase ficou ~1 min inalcançável (Prisma `Can't reach database server`; `GET /groups` → 500) e voltou sozinho — mesma classe de causa (rede/pooler), **não confirmada** para o 1º 500 porque não tenho acesso ao log do Furnace. Efeito prático: um cliente que repete o `POST /groups` após o 500 cria **grupo duplicado** (a criação não é idempotente). Sem retrabalho; **Maestro: conferir no log do Furnace por volta de 21:17 locais (00:17 UTC) se o stack é `Can't reach database server`.** Se for outra coisa, reabrir Task 3/4. |
| L2 | LOW | **`POST /profile/upload` (pré-existente, não é regressão da feature).** (i) Sem corpo multipart → 500 "Internal server error uploading photo" (esperado 4xx); (ii) o 2º upload **não apaga** a foto de perfil antiga de `profilePhotos/` (arquivo órfão). O `git show 026b6cf` confirma que o código antigo já se comportava assim; só a leitura/validação foi para `lib/imageUpload`. Sugestão futura: tratar não-multipart como 400 e usar `deleteImage` na troca. |
| I1 | INFO | Espaço **no meio** do código (`abcd efgh`) → 404: só as pontas são aparadas (`normalizeToken`). O plano diz "minúsculas com espaços"; as pontas foram testadas e funcionam. |
| I2 | INFO | `GET /groups/join/<token>` de grupo **encerrado** → 200 com `ended:true` (a prévia mostra); só `POST /join` dá 409. Detalhe `GET /groups/:id` de grupo público encerrado por não-membro → 200. |
| I3 | INFO | Rate limit de `/join` é por rota: só `GET /groups/join/*` foi levado ao 429 (21ª chamada, janela 1 min). `POST /join/*` tem a mesma config (`20/min`) mas não foi estourado. |
| I4 | INFO | `calories_burned` da Home é 0 para treinos de força (sessões não gravam `calories`); pré-existente, fora do escopo. |
| I5 | INFO | Auto-convite devolve 409 "Already a member" (o dono já é membro), conforme o plano. |

## Conclusão

Etapa BACKEND verde: 159/159 automatizados; contrato ao vivo, ranking (Cenários A e B, consistência = 0 linhas), editar/excluir treino e os 4 extras passaram. **Sem retrabalho de camada** — pode avançar para o Frontend (Task 8+). Dados de teste todos apagados.
