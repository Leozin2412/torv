# Security — Grupos e competição — ROUND 2 (2026-10-07)

**Escopo:** `git diff 20ff128..HEAD -- BackEndTorv FrontEndTorv` (HEAD `d2148cf`). Só código de backend mudou: `workoutValidation.js`, `workout.controller.js`, `workout.repository.js`, `groupInvitations.routes.js` (+ testes). O frontend não tem nenhuma alteração desde o round 1; uploads, CORS e `server.js` também não. Commits revisados: `40803bb` (janela 72 h, fim no futuro, teto 5/dia), `adec806` (advisory lock), `4abda0e` + `330b1fa` (rate limit de convites), `556f09d` (fila por usuário). Round 1: `docs/security-groups-competition-2026-10-06.md` (FAIL: 1 MEDIUM, 2 LOW), não alterado. Pré-condição atendida: round 3 do backend PASS (`d2148cf`) e teste completo PASS.

**Método:** leitura do diff e do spec (seção Segurança); testes ao vivo contra o backend em `:3000` (não parei, não reiniciei, não subi outra instância); SQL só via Prisma (`DIRECT_URL` do `.env`; o conector Supabase do ambiente não foi usado). Duas contas descartáveis (`sec-r2-*@example.test`), 3 grupos privados, ~150 requests; tudo apagado e conferido por SQL (ver Limpeza).

## Veredito: PASS — 0 CRITICAL, 0 HIGH, 0 MEDIUM, 3 LOW, 5 INFO

- **MEDIUM-1 do round 1 está fechado.** Não dá mais para fabricar um treino por dia desde `joined_at`, nem inflar `activities_count` sem limite. Sobra um resíduo que nenhuma regra de servidor fecha (ver R2-1) e dois LOW de contenção. Nenhum exige retrabalho para fechar a feature; recomendo R2-2 e R2-3 como melhoria de baixo custo na Task 6.
- **LOW-1 do round 1 (username) está coerente**: spec documenta o desvio; limite 30/min/IP vale e não é burlável por header.

## Verificação do MEDIUM-1 (item 1)

### Regras novas (código)
- `src/lib/workoutValidation.js:24` recusa `started_at` com mais de 72 h; `:28` recusa treino que termina depois de agora+5 min (`NaN` na duração falha fechado); `:21` mantém 2026-01-01 e o futuro de 5 min.
- `src/repository/workout.repository.js:242-253`: `pg_advisory_xact_lock(hashtext(${userId}::text))` + `count` do dia UTC + insert + `recomputeRanking`, tudo na mesma transação. Idempotência por `started_at` exato fica antes, no controller (`workout.controller.js:153`). Estouro do teto → `SESSION_DAY_LIMIT` → 400 com mensagem fixa (`:160`).

### Tentativas de furar (ao vivo, conta A e B, grupos tz −180 e +840)
| Tentativa | Resultado |
|---|---|
| `started_at` há 73 h; há 72 h + 1 min | **400** nos dois |
| Treino que termina no futuro (agora, 3600 s; −2 h com 2 h 10 min); sem `duration_sec`; início +10 min | **400** nos quatro |
| 4 treinos nas janelas −71 h, −47 h, −23 h, −1 h (dias UTC distintos, conta sem treino real) | 201×4. **Ranking: 4 pontos em cada um de 2 grupos** (tz −180 e +840) → ver R2-1 |
| Mesmo `started_at` de novo | 200 (idempotente) |
| `started_at + 1 ms` (ms distinto) | 201 e `activities_count` 4→5: **ms distinto conta no teto**, não escapa dele |
| 6 treinos no mesmo dia UTC (ms/minutos distintos) | 5×201, **6º → 400** |
| Mesmo dia **local** (tz −180) em 2 dias UTC: 6 no dia UTC X, 6 no dia UTC X+1 | 5+5 aceitos, 6º de cada dia → 400. **Ranking: 1 ponto, 10 atividades** → ver R2-2 |
| `PUT` com `started_at` no corpo (e `started_at` dentro da série) | 200; `start_time` idêntico antes e depois (a data não muda) |
| `DELETE` de 1 dos 5 do dia + recriar | 204, 201, depois **400** de novo: apagar e recriar não passa de 5; ranking segue 1/10 |
| Usuário com vários grupos | um POST recalcula todos; mesma pontuação em cada grupo (4/4 e 4/4), sem multiplicação |

