# Security — Importador de GPX (OWASP Top 10) — 2026-10-14

**Owner:** Torv Security · **Branch:** `feat/perfil-terceiros-gpx` · **HEAD revisado:** `538ff2a` · **Diff:** `git diff c65c169..HEAD -- BackEndTorv FrontEndTorv` (70 arquivos de código, só código; `docs/` ignorado) · **Testes:** `docs/qa-gpx-import-full-2026-10-14.md` (PASS: back 310/310, front 74/74, `tsc` limpo) · **Ambiente:** medição em processo (Fastify real, rotas e schemas reais, repositórios simulados), sem tocar no Furnace `:3000`, no banco nem no Supabase. Nenhuma conta criada, nada apagado.

## Veredito: **FAIL** (2 Médios, 3 Baixos, 5 Informativos)

0 Crítico, 0 Alto. O backend passa em todos os pontos obrigatórios. Os dois Médios são fora do backend e têm correção pequena:

- **F1 (Médio, Frontend, `gpx.ts`):** o parser trava o aparelho com um `.gpx` malformado (retrocesso quadrático). Falha o ponto "regex sem retrocesso catastrófico".
- **F2 (Médio, Privacidade, fixtures + histórico git):** a localização real da corrida do usuário é recuperável do repositório (o deslocamento das coordenadas está documentado). A branch ainda **não foi enviada** (`origin/feat/perfil-terceiros-gpx` não existe), então a correção é barata agora e cara depois do push.

Rework: F1 volta ao **Frontend**; F2 ao **Maestro** (reescrita de 2 commits locais) com o **Frontend** trocando a fixture. Backend e Database não são reabertos.

## Resultado por ponto da Task 15

