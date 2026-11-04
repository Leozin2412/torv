# QA — Importador de GPX, reteste depois do Security (round 3) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Testado:** `65331c9` (fixtures trocadas por uma rota sintética, F2 do Security) e `bbf8b8e` (`gpx.ts` linear, F1) · **Origem:** `docs/security-gpx-import-2026-10-14.md` (FAIL) · **Rounds anteriores:** `docs/qa-gpx-import-full-2026-10-14.md` (PASS) · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412 px); injeção do plano. Arquivos de teste gerados fora do repositório (scratchpad) e apagados no fim.

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW / 3 INFO) → pode voltar ao Security

F1 está corrigido (o malformado de 1 MB cai de 4,1 s a mais de 20 s para 1–47 ms; o legítimo de 25 MB continua entre 0,2 e 1,3 s, dentro do que o Security mediu) e a saída do parser não mudou para o usuário nos fluxos 2, 5 e 7. O LOW é um efeito colateral dos limites novos (L1).

## (1) Automatizados

| Suíte | Antes | Agora | Resultado |
|---|---|---|---|
| `BackEndTorv: npm test` | 310 | **310/310**, 0 fail, 0 cancelled, 0 skipped | **PASS** |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | 74 | **75/75** (+1: o teste de regressão do parser), 0 fail, 0 cancelled, 0 skipped | **PASS** |
| `FrontEndTorv: npx tsc --noEmit` | limpo | limpo | **PASS** |

**Nenhum assert perdeu sentido com a rota sintética (`65331c9`).** Comparei a fixture antiga (`65331c9^`) com a nova ponto a ponto:

| Medida | Resultado |
|---|---|
| Colunas `t`, `ele`, `hr`, `cad` dos 2.875 pontos | **idênticas** (0 diferenças); `start_time` igual |
| Distância de cada passo (haversine) | diferença máxima de **0,13 m**; soma dos passos 8.670,9 → 8.671,9 m |
| Velocidade máxima de um passo | 10,84 m/s, a mesma da fixture antiga (passo de distância e tempo preservados) |
| Local | origem da fixture antiga omitida; a nova tem outra região e direção sem relação com o percurso real (não reconstitui o percurso) |
| Formato do traçado | percurso fechado em "flor" de ~1,6 km de raio (antes ~2,4 km): ainda não-trivial para o Douglas-Peucker |

O que mudou nos asserts, e só isso: `distance_m` 8.670,74 → 8.671,66 e `split` 9 de 671 → 672 m (a soma dos passos mudou ~0,9 m com a nova direção); `route` 104 → 69 pares (o Douglas-Peucker acha menos vértices na curva suave) e `route[0]` (coordenada antiga, omitida) → `[-10.5, -52.5]`; no front `points[0]`. Seguem **iguais**: duração 2.877 s, tempo total 2.882, pace 332, elevação 38,3, FC 151/169, cadência 175, 726 kcal (RUN) e 414 (WALK), as 9 parciais (8 de 1.000 m, tempos 338, 318, 334, 323, 354, 360, 312, 321, 217 s), `splits` somando `duration_sec`, e `checkPlausible` na amostra (`null`). Os asserts de `simplifyRoute` (linha reta → 2 pares; ≤ 500 pares; primeiro e último ponto) não usam a fixture e não mudaram. O `route: 69` é agora um instantâneo da curva sintética, mas o teste continua cobrindo "mais de 2 e menos de 500 pares com o primeiro ponto preservado". Valores da API ao vivo com a fixture nova: 8.671,66 m, 2.877 s, pace 332, 9 parciais, 726 kcal, rota 69 pares, `route[0]` `[-10.5, -52.5]` (= testes do back).

## (2) Parser: tempos no node

Arquivos gerados fora do repositório (scratchpad), cada caso num processo próprio; parser **antigo** = `gpx.ts` de `bbf8b8e^`, **novo** = HEAD. Máquina de desenvolvimento, sem carga.

**Malformado de ~1 MB real (1.048.5xx bytes) — pedido do Maestro**

| Caso | Antigo | Novo |
|---|---|---|
| `trkpt` sem fechar (`<trkpt …><time>…</time>` repetido) | 2.466 ms | **35 ms** |
| `trkpt` sem `>` (`<trkpt lat="1" ` repetido) | > 15 s (morto) | **11 ms** |
| `time` sem fechar / sem `>` (dentro de um `trkpt`) | 3 ms / 1 ms¹ | **4 ms / 2 ms** |
| `name` repetido no cabeçalho da trilha | 3 ms¹ | **3 ms** |
| `trk` repetido sem fechar | > 15 s (morto) | **2 ms** |

