# QA — Perfil de membro, teste completo no HEAD (Task 9) — 2026-10-14

**Owner:** Torv Review and Tests · **Branch:** `feat/perfil-terceiros-gpx` · **HEAD:** `bc61dd5` (código da feature até `d6f5b85`; `cf10061`, fixtures do próximo subprojeto, não entra no teste) · **Relatórios anteriores:** `docs/qa-member-profile-backend-2026-10-14.md` (PASS), `docs/qa-member-profile-frontend-2026-10-14.md` (FAIL: M1), `docs/qa-member-profile-frontend-2026-10-14-round2.md` (PASS) · **Ambiente:** Furnace `:3000` e Expo web `:8081` no ar, nenhum reiniciado; portal `QA Web` (412x915 e 320x691).

## Veredito: PASS (0 CRITICAL / 0 HIGH / 0 MEDIUM / 1 LOW residual já conhecido / 5 INFO) → pode seguir para Security (Task 10)

Nada novo falhou no HEAD. Contrato do backend, meia-noite local, os 10 fluxos da Task 8 (com o toque real no calendário) e a regressão das demais áreas do app passaram.

## Step 2.1 — Automatizados (antes → depois)

| Suíte | Base do início da branch | HEAD | Resultado |
|---|---|---|---|
| `BackEndTorv: npm test` | 239 | **272/272** (+33), 0 fail, 0 cancelled, 0 skipped | **PASS** |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | 49 | **58/58** (+9: `heatmap` 7, `profileStats` 2), 0 fail | **PASS** |
| `FrontEndTorv: npx tsc --noEmit` | limpo | limpo | **PASS** |

## Step 2.3a — Task 4 sobre o HEAD (contrato ao vivo e meia-noite)

Contas A (dona), B (membro), C (fora). Data local 2026-10-14, `tz_offset_min=-180`. Resultados idênticos aos do relatório do backend:

| Item | Resultado |
|---|---|
| Acesso: A→B 200 `is_me:false`; A→A 200 `is_me:true` (também com o UUID em maiúsculas); A→C 404 `{"error":"Not found"}`; A→UUID aleatório 404 **idêntico** ao de C; C→B 404; sem token 401 | **PASS** |
| Lista branca: `user,is_me,streak,month,total_activities,calendar`; `user`: `id,name,username,photo_url,fitness_level`; sem e-mail, peso, altura, idade, gênero, objetivo, nascimento | **PASS** |
| Números de B vs SQL: `total_activities` 8 = 8; `streak` 2/2; `month` 2 dias, 3 atividades, delta 0; `calendar.days` idêntico ao SQL na janela (`2025-10-12` … `2026-10-14`, 6 dias; a atividade de 13 meses fica fora) | **PASS** |
| Histórico: `limit=2` → 2 itens, `distance_m:null`, `next_before`; página 2 sem repetir; `limit=20` → 8 itens, `next_before:null`; C → 404; A→A lista vazia | **PASS** |
| 400: `date=2026-02-31`, `tz_offset_min=841`, `/users/abc/profile` (e `/activities`), `limit=51` e `limit=0`, `before=ontem`, sem `date` | **PASS** (8 de 8) |
| Home: `streak_days` = `streak.current`; `TEST_OTHER` conta o dia (B no dia 12/10: streak 2 → 3; A hoje: 0 → 1); linhas apagadas, valores voltam | **PASS** |
| `GET /profile` de A sem `streak`, `longest_streak`, `workouts_in_month`, `total_workouts` | **PASS** |
| Meia-noite (atividade em `2026-10-13T02:50:00Z` = 23:50 BRT de 12/10): `tz=-180` → dia **2026-10-12** (streak 3, mês 3 dias, delta +1); `tz=0` → dia **2026-10-13** (streak 2, delta 0). Linha apagada | **PASS** |

## Step 2.3b — Os 10 fluxos da Task 8 sobre o HEAD

