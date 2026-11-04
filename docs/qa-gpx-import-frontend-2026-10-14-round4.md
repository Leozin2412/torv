# QA — Importador de GPX, reteste depois do Security round 2 (round 4) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Testado:** `cfd7f90` (F1b: o laço de pontos do `gpx.ts` reaproveita o `closeAt`) e `4f70f81` (F2b: docs com as coordenadas trocadas pela amostra sintética) · **Origem:** `docs/security-gpx-import-2026-10-14-round2.md` (FAIL) · **Referência de saída do parser:** `bbf8b8e` · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412 px); injeção do plano. Arquivos de teste gerados fora do repositório e apagados no fim. **Este relatório não traz nenhuma coordenada**: só contagens, arquivo e linha.

## Veredito: F1b PASS, F2b FAIL por 1 linha (0 CRITICAL / 0 HIGH / 1 MEDIUM / 1 LOW / 3 INFO) → o item (4) do escopo falha: `docs/qa-gpx-import-frontend-2026-10-14-round3.md:24` (um doc meu) ainda traz a caixa de coordenadas da fixture antiga

O parser novo dá a mesma saída que `bbf8b8e` em todos os arquivos e mensagens, e o `<trkpt>` repetido sem fechar caiu de 356 ms (1 MB) e 9,9 s (25 MB) para 1 ms e 15 ms. Os fluxos 2 e 7 no navegador não mudaram. Mas a varredura do HEAD achou **uma** ocorrência residual da coordenada do deslocamento antigo, no meu relatório do round 3 (ver F2b e M1).

## (1) Automatizados

| Suíte | Antes | Agora | Resultado |
|---|---|---|---|
| `FrontEndTorv: node --test src/utils/*.test.mjs` | 75 | **76/76** (+1: o teste de `<trkpt>` repetido), 0 fail, 0 cancelled, 0 skipped | **PASS** |
| `FrontEndTorv: npx tsc --noEmit` | limpo | limpo | **PASS** |

## (2) Parser no node: `bbf8b8e` × HEAD (`cfd7f90`)

Cada arquivo parseado pelos dois e a saída serializada comparada byte a byte. Máquina de desenvolvimento, sem carga.

| Arquivo | `bbf8b8e` | HEAD | Saída |
|---|---|---|---|
| `<trkpt>` repetido sem fechar, **~1 MB** (0,95 MiB) | 356 ms | **1 ms** | idêntica (GpxError "sem pontos com horário") |
| `<trkpt>` repetido sem fechar, **25 MiB** | 9.928 ms | **15 ms** | idêntica |
| `<trkpt lat="1" lon="2">` repetido sem fechar, 1 MB / 26 MB | 113 ms / 2.703 ms | **1 ms / 17 ms** | idêntica |
| `<trkpt>` com corpo e sem fechar (1 MB / 24 MiB) | 48 ms / 720 ms | 1 ms / 12 ms | idêntica |
| `<trkpt lat="1" ` sem `>` (1 MB / 24 MiB) | 13 ms / 203 ms | 9 ms / 214 ms | idêntica |
| `time` sem fechar, `name` repetido, `trk` sem fechar (1 MB / 24 MiB) | ≤ 3 ms / ≤ 59 ms | ≤ 2 ms / ≤ 42 ms | idêntica |
| **Legítimo de 24,6 MiB** (Strava com FC e cadência, 28.263 pontos) | 203 ms | **217 ms** | **idêntica** (1.190.608 bytes de JSON) |
| Legítimo de 24 MiB, 1 ponto por segundo (afinado a 30.000) | 1.062 ms | **1.086 ms** | **idêntica** (1.182.651 bytes) |
| **Amostra** `run-sample.gpx` (120 pontos) | 10 ms | 3 ms | **idêntica** (4.783 bytes) |

