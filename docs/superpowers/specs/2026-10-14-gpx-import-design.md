# Importador de GPX (Corrida e Caminhada) — Design

**Data:** 2026-10-14 · **Branch:** `feat/perfil-terceiros-gpx` · **Base:** módulo de treinos (`workout_routines`, `activities`), `activity_gps_data` (existe e nunca foi usada), grupos e ranking, e o perfil de membro (`2026-10-14-member-profile-design.md`, feito antes deste).

## Objetivo

1. Em **Meus treinos**, criar uma rotina do tipo **Corrida** ou **Caminhada** e importar nela o `.gpx` de cada treino. A atividade vai para o histórico com distância, tempo, pace, elevação, FC, cadência, parciais por km, calorias estimadas e o traçado da rota.
2. A atividade de GPS conta como qualquer outra: no ranking (1 ponto por dia, como hoje), no streak, no calendário, nas calorias gastas da Home e no perfil de membro.

## Decisões (do brainstorm com o usuário)

| Tema | Decisão |
|---|---|
| Tipos | `RUN` (Corrida) e `WALK` (Caminhada) entram agora. `RIDE` (Bike) fica para depois, mas o mapeamento do arquivo já o reconhece, para recusar com mensagem. |
| Rotina | `workout_routines.activity_type`: `STRENGTH` (padrão), `RUN` ou `WALK`. É escolhido na criação e **não muda** depois. Rotina de GPS tem só nome, sem exercícios. |
| Regras da musculação | O plano gerado continua só de musculação. "Próximo", o selo "Concluído" e o aviso de 48–72 h olham só rotinas `STRENGTH`. Sessão de musculação não se vincula a rotina de GPS. |
| Fluxo | Card da rotina de GPS → **Importar GPX** → tela de importação → **Escolher arquivo .gpx** → o app lê o arquivo → prévia calculada pelo servidor → **Salvar** → resumo da atividade salva. |
| Tipo do arquivo | Vem de `<trk><type>`. Tipo ausente ou desconhecido usa o da rotina. Tipo de bike é recusado ("Bike chega em breve"). Se o arquivo diz Corrida e a rotina é Caminhada (ou o contrário), a prévia **avisa e deixa escolher** o tipo antes de salvar. |
| Janela de data | Mesma regra da musculação: início nas últimas **72 h** e a partir de 2026-01-01; fim até agora + 5 min. |
| Teto por dia | 5 atividades por dia UTC, agora **somando todos os tipos** (pendência do `revisar4.md`). Usa a mesma fila por usuário e o mesmo advisory lock. |
| Duplicado | Outra atividade de GPS do usuário com o mesmo `start_time` → **409**. A resposta traz o `activity_id` da que já existe. |
| Métricas | Calculadas **no servidor**, a partir dos pontos: distância, tempo total, tempo em movimento, pace médio, ganho de elevação, FC média e máxima, cadência média (passos/min), parciais por km e calorias. |
| Calorias | Fórmula da ACSM, pelo último peso do usuário (seção Backend). Sem peso → `null`. Entram em "gastas" na Home. |
| Rota | Simplificada (Douglas-Peucker), com no máximo 500 pontos e 5 casas decimais. Desenhada em SVG, **sem mapa de fundo** (nada de chave de API nem envio de localização a terceiros). **Só o dono vê.** |
| O que os outros veem | Tipo, título, data, duração, distância e pace. Nunca rota, FC, cadência ou calorias. |
| Armazenamento | O `.gpx` **não sai do aparelho**. O app lê o XML e envia só os pontos, em formato compacto. O servidor guarda o resumo, as parciais e a rota simplificada, e descarta os pontos brutos. |
| Editar | Renomear e excluir. Excluir recalcula o ranking. As métricas não são editáveis. |
| Fora da v1 | Bike, registro manual (esteira), gráficos de pace/FC/elevação, mapa real, importação do Strava. |

## Banco de dados

Migration nova, `BackEndTorv/prisma/migrations/20261014120000_gps_activities/migration.sql`, do `torv-database`. O Prisma só reflete o schema.

**Pré-condições** (conferir antes; se falharem, parar e avisar o Maestro):
- `SELECT DISTINCT activity_type FROM activities` só devolve `STRENGTH`;
- `activity_gps_data` está vazia.

