# QA — Grupos e competição — TESTE COMPLETO, HEAD, todas as camadas (2026-10-06/07)

**Veredito: PASS.** Automatizados verdes, regressão dos módulos tocados sem quebra, feature ponta a ponta por interface, cenários A e B do ranking por API e consulta de consistência com **0 linhas**, trigger legado inexistente, dados de teste apagados e conferidos. 0 CRITICAL / 0 HIGH / 0 MEDIUM / 2 LOW (pré-existentes, fora da feature) / 6 INFO. **Sem retrabalho de camada.**

HEAD testado: `98ea752` (24 commits desde `67b53dc~3`). Backend no Furnace `:3000` sem commits depois de `18224b9` (`git diff 18224b9 HEAD -- BackEndTorv` vazio), então o código do Furnace é o do HEAD; Expo `:8081` serve a árvore de trabalho. Não parei nem reiniciei nada. Obs.: a árvore tem alterações **não commitadas e alheias à feature** (`FrontEndTorv/src/screens/Login/index.tsx`, só um espaço antes de `)`, mais `CLAUDE.md`, `revisar*.md`); não afetam o teste.

## (1) Automatizados — **PASS**

| Suíte | Antes da feature | Agora (HEAD) |
|---|---|---|
| `npm test` (BackEndTorv) | 92 (valor do plano, ciclo anterior) | **159 testes, 159 PASS, 0 fail, 0 cancelled, 0 skipped** |
| `node --test src/utils/*.test.mjs` (FrontEndTorv) | 32 (valor do plano) | **47 testes, 47 PASS, 0 fail** |
| `npx tsc --noEmit` (FrontEndTorv) | — | exit 0, sem erros |

Os números "antes" são os do plano (não remedidos nesta rodada); os "agora" foram executados agora.

## Método

Portal `QA Home` em **uma só aba**, viewport **320×691**. Contas QA A (dono/regressão), B (convidada, UI) e C (jogadora dos cenários por API), registradas por `/auth/register`; login/logout pela UI. Troca A↔B gravando a sessão no `localStorage`. Capa e foto de perfil: o `expo-image-picker` web foi alimentado por um `File` PNG gerado em canvas (640×360). SQL só via Prisma (`DIRECT_URL`); o conector Supabase **não foi usado**. Sem capturas de tela (`screenshot` do portal segue dando "not rendering"): evidência por `snapshot`, `innerText`, `getBoundingClientRect` e SQL. O portal ficou "not rendering" por ~90 s em um momento e voltou sozinho, sem laço de espera. Como a rodada começou às 23:51 locais, **esperei passar da meia-noite local (+5 min)** antes dos cenários de ranking e do fluxo da feature (o Cenário A não pode cruzar o dia local).

## (2) Regressão dos módulos tocados — **PASS**

| Módulo | Fluxo real no navegador | Resultado |
|---|---|---|
| Login/logout | Senha errada → "Email ou senha incorretos."; senha certa → Home; **Sair da conta** (Perfil) → tela de Login; login de novo | PASS |
| Boas-vindas | 1º login → modal "Bem-vindo(a) ao Torv…" → **Começar**; no 2º login **não reaparece** | PASS |
| Home | Streak 0 → **1** após o treino; "Treino de hoje: Dia 1 — Corpo todo A"; "Calorias de hoje": Consumidas **400** kcal e "1.633 kcal restantes" depois de registrar a refeição | PASS |
| Dieta | Home → Calorias de hoje → My Diet; **Adicionar refeição** (400 kcal, P30/C40/G10) → totais "400/2033 kcal", "30/127g", "40/229g", "10/68g" e o item "Almoço QA" | PASS (ver L1) |
| Treinos | Rotinas (Dia 1/2/3 · 6 exercícios · 18 séries); iniciar Dia 1, carga 5 kg (+2×2,5), série, finalizar → resumo "**5 kg**" e aviso "Cargas diferentes da rotina" → **Atualizar rotina** → "Rotina atualizada"; **Histórico**: "Hoje · Dia 1 · 23:53 · 0:17 · 1 série", chips **7 dias / 30 dias / 3 meses** (listam o treino) e **Personalizado** (2 calendários "Desde quando?/Até quando?" → "06/10 – 06/10" com o treino) | PASS |
| Perfil | Upload de foto pela UI: arquivo novo em `profilePhotos/`, imagem servida em `/uploads/profile-…png` (640 px) → a **lib `imageUpload` continua servindo** o upload de perfil; contadores (seguidores/seguindo/treinos), streak 1, "Atividade Física: Dia 1 — … · 06/10 · 1 min · 1 série" (**lista de treinos recentes**), objetivo/nível/peso | PASS (ver L2) |
| Barra de baixo (5 abas) | Home/Treinos/My Diet/Grupos/Profile com **56×64 px** cada, terminando em x=300 (cabe nos 280 px da barra); `scrollWidth = innerWidth = 320`; sem rolagem horizontal | PASS |