Pior caso do HEAD nos malformados: **214 ms**; o `<trkpt>` repetido, que era o vetor da F1b, ficou em **1–17 ms**. O legítimo de 25 MB segue entre 0,2 e 1,1 s.

**Comparação lado a lado em 21 casos** (os 17 do round 3 mais 4 estruturais: `trkpt` sem fechar seguido de ponto fechado, ponto autofechado depois de ponto sem fechar, 50 `<trkpt>` curtos seguidos de pontos válidos, último ponto sem fechamento): **21 iguais, 0 diferentes**, inclusive os que ultrapassam os limites de 4.096/256 caracteres (o L1 do round 3 continua o mesmo comportamento, só agora sem custo quadrático).

## (3) No navegador: fluxos 2 e 7 da Task 13

Conta única QA (75 kg) com a rotina "Corrida leve".

| Fluxo | Resultado | Evidência |
|---|---|---|
| 2 — Importar | **PASS** | `run-recent.gpx`: **8,67 km · 47:57 · 5:32 /km · 38,3 m · 151 / 169 bpm · 175 passos/min · 726 kcal**; título "Corrida QA"; traçado; **9 parciais** (5:38, 5:18, 5:34, 5:23, 5:54, 6:00, 5:12, 5:21, "0,67 km 3:37 5:23 /km") — igual ao round 3 |
| 7 — Erros | **PASS** | `ride.gpx` → "Bike chega em breve. Por enquanto, só corrida e caminhada."; `old.gpx` → "Só dá para importar atividades das últimas 72 horas."; `nope.gpx` → "Este arquivo não é um GPX válido."; `route-only.gpx` → "O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade)." Nada gravado (0 atividades da conta no banco) |
| Extra | **PASS** | `<trkpt>` repetido de 1 MB: a mensagem "sem pontos com horário" aparece em ~0,25 s (inclui o `fetch`); o de 25 MiB + 7 bytes é barrado antes do parser por "Arquivo grande demais (máx. 25 MB)." (o teto de 25 MiB do app; o parser a 25 MB ficou no node); o legítimo de 24,6 MiB gera a prévia normalmente (74,85 km) |

## (4) `git grep` no HEAD: coordenada real ou do deslocamento antigo

Referência: o `.gpx` da raiz (`/*.gpx` no `.gitignore`, **não versionado**; 2.875 pontos) e a fixture antiga (`65331c9^`, o real deslocado). Para cada ponto, extraí lat e lon e procurei no HEAD com `git grep -F -f` (arquivos de padrões fora do repositório), imprimindo só contagens.

| Busca | Valores distintos | Ocorrências no HEAD |
|---|---|---|
| Real, 5 casas | 2.405 | **0** arquivos |
| Real, 4 casas | 319 | **0** |
| Real, 3 casas, sem sinal, com ponto **e** com vírgula decimal | 34 | **0** |
| Fixture antiga (deslocamento), 5 casas | 2.359 | **0** |
| Fixture antiga, 4 casas | 319 | **0** |
| **Fixture antiga, 3 casas, sem sinal, com ponto e com vírgula** | 34 | **1 linha, em `docs/qa-gpx-import-frontend-2026-10-14-round3.md:24`** |
| (controle) fixture sintética atual, 5 casas | 2.538 | só nos 3 lugares esperados: as 2 fixtures e 1 linha do plano |

As buscas só com ponto decimal (as primeiras cinco) deram 0; a **vírgula decimal** (como escrevo nos relatórios) e o **valor sem sinal** (o relatório usa o sinal tipográfico `−`) é que pegaram a linha 24: a linha "Local" da tabela de fixtures do round 3 (feita antes do `4f70f81`, que só tratou a linha 27) ainda traz a **caixa de latitude da fixture antiga**, com o nome da cidade. Como a fixture antiga era o real deslocado por uma constante, é a mesma classe do F2b (MÉDIO no round 2 do Security).

