# QA — Importador de GPX, etapa Frontend — round 2 (Task 13) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Rework testado:** `a73d723` (`RouteTrace`, `GpsActivity`, `GpxImport`, `Profile`); injeção corrigida no plano em `6d9a13a` · **Round anterior:** `docs/qa-gpx-import-frontend-2026-10-14.md` (FAIL: M1 MEDIUM, I1–I6) · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412 e 320 px). Arquivos `.gpx` gerados da fixture fora do repositório, servidos na `:8099` (encerrado no fim). Medidas de posição lidas do DOM (`getBoundingClientRect`); os screenshots do portal ficaram indisponíveis por um trecho (janela do portal sem renderizar) e voltaram depois, então há captura de I2, I3, I4 e do duplicado a 320 px.

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 2 INFO novos) → pode seguir para Security (Task 15)

M1, I2, I3 e I4 corrigidos. Regressão dos fluxos 2, 3 e 8 sem diferença.

## Automatizados

| Item | Resultado |
|---|---|
| `FrontEndTorv: node --test src/utils/*.test.mjs` | **PASS** — 74/74, 0 fail, 0 cancelled, 0 skipped (igual ao round 1) |
| `FrontEndTorv: npx tsc --noEmit` | **PASS** — sem erros |

## M1 — erro de salvar visível sem rolar

Conta A (75 kg). Em cada caso: tela rolada até o fim, toque em **Salvar atividade**, e leitura das posições logo depois, sem rolar. Antes (round 1) o aviso ficava no topo, fora da tela.

| Cenário | Viewport | Resultado | Evidência (topo–base, px) |
|---|---|---|---|
| Duplicado (409): `run-recent.gpx` de novo | 412x899 | **PASS** | aviso "Você já importou esta atividade." 707–727, **Ver atividade** 755–805, Salvar 833–883; tudo dentro da tela |
| Duplicado (409) | 320x691 | **PASS** | aviso 499–519, **Ver atividade** 547–597, Salvar 625–675 (captura: aviso, botão "Ver atividade" e "Salvar atividade" juntos no rodapé) |
| 400 do **teto de 5 por dia**: A com 4 `STRENGTH` (SQL, 01:00–04:00 UTC) + 1 corrida do dia; importar `walk-recent.gpx` (mesmo dia UTC) | 412x899 | **PASS** | aviso "Você já registrou 5 atividades nesse dia, o limite diário." 707–747, sem "Ver atividade", Salvar 775–825 |
| 400 do teto | 320x691 | **PASS** | aviso 447–487, Salvar 515–565; `scrollWidth` = 320 |
| "Ver atividade" | 412 | **PASS** | abre o resumo da atividade existente (`GpsActivity`, Corrida, 08:43) |
| Aviso antigo ao escolher outro arquivo | 320 | **PASS** | depois do 400 do teto, "Escolher outro arquivo" com `run-recent.gpx`: nenhum `role=alert` na tela (e o aviso novo do duplicado só aparece ao salvar) |
| Erros de leitura/prévia | 412 | **PASS** | continuam no topo (a tela está no topo nesse momento); o aviso do teto não aparece na prévia, só ao salvar |

## I2, I3, I4

| # | Item | Resultado | Evidência |
|---|---|---|---|
| I2 | Início visível no traçado de ida e volta | **PASS** | fixture (percurso fechado): círculo do Fim (branco, r 8) por baixo e o do Início (verde `#8CC63F`, r 5) por cima; centros a (356, 578) e (357, 580) px; `elementFromPoint` no centro do Início devolve o círculo verde. Na captura, ponto verde com aro branco na ponta do percurso, e a legenda "Início"/"Fim" bate |
| I3 | Título longo no item do Perfil | **PASS** | título de 96 caracteres, a 320 px: `-webkit-line-clamp: 2`, bloco de 42 px, item de 134 px (antes 260), terminando em "…" ("Treino longo de domingo no …"); `scrollWidth` = 320 |
| I4 | 400 no renomear | **PASS** | título de 101 caracteres (valor injetado por script, o campo limita a 100 ao digitar) → 400 → "Não foi possível salvar o título." (em vermelho, sob Salvar/Cancelar); não aparece mais "arquivo". Com 96 caracteres, salva normalmente |