| # | Ponto | Resultado | Evidência |
|---|---|---|---|
| 1 | **A01** — `/activities/gps/*` filtra por `userId` | **PASS** | `userId` só de `request.user` (JWT validado por `jose`). Todas as consultas do `gps.repository.js` levam `user_id: userId`: `findGpsRoutine`, `findByStart`, `getGpsActivity`, `renameGps` (`updateMany`), `deleteGps` (`deleteMany`). Nenhum id de usuário vem de body, query ou header. `:id` e `routine_id` são `Uuid` validado. |
| 2 | **A01** — rotina de outro usuário ou de musculação → 404 | **PASS** | `findGpsRoutine`: `where { id, user_id, activity_type in (RUN, WALK) }` → `null` → 404 `{"error":"Not found"}`, um único literal para "não existe", "é de outro" e "é de musculação". Ordem no `create`: rotina (404) antes de `analyze` (400). O inverso também fecha: `createSession` só vincula rotina `STRENGTH`; `getSession`/`updateSession`/`deleteSession` filtram `activity_type: 'STRENGTH'`, então os endpoints de musculação não editam nem apagam uma atividade de GPS (não mudam a data dela). |
| 3 | **A01** — nada de rota, FC ou calorias a outro usuário | **PASS** | `GET /users/:id/activities` usa `listActivities`, com `select` fixo: `id, activity_type, title, start_time, duration_sec, distance_m, _count(workout_sets)`. Sem `calories`, `activity_gps_data` (rota, parciais, FC, cadência, altimetria) nem `routine_id`. O schema `ActivityItem` é lista branca por cima. `canView` = o próprio ou grupo em comum; negado e inexistente dão o mesmo 404. `GET /activities/gps/:id` só devolve ao dono. O 409 de duplicata devolve só o `activity_id` do **próprio** usuário. Ver I2 sobre o que os colegas de grupo enxergam. |
| 4 | **A03** — sem SQL cru novo | **PASS** | Nenhum `$queryRaw`/`$executeRaw` novo. O único SQL cru tocado é o `pg_advisory_xact_lock(hashtext(${userId}::text))`, **movido** para `activityWrites.js` sem mudança, com `Prisma.sql` parametrizado (`$1`). Resto é Prisma tipado. |
| 5 | **A03** — `start_time` vira `Date` | **PASS** | `new Date(body.start_time)`; `NaN` → 400 `body/start_time must match format "date-time"`. O que chega ao Prisma é `Date`, nunca string. |
| 6 | **A03** — JSON das parciais e da rota é do servidor | **PASS** | `splits` e `route` vêm de `computeMetrics` (`gpsMetrics.js`); o corpo da requisição não tem campo `splits`, `route` nem métrica nenhuma (`CreateBody`: `routine_id, activity_type, title?, start_time, points`). Prisma grava como JSONB parametrizado. `title` (≤100) é texto e entra como parâmetro. |
| 7 | **A04/A05** — `bodyLimit` de 2 MiB | **PASS** | 30.000 pontos com precisão total (2.148.848 B) → **413** em 2,5 ms; 30.000 pontos a 6 casas (1,2–1,4 MB) passam. O limite é por rota (`bodyLimit` em `/preview` e `/`); as demais rotas ficam no padrão. |
| 8 | **A04/A05** — teto de 30.000 pontos | **PASS** | Schema `maxItems: 30000`: 30.001 pontos → **400** em 26 ms. `minItems: 2`; cada ponto 3 a 6 itens. |
| 9 | **A04/A05** — Douglas-Peucker com entrada de 2.000 | **PASS** | `simplifyRoute` faz `thin(points, 2000)` antes de qualquer conta quadrática e roda **uma** passada. Pior caso adversarial (curva `x^k`, k=20/60/200, 30.000 pontos): `simplifyRoute` **0,4–5 ms**; `computeMetrics` inteiro **18–22 ms**. O vetor de 2,3 s do commit `c65c169` não reaparece. |
| 10 | **A04/A05** — rate limit 30/min por IP | **PASS, com L1** | Medido: 18 inválidas + 12 anteriores = 30 contadas, a 31ª em diante **429**. `GET/PATCH/DELETE` não entram na cota (`global: false`, só `/preview` e `/` têm `config`). Roda em `onRequest`, antes do corpo e da autenticação. Ver L1 (o "I6" já conhecido). |
| 11 | **A04/A05** — medir o pior caso do servidor | **PASS** | Ver tabela "Servidor" abaixo: **≤ 90 ms a frio, 23–61 ms a quente**, para 30.000 pontos (zigue-zague, parábola, exponencial, espiral, aleatório). |
| 12 | **A04/A05** — a Vercel aceita o corpo | **PASS** | 2 MiB < 4,5 MB da Vercel. Não há `vercel.json` do back no repositório (nenhum `maxDuration` a conferir); `trustProxy` e `bodyLimit` em `server.js`/`gps.routes.js` coerentes. Não testei o deploy real. |
| 13 | **Integridade** — janela de 72 h, fim no futuro | **PASS** | Ao vivo (em processo): início 72 h + 1 s → 400; início +10 min → 400; fim no futuro → 400 (`checkWindow`, mesma janela e tolerância de 5 min da musculação); antes de 2026-01-01 → 400. |
| 14 | **Integridade** — teto diário de todos os tipos sob lock | **PASS** | `lockAndCheckDailyCap` (advisory lock por usuário + `count` de **todos** os tipos no dia UTC, antes do insert) dentro da mesma transação do insert e do `recomputeRanking`; `serializePerUser` serializa a rajada. A musculação passou a usar a mesma função. |
| 15 | **Integridade** — deduplicação por índice | **PASS, com L2** | Índice único parcial `(user_id, start_time) WHERE activity_type <> 'STRENGTH'`; `P2002` na corrida vira 409 com o `activity_id` do vencedor. Mesmo início → **409** (medido). Ver L2 para o início deslocado. |
| 16 | **Integridade** — plausibilidade de velocidade | **PASS** | `checkPlausible`: ≥ 60 s, ≥ 100 m, ≤ 24 h, velocidade em movimento ≤ 25 km/h; 400 antes de gravar. Faixas de ponto: lat/lon/ele/FC/cadência, `t` crescente e primeiro `t = 0`; FC/cadência fora da faixa viram `null`. `Infinity`/`NaN` não passam (Ajv + `Number.isFinite`). |
| 17 | **Integridade** — tentar forjar pontos | **RISCO RESIDUAL, ver L2** | Arquivo 100% fabricado (linha reta, 10 km em ~1 h, FC 150, cadência 85) passa na prévia e na criação (200/201; 884 kcal). Mesmo arquivo com início +1 ms… +4 ms: 4× 201. O limite real é o teto de 5/dia e a janela de 72 h. |
| 18 | **Privacidade** — o `.gpx` não sai do aparelho | **PASS** | `parseGpx` roda no aparelho; só `[t, lat, lon, ele, hr, cad]` vai no corpo (`services/gps.ts`). O XML nunca é enviado. Único cliente HTTP novo é `gpsApi` sobre `api` (`EXPO_PUBLIC_API_URL`). |
| 19 | **Privacidade** — sem pontos brutos nem série de FC no banco | **PASS** | `activity_gps_data` guarda `elapsed_sec, elevation_gain_m, avg_hr, max_hr, avg_cadence, splits, route`; `route_json` foi removida. Sem coluna de pontos nem de série de FC. |
| 20 | **Privacidade** — rota simplificada, só o dono vê | **PASS** | Rota: ≤ 500 pontos, 5 casas (~1 m), Douglas-Peucker 5 m. A lista de outros usuários não tem `activity_gps_data` (item 3). Sem mapa de terceiros: `RouteTrace` desenha SVG local (`react-native-svg`), nenhuma chave nem coordenada vai a provedor. |
| 21 | **Privacidade** — nada sensível em log | **PASS, ver I4** | O `onResponse` registra `método url -> status (ms)`; as URLs não carregam coordenada (só UUID). Erros de validação do Ajv não repetem os valores. Os pontos não são logados em nenhum caminho do diff. |
| 22 | **Frontend** — o parser só roda no aparelho | **PASS** | `gpx.ts` sem import de runtime nem rede. |
| 23 | **Frontend** — regex sem retrocesso catastrófico (25 MB) | **FAIL → F1** | Arquivo legítimo de 25 MB: ok (0,5 s, 28.263 pontos). Arquivos malformados de 1 MB: 4,6 s a mais de 20 s; de 25 MB: mais de 60 s (morto pelo teste). |
| 24 | **Frontend** — nenhum segredo, só a nossa API | **PASS** | Varredura do diff: nenhum token, chave ou URL literal. Dependências novas: `expo-document-picker ~57.0.3`, `expo-file-system ~57.0.7` (versões do SDK 57; CVE de dependência fora do escopo desta revisão). |
| 25 | **Frontend** — `readPickedFile.web` | **PASS** | Sem `dangerouslySetInnerHTML`, `eval`, `new Function` nem `innerHTML` no diff (0 ocorrências). `asset.file.text()`; o `fetch(asset.uri)` é de fallback e a URI vem do seletor do navegador (`blob:`), não do servidor nem do arquivo. O título (nome da trilha do GPX) entra em `<Input>`/`<Text>`, nunca como HTML. |
| 26 | **Migration / Supabase** | **PASS (ver I5)** | `CHECK`s de tipo, índice único parcial e colunas tipadas; `DEFAULT 'STRENGTH'` mantém as linhas antigas válidas. RLS: `activity_gps_data` já tem `ENABLE ROW LEVEL SECURITY` + policy só para `torv_api` (`20260925180000_lock_down_public_schema`), então as colunas novas (`route` incluída) herdam o bloqueio ao `anon`/`authenticated`. Nenhuma foto nem Storage no diff. |

