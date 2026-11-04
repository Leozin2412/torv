# QA — Perfil de membro, etapa Frontend — round 2 (Task 8) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **Rework testado:** `d6f5b85` (`ActivityHeatmap`, `GroupManage`, `MemberProfile`, `heatmap.ts`) · **Round anterior:** `docs/qa-member-profile-frontend-2026-10-14.md` (FAIL: M1 MEDIUM, L1–L3 LOW) · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412x915 e 320x691). Toques **reais** do portal (clique por coordenada), nenhum `locationX` sintético nos testes de toque.

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW residual / 3 INFO) → pode seguir para Security (Task 10)

M1 está corrigido e L2 e L3 também; L1 melhorou (1,40 → 2,21:1) e ficou como LOW residual, sem bloqueio.

## 2 — Automatizados

| Item | Resultado |
|---|---|
| `FrontEndTorv: node --test src/utils/*.test.mjs` | **PASS** — 58/58 (round 1: 57; +1 teste `cellAt` com `NaN`/`undefined`/`Infinity` → `null`) |
| `FrontEndTorv: npx tsc --noEmit` | **PASS** — sem erros |

## 1 — M1: toque real nos dias do calendário

Contas QA: B com 33 atividades (3 treinos reais + 30 por SQL), dia 14/10 com 2, 13/10 com 1, 17/09 com 3, 18/09 com 4, 10/09 com 2, 03/09 com 1 etc. Os toques abaixo são cliques reais no centro do quadrado (origem da grade lida do DOM a cada clique); o rodapé foi lido depois de cada um.

| Cenário | Resultado | Evidência (rodapé após o toque) |
|---|---|---|
| **412 px**, fim da rolagem (semana atual) | **PASS** | hoje → `14 de out. · 2 atividades`; ontem → `13 de out. · 1 atividade`; 10/10 vazio → `10 de out. · nenhuma atividade` |
| **412 px**, dia futuro (15/10, sem quadrado) | **PASS** | volta para "Toque num dia para ver o total" (sem erro) |
| **412 px**, rolado para os meses antigos (`scrollLeft` 0) | **PASS** | `5 de nov. · 1 atividade`, `8 de dez. · 1 atividade`, `22 de dez. · 1 atividade`, `16 de nov. · nenhuma atividade`, primeiro quadrado `12 de out. · nenhuma atividade` |
| **412 px**, rolado até o meio (`scrollLeft` 480) | **PASS** | `18 de set. · 4 atividades` (4 → nível 3+), `17 de set. · 3 atividades`, `10 de set. · 2 atividades`, `3 de set. · 1 atividade`, `6 de set. · nenhuma atividade` |
| **320 px**, fim da rolagem (`scrollLeft` 585,6) | **PASS** | `14 de out. · 2 atividades`, `13 de out. · 1 atividade`, `10 de out. · nenhuma atividade`, futuro → rótulo padrão, `18 de set. · 4 atividades` |
| **320 px**, rolado para os meses antigos (`scrollLeft` 0) | **PASS** | `5 de nov. · 1 atividade`, `8 de dez. · 1 atividade`, `12 de out. · nenhuma atividade`; página sem rolagem horizontal (320 = 320) |
| Quadrado selecionado | **PASS** | só o quadrado tocado ganha a borda branca (medida no DOM: 1 célula, índice `52×7+3` para hoje); some ao tocar num dia futuro |
| Toque **fora** da grade (rótulo do mês, rótulos "Qua", legenda, 3 px abaixo da última linha) | **PASS** | nada quebra: a seleção anterior permanece; sem erro |
| Toque no espaço entre quadrados (à direita/abaixo de hoje) | **PASS** | cai no quadrado anterior (`14 de out.`), como no spec |
| Calendário do **Perfil próprio** (mesmo componente) | **PASS** | toques reais: `14 de out. · 2 atividades`, `13 de out. · 1 atividade`, `10 de out. · nenhuma atividade`, `18 de set. · 4 atividades` |

## 3 — L1, L2, L3

