# Security — Perfil de membro (OWASP Top 10) — 2026-10-14

**Owner:** Torv Security · **Branch:** `feat/perfil-terceiros-gpx` · **HEAD revisado:** `05507c4` · **Diff do código:** `f2f33c4`, `c07f1df`, `ea93838`, `5ece5e5`, `e6baca9`, `d6f5b85` (`git diff 2354153..d6f5b85 -- BackEndTorv FrontEndTorv`, 38 arquivos) · **Fora do escopo:** `cf10061` (fixtures do próximo subprojeto) e os docs · **Testes:** `docs/qa-member-profile-full-2026-10-14.md` (PASS) · **Ambiente:** API local (Furnace `:3000`) contra o Supabase do projeto.

## Veredito: **PASS**

0 Crítico, 0 Alto, 0 Médio, **1 Baixo**, 4 Informativos. Nenhum achado bloqueia a feature; o Baixo (F1) tem correção de uma linha e pode entrar já ou no próximo ciclo, a critério do Maestro.

## Resultado por item da Task 10

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | **A01** — `/users/:id/*` usa o `userId` do token | **PASS** | `users.controller.js`: `const { userId } = request.user` (payload do JWT validado por `jose` contra o JWKS). Nenhum `userId` vem de body, query ou header. |
| 2 | **A01** — só o próprio ou membro de grupo em comum | **PASS** | `canView` = `viewerId === targetId \|\| sharesGroup`. `sharesGroup` consulta só `group_members` (convite pendente não conta; grupo `PUBLIC` não dá acesso a quem não é membro). Ao vivo: A→B (grupo comum) 200; A→C (existe, sem grupo) 404; C→B 404; **B saiu do grupo → A→B 404 no perfil e no histórico** (vale o grupo de agora). |
| 3 | **A01** — 404 igual para negado e inexistente | **PASS** | A→C (existe, 900 atividades) e A→UUID aleatório: corpo `{"error":"Not found"}` **byte a byte idêntico** e **mesmos headers** (perfil e histórico, minúsculas e maiúsculas). Um único literal `NOT_FOUND` serve os dois casos. |
| 4 | **A01** — checagem em paralelo, nada na resposta antes dela | **PASS** | `Promise.all([canView, getPublicProfile, dayCounts/listActivities])`; o único `reply.send` com dado vem depois de `if (!allowed \|\| !profile) return 404`. Nenhum header ou status diferencia antes. Teste `…404 sem nenhum dado` cobre os três ramos (sem grupo / sem perfil / nenhum dos dois) e `…sem grupo em comum → 404 e nenhuma atividade no corpo` cobre o histórico. |
| 5 | **A01** — `id` em maiúsculas não fura | **PASS** | `request.params.id.toLowerCase()` antes de comparar e de consultar. Ao vivo: B/C/A em maiúsculas → 200/404/200 (`is_me` certo, `user.id` devolvido em minúsculas). Sem o `toLowerCase`, o próprio usuário em maiúsculas cairia no ramo de grupo; o teste dedicado existe. |
| 6 | **A04** — schema de resposta é lista branca | **PASS** | `MemberProfile` e `ActivityPage` tipados (Fastify serializa só o que está no schema) **e** o repositório faz `select` explícito de 5 campos. Ao vivo: perfil `user,is_me,streak,month,total_activities,calendar`; `user`: `id,name,username,photo_url,fitness_level`; item: `id,activity_type,title,start_time,duration_sec,set_count,distance_m` (sem `calories`, `routine_id`, `user_id`, GPS). Teste de lista branca injeta `email`, `weight_kg`, `birth_date` no repositório e confirma que não saem. |
| 7 | **A04** — nenhum dado de saúde, corpo, contato ou nascimento sai | **PASS** | Sem e-mail, peso, altura, idade, gênero, objetivo, nascimento, calorias, nutrição. Ver decisões abaixo para `fitness_level` e título. |
| 8 | **A04** — título de rotina no histórico do membro | **ACEITO** | Ver "Decisões". |
| 9 | **A03** — `dayCounts` parametrizado | **PASS** | `prisma.$queryRaw` com **template tagged**: `${tzOffsetMin}::int`, `${userId}::uuid`, `${before}::timestamptz` viram `$1..$3`; nenhum `$queryRawUnsafe`, nenhuma concatenação no diff. Defesa em profundidade: o fuso já chega como inteiro validado (`-840..840`) e `before` é um `Date` construído no servidor. Ao vivo: `date=2026-10-14'%3BDROP TABLE…` → 400; `tz_offset_min=0;select` → 400. Nenhuma tabela afetada (contagens iguais no fim). |
| 10 | **Enumeração** — resposta | **PASS** | Ver item 3. UUID malformado dá 400 e UUID bem formado dá 404 (nunca 403/500 para "existe"). |
| 11 | **Enumeração** — tempo | **PASS (diferença dentro do ruído)** | 60 amostras intercaladas por caso, ~145 ms de ida e volta ao Supabase. Perfil: negado-existente (900 atividades) **mediana 148 ms**, UUID aleatório **146 ms**, permitido 150 ms; p10 143/142/143, p90 194/183/198. Histórico: 147 / 145 / 148 ms, p10 142/142/141. **Diferença medida ≈ 2 ms (≈1%)**, menor que a dispersão (p10→p90 ≈ 40 ms). Ver I3. |
| 12 | **Entrada** — `date`, `tz_offset_min` | **PASS, com F1** | `date`: `2026-02-31`, `2026-10-14'…`, duas datas, sem data → 400. `tz_offset_min`: `841`, `-841`, `1.5`, `0;select` → 400. `1e2` → 200 (vira 100, inteiro válido). Extremos de `date`: ver F1. |
| 13 | **Entrada** — `before`, `limit` | **PASS** | `limit=0/-1/51/abc/1.5/2&limit=3` → 400; `1e1` → 200 (=10). `before=ontem`, `2026-10-01` (sem hora), `2026-13-45T25:61:61Z`, `…+99:99`, `';DROP--` → 400; `0001-…` → 200 vazio; `9999-12-31…` → 200. O `NaN` de `new Date` também vira 400. |
| 14 | **Entrada** — `urn:uuid:` recusado | **PASS** | `/users/urn:uuid:<uuid>/…` → 400 (o `pattern` de `Uuid` corta o prefixo que o `format: uuid` do Ajv aceitaria). `%0A`, `%00`, `' OR 1=1--`, `abc` → 400. Nunca chegam ao Prisma. |
| 15 | **Frontend** — nenhum segredo | **PASS** | Varredura do diff (`secret`, `token`, `apikey`, `sk_`, `eyJ…`, `BEGIN … KEY`): só `key=` de React e `SUPABASE_SECRET_KEY: 'test-key'` em teste de backend (valor fictício). `services/users.ts` usa a instância `api` (base `EXPO_PUBLIC_API_URL`). |
| 16 | **Frontend** — só a nossa API | **PASS** | Único cliente HTTP novo é `usersApi` sobre `api`. Nenhum `fetch`/URL literal nova. `photo_url` vem do servidor já montada por `images.publicUrl` (prefixo fixo do bucket público do Supabase + nome gerado no servidor: `profile-<uuid>-<sufixo>.<ext>`); o usuário não grava URL arbitrária. |
| 17 | **Frontend** — `dangerouslySetInnerHTML` | **PASS** | 0 ocorrências. Todo texto de servidor entra em `<Text>` (RN/RN Web escapa). Ao vivo, um título `<img src=x onerror=alert(1)>` volta como string JSON `application/json` e é renderizado como texto. |
| 18 | **Frontend** — `Alert.alert` com dado do servidor | **PASS** | 0 ocorrências no diff; estados de erro usam texto fixo. |
| 19 | Rota nova sem deep link | **PASS** | `MemberProfile` não está no tratamento de URL (`routes/index.tsx` só trata o link de entrada em grupo). O `userId` só vem de `ranking.user_id`/`members.user_id` do servidor; o backend revalida de qualquer jeito. |
| 20 | Migração / Supabase Storage | **PASS (n/a)** | O diff não toca Prisma schema, migrations, chaves nem escrita no Storage. Nenhum caminho de foto novo chega ao bucket; só **leitura** de URL pública já existente. Auth continua `jose` + JWKS. |