Contas A (dona), B (membro: 3 treinos reais + 30 por SQL; 33 atividades), D (nova, vazia), E (nome de 60 caracteres, sem foto), F (membro que sai). Evidência no portal (DOM, retângulos e estilos medidos; toques **reais** por coordenada).

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|
| 1 | Ranking → perfil de B | **PASS** | inicial, nome, `@`, "Nível físico: Avançado"; Streak 2 / Recorde 2 dias; Este mês 2 · 3 atividades · "Igual ao mês passado"; calendário; histórico. Contra a API/SQL: 2/2, 2/3/0, total 33, 25 dias na janela, `calendar.days` idêntico |
| 2 | Gerenciar → nome de B → perfil; remover separado | **PASS** | "Ver perfil de …" (276x44) abre o perfil; "Remover …" (44x44) abre só o diálogo e "Cancelar" o fecha (chevron presente nos nomes) |
| 3 | Própria linha | **PASS** | "QA Dona Alice (você)" |
| 4 | Calendário | **PASS** | abre na semana atual (`scrollLeft` 493,6 de 795); rolagem até os meses antigos; cliques reais: `14 de out. · 2 atividades`, `13 de out. · 1 atividade`, `10 de out. · nenhuma atividade`, dia futuro → rótulo padrão, `5 de nov. · 1 atividade`, `8 de dez. · 1 atividade`, `12 de out. · nenhuma atividade` (rolado até o início), `18 de set. · 4 atividades`, `10 de set. · 2 atividades`, `3 de set. · 1 atividade`. Níveis medidos nas 371 células: nível 1 `rgb(63,107,34)` 21, nível 2 2, nível 3+ 2, vazio 343, transparente 3 = SQL |
| 5 | Histórico | **PASS** | 33 itens = total do SQL, 33 chaves únicas, último `05/09 · 12:00` (13 meses); toque num item não navega |
| 6 | Saiu do grupo (Review Focus 3) | **PASS** | perfil de F aberto em A; F sai pela API (204); `onRefresh` chamado (ver I1) → ícone, "Perfil indisponível.", "Vocês não estão mais em um grupo em comum." e botão "Voltar" (funciona, volta ao Gerenciar); nenhum dado antigo |
| 7 | Conta vazia (Review Focus 2) | **PASS** | D: Streak 0, "Recorde: 0 dias", mês 0/0, 368 células vazias, "Nenhuma atividade ainda." |
| 8 | 320 px e nome longo (Review Focus 5) | **PASS** | nome: 24 px, 2 linhas (60 px), `@` em 1 linha (20 px), inicial "M", cards sem corte, 0 elementos com overflow, documento 320 = 320, calendário rola no cartão (`scrollLeft` 585,6 = fim); alvos: Voltar 44x44, linhas do ranking 270x64, nomes no Gerenciar 184x44, remover 44x44 |
| 9 | Perfil próprio | **PASS** | B na aba Perfil, depois de somar 2 dias por SQL: 35 atividades (total), Streak 4, Recorde 4 dias, Este mês 4 · 5 atividades · **"+2 vs mês passado"** (= API), calendário com toque real (`14 de out. · 2 atividades`, `18 de set. · 4 atividades`), "Atividade Física" com os 5 últimos |
| 10 | Home | **PASS** | Home de B: Streak 2 (antes do SQL extra) e 4 (depois) = Perfil e API |

## Step 2.2 — Regressão no navegador (um fluxo real por área)

| Área | Resultado | Fluxo feito e evidência |
|---|---|---|
| Login e boas-vindas | **PASS** | login por e-mail e senha (A, B e D) → Home; diálogo "Bem-vindo(a) ao Torv, QA!…" com "Começar" aparece na conta nova e some ao tocar |
| Home (streak, calorias, dieta) | **PASS** | A: Streak 0, "Consumidas 0 kcal", "2.625 kcal restantes". Depois de registrar 500 kcal na dieta: "Consumidas 500", "2.125 kcal restantes" (2.625 − 500). Streak de B 2 → 4 acompanha o perfil |
| Treinos | **PASS** | rotina "Dia 1 — Corpo todo A" → "Iniciar" → série 1 feita com carga 2,5 kg → "Finalizar treino" (diálogo) → resumo "Treino concluído" (1:15, 1 série, "Cargas diferentes da rotina: … → 2,5 kg", Atualizar rotina/Manter) → Concluir; no Histórico abre o detalhe; **editar** carga 2,5 → 20 kg e salvar ("20 kg" no detalhe); **excluir** (diálogo "Excluir este treino?") e o histórico volta a "Nenhum treino ainda" com 0 linhas de A no banco |
| Histórico com filtros e períodos | **PASS** | com B (35 atividades): "Tudo" 35; "7 dias" 5; "30 dias" 12; "3 meses" 18 (= SQL por janela); "Musculação" + "3 meses" 18; "Personalizado" (seletor "Desde quando?"/"Até quando?" → "01/10 – 01/10") com A → "Nenhum treino nesse período" |
| Grupos | **PASS** | A **cria** "QA Grupo UI" pelo formulário (GroupDetail); Gerenciar → "Gerar código" (código de 8 caracteres) e "Convidar" por username ("Convite enviado."); D vê o convite, "Aceitar", **ranking** com A e D "(você)", "Sair do grupo" (diálogo) → deixa de ser membro (banco); D volta por "Entrar com código" (código → "Buscar grupo" → prévia → "Entrar no grupo") |
| Perfil (foto, objetivo, nível, peso e altura) | **PASS** | objetivo "Saúde & Bem-estar" → "+ Perder Peso" (API: `Saúde & Bem-estar, Perder Peso`); nível Avançado → Iniciante (API `INICIANTE`); peso e altura 75/175 → 82/180 (API `82`/`180`); cada mudança abre "Nova meta sugerida" com "Aplicar nova meta"/"Manter atual" (usei os dois); **foto**: arquivo gerado enviado ao seletor (ver I2) → `photo_url` gravado e avatar trocado |
| Dieta | **PASS** | "Adicionar refeição" → "QA Almoço", 500 kcal, P 30, C 60, G 15 → aparece em "Refeições" com `P: 30g · C: 60g · G: 15g`, 500 kcal; reflete na Home (acima) |