| # | Item | Resultado | Evidência |
|---|---|---|---|
| L1 | Contraste nível 1 (`#3F6B22`) × vazio (`#2C2C2E`) e progressão | **PASS (com resíduo LOW)** | **2,21:1** (antes 1,40). Passos: vazio→1 2,21; 1→2 1,90; 2→3 1,62; vazio→2 4,21; vazio→3 6,81. Contagem no DOM: nível 1 `rgb(63,107,34)` 21 células, nível 2 `rgb(90,158,28)` 2, nível 3 `rgb(140,198,63)` 2, vazio 343, `transparent` 3 = SQL (21/2/2). Na captura os 4 níveis são claramente distintos. O nível 1 segue abaixo dos 3:1 do WCAG 1.4.11 para elementos gráficos (ver R1) |
| L2 | Rótulos 10/11 px legíveis e sem cortar | **PASS** | meses 11 px (alturas 14, `scrollWidth` = `clientWidth`, nenhum cortado, incluindo o último "out" dentro do cartão: right 354 ≤ 365); "Seg/Qua/Sex" 10 px (21x12); "Menos/Mais" 10 px; contraste 5,54:1 |
| L3a | Chevron no nome dos membros do Gerenciar | **PASS** | chevron cinza 16 px à direita do nome em A, B, E, F; botões "Ver perfil de …" 180–184x44 (320 px). Toque no nome de B abre o `MemberProfile`; toque em "Remover …" (44x44) abre **só** o diálogo "Remover…?" e "Cancelar" o fecha, sem abrir perfil |
| L3b | "Perfil indisponível" | **PASS** | F sai do grupo (API, 204) com o perfil dele aberto em A; `onRefresh` chamado (ver I1) → ícone `UserX` 32 px, título "Perfil indisponível." (18 px, branco, extrabold), subtítulo "Vocês não estão mais em um grupo em comum.", botão "Voltar" (280x50, outline verde), sem nenhum dado antigo. O botão Voltar volta ao Gerenciar; o `Voltar` do cabeçalho (44x44) segue ok |

## 4 — Regressão curta

| Fluxo | Resultado | Evidência |
|---|---|---|
| Ranking → perfil de B | **PASS** | A toca em B: Streak 2 / Recorde 2 dias; Este mês 2 · 3 atividades · "Igual ao mês passado"; API/SQL: streak 2/2, mês 2/3/delta 0, total 33, 25 dias na janela, `calendar.days` idêntico ao SQL |
| "(você)" | **PASS** | A toca na própria linha → "QA Dona Alice (você)" |
| Histórico com rolagem | **PASS** | 33 itens = total do SQL, 33 chaves únicas (data+hora+título), primeiro `14/10 · 18:40`, último `05/09 · 12:00` (item de 13 meses); toque num item não navega |
| Perfil próprio com calendário | **PASS** | B na aba Perfil: 33 atividades, Streak 2, Recorde 2 dias, Este mês 2 · 3 atividades · "Igual ao mês passado", calendário (21/2/2 células) e "Atividade Física" com os 5 últimos |

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| R1 | LOW (resíduo de L1) | Frontend — visual | O nível 1 (`#3F6B22`) contra o vazio dá 2,21:1, ainda abaixo de 3:1 (WCAG 1.4.11). O passo seguinte (nível 2) já está a 4,21:1 do vazio e a captura mostra os 4 níveis distintos, então não bloqueia. Se quiser fechar: nível 1 por volta de `#4A7A28` (≈3:1) ou borda de 1 px nos quadrados com atividade. |
| I1 | INFO | Ambiente | O puxar-para-atualizar não existe no web (`RefreshControl` do react-native-web é um stub); a atualização do "Perfil indisponível" foi disparada chamando o `onRefresh` pela fiber, como no round 1. |
| I2 | INFO | Frontend — nativo | A correção usa `clientX/clientY` (web) ou `pageX/pageY` (nativo) menos `measureInWindow` da grade. O web foi provado com cliques reais; **iOS/Android não foram testados** aqui. Em Android sem edge-to-edge, `pageY` (raiz) e `measureInWindow` (janela) podem divergir pela altura da barra de status; com edge-to-edge (padrão do Expo atual) não. Vale um toque de verificação num aparelho antes de publicar. |
| I3 | INFO | Ambiente/Frontend | Ao **redimensionar** a janela do portal (412 → 320) com o calendário já aberto, a rolagem horizontal não é reajustada para o novo fim (`scrollLeft` ficou em 493 de 584 possíveis), então a semana atual fica meio escondida até rolar. Só acontece ao mudar a largura com a tela aberta (girar o aparelho); abrir a tela já em 320 px cai no fim certo (round 1: `scrollLeft` 584 de 584). |

## Dados de teste e limpeza

Criados: 5 contas (A, B, D, E, F), 1 grupo (`QA Perfil FE`; D e E não foram usadas no round 2, D nem entrou no grupo), 4 treinos reais pelo app (B 3, F 1) e 30 `STRENGTH` antigas por SQL só em B. Nenhuma foto nem capa. Tudo apagado: grupo pelo app (204) e contas pela Admin API do Auth (cascade); `localStorage` e sessão do portal limpos; arquivos temporários com senha e tokens apagados.

| Tabela | Antes | Com dados QA | Depois |
|---|---|---|---|
| `users` | 87 | 92 | **87** |
| `auth.users` | 87 | 92 | **87** |
| `activities` | 417 | 451 | **417** |
| `groups` | 8 | 9 | **8** |
| `group_members` | 7 | 10 | **7** |

Sem resíduo: 0 linhas das 5 contas em `users`, `user_profiles`, `activities`, `group_members`, `user_streaks`; 0 grupos `QA Perfil FE`.
