# QA — Perfil de membro, etapa Frontend (Task 8, usabilidade no navegador) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Diff:** `ea93838` (serviço e utilitários), `5ece5e5` (`ActivityHeatmap`, `MemberProfile`, entradas), `e6baca9` (Perfil próprio) · **Backend:** Furnace `:3000` (etapa já aprovada em `docs/qa-member-profile-backend-2026-10-14.md`) · **Expo web:** `:8081` · **Portal:** `QA Web` (criado por mim, 412x915 e 320x691). Nenhum serviço foi reiniciado.

## Veredito: FAIL (1 MEDIUM, 3 LOW, 4 INFO) → reabrir **Task 6** (`ActivityHeatmap`), rodada `-round2`

Nove dos dez fluxos passam. O fluxo 4 passa **em tudo, menos no toque num dia do calendário**: no Expo web o toque nunca seleciona o dia (M1). A lógica de rótulo e nível está correta (provada com `locationX/Y` sintéticos); o defeito é como o web entrega o evento. Se o Maestro decidir que o web não é alvo de produto, M1 cai para LOW e o ciclo pode seguir para Security. Essa decisão é dele, não minha.

## Step 1 — Automatizados

| Item | Resultado |
|---|---|
| `FrontEndTorv: node --test src/utils/*.test.mjs` | **PASS** — 57/57 (base 49 → **+8**: `heatmap` 6 e `profileStats` 2) |
| `FrontEndTorv: npx tsc --noEmit` | **PASS** — sem erros |

## Step 3 — Fluxos (portal `QA Web`, contas QA reais)

Contas: **A** dona do grupo, **B** membro (3 treinos reais pelo app: 2 hoje, 1 ontem; mais 30 `STRENGTH` antigas por SQL; total 33, depois 35), **D** nova sem atividade, **E** nome de 60 caracteres sem foto, **F** membro com 1 treino (sai do grupo). **C** (fora do grupo) não foi criada: sem entrada de UI para ela, o 404 de fora já foi coberto na Task 4. Hoje = 2026-10-14, BRT.

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|
| 1 | Ranking → perfil de B | **PASS** | inicial "Q", nome, `@qafebmv8jnn4j`, "Nível físico: Avançado"; Streak 2 / Recorde 2 dias; Este mês 2 dias ativos · 3 atividades · "Igual ao mês passado"; calendário; histórico. Contra a API/SQL: streak 2/2, mês 2/3/delta 0 (mês passado até o dia 14 = 3/09 e 10/09 = 2 dias), `total` 33, 25 dias na janela, `calendar.days` idêntico ao SQL |
| 2 | Gerenciar → nome de B → perfil | **PASS** | "Ver perfil de QA Bruno Membro" (276x44) abre o `MemberProfile`. O ícone "Remover QA Dani Vazia" (44x44) abre **só** o diálogo "Remover…?" (sem abrir o perfil); "Remover" tira D (Membros 4 → 3) |
| 3 | Própria linha | **PASS** | A toca em si → "QA Dona Alice (você)" |
| 4a | Abre na semana atual | **PASS** | `scrollLeft` 492 de 795 (largura visível 303): fim da rolagem; "out" no último rótulo |
| 4b | Rola para meses antigos | **PASS** | `scrollLeft` 0; rótulos out/nov/dez…; a página não rola de lado (`scrollWidth` 412 = 412) |
| 4c | Toque num dia mostra "D de mês. · N atividades" / "nenhuma atividade" | **FAIL (M1)** | toque real (`click` por coordenada e sequência pointer/mouse/click despachada no DOM): o rodapé fica "Toque num dia para ver o total". Com `onPress` chamado pela fiber e `locationX/Y` sintéticos: `14 de out. · 2 atividades`, `13 de out. · 1 atividade`, `10 de out. · nenhuma atividade`, `18 de set. · 4 atividades`, `10 de set. · 2 atividades`, `3 de set. · 1 atividade`; dia futuro → sem seleção |
| 4d | Níveis de cor | **PASS** | cores medidas nas 371 células: nível 1 (`rgb(47,74,26)`) 21, nível 2 (`rgb(90,158,28)`) 2, nível 3+ (`rgb(140,198,63)`) 2, vazio (`rgb(44,44,46)`) 343, `transparent` 3 (dias depois de hoje) = SQL por contagem (1: 21, 2: 2, 3+: 2). 4 atividades em 18/09 caem no nível 3+ |
| 5 | Histórico | **PASS** | 20 itens, rolar até o fim carrega o resto: 33 itens = total do SQL, sem repetir (as duas atividades de hoje têm o mesmo título/data e são itens distintos); toque num item não navega (`title` segue `MemberProfile`) |
| 6 | Saiu do grupo (Review Focus 3) | **PASS** | perfil de F aberto em A com dados ("Streak 1, dia seguido"); F sai pela API (204); `onRefresh` do `RefreshControl` chamado pela fiber → tela só com "Perfil indisponível." e "Vocês não estão mais em um grupo em comum.", sem nenhum dado antigo. Ver I1 (puxar-para-atualizar não existe no web) |
| 7 | Conta vazia (Review Focus 2) | **PASS** | D entra no grupo: Streak 0, "Recorde: 0 dias", Este mês 0 · 0 atividades · "Igual ao mês passado", 368 células vazias, "Nenhuma atividade ainda." |
| 8 | 320 px e nome longo (Review Focus 5) | **PASS** | nome de 60 caracteres: 24 px, 2 linhas (60 px, line-height 30; termina em "…", como o spec pede), `@username` 1 linha, inicial "M" no lugar da foto; cards sem corte (`scrollWidth` = `clientWidth`); calendário rola dentro do card (`scrollWidth` do documento 320 = 320); alvos medidos: Voltar 44x44, linhas do ranking 270x64, nomes no Gerenciar 180–184x44, remover 44x44 |
| 9 | Perfil próprio | **PASS** | aba Perfil de B: 35 atividades (total), Streak 4, Recorde 4 dias, Este mês 4 · 5 atividades · **"+2 vs mês passado"** (delta real, após eu somar 2 dias por SQL; antes: "Igual ao mês passado" com delta 0), calendário, "Atividade Física" com 5 itens. Igual ao `MemberProfile` de si mesmo (B → própria linha: "(você)", 4/4, +2) e à API |
| 10 | Home | **PASS** | Home de B: "Streak 2" (antes do SQL extra) e "Streak 4" (depois) = Perfil |