### Avaliação honesta
O que foi fechado: a falsificação **em lote** (um dia por dia desde a entrada) e o desempate **ilimitado**. O que continua aberto e **não tem correção só de regra**:
- A 72 h de janela + 1 treino/dia fabricado = 1 ponto/dia, o mesmo que quem treinou. O servidor não tem evidência de que o treino aconteceu (sem GPS, sem atestado do dispositivo). Um piso de duração ou de séries (ex.: ≥ 5 min) não ajuda: o atacante envia esses valores. Por isso é **LOW aceito**, não MEDIUM: o spec já recusa piso de duração (para não barrar treino curto) e o ranking de "dias com treino" entre amigos é uma competição de honra. Trocar isso exige decisão de produto (verificação externa, denúncia/moderação do dono, ou remover membro, que já existe).
- A janela dá folga de até 3 dias: quem fica 3 dias sem abrir o app compra os 4 dias de uma vez (evidência acima). Isso é o preço de aceitar salvamento tardio legítimo; encurtar a janela é um botão do Maestro (24 h, p. ex.).

## Achados

### LOW — R2-1: ranking por dias continua autodeclarado (resíduo aceito do MEDIUM-1)
- **Onde:** `workoutValidation.js:21-28`, `groups.repository.js:26` (`start_time >= gm.joined_at`).
- **Evidência:** conta recém-criada, sem treino real, 4 POSTs válidos → 4 pontos no ranking de 2 grupos (tabela acima).
- **Correção sugerida:** nenhuma de código que feche de verdade. Opções de produto: janela menor (24-48 h); dono vê e remove membro suspeito (já existe `DELETE /groups/:id/members/:userId`); verificação por dispositivo/GPS na fase 2. Registrar como risco aceito no spec (a seção Segurança hoje só cita o teto).
- **Reabrir:** nenhuma task.

### LOW — R2-2: o desempate `activities_count` ainda é forjável (até 5 por dia UTC, 10 por dia local)
- **Onde:** `workout.repository.js:11` (`MAX_SESSIONS_PER_DAY = 5` por dia **UTC** de `started_at`) vs. `groups.repository.js:23-29` (dia local = UTC + `tz_offset_min`) e `groupRules.rankRows` (desempate por `activities_count`).
- **Evidência:** grupo tz −180: 5 treinos no dia UTC X + 5 no dia UTC X+1 caem no mesmo dia local → **1 ponto, 10 atividades**. Quem treina uma vez por dia perde todo empate de pontos para quem posta 5 (ou 10) por dia.
- **Correção sugerida:** o desempate não deveria depender de contagem bruta de POSTs. Opções baratas: contar `activities_count` com `LEAST(n, 2)` por dia local (no `recomputeRanking`), ou desempatar por quem entrou primeiro e remover `activities_count` da ordenação. Se mantiver, alinhar o teto ao dia local do menor fuso (±14 h) não resolve; limitar no SQL por dia local é o correto.
- **Reabrir:** Task 6 (opcional, baixo custo).

