# QA — Importador de GPX + Perfil de membro, teste completo no HEAD (Task 14) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **HEAD:** `3ed3d14` (código das duas features até `a73d723`; `6d9a13a` é só o plano) · **Relatórios anteriores:** `docs/qa-gpx-import-backend-2026-10-14.md` (PASS), `docs/qa-gpx-import-frontend-2026-10-14.md` (FAIL: M1), `docs/qa-gpx-import-frontend-2026-10-14-round2.md` (PASS), `docs/qa-member-profile-full-2026-10-14.md` (PASS, referência do Step 3) · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412x907 e 320x691). Arquivos `.gpx` gerados da fixture `run-sample.json` fora do repositório, servidos na `:8099` com a injeção do plano (`6d9a13a`). Banco só via Prisma/Admin API; contas QA por `/auth/register` + confirmação pela Admin API.

## Veredito: PASS nas duas features (0 CRITICAL / 0 HIGH / 0 MEDIUM de produto, 6 INFO) — com 1 INCIDENTE DO PRÓPRIO TESTE na limpeza (ver abaixo) → pode seguir para Security (Task 15)

Nada falhou no HEAD. Contrato do Perfil de membro, meia-noite local, contrato do importador, os 10 fluxos do Perfil de membro, os 10 do importador, a regressão das demais áreas e a consulta de consistência passaram.

**INCIDENTE (meu, não do produto): a limpeza apagou 4 contas que não eram deste teste.** O meu script de limpeza apagou, pela Admin API, toda conta com e-mail começando em `qa.full.` — e existiam 4 contas antigas `qa.full.{a,b,c,d}.1790892…@torvtest.dev` (de um teste anterior, já no banco antes de eu começar) que casaram com o filtro. Eu não listei antes de apagar. O cascade levou os dados delas: **−4 em `users`/`auth.users` e `user_measurements`, −10 em `activities`, −16 em `workout_routines`** (a diferença entre "antes" e "depois" na tabela de limpeza). Nada mais foi tocado: grupos, `group_members`, `food_logs` e `activity_gps_data` voltaram exatamente ao valor de antes, e as linhas da conta real (`leonardommonteiro2004@gmail.com`) estão intactas. As 4 contas eram descartáveis de teste (domínio `torvtest.dev`), mas **não dá para recriá-las daqui**; se alguma coisa dependia delas, só restaurando o banco. A causa é do script (filtro por prefixo sem conferir a origem), e nos rounds anteriores o prefixo era `qa.gpx.`, que não colidia com nada.

## Step 1 — Automatizados (antes → depois)

| Suíte | Base do início da branch | HEAD | Resultado |
|---|---|---|---|
| `BackEndTorv: npm test` | 239 | **310/310** (+71), 0 fail, 0 cancelled, 0 skipped | **PASS** |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | 49 | **74/74** (+25), 0 fail, 0 cancelled, 0 skipped | **PASS** |
| `FrontEndTorv: npx tsc --noEmit` | limpo | limpo | **PASS** |

## Step 3 — Perfil de membro sobre o HEAD

### 3a — Contrato ao vivo (Task 4 Step 3 e Step 4)

Contas A (dona), B (membro), C (fora); data local 2026-10-15, `tz_offset_min=-180`. B com 2 treinos reais (há 1 h e 26 h, `POST /workouts/sessions`) e 30 atividades antigas por SQL (3 no mês passado, 2 até o dia 15; 1 há 11 meses; 1 há 13 meses; 25 em jul–ago).