## (3) Feature ponta a ponta — **PASS**

**Por interface (A dono, B convidada, viewport 320 px, 2026-10-07 após 00:05 local):**

| Passo | Resultado |
|---|---|
| Criar grupo com capa e período **com término** (`QA Full G1`, público, 07/10→14/10) | `GroupDetail` com capa (640 px), "07/10/2026 → 14/10/2026 · 7 dias restantes", A em 1º — PASS |
| Criar grupo **sem término** (`QA Full G2 privado`, com capa) | "07/10/2026 · Sem data de término" (sem rótulo repetido) — PASS |
| Convidar por username (B) → B aceita | "Convite enviado."; B vê **Convites recebidos**, **Aceitar** → `GroupDetail` com 2 membros — PASS |
| Código/link | A **Gerar código** em G2 (`7S3RGRXH`); B em **Entrar com código** digita `7s3r grxh` (minúsculas, espaço) → prévia → **Entrar no grupo** → ranking com 2 membros — PASS |
| Pedido de entrada em grupo público | B busca "QA Full G3" em **Descobrir**, **Pedir para entrar** → "Pedido enviado…"; A em **Gerenciar** "Pedidos de entrada (1)" → **Aceitar** → (0), "Membros (2)" — PASS |
| Ranking subindo ao gravar treino real | B finaliza o Dia 2 (Treinos → Iniciar → série → Finalizar): SQL e UI mostram **1 dia / 1 atividade** nos 3 grupos; a aba Grupos mostra "#1 · 1 dia" em cada — PASS |
| Editar treino (tempo/carga) | Histórico → treino → **Editar treino**: tempo 45, carga `12,5` → resumo "**12,5 kg · 0:45**" — PASS |
| Apagar treino e ver o ranking cair | **Excluir treino** (modal) → SQL **0/0** nos 3 grupos; aba Grupos "#2 · 0 dias" — PASS |
| Sair / remover | B **Sair do grupo** (modal) em G3 → some da lista; A **Remover QA Front B** (modal) em G1 → "Membros (1)" — PASS |
| Excluir grupo | A **Excluir grupo** (modal) em G1 → some da lista; a capa some do disco (2 → 1 arquivo `group-*`) — PASS |

**Cenários A e B do ranking por API (Task 7, Step 4)**, com A dono e C jogadora (valores esperados da tabela do plano; API **e** `group_rankings` iguais em todos):

| Cenário A (tz −180, `starts_at` hoje−3, `ends_at` nulo) | Esperado | Obtido |
|---|---|---|
| entra no grupo | 0/0 | 0/0 |
| treino agora−1 h (antes do `joined_at`) | 0/0 | 0/0 |
| treino agora | 1/1 | 1/1 |
| repetir o mesmo `started_at` (`createSession`) | 200, mesmo id, 1 linha | 200, mesmo id, 1 linha, pontos não duplicam |
| 2º treino, mesmo dia local | 1/2 | 1/2 |
| apagar o 1º / o 2º | 1/1 / 0/0 | 1/1 / 0/0 |
| treino de novo / `starts_at`=amanhã / de volta | 1/1 → 0/0 → 1/1 | 1/1 → 0/0 → 1/1 |

| Cenário B (dia local do grupo) | Esperado | Obtido |
|---|---|---|
| fuso calculado (`m=180` → `tz_offset_min=-180`; T1 local 23:55 do dia anterior, T2 local 00:03) | 2/2 | 2/2 |
| `tz_offset_min=0` (T1 e T2 no mesmo dia UTC, conferido) | 1/2 | 1/2 |