**Mudanças:**

```sql
ALTER TABLE workout_routines ADD COLUMN activity_type varchar(10) NOT NULL DEFAULT 'STRENGTH';
ALTER TABLE workout_routines ADD CONSTRAINT workout_routines_activity_type_check
  CHECK (activity_type IN ('STRENGTH','RUN','WALK'));

ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN ('STRENGTH','RUN','WALK'));
-- Deduplicação da importação: uma atividade de GPS por usuário e instante de início.
CREATE UNIQUE INDEX activities_gps_user_start_key ON activities (user_id, start_time)
  WHERE activity_type <> 'STRENGTH';

ALTER TABLE activity_gps_data DROP COLUMN route_json;
ALTER TABLE activity_gps_data
  ADD COLUMN elapsed_sec      integer      NOT NULL CHECK (elapsed_sec > 0),
  ADD COLUMN elevation_gain_m numeric(7,1)          CHECK (elevation_gain_m >= 0),
  ADD COLUMN avg_hr           smallint              CHECK (avg_hr BETWEEN 20 AND 250),
  ADD COLUMN max_hr           smallint              CHECK (max_hr BETWEEN 20 AND 250),
  ADD COLUMN avg_cadence      smallint              CHECK (avg_cadence BETWEEN 1 AND 400),
  ADD COLUMN splits           jsonb        NOT NULL,
  ADD COLUMN route            jsonb        NOT NULL;
```

`activity_gps_data` já tem RLS e a policy `torv_api_full_access`, e `activity_id` com `ON DELETE CASCADE`.

**Colunas que já existem e passam a ser usadas:**

| Coluna | Na atividade de GPS |
|---|---|
| `activities.distance_m` | distância, em metros |
| `activities.duration_sec` | tempo **em movimento**, o que entra no pace e nas listas |
| `activities.calories` | calorias estimadas |
| `activities.routine_id` | a rotina usada na importação |
| `activities.title` | o título |

Os scripts de `BancoDeDadosTorv/` são sincronizados como nas features anteriores.

## Backend

### Formato dos pontos (o app envia, o servidor valida)

`points`: array de `[t, lat, lon, ele, hr, cad]`. Os três primeiros são obrigatórios, os três últimos podem faltar ou ser `null`.

| Campo | Regra |
|---|---|
| `t` | Segundos desde `start_time`. O 1º é `0` e a sequência nunca diminui. |
| `lat` | De −90 a 90. |
| `lon` | De −180 a 180. |
| `ele` | Metros, de −500 a 9000. |
| `hr` | bpm. Fora de 20–250 vira `null`. |
| `cad` | Cadência por perna, como o `gpxtpx:cad` grava. Fora de 0–255 vira `null`. |

- De 2 a 30.000 pontos.
- O corpo tem limite de 2 MiB (`bodyLimit` na rota). Uma corrida de 48 min a 1 Hz dá cerca de 117 KB; 30.000 pontos dão cerca de 1,2 MB.
- **Plausibilidade:**
  - tempo total entre 60 s e 24 h;
  - distância de pelo menos 100 m;
  - velocidade média em movimento de no máximo 25 km/h.

### Cálculo — `lib/gpsMetrics.js` (puro, testado com a amostra anonimizada)

- **Segmento** `i ≥ 1`: `d` = haversine(p[i−1], p[i]), com R = 6.371.008,8 m, e `dt = t[i] − t[i−1]`. O segmento está **em movimento** se `dt > 0` e `d/dt ≥ 0,5 m/s`.
- `distance_m` = soma de `d` dos segmentos em movimento, com 2 casas. Isso exclui o ruído do GPS parado.
- `duration_sec` = soma arredondada de `dt` dos segmentos em movimento.
- `elapsed_sec` = `t[último] − t[0]`.
- `pace_sec_per_km` = `round(duration_sec / (distance_m / 1000))`.
- `elevation_gain_m`: histerese de **2 m** sobre os `ele` não nulos, em ordem.
  - `âncora` = 1º valor;
  - subiu 2 m ou mais → soma a diferença e move a âncora;
  - desceu 2 m ou mais → só move a âncora.
  - Menos de 2 valores → `null`. Resultado com 1 casa.