## Medições

### Servidor — `POST /activities/gps/preview`, 30.000 pontos, rota e schema reais

| Forma do arquivo | Corpo | Resposta | Tempo (1ª / 2ª chamada) |
|---|---|---|---|
| zigue-zague | 1,21 MB | 400 velocidade | 68 ms / 25 ms |
| parábola | 1,20 MB | 200 | 61 ms / 23 ms |
| exponencial | 1,30 MB | 400 velocidade | 48 ms / 23 ms |
| espiral | 1,18 MB | 200 | 45 ms / 57 ms |
| aleatório | 1,39 MB | 400 velocidade | 56 ms / 41 ms |
| 30.001 pontos | 1,39 MB | 400 | 26 ms |
| 30.000 pontos, precisão total | 2,15 MB | 413 | 2,5 ms |
| sem token, corpo válido de 1,39 MB | 1,39 MB | **401** | 51 ms (corpo lido e validado antes do 401, ver L3) |

Pior caso sustentado: **≤ 90 ms por requisição**, dentro da cota de 30/min por IP (≈ 2,7 s de CPU por minuto por IP no pior cenário). O custo é pago antes de a plausibilidade rejeitar, mas é pequeno.

### Parser — `parseGpx`, arquivos gerados fora do repositório e apagados no fim

