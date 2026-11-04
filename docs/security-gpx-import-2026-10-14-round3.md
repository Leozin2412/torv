# Security — Importador de GPX, round 3 — 2026-10-14

**Owner:** Torv Security · **Branch:** `feat/perfil-terceiros-gpx` · **HEAD revisado:** `11a3efc` · **Escopo:** só o que mudou desde o round 2 (`51ee29f..HEAD`): `4f70f81` e `11d613f` (F2b, só docs), `cfd7f90` (F1b, `gpx.ts`), `719b503` (teste do F1b), `ee9f1cc` e `11a3efc` (relatórios QA round 4 e 5) · **Rounds anteriores:** `docs/security-gpx-import-2026-10-14.md` (round 1, FAIL) e `docs/security-gpx-import-2026-10-14-round2.md` (round 2, FAIL) · **QA:** `docs/qa-gpx-import-frontend-2026-10-14-round5.md` (PASS) · **Ambiente:** medição em processo (Node 24), nada no Furnace, nenhuma conta, nenhum dado escrito. O `.gpx` original (raiz, fora do git) foi lido só para comparar. **Este relatório não traz coordenada, deslocamento nem nome de cidade: só `arquivo:linha`, hashes e contagens.**

## Veredito: **PASS**

0 Crítico, 0 Alto, 0 Médio, 0 Baixo novo. O F2b e o F1b (os dois achados abertos do round 2) estão **fechados no HEAD**. Sobra **1 risco residual** que não é falha deste round: o **histórico local** ainda contém a coordenada real e o deslocamento, e a decisão de reescrevê-lo **antes do primeiro push** é do usuário. L1, L2 e L3 do round 1 seguem aceitos pelo Maestro e vão para a decisão do usuário. Nenhum código de produção do backend mudou desde o round 1.

## Resultado

| # | Ponto | Resultado | Evidência |
|---|---|---|---|
| 1 | **F2b** — nenhuma coordenada real nos arquivos do HEAD | **PASS** | Varredura de 495 arquivos de texto versionados (lockfiles e binários fora). Para as 2.875 coordenadas do treino original: **pares lat/lon** com 3 e com 2 casas decimais, **ponto ou vírgula** como separador, **sinal** hífen ou tipográfico (menos U+2212, travessões U+2013/U+2014, hífens U+2010/U+2011, largura total e pequeno), **com ou sem sinal**, **nas duas ordens**, na mesma linha ou em linhas vizinhas: **nenhum acerto**. Números isolados com 4+ casas: **nenhum**. |
| 2 | **F2b** — nenhuma coordenada do deslocamento antigo | **PASS** | Mesma varredura sobre as coordenadas da fixture antiga (original + deslocamento): pares 3 e 2 casas e números isolados: **nenhum acerto**. |
| 3 | **F2b** — o deslocamento não está escrito | **PASS** | Procurei os dois valores do deslocamento no mesmo trecho (linha e a seguinte), em qualquer formato numérico: **nenhum acerto** (o valor que o r1 trazia na linha 88 foi removido). |
| 4 | **F2b** — cidade ou região | **PASS** | Busca sem acento e sem maiúsculas por 17 municípios, regiões e o estado da área do treino (lista mantida fora do relatório, para não reproduzir o local): **nenhum acerto**. |
| 5 | **F2b** — formato graus/minutos/segundos e links de mapa | **PASS** | 1 acerto da expressão (`docs/qa-groups-competition-backend-2026-10-06.md:73`); lido: é texto sem relação (falso positivo), sem coordenada. Nenhum `geo:`, Google Maps, OpenStreetMap ou link de mapa. |
| 6 | **F2b** — fixtures continuam sintéticas | **PASS** | `65331c9` (round 2) intacto: fixtures sem par original, direção sem correlação com o percurso real. Ver I1 sobre o que a sintética preserva. |
| 7 | **F1b** — o caso do round 2 | **PASS** | 25 MB de `<trkpt>` curto sem fechar: **15 ms** (era 10,1 s); a 1 MB, 3 ms (era 371 ms). |
| 8 | **F1b** — meus geradores (todos) | **PASS** | Tabela abaixo: 20 casos, 1 MB e 25 MB. Pior caso malformado a 25 MB: **553 ms** (`<trkpt` colado, sem `>`). Arquivo legítimo de 25 MB: 0,73 s; 1 ponto por segundo: 1,41 s. |
| 9 | **F1b** — o teste novo pega o parser antigo | **PASS** | `gpx.test.mjs` no HEAD: 11/11 (o teste do F1b em 6 ms). Rodei o **mesmo teste** contra o `gpx.ts` do `bbf8b8e` (anterior ao fix): **falha** em 1.913 ms (limite 500 ms) e as outras 10 passam. O teste de fato protege contra a regressão. |
| 10 | Escopo do diff | **PASS** | `git diff 51ee29f..HEAD`: código só em `gpx.ts` (11 linhas) e `gpx.test.mjs` (9 linhas); o resto é documento. Nada em `BackEndTorv`. |

### Parser — `parseGpx` no HEAD `11a3efc` (Node 24; arquivos gerados fora do repositório e apagados no fim)