¹ Nas minhas variantes de `time` e `name` o parser antigo não era lento (o motor de regex as otimiza). Por isso repeti com **os mesmos geradores do Security** (`gpxbench/run.mjs`, só leitura), em que o antigo trava de verdade:

| Caso do Security (1 MB) | Antigo | Novo |
|---|---|---|
| `unclosed_trkpt` | 4.147 ms | **47 ms** |
| `unclosed_time_in_pt` | > 20 s (morto) | **3 ms** |
| `unclosed_name_in_header` | > 20 s (morto) | **2 ms** |
| `time_no_gt` | > 20 s (morto) | **3 ms** |
| `trkpt_no_gt`, `unclosed_trk`, `unclosed_cdata_name`, `huge_attr_area`, `numeric_entities` | (Security: > 20 s e ≤ 3 ms) | 12, 3, 3, 1, 1 ms |

**Pior caso do novo a 1 MB: 47 ms (< 1 s ✓).** O mesmo conjunto a **25 MB**, novo: `unclosed_trkpt` 943 ms, `trkpt_no_gt` 204, `unclosed_time_in_pt` 40, `unclosed_name_in_header` 30, `unclosed_cdata_name` 24, `huge_attr_area` 3, `unclosed_trk` 47, `time_no_gt` 31, `numeric_entities` 6 ms. Minhas variantes de 24 MB: `trkpt` sem fechar 707 ms, sem `>` 199 ms, `time`/`name`/`trk` ≤ 39 ms. **Todos ≤ 1,5 s a 25 MB**, o teto que o Security fixou para a correção (antes: > 60 s).

**Legítimo de ~25 MB**

| Arquivo | Pontos | Antigo | Novo | Saída |
|---|---|---|---|---|
| Strava com FC, cadência e extensões, 24,6 MiB (como o do Security) | 28.263 | 187 ms | **193–259 ms** (3 execuções: 227, 193, 196 no benchmark; 259 na comparação), 118 MB RSS | **idêntica** (1.190.608 bytes de JSON) |
| 1 ponto por segundo, sem extensões, 24 MiB (246.520 pontos → afinados a 30.000) | 30.000 | 863 ms | **1.046 ms** | **idêntica** |
| Harness do Security, `legit` 25 MB | 28.263 | (Security: 493 ms) | 699 ms | — |
| Harness do Security, `many_points_one_second` 25 MB | 28.008 | (Security: 1.234 ms) | 1.310 ms | — |
| `run-sample.gpx` (a amostra do front) | 120 | 8 ms | 6 ms | **idêntica** |

Dentro do que o Security mediu: 28.263 pontos em 0,2–0,7 s (493 ms antes) e o caso de 1 ponto por segundo em 1,0–1,3 s (1.234 ms antes), abaixo do teto de 1,5 s dele. O teste de regressão novo (`~1 MB malformado … termina em tempo linear`) **falha com o parser antigo** (3,5 s no 1º caso) e passa com o novo.

**Comparação lado a lado (antigo × novo) em 17 variantes legítimas e de erro:** 13 idênticas (Strava com FC/cadência, `trkpt` autofechado, prefixo `ns3:`, nome em CDATA com `<` e `&`, duas trilhas, pontos fora de ordem, corpo de ponto de 3.900 caracteres, tipos walking e cycling, sem `gpx`, só `rte`, um ponto só, latitude fora da faixa) e 4 diferentes, todas nos limites novos (ver L1).

## (3) No navegador: a saída do parser não mudou para o usuário

Conta única QA (75 kg) com a rotina "Corrida leve"; `.gpx` gerados da fixture **sintética**. Injeção do plano.