| Item | Resultado | Evidência |
|---|---|---|
| 1 Acesso | **PASS** (7/7) | A→B 200 `is_me:false`; A→A 200 `is_me:true`, também com UUID maiúsculo; A→C 404 `{"error":"Not found"}`; UUID aleatório → **o mesmo** 404 (corpo idêntico); C→B 404; sem token 401 |
| 2 Lista branca | **PASS** (3/3) | topo `calendar,is_me,month,streak,total_activities,user`; `user`: `id,name,username,photo_url,fitness_level`; sem e-mail, peso, altura, idade, gênero, objetivo, nascimento |
| 3 Números vs SQL | **PASS** (4/4) | `total_activities` 32 = 32; `streak` 2/2 = SQL; `month` 2 dias, 2 atividades, delta 0 = SQL; `calendar.days` idêntico ao SQL na janela (2025-10-12…2026-10-15: 31 dias; a de 13 meses fica de fora) |
| 4 Histórico | **PASS** (4/4) | `limit=2` → 2 itens, `distance_m:null`, `next_before`; página 2 sem repetir; `limit=20` percorre as 32 atividades em 2 páginas, sem repetir; C → 404 |
| 5 400 | **PASS** (8/8) | `date=2026-02-31`, `tz_offset_min=841`, `/users/abc/profile`, `/users/abc/activities`, `limit=51`, `limit=0`, `before=ontem`, sem `date` |
| 6 Home | **PASS** | `summary.streak_days` = `streak.current` (2 = 2). **Item 6.b do plano (`TEST_OTHER`) não roda mais:** o banco rejeita (`activities_activity_type_check`, só `STRENGTH`/`RUN`/`WALK` depois da migration do GPS; ver I3). Refeito com uma atividade `RUN` (sem `activity_gps_data`) num dia sem treino: streak de B 2 → 3, Home 3; apagada, volta a 2 |
| 7 `GET /profile` de A | **PASS** | sem `streak`, `longest_streak`, `workouts_in_month`, `total_workouts` |
| Meia-noite (Step 4) | **PASS** (2/2) | atividade em `2026-10-14T02:50:00Z` (23:50 BRT de anteontem): `tz_offset_min=-180` → cai em **2026-10-13** (+1); `tz_offset_min=0` → cai em **2026-10-14** (+1). Linha apagada |

### 3b — Os 10 fluxos da Task 8 no navegador

Contas A (dona), B (membro, 38 atividades no fim), D (vazia), E (nome de 61 caracteres, sem foto), F (membro que sai). Toques **reais** por coordenada nos fluxos 4 e 8 (calendário, ranking); em trechos em que a janela do portal ficou sem renderizar usei cliques por JS (ver I5).

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|
| 1 | Ranking → perfil de B | **PASS** | inicial, nome, `@`, "Nível físico: Intermediário"; Streak 2 / Recorde 2; Este mês 2 · 2 atividades · "Igual ao mês passado"; calendário; histórico — tudo igual à API/SQL |
| 2 | Gerenciar → nome de B → perfil; remover separado | **PASS** | "Ver perfil de …" abre o perfil; "Remover …" (44x44) abre só o diálogo "Remover …?" e "Cancelar" o fecha, sem abrir perfil |
| 3 | Própria linha | **PASS** | "QA Alice Full (você)" |
| 4 | Calendário | **PASS** | abre na semana atual (`scrollLeft` 494 de 494); cliques reais: `15 de out. · 1 atividade`, `14 de out. · 1 atividade`, `18 de set. · 3 atividades` (nível 3+, `rgb(140,198,63)`), `10 de set. · 2 atividades` (nível 2, `rgb(90,158,28)`), `3 de set. · 1 atividade`, `12 de out. · nenhuma atividade`, dia futuro → "Toque num dia para ver o total"; rolado até o início: `12 de nov. · 1 atividade`, `12 de out. · nenhuma atividade`, `1 de nov. · nenhuma atividade`; 1 célula com borda de seleção |
| 5 | Histórico | **PASS** | rolar até o fim: 36 itens = total do SQL do momento, 36 únicos (2ª página sem repetir); toque no item não navega |
| 6 | Saiu do grupo | **PASS** | perfil de F aberto em A; F sai pela API (204); `onRefresh` chamado (ver I4) → "Perfil indisponível." + "Vocês não estão mais em um grupo em comum." + "Voltar" (do corpo, 372x50, volta ao Gerenciar); sem dado antigo |
| 7 | Conta vazia | **PASS** | D: Streak 0, "Recorde: 0 dias", mês 0 · 0, 369 células vazias (+2 transparentes), "Nenhuma atividade ainda." |
| 8 | 320 px e nome longo | **PASS** | E a 320 px: nome 24 px em 2 linhas (60 px), `@` em 1 linha (21 px), inicial "M", 0 elementos com overflow, documento 320 = 320; calendário rola (586 de 586); alvos: Voltar 44x44, linhas do ranking 270x64, nomes no Gerenciar 184x44, remover 44x44 |
| 9 | Perfil próprio | **PASS** | B depois de somar 2 dias por SQL: 38 atividades, Streak 4, Recorde 4, Este mês 4 · 4 atividades · **"+2 vs mês passado"** (= API), calendário, "Atividade Física" com os 5 últimos |
| 10 | Home | **PASS** | Streak 4 = Perfil |