- `avg_hr` = média arredondada dos `hr` válidos; `max_hr` = o maior. Sem `hr` → `null`.
- `avg_cadence` = `round(2 × média dos cad > 0 nos pontos finais dos segmentos em movimento)`, em passos/min. Sem `cad` → `null`.
- **`splits`:** percorre os segmentos em movimento acumulando distância e tempo.
  - A cada múltiplo de 1000 m, o instante da fronteira é interpolado dentro do segmento.
  - Cada parcial é `{ km, distance_m: 1000, duration_sec }`. `duration_sec` é a diferença entre os instantes de fronteira **acumulados e arredondados**, de modo que as parciais completas somam exatamente até o instante da última fronteira.
  - A sobra de pelo menos 50 m vira a última parcial, com `distance_m` arredondado.
- **`calories`** (equações metabólicas da ACSM, por metro):
  - O₂ (ml/kg) = `h × distance_m + v × elevation_gain_m + 3,5 × duration_sec / 60`;
  - `RUN`: `h = 0,2` e `v = 0,9`; `WALK`: `h = 0,1` e `v = 1,8`;
  - `kcal = round(O₂ × peso_kg / 1000 × 5)`;
  - sem peso cadastrado → `null`.
- **`route`:** Douglas-Peucker com tolerância de 5 m, numa projeção equirretangular em torno da latitude média, em **uma passada só**.
  - Antes, a entrada é reduzida a no máximo **2.000** pontos, por passo uniforme que sempre mantém o primeiro e o último. Isso limita o pior caso, que é O(n²), a ~2 milhões de contas.
  - Se o resultado passar de 500 pontos, cai para 500 pelo mesmo passo uniforme.
  - Saída `[[lat, lon], ...]` com 5 casas decimais.
  - Na prática: 30.000 pontos em zigue-zague levam ~30 ms. A primeira versão, que repetia a passada aumentando a tolerância, levava 2,3 s, e isso seria vetor de DoS.

**Referência na amostra do usuário** (original, sem anonimização; peso hipotético de 75 kg):

| Métrica | Valor |
|---|---|
| Distância | 8.445,1 m |
| Tempo em movimento | 2.877 s |
| Tempo total | 2.882 s |
| Pace | 341 s/km (5:41) |
| Ganho de elevação | 38,3 m |
| FC média / máxima | 151 / 169 |
| Cadência | 175 passos/min |
| Calorias | 709 kcal |
| Parciais | 5:47, 5:30, 5:41, 5:31, 6:09, 6:06, 5:11, 5:48 e 445 m em 2:17 |
| Rota | ~104 pontos |

Os testes usam a cópia anonimizada (`src/lib/tests/fixtures/run-sample.json`, coordenadas e horários deslocados). Os valores esperados saem dela.

### Rotas novas — `gps.routes.js`, `prefix: '/activities/gps'`

| Rota | Efeito |
|---|---|
| `POST /preview` | Corpo `{ activity_type, start_time, points }`. Aplica as mesmas validações da criação (pontos, janela de 72 h, plausibilidade), menos rotina, duplicado e teto do dia. Calcula e devolve as métricas. **Não grava nada.** |
| `POST /` | Corpo da prévia + `routine_id` + `title?` (1 a 100 caracteres depois do `trim`). Grava e devolve **201** com o detalhe. |
| `GET /:id` | Detalhe, só para o dono. |
| `PATCH /:id` | `{ title }`. Renomeia. |
| `DELETE /:id` | Apaga e recalcula o ranking, na mesma transação. **204.** |

- **Detalhe** (`GpsActivityDetail`):

  ```json
  {
    "id": "...", "activity_type": "RUN", "title": "...", "start_time": "...", "routine_id": "...",
    "distance_m": 8445.1, "duration_sec": 2877, "elapsed_sec": 2882, "pace_sec_per_km": 341,
    "elevation_gain_m": 38.3, "avg_hr": 151, "max_hr": 169, "avg_cadence": 175, "calories": 709,
    "splits": [{ "km": 1, "distance_m": 1000, "duration_sec": 347 }],
    "route": [[-10.5, -52.5]]
  }
  ```

  A prévia devolve o mesmo formato, sem `id`, `title` e `routine_id`.