**Derivabilidade pela fixture atual:** dos 2.874 passos (diferença entre pontos consecutivos) da fixture sintética, só **9** coincidem na mesma posição com os do percurso real (acaso); a fixture antiga, 2.874 de 2.874 (era o real deslocado). Ou seja, a direção atual não segue o percurso real. O que continua igual ao real (passo de distância, tempo, elevação, FC, cadência) é o aceito como I1 pelo Security.

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| M1 | MEDIUM | Docs (relatório QA, meu) | **F2b residual:** `docs/qa-gpx-import-frontend-2026-10-14-round3.md:24` (linha "Local" da 1ª tabela de (1)) ainda traz a caixa de latitude da fixture antiga (deslocamento) e o nome da cidade. Correção de uma linha, só texto: trocar o conteúdo da linha por "origem da fixture antiga omitida; a nova tem outra região e direção sem relação com o percurso real". Não mexi no arquivo porque o escopo pedia commit só deste relatório; se o Maestro autorizar, aplico e commito à parte. Sem reescrever histórico (a linha continua no commit `a3116d2`). |
| L1 | LOW | Frontend (teste) | O teste novo de F1b ("~1 MB de `<trkpt>` curto repetido…", limite 1.000 ms) **passa com o parser de `bbf8b8e`**: ele leva ~350 ms nesta máquina (3 execuções: 352, 346, 357 ms), ou seja, não pega a regressão que ele mesmo descreve; só falharia numa máquina de CI quase 3× mais lenta. O comentário do teste diz "~370 ms/MB (10 s a 25 MB)". Sugestão: usar a ordem de grandeza certa (25 MB com limite de 1 s, ou 1 MB com limite de ~100 ms) para ele distinguir 1–15 ms de 350 ms+. |
| I1 | INFO | Ambiente | Nesta sessão o toque real do portal em "Escolher arquivo .gpx" não levava o `change` até a tela (a prévia não abria; o handler era chamado e o `DocumentPicker` resolvia, mas a tela não seguia), mesmo após recarregar a página. Chamando o **mesmo `onPress` do botão** pela fiber do React o fluxo roda inteiro (prévia, erros, tudo igual). Já tinha visto isso uma vez no teste completo e não sei a causa (não parece do código: nos rounds 2 e 3 o toque real funcionou). Os fluxos 2 e 7 foram feitos assim; os asserts são os mesmos. |
| I2 | INFO | Cobertura | Só web e node (V8). O tempo no aparelho (Hermes/JavaScriptCore) não foi medido (round 3, I2). |
| I3 | INFO | Segurança (aceito) | A fixture sintética mantém distância de cada passo, horário, elevação, FC e cadência do treino real (Security I1, aceito); só a direção/local é sintética. |

## Dados de teste e limpeza

Criada **1 conta** (`e8b47227-4670-45b1-a8ae-b386664d54c5`) e 1 rotina Corrida (via API); nenhuma atividade foi salva (0 atividades no banco). Apagada **por id** pela Admin API (200, cascade), sem filtro por prefixo; nenhuma outra conta foi tocada. Servidor da `:8099`, pasta dos `.gpx`, arquivo de contas (com senha), arquivos de benchmark e de padrões removidos; `localStorage` do portal limpo e página recarregada no login; nenhum arquivo de teste no repositório (o `.gpx` da raiz só foi lido).

| Tabela | Antes | Com dados QA (pico) | Depois |
|---|---|---|---|
| `users` | 83 | 84 | **83** |
| `auth.users` | 83 | 84 | **83** |
| `activities` | 408 | 408 | **408** |
| `groups` | 8 | 8 | **8** |
| `group_members` | 7 | 7 | **7** |
| `workout_routines` | 190 | 195 | **190** |
| `activity_gps_data` | 1 | 1 | **1** |
| `user_measurements` | 106 | 107 | **106** |

Sem resíduo: 0 linhas da conta em `users`, `activities` e `workout_routines`.
