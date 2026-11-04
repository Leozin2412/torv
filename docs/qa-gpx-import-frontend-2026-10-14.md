# QA — Importador de GPX, etapa Frontend (Task 13) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Diff:** `3319edc` (parser, formatação, projeção, cliente da API), `62d4d6f` (T10: `RouteTrace`, `ActivityIcon`, tipo no `RoutineEditor`, card em Meus treinos), `58aa62a` (T11: `GpxImport` e `GpsActivity`), `9bb5848` (T12: atividades de GPS no Histórico, Perfil e Perfil de membro), `278689a` (404 do `GpsActivity`) · **Plano:** `docs/superpowers/plans/2026-10-14-gpx-import.md` (Task 13 Steps 1–4, Task 10 Step 5, Task 11 Step 4) · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412x907, e 320x691 no item 10). Toques reais do portal. Arquivos `.gpx` gerados da fixture `run-sample.json`, fora do repositório, servidos na `:8099` com CORS (encerrado no fim).

## Veredito: FAIL (0 CRITICAL / 0 HIGH / 1 MEDIUM / 0 LOW / 6 INFO) → reabre a Task 11 (Frontend); não avança para Security

Os 10 fluxos funcionam e os números batem com o servidor. O MEDIUM é de usabilidade: **qualquer erro ao salvar fica fora da tela** (M1), e isso quebra o fluxo 6 (duplicado) no celular.

## Step 1 — Automatizados

| Item | Resultado |
|---|---|
| `FrontEndTorv: node --test src/utils/*.test.mjs` | **PASS** — 74/74, 0 fail, 0 cancelled, 0 skipped (base do começo da branch: 49 → **+25**) |
| `FrontEndTorv: npx tsc --noEmit` | **PASS** — sem erros |

## Step 2 — Arquivos e injeção

Gerados em pasta temporária fora do repositório: `run-recent.gpx` (termina ~10 min antes; 2.875 pontos, FC e cadência), `walk-recent.gpx` (`<type>walking</type>`, termina ~80 min antes, deslocado 0,01° em lat), `ride.gpx` (`cycling`), `old.gpx` (começou há 4 dias), `nope.gpx` (texto qualquer) e `route-only.gpx` (só `<rte>`). A injeção do plano **não funciona** neste ambiente (ver I1); usei um listener de captura equivalente (mesmo efeito: `fetch` na `:8099` → `DataTransfer` → `change`).

## Task 10 Step 5 e Task 11 Step 4 (portal)

| Item | Resultado | Evidência |
|---|---|---|
| T10 — criar Corrida | **PASS** | `RoutineEditor`: seletor `tablist` com Musculação / Corrida / Caminhada, `aria-selected` certo, abas de 44 px; com Corrida somem os exercícios e o "Adicionar exercício", aparece "Depois é só importar o .gpx de cada treino em Meus treinos." e o placeholder vira "Ex.: Corrida leve". Salvo (banco: `RUN`). O card mostra a etiqueta **Corrida**, "Importe o .gpx do seu treino" e o botão `Importar GPX em Corrida leve` (48x48, igual ao ▶); o "Próximo" continua no Dia 1 |
| T10 — editar | **PASS** | Tipo fixo ("Tipo da rotina: Corrida", sem seletor); nome editável; "Excluir rotina" presente |
| T10 — musculação | **PASS** | Sem exercício → "Adicione pelo menos um exercício."; com "Prancha" salva; card "1 exercício · 3 séries" com ▶, sem etiqueta, igual a antes |
| T10 — treino em andamento | **PASS** | Com o Dia 1 em andamento ("Treino em andamento", Continuar/Descartar), a rotina Corrida segue com o botão **Importar GPX** ativo |
| T11 — prévia, salvar, resumo, renomear, excluir | **PASS** | ver fluxos 2, 3 e 8 |

## Step 3 — Fluxos reais