- **Erros:** o texto é estável, e o app traduz para pt-BR.

  | Código | Quando |
  |---|---|
  | 400 | Ver a tabela de mensagens abaixo. |
  | 404 `Not found` | Rotina inexistente, de outro usuário ou que não é de GPS; atividade de outro usuário. |
  | 409 `Activity already imported` | Duplicado. Vem com `activity_id`. |

  Mensagens de 400:

  | Mensagem | Quando |
  |---|---|
  | `start_time must be on or after 2026-01-01` | Início antes de 2026. |
  | `start_time must be within the last 72 hours` | Início fora da janela de 72 h. |
  | `start_time must not be in the future` | Início no futuro. |
  | `activity must not end in the future` | Fim depois de agora + 5 min. |
  | `points must be in chronological order` | Algum `t` menor que o anterior. |
  | `invalid point at index N` | Ponto fora das faixas. |
  | `activity too short` | Menos de 60 s ou de 100 m. |
  | `activity too long` | Mais de 24 h. |
  | `speed not compatible with run or walk` | Média em movimento acima de 25 km/h. |
  | `too many sessions on that day` | Teto de 5 por dia. É a mensagem atual, mantida para os dois caminhos. |

- **Rate limit** (`@fastify/rate-limit` no escopo do plugin, `global: false`): 30 por minuto por IP em `POST /preview` e em `POST /`.
- **Gravação** (`gps.repository.createGpsActivity`), na mesma fila por usuário e transação da musculação:
  1. advisory lock;
  2. teto do dia contando **todos os tipos**;
  3. `INSERT` em `activities` e em `activity_gps_data`;
  4. `recomputeRanking`.

  A fila (`serializePerUser`), o lock e o teto saem de `workout.repository.js` para `repository/activityWrites.js`, compartilhado pelos dois caminhos. A contagem da musculação passa a somar todos os tipos.
- **Peso:** o último `user_measurements.weight_kg` (`profileRepository.getLatestMeasurement`).

### Mudanças em rotas que já existem

- **`POST/PUT /workouts/routines`:**
  - O corpo ganha `activity_type` (opcional, padrão `STRENGTH`).
  - `exercises` passa a ser opcional (0 a 20 itens). Regras em `checkRoutineBody`:
    - `STRENGTH` exige pelo menos 1 exercício;
    - `RUN`/`WALK` exigem lista vazia ou ausente.
  - No `PUT`, mandar `activity_type` diferente do gravado → 400 `activity_type cannot change`. Omitido, vale o gravado.
- **Rotinas na resposta:** `RoutineSummary` e `RoutineDetail` ganham `activity_type`.
- **`next_routine_id` e `completed_recently`:** só consideram rotinas `STRENGTH`; nas de GPS, `completed_recently` é `false`.
- **`createSession`:** só vincula rotina `STRENGTH`. Com rotina de GPS, o treino vira "Treino livre", como já acontece com rotina de outro usuário.
- **`GET /activities`:** `type` aceita `STRENGTH | RUN | WALK`. O item já tem `distance_m` desde o perfil de membro. `GET /users/:id/activities` não muda de contrato.

## Frontend

Regras do `AGENTS.md`, `/frontend-design` nas telas novas, pt-BR, 44 px, 320 px e `ConfirmModal`.

**Dependências novas** (`npx expo install`):
- `expo-document-picker`;
- `expo-file-system`, para ler o arquivo no celular. No web, usa o `File` do próprio navegador.