| Caso | 1 MB | 25 MB |
|---|---|---|
| legítimo (Strava, FC e cadência) | 39 ms | **493 ms** (28.263 pts, 150 MB RSS) |
| 1 ponto por segundo, sem extensões | 65 ms | 1.234 ms |
| `<trkpt>` sem `</trkpt>` repetido | **4.573 ms** | **> 60 s** |
| `<trkpt lat="1" ` repetido, sem `>` | **> 20 s** | **> 60 s** |
| `<time>x` repetido dentro de um ponto | **> 20 s** | **> 60 s** |
| `<time ` repetido sem `>` | **> 20 s** | **> 60 s** |
| `<name>` repetido no cabeçalho da trilha | **> 20 s** | **> 60 s** |
| `<trk>` repetido sem fechar | **> 20 s** | **> 60 s** |
| `<![CDATA[` repetido no nome | 3 ms | 165 ms |
| `lat=` repetido, `&#x41;` repetido | ≤ 3 ms | ≤ 72 ms |

## Achados

### F1 — **MÉDIO** — Parser de GPX trava o aparelho com um arquivo malformado (A04, retrocesso quadrático)
- **Camada / arquivo:** Frontend · `FrontEndTorv/src/utils/gpx.ts`: o regex de `trkpt` (linha 73), o `match` de `<trk>` (linha 66) e `tag()` (linhas 41-44).
- **Causa:** `[\s\S]*?` até um fechamento que não existe: cada `<trkpt` (ou `<trk>`, `<time>`, `<name>`) sem fechamento varre até o fim da entrada, e o motor tenta de novo no `<trkpt` seguinte. O custo é quadrático no tamanho do arquivo.
- **Cenário:** alguém manda a outra pessoa um `.gpx` de 1 a 25 MB (cabe no limite de 25 MB do `MAX_FILE_BYTES`). Ao importar, a thread de JS fica presa por minutos (na prática trava o app até o sistema matá-lo) e o usuário perde o que estava aberto. Não há vazamento nem escrita: é negação de serviço **no próprio aparelho**, mas exige só um arquivo de 1 MB, e o limite de 25 MB não protege (1 MB já passa de 20 s).
- **Correção testada (protótipo fora do repo, `scratchpad/gpxbench/gpx_fixed.ts`):** varredura por `indexOf`, cada elemento olhado só nos primeiros 4.096 caracteres, `tag()` com abertura limitada (`[^>]{0,256}>`) e fechamento procurado só no trecho cortado, cabeçalho da trilha cortado em 4.096. Resultado: **todos os casos acima ≤ 1,5 s a 25 MB** (pior: `<trkpt>` sem fechar, 1,5 s; o resto ≤ 230 ms) e a saída do `run-sample.gpx` é **idêntica** à do parser atual. Cobrir com teste de regressão: 1 MB de `<trkpt>`, `<time>`, `<name>` e `<trk>` sem fechar tem de terminar em menos de 1 s.
- **Observação:** com a correção, `asset.size ?? 0` (I1) deixa de importar.