Contas: **A** (75 kg, dona do grupo `QA GPX FE` com B; `joined_at` recuado 5 dias por SQL, como no round do backend) e **B** (sem peso: linha de `user_measurements` removida).

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|
| 1 | Rotina | **PASS** | ver T10 acima |
| 2 | Importar | **PASS** | `run-recent.gpx` na rotina Corrida (A): **8,67 km · 47:57 · pace 5:32 /km · elevação 38,3 m · FC 151/169 bpm · cadência 175 passos/min · 726 kcal** = valores da fixture e da fórmula com 75 kg; título vem do `<name>` ("Corrida QA"); traçado aparece; **9 parciais** (1–8 e "0,67 km 3:37 5:23 /km") |
| 3 | Salvar | **PASS** | abre o `GpsActivity` (Corrida, 15/10/2026 · 08:24, Tempo total 48:02, 726 kcal). Voltar → **Histórico já traz a atividade sem puxar para atualizar** (filtro Corrida: "08:24 · 8,67 km · 47:57 · 5:32 /km", chevron). **Perfil:** 1 atividade, Streak 1 / Recorde 1 dia, Este mês 1 · "+1 vs mês passado", quadrado de hoje aceso no calendário, "Atividade Física" com o item. **Home:** Streak 1, "Gastas 726 kcal" (depois da caminhada: 1.140). **Ranking** (API e tela): A 0 → 1 ponto, "#1 · 1 dia" |
| 4 | Sem peso | **PASS** | B: calorias "—" com "Cadastre seu peso no Perfil para estimar as calorias." na prévia **e** no resumo salvo; o resto igual |
| 5 | Tipo divergente | **PASS** | `walk-recent.gpx` na rotina Corrida → "O arquivo indica Caminhada, mas a rotina é de Corrida. Salvar como:" com Corrida / Caminhada (`tablist`, `aria-selected`, 44 px; Corrida marcada); trocar para Caminhada recalcula **726 → 414 kcal** (= `(0,1·dist + 1,8·elev + 3,5·t/60)·75/1000·5`); salvar → resumo com ícone de pegadas e "Caminhada"; Histórico (Todos) mostra os dois itens com o ícone de cada tipo |
| 6 | Duplicado | **PASS com ressalva (M1)** | importar `run-recent.gpx` de novo: a prévia abre (a prévia não dedupa) e **Salvar** mostra "Você já importou esta atividade." + **Ver atividade**, que abre o resumo da existente; 1 linha no banco. **Mas o aviso aparece no topo da tela e a tela fica rolada no botão: não se vê nada** (M1) |
| 7 | Erros | **PASS** | `ride.gpx` → "Bike chega em breve. Por enquanto, só corrida e caminhada."; `old.gpx` → "Só dá para importar atividades das últimas 72 horas."; `nope.gpx` → "Este arquivo não é um GPX válido."; `route-only.gpx` → "O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade)." Todos `role=alert` no topo, o cartão de escolha continua para tentar de novo. **Banco: só as 2 atividades válidas de A**, nenhuma gravada pelos erros |
| 8 | Renomear e excluir | **PASS** | lápis ("Renomear") → `Input` + Salvar/Cancelar na mesma linha; título vazio → "Dê um título para a atividade."; "Longão de domingo" aparece no Histórico, no Perfil e no perfil de membro. Excluir: modal "Excluir atividade?" com o texto do plano, Cancelar fecha sem apagar, "Excluir" apaga e volta; some do Histórico e do Perfil. Ranking: com a corrida apagada o dia seguiu contando (a caminhada era do mesmo dia); apagando a caminhada também, **A 1 → 0** (B em 1), Perfil Streak 0 / 0 atividades, Home "Gastas 0", `activities` de A = 0 |
| 9 | Perfil de membro | **PASS** | B abre A pelo ranking ("1º, QA Alice GPX, 1 dia. Abrir perfil"): Streak 1, "1 dia ativo · 2 atividades", calendário, e os dois itens com ícone próprio e "15/10 · 08:24 · 8,67 km · 47:57 · 5:32 /km" — **sem chevron, sem toque (dois cliques: continua em `MemberProfile`), sem rota, FC, cadência, calorias nem parciais** |
| 10 | 320 px e acessibilidade | **PASS** | a 320x691, `scrollWidth` = 320 em todas as telas: **card de GPS** (texto quebra em 2 linhas, botão intacto); **RoutineEditor** (abas 90x44 cada, sem corte, nome longo com rolagem no campo); **GpxImport** (aviso de tipo quebra em 3 linhas, métricas em 2 colunas, FC/cadência com a unidade em texto menor quebrando abaixo, tabela de parciais cabe com "0,67 km" encostando em "3:37"); **GpsActivity** (edição do título com Salvar/Cancelar lado a lado; título de 96 caracteres quebra em 7 linhas sem corte; modal de exclusão cabe). Nenhum alvo < 44 px nas telas novas (`GpxImport`, `GpsActivity`, `RoutineEditor`, card de GPS); nenhum botão sem texto ou `aria-label`; "Voltar", "Renomear", "Importar GPX em <nome>", "Ver atividade <título>" (Histórico e Perfil, RUN/WALK) com rótulo; `RouteTrace` com `role=image` "Traçado da rota". **Nenhum `Alert`** nos arquivos novos (grep) |
| extra | Perfil → atividade | **PASS** | no Perfil de B, o item de corrida (chevron, `Ver atividade <título>`, 372x176 com o título longo) abre o `GpsActivity` |