| Caso | 1 MB | 25 MB | 25 MB no round 2 (`bbf8b8e`) |
|---|---|---|---|
| legítimo (Strava, FC e cadência) | 53 ms | 0,73 s | 0,77 s |
| 1 ponto por segundo, sem extensões | 119 ms | 1,41 s | 1,23 s |
| pontos aninhados/mistos (válido) | 63 ms | 1,27 s | — |
| `<trkpt>` sem fechar (60 B/unidade) | 2 ms | 14 ms | 0,96 s |
| **`<trkpt>` sem fechar (7 B/unidade)** | 3 ms | **15 ms** | **10,1 s** |
| `<trkpt>` repetido e um único `</trkpt>` no fim | 22 ms | 394 ms | — |
| 4 KB de lixo entre abertura e fechamento | 4 ms | 40 ms | 36 ms |
| `<trkpt` colado, sem `>` | 26 ms | 553 ms | 476 ms |
| `<trkpt a="<` repetido | 23 ms | 279 ms | 253 ms |
| `<trkpt lat="1" ` repetido, sem `>` | 14 ms | 224 ms | 192 ms |
| `<time>x` repetido num ponto / 480 `<time>` por ponto | 4 / 8 ms | 46 / 55 ms | 24 / 51 ms |
| `<time ` sem `>` | 4 ms | 48 ms | 31 ms |
| `<name>` no cabeçalho / `<trk>` sem fechar | 3 / 5 ms | 27 / 43 ms | 25 / 42 ms |
| CDATA, entidades, `lat=` repetidos | ≤ 2 ms | ≤ 21 ms | ≤ 20 ms |

(Os números do round 2 e do round 3 variam ±30% com a carga da máquina; o que importa é que **nada passa de 1,5 s** e que não há mais crescimento fora de linear.)

### Varredura do HEAD — o que foi coberto

| Variante | Cobertura |
|---|---|
| Separador | ponto e vírgula |
| Sinal | hífen, menos tipográfico (U+2212), travessões, hífens Unicode, largura total, ou sem sinal |
| Ordem e vizinhança | lat/lon e lon/lat; qualquer par entre os 60 primeiros números da linha, ou com os 6 primeiros da linha seguinte |
| Precisão | 3 casas (~100 m) e 2 casas (~1 km) para pares; 4 casas para números isolados |
| Conjuntos | coordenadas reais (2.875) e coordenadas da fixture antiga (original + deslocamento) |
| Outros | deslocamento escrito, graus/minutos/segundos, links de mapa, municípios e região, nome do arquivo original |

## Informativos

- **I1 — As fixtures sintéticas preservam a parte "não geográfica" do treino** (elevação, FC, cadência, horários e comprimento de cada passo). Já registrado no round 2; aceitável, sem coordenada nem relação com o percurso real.
- **I2 — O nome do arquivo original aparece uma vez em documento** (`docs/security-gpx-import-2026-10-14.md:90`, no round 1) e o mesmo texto genérico já é o nome da trilha na fixture. É o nome padrão que o app de origem dá ("Corrida na hora do almoço"), sem local. Não é achado.
- **I3 — A data do treino original coincide com datas já usadas em testes e documentos do projeto** (16 linhas em 8 arquivos, todos sem relação com GPS). Não distingue o treino; só registro de que a varredura olhou.
- **I4 — A verificação da etapa anterior (mensagem ao Maestro sobre `cfd7f90`) é refeita aqui no HEAD atual**, com o `719b503` e os dois relatórios QA a mais; os resultados batem (F1b 15 ms; F2b limpo).

## Risco residual (não é falha deste round): histórico local ainda contém a coordenada real e o deslocamento

- **Situação:** a branch **não foi enviada**. Conferi no remoto (`git ls-remote --heads origin`): nenhuma ref `feat/perfil-terceiros-gpx`; local está 45 commits à frente do `origin/main`.
- **Onde está, no histórico (só hashes):**
  - coordenada **real**: introduzida em `2354153` (spec) e removida em `4f70f81`;
  - coordenadas do **deslocamento antigo**: `c65c169` (plano), `cf10061` (fixtures), `b3defe6`, `f5eab32`, `e78fd83` (testes do backend), `3319edc` (teste do front), `a3116d2` (QA round 3); removidas em `65331c9` e `4f70f81`;
  - **valor do deslocamento**: no texto de `a30f74e` (relatório do round 1, removido em `4f70f81`) e na **mensagem** de `cf10061`.
  - Os commits que removem os valores também carregam os valores nas linhas apagadas do diff (`65331c9`, `4f70f81`).
- **Condição:** reescrever esses commits (por exemplo `git rebase -i`/`git filter-repo --replace-text`, ou um squash da branch para o `main`) **antes do primeiro push**. Depois do push o dado vira público no host; aí seria preciso reescrever, forçar push e pedir a limpeza do cache ao host. Reescrever muda os hashes citados em relatórios.
- **Decisão:** do usuário. Sem a reescrita, o HEAD está limpo, mas qualquer push da branch inteira expõe o ponto de partida do treino.

## Itens do round 1 mantidos como aceitos (sem reavaliação, nada no diff os altera)
L1 (rate limit de 30/min por IP somando `/preview` e criação), L2 (dado forjado e deduplicação só pelo instante exato) e L3 (autenticação em `preHandler`, depois de ler o corpo de 2 MiB), mais os Informativos do round 1. Vão para "Para você decidir".

## Não verificado
- Hermes (celular): os tempos são de Node 24; o comportamento linear vale igual, a constante é maior.
- A varredura só cobre arquivos de texto versionados no HEAD (não binários) e valores numéricos; coordenadas descritas em palavras (endereço, bairro) só foram procuradas por município/região, não por endereço.
- Nenhuma conta criada, nada escrito no banco, nada no Furnace. `BackEndTorv/package-lock.json` fora do commit. Arquivos de 25 MB gerados e apagados fora do repositório.