### F2 — **MÉDIO** — A localização real da corrida é recuperável pela fixture + mensagem de commit (A02/A04, LGPD)
- **Camada / arquivo:** Frontend (fixtures) + histórico git · `FrontEndTorv/src/utils/fixtures/run-sample.gpx`, `BackEndTorv/src/lib/tests/fixtures/run-sample.json`, commit `cf10061` (mensagem) e `docs/superpowers/plans/2026-10-14-gpx-import.md:131`.
- **Causa:** a anonimização é uma translação fixa das coordenadas, e a constante está escrita em claro em dois lugares: a mensagem do commit `cf10061` (constante registrada na mensagem do `cf10061`, omitida aqui) e o plano. Subtrair a constante devolve as coordenadas originais com precisão de ~0,1 m (a fixture tem 6 casas). Os pontos têm a trilha inteira (120 pontos), então o início costuma ser a casa ou o ponto de saída. Altitude (413 m), FC e cadência estão **inalteradas** e a forma da rota também.
- **Cenário:** qualquer pessoa com acesso ao repositório (hoje privado ao usuário; a branch **não foi enviada**, 34 commits à frente do `origin/main`) obtém a localização e o horário-relativo de um treino do usuário. É dado pessoal de localização (LGPD).
- **Correção:** (1) trocar as duas fixtures por uma rota **sintética** (gerada por script, outra região, outra altitude, outra FC) com o mesmo formato; (2) como nada foi enviado, reescrever as mensagens de `cf10061` e o trecho do plano (`git rebase`/`filter-repo` local) para tirar o deslocamento e o histórico das coordenadas antigas, **antes do primeiro push**; (3) conferir `git log -p -- '*.gpx' '*run-sample*'` depois. O `.gpx` original (`/Corrida_na_hora_do_almoço.gpx`, raiz) continua fora do git (`/*.gpx` no `.gitignore`; `git ls-files` só lista a fixture). Os testes que usam números da amostra (`8670.74 m`, `726 kcal`) precisam de valores novos.
- **Se o repositório já tivesse sido enviado:** tratar como vazamento (reescrever e forçar push, pedir a limpeza do cache do host).

### L1 — **BAIXO** — Rate limit de 30/min por IP soma `/preview` e `/` (item I6 já conhecido)
- **Camada / arquivo:** Backend · `routes/gps.routes.js:12-16`.
- **Avaliação:** a cota é uma só (`@fastify/rate-limit` registrado no plugin, `global: false`, chave padrão = IP), contada em `POST /preview` + `POST /`. `GET/PATCH/DELETE` ficam de fora (medido: sem cabeçalho de limite). Por usuário o fluxo normal gasta 2 chamadas por importação (prévia + salvar, mais 1 por troca de tipo), então ~10 importações por minuto por IP bastam para chegar a 429. Isso não é falha de segurança: o freio que protege de verdade é o teto de 5/dia, o `bodyLimit` e o custo medido (≤ 90 ms). O problema real é de disponibilidade e justiça: usuários atrás do mesmo IP (CGNAT de operadora, wi-fi de academia, escritório) dividem os 30/min e podem se bloquear. Na Vercel o contador é em memória por instância, então o freio também não é global.
- **Classificação:** Baixo. Sem exploração para ganho; risco de 429 legítimo.
- **Sugestão (para o Maestro decidir):** subir para 60–120/min por IP, ou contar por usuário num hook posterior à autenticação (a fila `serializePerUser` já existe). Manter a cota atual só se aceitar 429 em IP compartilhado. Anotar a limitação no plano (o plano já pedia).

### L2 — **BAIXO** — Dados fabricados passam e a deduplicação só olha o instante exato (A04, integridade do ranking)
- **Camada / arquivo:** Backend · `gps.controller.js:64` (`findByStart`) e índice `activities_gps_user_start_key`.
- **O que sobra de risco depois dos controles:** (a) um cliente HTTP qualquer fabrica pontos plausíveis (o servidor não tem como provar que veio de um aparelho); (b) o mesmo arquivo reenviado com `start_time` deslocado em 1 ms vira outra atividade (medido: +1 ms a +4 ms → 4× 201), porque a deduplicação é por início idêntico; (c) atividades podem se sobrepor no tempo.
- **Limite do estrago:** 5 atividades por dia UTC (todos os tipos), janela de 72 h (≤ 4 dias UTC → no máximo ~20 por usuário); `total_points` do ranking conta **dias distintos**, então duplicar não muda a pontuação principal, só o desempate `activities_count`. A musculação já tem exatamente a mesma exposição (corpo de sets forjável), então o importador não abre classe nova de risco.
- **Sugestão (opcional):** recusar atividade cujo intervalo `[start, start + elapsed]` sobreponha uma atividade GPS existente do usuário (409), ou deduplicar por impressão digital (ponto inicial + distância + duração). Aceitar o risco é razoável para um app de grupos de amigos.