## Achados

### F1 — **BAIXO** — `date` extremo derruba a rota com 500 (A04/A05, robustez)
- **Onde:** `routes/activities.schemas.js` (`LocalDayQuery.date`) + `lib/activityStats.js` (`localDayBounds`).
- **Evidência (ao vivo):** `GET /users/<id>/profile?date=9999-12-31&tz_offset_min=-840` → **500** `{"error":"An unexpected error occurred"}`. O `before` calculado cai no ano 10000, que o driver não serializa. Qualquer usuário autenticado dispara, inclusive sobre o próprio id. `date=0000-01-01` responde 200, mas com `calendar.start = "-000002-12"` (string de ano negativo).
- **Impacto:** o corpo do erro é genérico (nada vaza), mas o usuário gera 500 e log de erro à vontade; sem efeito sobre dados. `localDayBounds` é a mesma função de `GET /activities/summary` (não testei essa rota).
- **Correção sugerida:** limitar o ano no `pattern`/`isCalendarDay` (ex.: `^20\d{2}-…` ou rejeitar fora de 2000–2100 com 400) e cobrir com teste. Nenhuma mudança no front (ele manda a data do aparelho).

### I1 — INFORMATIVO — validação roda antes da autenticação
- `authenticateToken` está em `preHandler`, que no Fastify vem **depois** da validação. Sem token e com `id` inválido a rota responde 400 (não 401) com a mensagem do schema. Nada sensível sai (só o padrão do `id`), e é o mesmo padrão de todas as rotas do projeto. Se quiserem 401 sempre primeiro: mover o hook para `onRequest`.