### LOW — R2-3: fila por usuário sem limite de profundidade; o excedente ainda custa uma transação (contenção de conexões)
- **Onde:** `workout.repository.js:21-27` (`serializePerUser`), `:236-238` e `workout.controller.js:153` (3 consultas **antes** da fila), `workout.routes.js:79` (sem rate limit na rota).
- **Evidência (ao vivo):** 60 POSTs paralelos do mesmo usuário (corpo de 200 séries, 27,6 kB): 3×201 e 57×400 `too many sessions on that day`; **última resposta em 45,4 s**, mediana 26,2 s, mínima 6,0 s. Observador (outra conta, `GET /groups` a cada 1,5 s durante a rajada): 2,7 s, 0,8 s e depois 0,42–0,75 s (linha de base 0,14–0,3 s), todos 200. **Zero 500.** Memória do processo `node` do backend (PID da porta 3000) praticamente plana: 108 MB → 115 MB durante a rajada e 115 MB depois.
- **Análise:**
  - *Memória:* cada request pendente guarda só o corpo já validado (≤ ~30 kB, porque o schema limita séries e campos). 1.000 pendentes ≈ 30 MB. Não é vetor prático de memória. O `Map` não vaza: `serializePerUser` remove a entrada quando a chamada é a última da fila.
  - *Erro na fila:* não trava. `tail` engole a rejeição (`run.then(() => {}, () => {})`) e um `throw` síncrono dentro de `fn` vira rejeição no `.then`. Cada transação tem teto de 15 s (`TX`), então um item preso não segura os seguintes para sempre.
  - *Latência/pool:* sem limite de profundidade, cada excedente ocupa uma transação inteira (lock, `count`, rollback, ~0,75 s) com 1 das 5 conexões (`connection_limit=5`). Um usuário mantém ~1 conexão ocupada durante toda a rajada, e as 3 consultas antes da fila de cada request vão ao pool em paralelo. O efeito observado nos outros foi 2-3× de latência, não falha. Para derrubar o pool de verdade seria preciso ~5 contas em rajada ao mesmo tempo (cadastro é livre, 10/min/IP); **não testei com 5 contas** (conclusão por análise, não por teste).
  - *Só o próprio usuário vs. demais:* o resultado correto e a espera longa são do próprio dono da rajada; os demais sentem só a pressão no pool.
- **Correção sugerida:** (a) checar o teto **antes** de entrar na fila (um `count` fora da transação devolve o 400 logo, sem lock nem transação); (b) limitar a fila (ex.: > 3 pendentes do mesmo usuário → 429); (c) rate limit em `POST /workouts/sessions` por usuário (`@fastify/rate-limit` com `hook: 'preHandler'` e `keyGenerator: (req) => req.user.userId`, para chavear depois da autenticação).
- **Reabrir:** Task 6 (opcional).

### INFO
- **INFO-1 (deploy):** o rate limit de convites (30/min) e de `/join` (20/min) chaveia por `request.ip`. **Teste ao vivo:** `X-Forwarded-For` (valor único e lista), `X-Real-IP` e `Forwarded` **não** mudam o balde (todos 429 depois do 31º). Não há `trustProxy` no `server.js` (o único registro da palavra é um comentário em `auth.routes.js`). Logo o limite **não é burlável por header**; só trocando de IP de verdade. Duas consequências para o deploy: (1) atrás de proxy/LB sem `trustProxy`, todos os clientes dividem **um** balde por rota (aceitável hoje, Furnace direto); (2) ao ligar `trustProxy`, usar o número de saltos (`trustProxy: 1`), nunca `true` com proxy que não limpa o `X-Forwarded-For` do cliente, senão o header passa a ser burlável.
- **INFO-2 (convites):** o balde é por IP e compartilhado entre contas e **anônimos** (requisição sem token também consome o limite, pois o rate limit roda antes da autenticação; conta B ficou em 429 depois que A estourou, e `GET /join/…` tem balde próprio e não foi afetado). Varredura de usernames: ≤ 30/min/IP, ~43 mil/dia/IP, de nomes que o ranking dos grupos já mostra. Aceito no spec (seção Segurança, "Enumeração de username (aceito)").
- **INFO-3 (funcional, por leitura, não testado):** retry com o mesmo `started_at` enquanto o 1º POST ainda está na fila passa pela checagem de idempotência (nada gravado ainda), entra atrás e, se o 1º foi o 5º do dia, recebe 400 "too many sessions" em vez de 200. O app trata 400 como "não salvou" e o treino já está salvo. Janela estreita; só confunde a UI.
- **INFO-4:** o teto conta só `activity_type = 'STRENGTH'` (`workout.repository.js:247-249`), enquanto o ranking soma atividades de **qualquer tipo** (`groups.repository.js:26`, comentário da migration). Hoje só `STRENGTH` é criável (`ACTIVITY_TYPES = ['STRENGTH']`, nenhum outro INSERT em `activities`), então não há vazamento; ao criar outro tipo, o teto precisa cobrir também o novo tipo.
- **INFO-5:** `hashtext()` é de 32 bits: dois usuários podem cair no mesmo advisory lock e se serializar sem necessidade (só espera, nunca vaza dado nem pula o teto). Sem ação.