## Step 2 — Regressão no navegador (um fluxo real por área)

| Área | Resultado | Fluxo feito e evidência |
|---|---|---|
| Login e boas-vindas | **PASS** | login por e-mail e senha (A, B, C) → Home; diálogo "Bem-vindo(a) ao Torv, QA!…" com "Começar" na conta nova; some ao tocar; logout pelo Perfil volta ao Login |
| Home | **PASS** | Streak, "Consumidas", "restantes": 2.587 → **2.087** depois de 500 kcal na dieta; "Gastas" 726 depois da corrida; Streak acompanha o Perfil |
| Dieta | **PASS** | "Adicionar refeição" → "QA Almoço", 500 kcal, P 30, C 60, G 15 → aparece em "Refeições" com `P: 30g · C: 60g · G: 15g`, 500 kcal e reflete na Home |
| Treinos de musculação | **PASS** | "Iniciar Dia 1 — Superior A" → carga 2,5 kg → série feita → "Finalizar treino" (diálogo) → resumo "Treino concluído" ("Cargas diferentes da rotina: … Sem carga → 2,5 kg", Atualizar/Manter) → Concluir; no Histórico abre o detalhe; **editar** carga → 20 kg (o detalhe mostra "20 kg"); **excluir** (diálogo "Excluir este treino?") e 0 linhas de A no banco |
| Histórico, filtros e períodos | **PASS** | com B (38 atividades): "Tudo" 38; "7 dias" 4; "30 dias" 8; "3 meses" 29 (= SQL por janela); "Musculação" + "3 meses" 29; "Corrida" + "3 meses" 0 → "Nenhuma atividade nesse período"; "Personalizado" ("Desde quando?"/"Até quando?" → "15/10 – 15/10") → 1 |
| Grupos | **PASS** | A **cria** "QA Grupo UI" pelo formulário; Gerenciar → "Gerar código" (8 caracteres) e "Convidar" por username (C recebe em "Convites recebidos"); C **aceita**, vê o **ranking** (A e C "(você)"), "Sair do grupo" (diálogo "Sair do grupo?… a contagem começa do zero") → 0 linhas em `group_members`; C volta por "Entrar com código" (código em minúsculas → "Buscar grupo" → prévia "QA Grupo UI · 1 membro" → "Entrar no grupo"). Link: o grupo `QA Full` foi montado pelo `invite-link` + `POST /groups/join/<token>` |
| Perfil (objetivo, nível, peso e altura, foto) | **PASS** | C: objetivo + "Perder Peso" (API: `Melhorar Condicionamento, Perder Peso`) → "Nova meta sugerida" → "Aplicar nova meta"; nível Intermediário → Avançado (API `AVANÇADO`) → "Manter atual"; peso/altura 70/175 → 82/180 (API `82`/`180`) → "Aplicar nova meta"; **foto**: PNG gerado no navegador entregue ao `input[type=file]` que o `expo-image-picker` cria → `photo_url` gravado (objeto no bucket `pictures`, apagado na limpeza) |

## Step 4 — Importador inteiro