## Achados

| # | Sev | Camada | Achado |
|---|---|---|---|
| R1 | LOW (residual, já conhecido) | Frontend — visual | Nível 1 do calendário (`#3F6B22`) × vazio (`#2C2C2E`) = 2,21:1, abaixo dos 3:1 do WCAG 1.4.11; os 4 níveis seguem distintos na tela (vazio→2 4,21:1; vazio→3 6,81:1). Mesma conclusão do round 2: não bloqueia. |
| I1 | INFO | Ambiente | O puxar-para-atualizar não existe no web (`RefreshControl` do react-native-web é um stub). O fluxo 6 foi disparado chamando o `onRefresh` pela fiber. O gesto real só vale testar em dispositivo. |
| I2 | INFO | Ambiente | O seletor de foto do navegador abre um diálogo nativo que o portal não controla. Para o teste de foto, depois de tocar "Alterar foto de perfil" criei um PNG de 64x64 no navegador e disparei o evento `change` no `input[type=file]` que o `expo-image-picker` cria. O envio, o `photo_url` e o avatar foram reais; o diálogo do sistema operacional não foi exercitado. |
| I3 | INFO | Frontend — nativo | iOS e Android continuam não testados: a seleção do dia usa `clientX/clientY` (web) ou `pageX/pageY` (nativo) menos `measureInWindow`. Vale um toque num aparelho antes de publicar (round 2, I2). |
| I4 | INFO | Fora do diff | Mudar o nível físico de Avançado para Iniciante fez a meta sugerida cair de 2.993 para 1.808 kcal (−40%), e peso 75→82 kg / altura 175→180 cm sugeriu 1.929 kcal (nível Iniciante). Vem da calculadora de calorias, não da feature de perfil; só registro porque foi visível no fluxo. Também não exercitei: "Nova rotina", "Atualizar rotina", editar/excluir refeição e o nome de usuário. |
| I5 | INFO | Ambiente | Depois de apagar a foto do bucket (`DELETE` 200, listagem do prefixo vazia), o URL público ainda respondeu 200 por alguns instantes (cache do CDN do Storage). O objeto não existe mais. O ranking mostra "0 dias" para todos porque os treinos de teste começam antes do `joined_at` dos membros (efeito do seed, não bug); redimensionar a janela com o calendário aberto não reajusta a rolagem (round 2, I3). |

## Dados de teste e limpeza

Criados: 8 contas no total (A, B, C do Step 2.3a e A, B, D, E, F do navegador), 3 grupos (`QA Perfil` e, no navegador, `QA Perfil FE` e `QA Grupo UI`), treinos reais pelo app (B 3, F 1, A 1 que apaguei pela UI), 1 refeição, atividades `STRENGTH`/`TEST_OTHER` por SQL só nas contas QA, 1 foto de perfil no Storage. Tudo apagado: grupos pelo app (204), contas pela Admin API do Auth (cascade), a foto do bucket `pictures`, a sessão do navegador e os arquivos temporários com senha e tokens.

| Tabela | Antes | Com dados QA (pico) | Depois |
|---|---|---|---|
| `users` | 87 | 90 (Step 2.3a) / 92 (navegador) | **87** (nas duas rodadas) |
| `auth.users` | 87 | 90 / 92 | **87** |
| `activities` | 417 | 425 / 453 | **417** |
| `groups` | 8 | 9 / 10 | **8** |
| `group_members` | 7 | 9 / 13 | **7** |

Sem resíduo: 0 linhas das contas QA em `users`, `user_profiles`, `activities`, `group_members`, `user_streaks`, `food_logs`, `nutrition_targets` e `workout_routines`; 0 grupos `QA Perfil`/`QA Perfil FE`/`QA Grupo UI`; 0 objetos no bucket com o prefixo da foto de teste.