**Consulta de consistência** (a do plano, Task 7 Step 4): **0 linhas** após os cenários e **0 linhas** de novo depois do fluxo por interface (9 membros).

## (4) Banco — **PASS**

- Trigger legado `trg_add_points_to_group_ranking` e função `trg_fn_add_points_to_group_ranking()`: **0 e 0** (antes e depois da limpeza). Único trigger em `activities`: `trg_update_streak_on_activity`. Migrations `20261006120000_groups` e `20261006120100_drop_group_points_trigger` aplicadas (`finished_at` preenchido, sem `rolled_back_at`).
- Nenhuma tabela de teste: o único nome que casou com `test/tmp/…` foi `workout_template_slots` (tabela do app). `public` tem as 20 tabelas esperadas.
- **Limpeza** (dados do teste): 5 grupos restantes, as 3 contas (`auth.users` → `users`, treinos, rotinas, perfis por cascade), a capa de `QA Full G2` e a foto de perfil de A em `BackEndTorv/profilePhotos/`. Antes → depois: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `activities 408→408`, `workout_routines 173→173`, `exercises 73→73`, `group_members 0`, `group_rankings 0`; nenhuma linha restante com `user_id/owner_id/created_by/follower_id/followed_id` das contas QA; `profilePhotos` com os mesmos 8 arquivos. O portal ficou na tela de login, sem sessão; arquivos temporários com tokens apagados.

## Achados

| ID | Sev | Achado | Tarefa |
|---|---|---|---|
| L1 | LOW (pré-existente) | **"Adicionar refeição" fica sob a barra de baixo em 320×691.** Na My Diet o botão ocupa y 633–691 e a barra y 603–667: só a faixa de 667 a 691 é tocável. Um clique no centro cai na barra. `MyDiet` e o estilo da barra não foram alterados pela feature (a barra só mudou `minWidth` de 64 para 56), então não é regressão. | fora da feature (backlog de dieta) |
| L2 | LOW (pré-existente) | **Perfil mostra "Alimentação: Nenhuma refeição ainda" enquanto My Diet e Home mostram a refeição de 400 kcal**, visto entre 23:51 e 23:59 locais (já era dia 07 em UTC). O Perfil chama `/diet/summary` sem data, e a Home/My Diet usam o dia local; a causa provável é o dia do servidor (UTC) ≠ dia local nessa faixa de horas. Persiste ao recarregar. Não verificado fora dessa faixa. | fora da feature (dieta/perfil) |
| I1 | INFO | Botões de ícone do Perfil/My Diet medem 32×32 (foto), 14×14 (editar usuário), 18×18 (editar/excluir refeição): < 44 px, pré-existentes, fora do escopo. |  |
| I2 | INFO (conhecido) | Dias do `DatePickerModal` seguem com 33×33 px. |  |
| I3 | INFO | "Pedido enviado" aparece duas vezes no `GroupDetail` (card e mensagem): já reportado no round 1 (I4), sem mudança. |  |
| I4 | INFO | Na Home, "Gastas: 0 kcal" não muda com treino de força (as sessões não gravam `calories`); pré-existente. |  |
| I5 | INFO | O chip **Personalizado** do Histórico fica fora da tela em 320 px até rolar o carrossel de chips horizontalmente (funciona depois de rolar). |  |
| I6 | INFO | Não verificados: capturas de tela, `Share` nativo, deep link `torv://`, teclado virtual cobrindo campos. |  |

## Conclusão

A feature está íntegra no HEAD, em todas as camadas: 159/159 + 47/47 + `tsc` limpo; regressão de login, boas-vindas, Home, dieta, Treinos (cargas, Histórico, Personalizado), Perfil (upload via `imageUpload`) e barra de 5 abas em 320 px sem quebra; fluxo completo por interface; Cenários A e B e consistência com 0 linhas; trigger legado removido; banco limpo. Pelo lado de testes a feature está verde no HEAD; o fechamento depende do veredito do Security (não executado por mim). Sem task a reabrir.