### 4a — Contrato ao vivo (Task 8 Step 3 do plano gpx-import)

Contas GA (75 kg, dona do grupo `QA GPS Full` com GB), GB (sem peso), GC (fora), GD (só para o teto). Fixture `run-sample.json` com `start_time` deslocado para terminar ~10 min antes de cada chamada. 58 verificações automáticas: 55 passaram de primeira e 3 foram refeitas (ver nota). **Todos os 12 itens: PASS.**

| # | Item | Resultado | Evidência |
|---|---|---|---|
| 1 | Rotinas | **PASS** | RUN só com nome → 201 `activity_type:"RUN"`, sem exercícios; WALK idem; RUN com exercícios → 400 `run and walk routines have no exercises`; STRENGTH sem exercícios → 400; `GET /workouts/routines` lista a RUN (`completed_recently:false`) e o `next_routine_id` aponta para uma STRENGTH; `PUT` trocando o tipo → 400 `activity_type cannot change`; `PUT` só com o nome renomeia e mantém RUN |
| 2 | Prévia | **PASS** | A: 8.670,74 m, 2.877 s (2.882 s total), pace 332, 9 parciais, elevação 38,3, FC 151/169, cadência 175; calorias **726** = fórmula com 75 kg; B (sem peso) `calories:null`, resto igual; a prévia não grava nada |
| 3 | Importação | **PASS** | 201 com detalhe (título = nome da rotina, `routine_id`, 726 kcal); `GET /activities/gps/:id` (rota de 104 pares, 9 parciais); `GET /activities?type=RUN` traz o item com `distance_m: 8670.74` e `type=STRENGTH` não traz; **ranking de A 0 → 1**; `/activities/summary` → `calories_burned: 726`, `streak_days: 1`; **B** vendo A: `GET /users/<A>/profile` com o dia no calendário (`count:1`), total 1, streak 1, e `GET /users/<A>/activities` com as chaves `id, activity_type, title, start_time, duration_sec, set_count, distance_m` — **sem** rota, FC, cadência, calorias nem parciais |
| 4 | Duplicado e paralelo | **PASS** | mesma importação → 409 `Activity already imported` com o `activity_id` da primeira; duas importações paralelas de um arquivo novo → `201,409` e 1 linha no banco |
| 5 | Teto | **PASS** | GD: 4 treinos de musculação + 1 GPS no mesmo dia UTC → 5 × 201; a 6ª de **qualquer tipo** (GPS e musculação) → 400 `too many sessions on that day`; banco com exatamente 5 |
| 6 | 400 e 413 | **PASS** (16/16) | início há 73 h; início no futuro; termina no futuro; antes de 2026; 1º `t` ≠ 0 (`invalid point at index 0`); ordem trocada (`chronological`); `lat` 91 e `lon` 181 (`invalid point at index 10`); 30.001 pontos; carro (~30 km/h) em `/preview` **e** em `POST /activities/gps`; curta (30 s, < 100 m); 1 ponto; `activity_type` RIDE; corpo de 2,1 MB → **413** em `/preview` e em `POST /activities/gps` |
| 7 | Acesso | **PASS** | atividade de A vista por C → 404 em `GET`, `PATCH`, `DELETE` (o título não mudou); B (mesmo grupo) → detalhe 404; C importando em rotina de A → 404; `routine_id` de musculação → 404; inexistente → 404; rotina RUN de A lida por C → 404; sem token → 401; `PATCH` com `trim` ("  Longão QA  " → "Longão QA") sem mudar data nem métricas; título em branco → 400 |
| 8 | Excluir | **PASS** | 204; com 2 atividades no dia, apagar a 2ª mantém o ranking; apagar a 1ª → 204, ranking **1 → 0**, linha de `activity_gps_data` some; de novo → 404 |
| 9 | Rate limit | **PASS** | 31 prévias de B num minuto limpo: as 30 primeiras 200 e a 31ª **429** (em 5,1 s); outras rotas seguem 200 (ver nota e I6) |
| 10 | Musculação com `routine_id` de rotina RUN | **PASS** | `POST /workouts/sessions` → 201, salva como "Treino livre" com `routine_id` nulo |
| 11 | Banco | **PASS** | `activity_gps_data`: colunas só `activity_id, avg_cadence, avg_hr, elapsed_sec, elevation_gain_m, max_hr, route, splits`; rota de 104 pares com até 5 casas; 9 parciais; 2.679 bytes de JSON para 2.875 pontos enviados; sem ponto bruto nem série de FC. `activities`: RUN, 8670.74, 2.877 s, 726 kcal, `routine_id` da rotina |
| 12 | Tempo | **PASS** | prévia de **30.000 pontos** (1,26 MB, caminhada aleatória de 6 casas): 207, 204 e 181 ms; rota de 405 pares |