| Peça | O quê |
|---|---|
| `utils/gpx.ts` + `gpx.test.mjs` | Detalhado logo abaixo da tabela. |
| `utils/gpsFormat.ts` + teste | `formatDistance(m)` → "8,45 km"; `formatPace(s)` → "5:41 /km"; `paceOf(duration_sec, distance_m)`. A duração usa o `formatClock` existente. |
| `utils/gpsErrors.ts` + teste | Traduz os erros do servidor (tabela acima) para pt-BR, como o `groupErrors.ts`. |
| `utils/routeProjection.ts` + teste | Projeta `[lat, lon][]` num `viewBox` com margem e proporção mantida. |
| `services/gps.ts` | `gpsApi.preview`, `create`, `get`, `rename` e `remove`, com os tipos. |
| `services/activities.ts` e `utils/activities.ts` | `ACTIVITY_TYPES = ['STRENGTH','RUN','WALK']`; rótulos Musculação, Corrida e Caminhada. |
| `services/workouts.ts` e `utils/routineForm.ts` | `activity_type` nas rotinas. `buildRoutineInput` aceita rotina de GPS sem exercícios. |
| `components/RouteTrace` | SVG (`react-native-svg`, já instalado) com o traçado na cor da marca e marcadores de início e fim. Sem mapa de fundo. |
| `RoutineEditor` | Ao criar, o seletor **Musculação \| Corrida \| Caminhada** fica no topo. Em Corrida ou Caminhada, os exercícios somem e aparece a dica "Depois é só importar o .gpx de cada treino." Ao editar, o tipo aparece fixo. |
| `Workouts` (Meus treinos) | O card da rotina de GPS mostra o tipo e "Importe o .gpx do seu treino", com o botão **Importar GPX** no lugar do ▶. Funciona mesmo com um treino de musculação em andamento. |
| `screens/GpxImport` `{ routineId }` | Detalhado logo abaixo da tabela. |
| `screens/GpsActivity` `{ activityId }` | Título com lápis para renomear em linha; data e hora; grade de métricas (Distância, Tempo, Pace, Elevação, FC média/máx, Cadência, Calorias, que mostra "—" sem peso); traçado; tabela de parciais (km, tempo, pace); **Excluir atividade** com `ConfirmModal` ("Sai do histórico e do ranking dos grupos"). Depois de excluir, sobe o `sessionsVersion` para o Histórico recarregar. |
| Histórico, Perfil e perfil de membro | Item de GPS com ícone do tipo e "HH:MM · 8,45 km · 47:57 · 5:41 /km". No Histórico e no Perfil o toque abre o `GpsActivity`; no perfil de membro não abre nada. Os chips do Histórico ganham Corrida e Caminhada. |

**`utils/gpx.ts`:**
- `parseGpx(xml)` devolve `{ name, type, startTime, points }`, ou lança um erro com mensagem em pt-BR.
- **Leitura:**
  - extrai os `<trkpt>` com `lat`, `lon` e `<time>`, mais `<ele>` e os `hr` e `cad` com ou sem prefixo de namespace (`gpxtpx:`, `ns3:`);
  - ordena por horário;
  - descarta pontos sem horário ou com coordenada inválida.
- **Nome:** `<trk><name>`, com as entidades XML decodificadas e cortado em 100 caracteres.
- **Tipo:** `<trk><type>`, sem distinguir maiúsculas:

  | Valor no arquivo | Tipo |
  |---|---|
  | `running`, `run`, `trail_running`, `treadmill_running` | `RUN` |
  | `walking`, `walk`, `hiking`, `hike` | `WALK` |
  | `cycling`, `biking`, `ride`, `road_biking`, `mountain_biking`, `gravel_cycling`, `e_biking`, `virtualride`, `indoor_cycling` | `RIDE` |
  | qualquer outro, inclusive número | `null` |

- Mais de 30.000 pontos → reduz por passo uniforme, mantendo o último.
- **Erros:**

  | Caso | Mensagem |
  |---|---|
  | não é GPX | "Este arquivo não é um GPX válido." |
  | sem pontos com horário | "O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade)." |
  | bike | "Bike chega em breve. Por enquanto, só corrida e caminhada." |
  | menos de 2 pontos | "O arquivo tem pontos de menos." |

**`screens/GpxImport` `{ routineId }`:**
- Carrega a rotina (`workoutsApi.getRoutine`) para ter o nome e o tipo.
- **Estados:**
  - inicial: botão grande **Escolher arquivo .gpx** e a dica "Exporte o .gpx no Strava, no Garmin Connect ou no app do seu relógio". O seletor só abre por toque, porque o web exige gesto do usuário;
  - lendo/calculando;
  - erro, com **Escolher outro arquivo**;
  - prévia: métricas, traçado, parciais, campo de título (o nome do GPX ou o da rotina) e **Salvar atividade**;
  - salvando.
- **Validações antes de ler:**
  - arquivo sem extensão `.gpx` → "Escolha um arquivo .gpx.";
  - mais de 25 MB → "Arquivo grande demais (máx. 25 MB).".