### L3 — **BAIXO** — Corpo de 2 MiB é lido e validado antes da autenticação (A05)
- **Camada / arquivo:** Backend · `gps.routes.js:16` (`addHook('preHandler', authenticateToken)`).
- **Evidência:** sem token, um corpo válido de 1,39 MB gasta 51 ms de servidor (leitura + Ajv sobre 30.000 pontos) antes do 401; corpo inválido recebe 400 de validação, não 401 (`/preview` sem token respondeu 400 `Bad Request`). O padrão `preHandler` é o mesmo de todas as rotas do projeto; o que muda é que `/activities/gps` é a primeira com `bodyLimit` de 2 MiB (as outras ficam em 1 MiB).
- **Limite do estrago:** o rate limit roda em `onRequest` (antes), 30/min por IP.
- **Correção de uma linha:** `fastify.addHook('onRequest', authenticateToken)` neste plugin, registrado **depois** do `@fastify/rate-limit` (o rate limit continua contando todo mundo). Não é necessário reabrir nada além disso.

### I1 — Informativo — `asset.size ?? 0` pula o teto de 25 MB
`GpxImport/index.tsx:75`: se o seletor não informar `size`, o arquivo passa sem checagem. Vira irrelevante com F1 corrigido (o parser fica linear); se quiser, `?? Infinity` falha fechado.

### I2 — Informativo — O que colegas de grupo veem de uma atividade de GPS
`/users/:id/activities` mostra a membros em comum: tipo, **título**, início, duração em movimento e **distância**. Não mostra rota, FC, cadência, calorias nem parciais (verificado no `select`). O título vem do `<name>` do GPX e o usuário o vê e edita antes de salvar (`Input` com `maxLength` 100), mas um nome como "Corrida no Parque X" também é divulgado ao grupo. Por design; vale um aviso na tela se o Maestro quiser.

### I3 — Informativo — `GET /activities/gps/:id` de outro usuário e de id inexistente são indistinguíveis
Mesmo literal `{"error":"Not found"}` (404). Sem diferença de campos, status ou cabeçalho. Não medi tempo (a consulta é uma só, `findFirst` por `id + user_id`).

### I4 — Informativo — Logs de erro do Prisma (não reproduzido)
`server.js` faz `console.error(err)` e `fastify.log.error(err)` em qualquer 5xx. Um erro do Prisma em `createGpsActivity` pode carregar o trecho da chamada (incluindo `route` e `splits`) na mensagem. Não consegui provocar esse caminho sem escrever no banco, então não é achado; vale conferir os logs da Vercel na primeira falha real e, se houver coordenadas, trocar por log só de `err.code`.

### I5 — Informativo — RLS não foi conferido ao vivo
O conector de Supabase só lista o projeto "Portal Tradsul" (ref `xawcbnowiueflakfvths`), que não consegui confirmar como sendo o do Torv; não consultei. A conclusão do item 26 vem da migration `20260925180000_lock_down_public_schema` (RLS ligado em `activity_gps_data`, policy só para `torv_api`) e do fato de a `20261014120000_gps_activities` só adicionar colunas e restrições. Rodar `get_advisors` (security) no projeto certo depois de aplicar a migration.

### I6 — Informativo — Nada de leitura ao vivo do Furnace
Não bati no `:3000` (conforme combinado): os números do servidor são em processo, com o mesmo Fastify, as mesmas rotas, os mesmos schemas e os mesmos controladores/libs; só os repositórios (Prisma) foram simulados. Um `GET` de teste no script atingiu o Prisma real com um UUID aleatório (só leitura, 404). Consequência: tempos de banco (transação, lock, `recomputeRanking`) **não** entram nas medições.

## Decisões / o que não foi verificado
- Contas e dados: **nenhuma conta criada, nada apagado, nada escrito no banco**. Os arquivos de teste de 25 MB foram gerados em pasta temporária fora do repositório (`scratchpad/gpxbench/`) e apagados pelo próprio script ao fim de cada caso (conferido: a pasta só tem os scripts).
- Fora do escopo: CVE de dependências, o `BackEndTorv/package-lock.json` modificado (não revisado e não incluído no commit).
- Não testei: deploy real na Vercel (limite de 4,5 MB e `maxDuration`), ranking de grupos com concorrência de verdade (coberto por testes do repositório, não por mim), e o app em dispositivo (travamento do F1 medido em Node 24; no Hermes o motor de regex é outro, mas o padrão quadrático é o mesmo).