**Nota sobre as 3 verificações refeitas:** (7.k) o `PATCH` estava certo — título "Longão QA" e `start_time` inalterado — e o meu comparador é que usou `.000Z` onde a data tem milissegundos; (10) o meu script procurou `id` na resposta, que traz `activity_id`; refeito: "Treino livre", `routine_id` nulo, sessão apagada; (9) na 1ª vez as outras ~10 chamadas à `/activities/gps/*` do mesmo minuto já tinham gasto parte dos 30 (o limite conta todas as rotas do plugin por IP): 11 × 200 e 20 × 429; repeti depois de esperar 65 s com 30 × 200 e 1 × 429.

### 4b — Os fluxos da Task 13 no navegador, sobre o HEAD

A (75 kg) e B (sem peso), no grupo `QA Full`. Injeção do plano (`6d9a13a`).

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|
| 1 | Rotina | **PASS** | A cria "Corrida leve" no `RoutineEditor` (abas Musculação/Corrida/Caminhada de 44 px, `aria-selected` certo, exercícios e "Adicionar exercício" somem, dica "Depois é só importar o .gpx…"); o card mostra "Corrida", "Importe o .gpx do seu treino" e o botão **Importar GPX em Corrida leve**, e o "Próximo" fica no Dia 1; editar mostra "Tipo da rotina: Corrida" fixo |
| 2 | Importar | **PASS** | `run-recent.gpx` (A): 8,67 km · 47:57 · 5:32 /km · 38,3 m · 151 / 169 bpm · 175 passos/min · **726 kcal**; traçado; **9 parciais** |
| 3 | Salvar | **PASS** | resumo (15/10/2026 · 09:26, 726 kcal); Histórico com filtro "Corrida" mostra "09:26 · 8,67 km · 47:57 · 5:32 /km" sem puxar para atualizar; Perfil: 1 atividade, Streak 1 / Recorde 1 dia, Este mês 1 · "+1 vs mês passado", item em "Atividade Física"; Home "Gastas 726"; **ranking de A 0 → 1** |
| 4 | Sem peso | **PASS** | B importa: calorias "—" com "Cadastre seu peso no Perfil para estimar as calorias." na prévia e "—" no resumo salvo |
| 5 | Tipo divergente | **PASS** | `walk-recent.gpx` na rotina Corrida → "O arquivo indica Caminhada, mas a rotina é de Corrida. Salvar como:" (Corrida / Caminhada); trocar recalcula **726 → 414 kcal**; salvar como Caminhada → resumo "Caminhada" |
| 6 | Duplicado | **PASS** | `run-recent.gpx` de novo → **Salvar** mostra "Você já importou esta atividade." e **Ver atividade**, ambos **acima do Salvar e dentro da tela sem rolar** (412x899: aviso 707–727, Ver atividade 755–805, Salvar 833–883); "Ver atividade" abre a existente; 1 linha no banco |
| 7 | Erros | **PASS** | `ride.gpx` → "Bike chega em breve. Por enquanto, só corrida e caminhada."; `old.gpx` → "Só dá para importar atividades das últimas 72 horas."; `nope.gpx` → "Este arquivo não é um GPX válido."; `route-only.gpx` → "O arquivo não tem pontos com horário (pode ser uma rota planejada, não uma atividade)."; só as 2 atividades válidas no banco |
| 8 | Renomear e excluir | **PASS** | renomear "Longão de domingo" (Histórico e perfil de membro mostram o título novo); excluir pelo modal: com a corrida apagada o dia segue contando (a caminhada é do mesmo dia: ranking 1), apagando também a caminhada **1 → 0**, `activities` de A = 0, Perfil Streak 0 / 0 atividades. O excluir também foi exercitado, por engano de navegação, numa corrida de B (apagada pelo app, sem efeito colateral) |
| 9 | Perfil de membro | **PASS** | B abre A pelo ranking: Streak 1, "1 dia ativo · 2 atividades", os 2 itens "Longão de domingo" e "Caminhada QA" com "15/10 · 09:26 · 8,67 km · 47:57 · 5:32 /km" — **sem chevron, sem toque (clique no item: continua em `MemberProfile`), sem rota, FC, cadência, calorias nem parciais** |
| 10 | 320 px e acessibilidade | **PASS** | a 320x691, `scrollWidth` = 320 em Workouts (card de GPS), `RoutineEditor` (abas 90x44 cada), `GpxImport` (com o aviso de tipo) e `GpsActivity` (título em 1 linha, modo de renomear, modal de exclusão); nenhum alvo < 44 px nas telas novas; 0 botões sem texto ou `aria-label`; 0 `Alert.alert` nos arquivos novos (grep) |