- **Tipo divergente:** o aviso "O arquivo indica Caminhada, mas a rotina é de Corrida. Salvar como:" vem com as duas opções.
- **Depois de salvar:** troca para `GpsActivity` (`navigation.replace`).
- **409:** "Você já importou esta atividade." com o botão **Ver atividade**.

**Navegação:** `GpxImport: { routineId: string }` e `GpsActivity: { activityId: string }` em `AppStackParamList`.

## Segurança

- **IDOR:** toda rota filtra pelo `userId` do token. Atividade e rotina de outro usuário → 404.
- **Entrada:**
  - schema TypeBox mais validação manual dos pontos;
  - `bodyLimit` de 2 MiB;
  - teto de 30.000 pontos;
  - simplificação da rota em uma passada, com entrada limitada a 2.000 pontos;
  - rate limit nas rotas que calculam.
  - O servidor **nunca lê XML**, então não há XXE nem "billion laughs" no servidor. O XML só é lido no aparelho do próprio usuário.
- **Ranking:**
  - janela de 72 h;
  - nada no futuro;
  - teto de 5 por dia somando todos os tipos, sob lock;
  - deduplicação por índice único;
  - plausibilidade de velocidade.
- **Privacidade (LGPD):**
  - o arquivo original não é enviado;
  - pontos brutos e série de FC não são guardados, só médias, máximo e parciais;
  - a rota é simplificada e só o dono a recebe;
  - outros membros recebem só a lista branca do item de atividade.

## Testes

- **Backend:**
  - `gpsMetrics`:
    - haversine com distância conhecida;
    - limiar de movimento;
    - histerese;
    - parciais numa reta sintética a velocidade constante (valores exatos);
    - Douglas-Peucker mantém as pontas e respeita o teto;
    - calorias nos dois tipos, com e sem peso;
    - cadência × 2;
    - FC fora da faixa;
    - a amostra anonimizada com valores de ouro.
  - Validação:
    - ordem de `t`;
    - faixas;
    - 30.001 pontos;
    - velocidade;
    - curta e longa;
    - janela de 72 h.
  - Rotas:
    - prévia não grava;
    - criação 201;
    - 409 com `activity_id`;
    - 404 para rotina de outro usuário ou que não é de GPS;
    - detalhe, `PATCH` e `DELETE` só do dono;
    - `DELETE` recalcula o ranking;
    - rate limit.
  - Repositório:
    - o teto soma todos os tipos;
    - rajada na fila;
    - `P2002` vira 409.
  - Rotinas:
    - tipo na criação;
    - GPS com exercícios → 400;
    - musculação sem exercícios → 400;
    - troca de tipo → 400;
    - `next_routine_id` ignora GPS;
    - `createSession` não vincula rotina de GPS.
- **Frontend:**
  - `gpx.test.mjs`:
    - amostra no formato do Strava;
    - prefixo `ns3:` do Garmin;
    - sem extensões;
    - vários segmentos;
    - ponto sem horário;
    - `<rte>` sem trilha;
    - tipo bike;
    - entidades no nome;
    - redução acima de 30.000.
  - Testes de `gpsFormat`, `gpsErrors`, `routeProjection` e `routineForm`, mais `tsc`.
- **Usabilidade no Expo web:**
  - **Como importar:** o seletor de arquivo do navegador não é automatizável pelo portal. O QA injeta o arquivo pelo `maestri portal evaluate`: intercepta o `click` do `<input type=file>` e entrega um `File` buscado de um servidor estático local com CORS. O GPX de teste é gerado da amostra anonimizada, com horários deslocados para dentro da janela de 72 h, numa pasta temporária fora do repositório.
  - **Fluxos:**
    - criar rotina de Corrida;
    - importar e conferir a prévia contra os valores esperados;
    - tipo divergente;
    - salvar;
    - ver no Histórico (com filtro), no Perfil, na Home (calorias e streak), no calendário, no ranking do grupo e no perfil de membro de outra conta, sem rota;
    - renomear;
    - importar de novo → 409 → **Ver atividade**;
    - arquivo de bike, arquivo que não é GPX e arquivo antigo (fora das 72 h);
    - excluir e ver o ranking cair;
    - layout em 320 px.

## Fora do escopo

Bike, corrida sem GPX (registro manual), gráficos ao longo do tempo, mapa com fundo, integração com Strava, metas de distância ou pace na rotina, zonas de privacidade da rota.