## Visual (avaliado a 412 e 320 px; cores e tamanhos medidos no DOM)

- **Contraste de texto:** mínimo 4,89:1 (chip "Avançado" vermelho `rgb(224,82,77)` sobre o fundo); cinza secundário 5,54:1; verde de destaque 8,32:1; brancos 17–18:1. Tudo acima de 4,5:1.
- **Hierarquia:** boa — título 20 px, nome 24 px, números dos cards grandes, seções 18 px, itens 16 px; chip do nível colorido por nível (laranja/vermelho/verde). Cards seguem os do Perfil.
- **Alvos:** todos os tocáveis ≥ 44 px, exceto os quadrados do calendário (exceção prevista no plano). Nada cortado a 320 px; legenda do calendário quebra para baixo e a meta do histórico ("1 série") quebra em 2 linhas sem estourar.

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| M1 | **MEDIUM** | Frontend — `ActivityHeatmap` (Task 6) | No Expo web, tocar num dia do calendário **nunca** seleciona o dia. `onPress` do `Pressable` recebe o evento `click` do DOM (react-native-web 0.21.2, `PressResponder.onClick` → `onPress(event)`), cujo `nativeEvent` é um `MouseEvent`: **sem `locationX/locationY`** (esses só existem nos eventos do sistema de responder). `cellAt(undefined, undefined, 12, 3)` devolve `{week: NaN, day: NaN}` (`x < 0` é falso com `undefined`), `data.weeks[NaN]` é `undefined` e o `?? null` zera a seleção; nenhum erro aparece. Cenário: portal 412x915, B com 35 atividades, toque em (356,616) (hoje) → rodapé continua "Toque num dia para ver o total". O código de rótulo/nível está certo (provado com coordenadas sintéticas). No dispositivo (iOS/Android) o `onPress` do `Pressable` traz `locationX/Y`, então provavelmente funciona, mas **não pude verificar nativo**. Sugestões: ler a posição de `onPressIn`/`onResponderRelease` (eventos de responder têm `locationX` no web e no nativo) ou cair para `clientX - getBoundingClientRect().left` quando `locationX` não existir; blindar `cellAt` com `Number.isFinite`; teste de `cellAt(undefined, undefined)` → `null`. |
| L1 | LOW | Frontend — visual | Nível 1 do calendário (`#2F4A1A`) contra o vazio (`#2C2C2E`): contraste de ~1,4:1 (WCAG pede 3:1 para elementos gráficos). Na tela dá para ver, mas é fraco ao sol/para baixa visão, justamente o nível mais comum (21 dos 25 dias de B). Sugestão: clarear o nível 1 ou dar borda. |
| L2 | LOW | Frontend — visual | Rótulos do calendário em 9 px (dias da semana) e 10 px (meses, legenda "Menos/Mais"); contraste ok (5,54:1), mas pequenos para leitura no celular. |
| L3 | LOW | Frontend — usabilidade | Em **Gerenciar** os nomes abrem o perfil, mas não há nenhuma pista visual (sem seta, sublinhado ou cor); só o rótulo de acessibilidade ("Ver perfil de …") avisa. Descobrir o toque depende de tentar. Idem a tela "Perfil indisponível": texto de 14/13 px cinza, sem ícone, encostado no topo (padding de 32 px) numa tela vazia — correta e sem dado antigo, mas fraca como estado de erro. |
| I1 | INFO | Ambiente | `RefreshControl` do react-native-web é um stub: **não existe puxar-para-atualizar no web**. O fluxo 6 foi feito chamando o `onRefresh` (props do `ScrollView`, achado pela fiber); a lógica (`setData(null)`, `status 'missing'`) passou. O gesto real só vale testar em dispositivo. |
| I2 | INFO | Frontend — texto | O Perfil próprio escreve "Dias ativos · N atividades" (D maiúsculo) e o `MemberProfile` "dias ativos · N atividades". Pequena inconsistência de capitalização entre as duas telas. |
| I3 | INFO | Ambiente QA | O ranking mostra "0 dias" para todos: os treinos de B têm `start_time` anterior ao `joined_at` dele no grupo (a regra do ranking é `start_time >= joined_at`), efeito dos dados de teste e não bug. Também, depois de voltar de outra tela, `GroupDetail` e a lista do `Gerenciar` só mostraram D e a saída de F após recarregar o app (ou entrar de novo no grupo); não é parte do diff, mas vale saber. |
| I4 | INFO | Ambiente QA | Capturas do portal têm resolução baixa (texto borrado); por isso as medidas vêm do DOM (estilos, retângulos, contraste), não dos pixels. Confirmei contas e dados via Admin API do Auth + SQL via Prisma, como na Task 4 (o MCP do Supabase da sessão aponta para outro projeto). |