## Item 4 — regressão de segurança no diff: PASS
| Verificação | Resultado |
|---|---|
| IDOR / filtro por `userId` do token | PASS. `createSession`: `count` com `user_id`, rotina com `user_id`, exercícios por `visibleExercise(userId)`, `recomputeRanking(tx, userId)`. `findSessionByStart` filtra `user_id`. `userId` é o `sub` do JWT verificado. |
| SQL cru parametrizado | PASS. `SELECT pg_advisory_xact_lock(hashtext(${userId}::text))` via `Prisma.sql` (parâmetro, não concatenação). Nenhuma outra SQL nova. |
| Erros sem detalhe interno | PASS. 400 com mensagens fixas (`too many sessions on that day`, `started_at must be within the last 72 hours`, `workout must not end in the future`); demais erros caem no handler (5xx genérico). Nenhum stack ou texto de Prisma sai. |
| Segredos e log sensível | PASS. Nada de token, JWT ou corpo no log do diff. (Observação de higiene minha: uma verificação de `.env` neste round imprimiu a `DATABASE_URL` no terminal da sessão por engano; **o valor não foi gravado em arquivo nem neste relatório**; recomendo rotacionar a senha de `torv_api` se esse log for retido.) |
| CORS | Sem alteração no diff (`server.js` fora do escopo desde o round 1). Autenticação por Bearer, sem cookie. |
| Uploads | Sem alteração no diff desde o round 1 (nada em `imageUpload.js`, `groups.controller.js`, `profile.controller.js`). |
| Frontend | Sem alteração desde o round 1. |

## Limpeza (verificada por SQL via Prisma)
Apagadas as 2 contas `sec-r2-*@example.test` (`auth.users` → `users`, perfis, treinos, séries, grupos, membros, rankings e convites por cascade) e os 3 grupos/convites delas. Antes → depois, idêntico: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `group_members 0→0`, `group_rankings 0→0`, `activities 408→408`, `workout_sets 1027→1027`, `workout_routines 173→173`, `exercises 73→73`. Nenhuma linha restante com `user_id`/`owner_id`/`created_by` das 2 contas (u, g, a, gm, gr, gi, up = 0). Nenhum arquivo de capa ou foto criado; `profilePhotos` com os mesmos 8 arquivos. Arquivos temporários com tokens ficaram só no scratchpad da sessão e foram apagados.

## Resumo para o Maestro
| Item | Estado |
|---|---|
| MEDIUM-1 (round 1): backdating em lote e desempate ilimitado | **Fechado** (janela 72 h, fim no futuro, teto 5/dia, lock + transação). Resíduos LOW R2-1 e R2-2. |
| LOW-1 (round 1): enumeração de username | **Coerente e aceito.** Limite por IP não burlável por header (testado). |
| LOW-2 (round 1): capa privada em `/uploads` | Inalterado, aceito no spec. |
| Fila por usuário | Sem vazamento de memória, sem travar o usuário; contenção de conexões e latência longa só para quem dispara (R2-3). |
| Retrabalho | **Nenhum obrigatório.** Opcional na Task 6: R2-2 (desempate) e R2-3 (checar o teto antes da fila, limitar profundidade, rate limit por usuário). |