## Regressão rápida

| Fluxo | Resultado | Evidência |
|---|---|---|
| 2 — Importar | **PASS** | `run-recent.gpx` na rotina Corrida: 8,67 km · 47:57 · 5:32 /km · 38,3 m · 151/169 bpm · 175 passos/min · **726 kcal** · 9 parciais, título "Corrida QA" do `<name>`, traçado |
| 3 — Salvar | **PASS** | resumo (15/10/2026 · 08:43, Tempo total 48:02, 726 kcal); Histórico mostra "Corrida QA 08:43 · 8,67 km · 47:57 · 5:32 /km" sem puxar para atualizar; Perfil: 1 atividade, Streak 1 / Recorde 1 dia, Este mês 1 · "+1 vs mês passado", "Atividade Física" com o item; Home "Gastas 726", Streak 1; ranking de A **0 → 1** |
| 8 — Renomear e excluir | **PASS** | renomear (título novo no Perfil); excluir pelo modal volta à lista; `activities` de A = 0, ranking **1 → 0** (as 4 `STRENGTH` do teste do teto foram apagadas antes, para o dia deixar de contar) |

Console: sem erros novos.

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| I1 | INFO | Frontend (`GpxImport`) | O `saveError` não é limpo ao **trocar o tipo** (Corrida ↔ Caminhada) na prévia: depois de um 400 de salvar, trocar o tipo recalcula as métricas mas o aviso antigo continua. No caso testado (teto diário) o aviso segue verdadeiro; só incomoda se o erro dependesse do tipo. Já é limpo ao escolher outro arquivo e ao salvar de novo. |
| I2 | INFO | Cobertura | Seguem sem teste os pontos nativos (iOS/Android: seletor de arquivo, `react-native-svg`) e o arquivo de 25 MB (Security, Task 15). |

## Dados de teste e limpeza

Criados: 1 conta (A, 75 kg), 1 grupo (`QA GPX FE2`), 1 rotina Corrida criada pela API (mais as 3 do plano padrão), 1 corrida pelo app (apagada pelo app) e 4 `STRENGTH` por SQL só para o teto (apagadas por SQL). Grupo apagado pelo app (204) e conta pela Admin API do Auth (200, cascade). Servidor da `:8099` encerrado, pasta dos `.gpx` e arquivo de contas (com senha) removidos, `localStorage` do portal limpo e página recarregada no login; nenhum arquivo de teste no repositório.

| Tabela | Antes | Com dados QA (pico) | Depois |
|---|---|---|---|
| `users` | 87 | 88 | **87** |
| `auth.users` | 87 | 88 | **87** |
| `activities` | 417 | 418 | **418** |
| `groups` | 8 | 9 | **8** |
| `group_members` | 7 | 8 | **7** |
| `workout_routines` | 205 | 210 | **206** |
| `activity_gps_data` | 0 | 1 | **1** |
| `user_measurements` | 110 | 111 | **110** |

**Diferença de +1 em `activities`, `workout_routines` e `activity_gps_data` não é do QA:** a conta A não deixou nada (0 linhas em `users`, `activities`, `workout_routines`, `group_members`, `user_measurements`; 0 grupos `QA GPX FE*`), e a linha de GPS que sobrou é uma corrida ("Corrida na hora do almoço", 12/10 14:08 UTC) de uma conta real (`leonardommonteiro2004@gmail.com`), importada por fora durante a minha rodada, ligada à rotina "Corrida Leve" da mesma conta (a única rotina RUN/WALK que existe hoje no banco, conferida por consulta). As outras duas diferenças aparecem já no pico (418 e 210 = 417 + 1 e 205 + 4 minhas + 1), ou seja, vieram da mesma atividade real concorrente. O resto voltou ao valor de antes.