| Fluxo | Resultado | Evidência |
|---|---|---|
| 2 — Importar | **PASS** | `run-recent.gpx`: **8,67 km · 47:57 · 5:32 /km · 38,3 m · 151 / 169 bpm · 175 passos/min · 726 kcal** = a API; título "Corrida QA" (do `<name>`); traçado novo (flor, início verde sobre o fim branco); **9 parciais** (5:38, 5:18, 5:34, 5:23, 5:54, 6:00, 5:12, 5:21 e "0,67 km 3:37 5:23 /km") |
| 5 — Tipo divergente | **PASS** | `walk-recent.gpx`: "O arquivo indica Caminhada, mas a rotina é de Corrida. Salvar como:" (Corrida marcada); trocar para Caminhada recalcula **726 → 414 kcal**; salvar → resumo "Caminhada" (414 kcal) |
| 7 — Erros | **PASS** | `ride.gpx` → "Bike chega em breve. Por enquanto, só corrida e caminhada."; `old.gpx` → "Só dá para importar atividades das últimas 72 horas."; `nope.gpx` → "Este arquivo não é um GPX válido."; `route-only.gpx` → "O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade)." — as mesmas mensagens de antes; só a atividade válida de WALK no banco |
| Extra — malformado no navegador | **PASS** | `.gpx` de 1 MB com `trkpt` sem fechar, `trkpt` sem `>`, `time` sem `>` e `trk` sem fechar: a mensagem "O arquivo não tem pontos com horário…" aparece em ~0,5 s (inclui o `fetch` do arquivo); o de 24 MB, em ~1 s; o app segue responsivo |
| Extra — legítimo de 25 MB no navegador | **PASS** | prévia na tela em ~1 s (leitura, parser, API e renderização), 74,85 km, sem erro |

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| L1 | LOW | Frontend (`gpx.ts`) | Os limites novos do parser (`ELEMENT_MAX` 4.096 caracteres por `trkpt`, `ATTRS_MAX` 256 na abertura, 4.096 no cabeçalho da trilha) descartam sem aviso o que o parser antigo aceitava: **(a)** `trkpt` com corpo maior que 4.096 caracteres (por exemplo, extensão de 5 KB ou comentário antes do `hr`) é ignorado e o arquivo vira "O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade)." (mensagem enganosa: o arquivo tem pontos); **(b)** abertura do `trkpt` com atributos de 300 caracteres idem; **(c)** `<name>` que só aparece depois de 4.096 caracteres do cabeçalho vira `null` (cai no nome da rotina). Medido nas variantes de corpo de 3.900 (igual) e 4.300 (diferente) caracteres. Os arquivos que usei como referência (Strava com extensões, 800 bytes por ponto) ficam bem abaixo do limite, então deve ser raro (não medi exports reais de outros apps); vale **dizer o limite** (comentário e, se quiser, mensagem própria quando um `trkpt` passa de 4 KB) ou subir `ELEMENT_MAX` para 16–64 KB, que ainda é linear. |
| I1 | INFO | Cobertura | O teste de regressão fixa 1 s num `~1 MB` (`1e6` caracteres) por caso e já falha com o parser antigo (3,5 s). Não cobre `<![CDATA[` nem `&#x…;` repetidos (esses já eram lineares: ≤ 165 ms a 25 MB no Security). |
| I2 | INFO | Cobertura | Só web e node (V8). Hermes/JavaScriptCore no aparelho têm outro motor de regex; o parser novo quase não usa regex sobre texto grande (`indexOf` e fatias de 4 KB), então o risco é menor, mas o tempo no aparelho real não foi medido. |
| I3 | INFO | Ambiente | Tempos em máquina de desenvolvimento sem carga; os do Security (493 ms e 1.234 ms) vieram de outra execução, então a comparação tem ruído de ±30%. |

## Dados de teste e limpeza

Criada **1 conta** (`5b354d74-9ef2-41e0-9bf8-7c113697546a`), 1 rotina Corrida (via API) e 1 atividade GPS (a caminhada, pela interface). Apagada **por id** pela Admin API (200, cascade), sem filtro por prefixo; nenhuma outra conta foi tocada. Servidor da `:8099`, pasta dos `.gpx`, arquivo de contas (com senha) e `.gpx` de benchmark removidos; `localStorage` do portal limpo e página recarregada no login; nenhum arquivo de teste no repositório.

| Tabela | Antes | Com dados QA (pico) | Depois |
|---|---|---|---|
| `users` | 83 | 84 | **83** |
| `auth.users` | 83 | 84 | **83** |
| `activities` | 408 | 409 | **408** |
| `groups` | 8 | 8 | **8** |
| `group_members` | 7 | 7 | **7** |
| `workout_routines` | 190 | 195 | **190** |
| `activity_gps_data` | 1 | 2 | **1** |
| `user_measurements` | 106 | 107 | **106** |

Sem resíduo: 0 linhas da conta em `users`, `activities` e `workout_routines`. "Antes" = o estado deixado pela limpeza do round anterior (que incluiu as 4 contas antigas apagadas por engano, ver `qa-gpx-import-full-2026-10-14.md`).