Console: só o aviso conhecido `props.pointerEvents is deprecated` (react-native-web); nenhum erro durante os fluxos.

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| M1 | MEDIUM | Frontend (`screens/GpxImport/index.tsx`) | O erro de **salvar** (`setError`) e o botão **Ver atividade** são renderizados no **topo** do `ScrollView`, mas o botão "Salvar atividade" fica no fim de uma tela longa (cartões, mapa e 9 parciais). Ao tocar em Salvar o usuário está rolado até o fim e a tela não rola de volta: nada acontece, na visão dele. Reproduzido a 412x907 com o duplicado (fluxo 6): o aviso e o "Ver atividade" só aparecem rolando para cima. Vale para todo erro de salvar (409, 400 de plausibilidade/teto de 5 por dia, 429, rede). Os erros da **prévia** não sofrem disso (a tela está no topo). Sugestão: `scrollTo({ y: 0 })` ao definir o erro do `save`, ou mostrar o erro e o "Ver atividade" junto do botão Salvar. |
| I1 | INFO | Plano/Ambiente | A injeção do Step 2 (`HTMLInputElement.prototype.click`) não pega: o `expo-document-picker` 57 cria o `<input>` e dispara `input.dispatchEvent(new MouseEvent('click'))`, não `.click()`. Usei `document.addEventListener('click', h, true)` (filtrando `target.type==='file'`, `preventDefault`, mesma montagem do `File`). Vale corrigir o snippet do plano e o da Task 14. |
| I2 | INFO | Frontend (visual) | Em trajetos de ida e volta, o ponto de **Início** (verde) fica escondido sob o de **Fim** (branco), que é desenhado depois: na fixture a legenda "Início" não tem ponto correspondente visível no mapa. |
| I3 | INFO | Frontend (visual) | O título longo (100 caracteres) não tem `numberOfLines` no item de "Atividade Física" do Perfil: a 320 px ocupa 6 linhas (item de 260 px). No Histórico fica contido. |
| I4 | INFO | Frontend (copy) | Qualquer 400 vira "Não foi possível processar o arquivo." (`gpsErrorText`), inclusive ao **renomear**, onde não há arquivo. Só aparece se o servidor recusar o título (o campo já limita a 100 e a tela barra o vazio; reproduzi só com um valor de 101 caracteres injetado por script). |
| I5 | INFO | Frontend (fora desta feature) | No Perfil (tela existente) há alvos abaixo de 44 px: "Editar nome de usuário" 14x14, "Alterar foto de perfil" 32x32, "Editar objetivo/nível/peso" 43x18, "Abrir" 76x29. Não vêm do importador. |
| I6 | INFO | Cobertura | Só web: seletor de arquivo real, `DocumentPicker`/`readPickedFile` nativo e `react-native-svg` em iOS/Android **não** foram testados. O arquivo de 25 MB (tempo do parser) fica para o Security (Task 15). |

## Dados de teste e limpeza

Criados: 2 contas (A e B; mais 2 de tentativas descartadas na preparação, apagadas na hora), 1 grupo (`QA GPX FE`), 9 rotinas (as 3 do plano padrão de cada conta, mais A: Corrida leve e Peito QA, e B: Corrida do Bruno, esta criada pela API), 3 atividades pelo app (A: corrida e caminhada, depois apagadas pelo app; B: 1 corrida). Tudo pelo app e só nas contas QA; por SQL só o `joined_at` do grupo e a remoção do peso de B. Contas apagadas pela Admin API do Auth (200 ×2, cascade; o `DELETE /groups/:id` do meu script retornou 400 por corpo vazio e o grupo saiu junto com a conta dona). Pasta temporária dos `.gpx`, arquivo de contas (com senhas) e servidor da `:8099` encerrados/removidos; `localStorage` do portal limpo e página recarregada no login; nenhum arquivo de teste dentro do repositório.

| Tabela | Antes | Com dados QA (pico) | Depois |
|---|---|---|---|
| `users` | 87 | 89 | **87** |
| `auth.users` | 87 | 89 | **87** |
| `activities` | 417 | 418 | **417** |
| `groups` | 8 | 9 | **8** |
| `group_members` | 7 | 9 | **7** |
| `workout_routines` | 205 | 214 | **205** |
| `activity_gps_data` | 0 | 1 | **0** |
| `user_measurements` | 110 | 111 | **110** |

Sem resíduo: 0 linhas das contas QA em `users`, `activities`, `workout_routines`, `group_members`, `user_measurements`; 0 grupos `QA GPX FE`; 0 `activity_gps_data` órfã.