## Step 5 — Consistência

| Consulta | Resultado |
|---|---|
| Ranking dos grupos (Task 7 do plano `2026-10-06-groups-competition.md`: `group_rankings` × recontagem ao vivo por `local_day`, janela e `joined_at`), rodada depois de todos os fluxos, com as atividades de B inseridas por SQL ainda no banco | **0 linhas** (todos os grupos do banco, inclusive os 3 grupos QA e os da conta real) |
| `activity_gps_data` sem `activities` (órfã) | **0** |
| `activity_gps_data` ligada a atividade que não é `RUN`/`WALK` | **0** |
| `activities` `RUN`/`WALK` sem `activity_gps_data` | **0** |

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| INC | **INCIDENTE (processo de teste)** | Ambiente/QA (meu) | A limpeza apagou 4 contas pré-existentes `qa.full.{a,b,c,d}.1790892…@torvtest.dev` (filtro por prefixo): −4 `users`/`auth.users`/`user_measurements`, −10 `activities`, −16 `workout_routines`. Detalhes no topo. Se alguma coisa dependia delas, só restaurando o banco. |
| I1 | INFO (já conhecido) | Frontend (`GpxImport`) | O `saveError` não é limpo ao **trocar o tipo** Corrida ↔ Caminhada na prévia (round 2, I1): depois de um 400 ao salvar, trocar o tipo recalcula as métricas mas o aviso antigo continua. Já some ao escolher outro arquivo e ao salvar de novo. Sem reabrir. |
| I2 | INFO | Frontend (`RoutineEditor`, tela tocada pela Task 10) | O "Voltar" do `RoutineEditor` mede 24x24 (abaixo de 44 px). Pré-existente; as telas novas (`GpxImport`, `GpsActivity`) e o seletor de tipo estão ≥ 44 px. |
| I3 | INFO | Plano/Banco | O item 6.b da Task 4 do plano do Perfil de membro usa `activity_type='TEST_OTHER'`, que a CHECK de `activities` (`STRENGTH`/`RUN`/`WALK`, migration do GPS) agora rejeita. A regra (qualquer atividade conta o dia no streak) foi provada com `RUN`. Atualizar o plano para `RUN` se for repetido. |
| I4 | INFO | Ambiente | O puxar-para-atualizar não existe no web (`RefreshControl` do react-native-web é um stub): o fluxo 6 do Perfil de membro foi disparado chamando o `onRefresh` pela fiber (round 2, I1 do Perfil de membro). O gesto real só vale em dispositivo. |
| I5 | INFO | Ambiente | A janela do portal ficou sem renderizar por alguns minutos (clique por coordenada e screenshot recusados: "janela minimizada"). Nesse trecho usei cliques por JS (`element.click()`, com rolagem) no login/logout, no Gerenciar e na troca de contas; os cliques de calendário, ranking, filtros e os fluxos do importador foram toques reais. Também houve uma instância da página em que o seletor de arquivo da injeção "travou" (o `change` dispara e o `DocumentPicker` resolve o arquivo, mas a tela não segue para a prévia) por ~8 tentativas; recarregar a página resolveu e não consegui reproduzir. Sem causa conhecida; anoto como possível flaky do ambiente (portal), não do produto. |
| I6 | INFO | Backend (limite de taxa) | O limite de 30/min das rotas `/activities/gps/*` conta **todas** as rotas do plugin por IP (não só `/preview`): rodar vários testes no mesmo minuto o esgota (ex.: 11 × 200 e 20 × 429 na 1ª tentativa do item 9). Já era limitação anotada (por IP). |
| I7 | INFO | Cobertura | Nativo (iOS/Android: seletor de arquivo, `react-native-svg`, seleção de dia do calendário por `pageX/pageY`) segue sem teste; o arquivo de 25 MB no parser fica para o Security (Task 15). O contraste do nível 1 do calendário (2,21:1, LOW R1 do Perfil de membro) não foi remedido. |