## Dados de teste e limpeza

Criados: 5 contas (A, B, D, E, F), 1 grupo (`QA Perfil FE`), 4 treinos reais pelo app (B 3, F 1), 32 atividades `STRENGTH` por SQL só em B (30 antigas + 2 de delta). Sem foto nem capa. Tudo apagado: grupo pelo app (204) e contas pela Admin API (cascade); sessão e `localStorage` do portal limpos; arquivos temporários com tokens e senha apagados.

| Tabela | Antes | Com dados QA | Depois |
|---|---|---|---|
| `users` | 87 | 92 | **87** |
| `auth.users` | 87 | 92 | **87** |
| `activities` | 417 | 453 | **417** |
| `groups` | 8 | 9 | **8** |
| `group_members` | 7 | 10 | **7** |

Sem resíduo: 0 linhas das 5 contas em `users`, `user_profiles`, `activities`, `group_members`, `user_streaks`; 0 grupos `QA Perfil FE`.

## Para a rodada 2 (só Task 6)

1. Corrigir M1 (posição do toque no web) e cobrir com teste (`cellAt` com `undefined`/`NaN` → `null`).
2. Opcional (L1/L2/L3): clarear o nível 1, subir os rótulos do calendário para ≥ 11 px, dar pista visual aos nomes do Gerenciar e reforçar o estado "Perfil indisponível".
3. Reteste: fluxo 4c no portal (toque real em hoje, num dia de 1 atividade, num vazio e num dia futuro) e a regressão de 4a, 4b, 4d e 8.