### I2 — INFORMATIVO — `fitness_level` e histórico de atividades ficam visíveis a quem divide grupo
- Decisão da spec. `fitness_level` é um rótulo autodeclarado (INICIANTE…), não medida corporal. Streak/mês/calendário/histórico revelam o padrão de treino, o mesmo que o ranking do grupo já expõe. Só vale reabrir se o produto passar a tratar isso como privado (aí um opt-out por conta).

### I3 — INFORMATIVO — canal de tempo teórico, sem efeito hoje
- Hoje a diferença negado-existente × inexistente é ≈2 ms sobre ≈147 ms, abaixo do ruído. Isso se deve a rodar as 3 consultas em paralelo nos dois casos (a decisão do design). Se o banco um dia ficar colado na função (RTT ~2 ms) e alguém tiver 1000+ atividades, o `GROUP BY` pode aparecer. A exploração exigiria já saber o UUID do alvo (122 bits aleatórios, só visível a quem divide grupo), então o ganho do atacante é confirmar existência de um UUID que ele já tem. Nenhuma ação agora.

### I4 — INFORMATIVO — sem rate limit em `/users/*` e dependências com avisos já existentes
- Só as rotas de `auth` têm `rateLimit`; as autenticadas (inclusive as novas) não. Sem UUID enumerável isso não vira vazamento; vira custo de banco se um token for abusado.
- `npm audit --omit=dev`: backend 1 alto (`brace-expansion`, transitivo, `npm audit fix` resolve) e 1 baixo (`esbuild`); frontend 1 crítico (`shell-quote`, transitivo de ferramenta Expo), 19 altos (inclui `axios` direto: prototype pollution de gadgets). **Nenhum `package.json` mudou neste diff**, então não é regressão da feature. Sugestão: ciclo de atualização à parte (`axios`, `npm audit fix` no backend).

## Decisões pedidas pelo Maestro

- **Título da rotina no histórico do membro — ACEITO.** Já é o nome que o treino leva no app, o membro só vê quem divide grupo com ele, sai como texto puro (sem HTML, escapado pelo `Text`), com limite de 100 caracteres do banco. Risco residual: o nome da rotina é texto livre e pode ser pessoal. Mitigação futura, se quiserem: mostrar só o tipo ("Musculação") a terceiros e o título só ao dono.
- **`fitness_level` visível — ACEITO** (I2).

## Limpeza e contagem (A, B, C QA; apagado tudo)

Contas `secqa.*@torvtest.dev` criadas pela Admin API do Auth; 2 grupos pelo app; 905 atividades por SQL só nas contas QA (5 de B, 900 de C para o teste de tempo). Remoção: grupos pelo app (204), contas pela Admin API (cascade), `group_members` de B removido à mão para o teste de saída.

| Tabela | Antes | Pico | Depois |
|---|---|---|---|
| `users` / `user_profiles` / `user_streaks` | 87 | 90 | **87** |
| `activities` | 417 | 1322 | **417** |
| `groups` | 8 | 10 | **8** |
| `group_members` | 7 | 9 | **7** |
| `group_invitations` | 7 | 7 | **7** |
| `workout_routines` | 205 | 205 | **205** |

Resíduo: 0 linhas das contas QA em `users`, `user_profiles`, `activities`, `group_members`; 0 dos 2 grupos; as 3 contas respondem 404 na Admin API do Auth; arquivo temporário com tokens apagado. Limite: o role do Prisma não lê o schema `auth`, então a contagem de `auth.users` ficou pela confirmação individual (404) e por `users` (a trigger espelha 1:1).

## Resumo

PASS. A01 (controle de acesso, 404 uniforme, checagem em paralelo, UUID em maiúsculas) correto no código e ao vivo; A03 parametrizado; lista branca dupla; frontend limpo. Pendência única: **F1 (Baixo)**, limitar o ano de `date`. Por regra do ciclo, qualquer retrabalho em F1 volta ao Backend e roda `-round2` de testes e de Security só no que mudar.