## Dados de teste e limpeza

Criados (pico): 10 contas (A–F do navegador, GA–GD do contrato), 3 grupos (`QA Full`, `QA GPS Full`, `QA Grupo UI`), rotinas (o plano padrão de cada conta, mais as RUN/WALK dos testes), 2 treinos reais de B pelo app e 30 + 6 atividades `STRENGTH` antigas por SQL só em B, 1 refeição, 3 atividades GPS pela interface (A 2, B 1; todas apagadas pela interface) e, pela API do contrato, as importações de GA (apagadas) e de GD (a do teto, que saiu com a conta), 1 foto de perfil no Storage. Por SQL só: `joined_at` recuado 5 dias nos grupos, remoção da linha de peso de B e GB, as atividades antigas de B (30 + 4 de níveis do calendário + 2 do mês) e as linhas de meia-noite e `RUN` sem GPS (apagadas na hora).

Apagados: os 3 grupos pelo app (204 ×3); a foto do bucket `pictures` (`DELETE` 200, listagem do prefixo vazia); as 10 contas pela Admin API (200 ×10, cascade) — **e, pelo filtro largo, as 4 contas antigas do incidente**; a sessão do portal (`localStorage` limpo, página recarregada no login); o servidor da `:8099`, a pasta dos `.gpx`, o arquivo de contas (com senhas) e os temporários.

| Tabela | Antes | Com dados QA (pico) | Depois |
|---|---|---|---|
| `users` | 87 | 97 | **83** |
| `auth.users` | 87 | 97 | **83** |
| `activities` | 418 | 461 | **408** |
| `groups` | 8 | 11 | **8** |
| `group_members` | 7 | 15 | **7** |
| `workout_routines` | 206 | 236 | **190** |
| `activity_gps_data` | 1 | 2 | **1** |
| `user_measurements` | 110 | 119 | **106** |
| `food_logs` | 208 | 209 | **208** |
| `group_invitations` | 7 | 8 | **7** |
| `group_rankings` | 7 | 15 | **7** |

"Antes" já tinha +1 em `activities`/`activity_gps_data` e +1 rotina da conta real (`leonardommonteiro2004@gmail.com`, "Corrida na hora do almoço" / "Corrida Leve", ver o round 2); essas linhas continuam. As diferenças `depois ≠ antes` (−4 `users`, −10 `activities`, −16 `workout_routines`, −4 `user_measurements`) são exatamente o incidente. Resíduo das minhas contas: 0 linhas em `users`, `activities`, `group_members`; 0 grupos `QA …`.
