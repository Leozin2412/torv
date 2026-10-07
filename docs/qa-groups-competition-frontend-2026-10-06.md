# QA — Grupos e competição — etapa FRONTEND, usabilidade (2026-10-06)

**Veredito: FAIL (1 de 12 fluxos) — reabrir Task 9 e Task 12; Task 13 opcional.** Fluxos 1–11 e os 5 extras (i)–(v) passaram. O fluxo 12 falha no critério "nada cortado em 320 px" e tem alvos de toque < 44 px. 0 CRITICAL / 0 HIGH / 1 MEDIUM / 3 LOW / 9 INFO. Nenhum dado de teste ficou.

Escopo: commits `d73b9ac`, `7875205`, `b7723fd`, `00aeee1`, `e4d8596`, `ee2b9ae`, `c832458`, `280aa58` (Tasks 8–14). Backend no Furnace `:3000` e Expo web `:8081`, nenhum parado nem reiniciado.

## Step 1 — Automatizados

| Comando (em `FrontEndTorv`) | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0, sem erros |
| `node --test src/utils/*.test.mjs` | **47 testes, 47 PASS, 0 fail, 0 cancelled, 0 skipped** (esperado 47) |

## Método

- **Navegador pelo portal do Maestri** (`QA Home`, uma só aba, nunca fechada), viewport **320×691**. Token só no `localStorage` do navegador (`torv.session`). Contas QA A (dono), B (convidado) e C (só para deep link); registradas por `/auth/register`. A UI de login foi usada para A e B; para alternar entre elas eu gravei a sessão no `localStorage` e recarreguei (a UI só faz login uma vez por conta).
- API só para preparar dados: criar os grupos `QA Grupo Gama` (público), `Futuro` (começa em 5 dias), `Fim Membro`/`Fim Externo` (encerrados), regenerar token, 1 treino com 3 séries para o fluxo 8, e um nome longo para o fluxo 12. Banco só via Prisma (`DIRECT_URL`); conector Supabase **não usado**.
- **Sem capturas de tela:** `screenshot` do portal deu sempre `timed out — the page is not rendering`. A evidência é a árvore de acessibilidade (`snapshot`), `innerText`, estilos computados e SQL. Em vários momentos o portal respondeu `the portal is not rendering — its window may be minimized` e voltou sozinho após ~20 s; não houve laço de espera e nenhum passo ficou travado.
- Seletor de capa: o `expo-image-picker` web abre um `<input type=file>` nativo; no navegador do teste substituí o clique desse input por um `File` PNG gerado em canvas (640×360; e 1500×1500 de ruído = 7,7 MB para o extra iv).
- A bundle do Expo que o portal tinha em memória era **antiga** (tab bar com 4 abas, sem Grupos); um reload trouxe a bundle nova. A sessão antiga que estava no portal foi apagada do `localStorage` (era de uma conta anterior de QA).

## Step 3 — os 12 fluxos

| # | Fluxo | Resultado | Evidência |
|---|---|---|---|
| 1 | Aba | **PASS** | 5 abas (Home, Treinos, My Diet, Grupos, Profile) de 56×64 px dentro de 280 px; `scrollWidth = innerWidth = 320`; Grupos fica `aria-selected=true` ao tocar. |
| 2 | Criar | **PASS** | Nome vazio → "Dê um nome ao grupo." na própria tela. Capa + público + início 06/10 + fim 13/10 → `GroupDetail` com capa carregada (`naturalWidth 640`), "06/10/2026 → 13/10/2026 · 7 dias restantes", ranking com A em 1º. Calendário do fim: dias anteriores ao início `disabled`. Grupo com **Sem data de término** (toggle ligado por padrão): "→ sem data de término · Sem data de término". |
| 3 | Editar | **PASS** | Nome → "QA Grupo Alfa 2", capa trocada (arquivo antigo some do disco, só o novo existe), fim 20/10 → o detalhe reflete na volta: "14 dias restantes". |
| 4 | Convite por username | **PASS** (+ F3) | `nao_existe_zz` → "Usuário não encontrado."; `QA_FB_…` (maiúsculas) → "Convite enviado." e B aparece em "Convites enviados"; repetir → "Já existe um convite ou pedido pendente."; B vê o card **Convites recebidos** (grupo + "Convite de @qa_fa…") na aba Grupos, **Aceitar** → cai no `GroupDetail` com 2 membros. Convidar quem já é membro dá mensagem de "já está neste grupo" — mas com texto errado, ver F3. |
| 5 | Pedido de entrada | **PASS** | Em **Descobrir** B vê só Gama e Futuro (Beta privado, grupos encerrados e o grupo do qual já é membro não aparecem; busca "gama" filtra). **Pedir para entrar** → "Pedido enviado…"; A vê em **Gerenciar** "Pedidos de entrada (1)", **Aceitar** (botão 44×44) → (0), B membro e vê o ranking. |
| 6 | Código/link | **PASS** | A gera `73YRVRVR`; **Compartilhar** no web não quebra, o código segue na tela. B em **Entrar com código**: `zzzzzzzz` → "Código inválido ou link desativado."; `" 73yr vrvr "` (minúsculas, espaços) → prévia; A **Gerar novo código** (modal próprio "Gerar novo código?") → `FMASWWKV`; o antigo → "Código inválido ou link desativado."; `fmas wwkv` → prévia → **Entrar no grupo** → `GroupDetail` do grupo privado. **Desativar link** (modal) → "Link desativado." e o código dá inválido. Deep link `/join/fmaswwkv` e `/join/FMASWWKV` no navegador abre `JoinGroup` com a prévia (ativo) ou "Código inválido…" (desativado), sem quebrar o app. |
| 7 | Ranking vivo | **PASS** | B grava treino real (Treinos → Iniciar → série → Finalizar): ranking sobe para **1 dia** nos 3 grupos (SQL: Alfa 1/1, Beta 1/1, Gama 1/1). 2º treino no mesmo dia → segue 1 dia. Excluir pelo resumo (Histórico → treino → **Excluir treino**, modal) com outro no mesmo dia → ponto fica (1/1). Excluir o único → **0/0** nos 4 grupos (SQL). Cada treino some do Histórico ao voltar, **sem puxar para atualizar**. Home: streak 1 → **0**. Calorias: ver I1. |
| 8 | Editar treino | **PASS** | **Editar treino**: sem campo de data ("A data do treino não pode ser alterada…"). "Tempo" vazio → `Tempo inválido em "…série 1".`; "Carga" `abc` → `Carga inválida em "…série 1".`; nada foi salvo (SQL: séries inalteradas). Tempo 90, carga 30, série do meio removida → **Salvar** → o resumo mostra 2 séries (30 kg · 1:30 e 15 kg · 1:02). Ver L4 (3 tentativas deram 500 antes de passar). |
| 9 | Sair e remover | **PASS** | B **Sair do grupo** → modal "Sair do grupo? Se voltar depois, a contagem começa do zero." → some da lista e do ranking do grupo (visto por A). A remove B em **Gerenciar** (botão "Remover QA Front B" 44×44 → modal "Remover QA Front B?…") → "Membros (1)". O dono não vê "Sair do grupo". |
| 10 | Excluir grupo | **PASS** | **Excluir grupo** (modal "Excluir o grupo?…") → volta para a aba Grupos sem o card; a capa some do disco. |
| 11 | Estados | **PASS** | Futuro: "11/10/2026 → … · Começa em 5 dias" + "A competição ainda não começou: todo mundo está com zero.". Encerrado (ajustado por API para ontem): "Encerrado em 05/10/2026" no card e no detalhe; `/join/<código>` de grupo encerrado mostra "Este grupo já foi encerrado e não aceita novos membros." **sem botão de entrar**; some do Descobrir. Erro de rede: **simulado** redirecionando o XHR do navegador para uma porta fechada (o Maestro não autorizou derrubar o backend) → "Não foi possível carregar o grupo." + **Tentar de novo**. |
| 12 | Acessibilidade e layout | **FAIL** | Passa: nenhum `Alert.alert` nas telas da feature (só o comentário do `ConfirmModal`); todos os modais são próprios (`role=dialog` + `alert`); todos os ícones têm `accessibilityLabel` (Voltar, Remover … série n, Aceitar/Recusar <nome>, etc.); sem rolagem horizontal em nenhuma tela (GroupDetail, Grupos, Descobrir, JoinGroup, GroupEditor, GroupManage, Histórico, WorkoutSummary, WorkoutEdit); botões de ação ≥ 44 px. **Falha:** F1 (texto cortado em 320 px) e F2 (alvos < 44 px). "Teclado não cobre o campo ativo": **não verificável** no navegador desktop (sem teclado virtual); precisa de aparelho/emulador. |

## Extras

| # | Extra | Resultado | Evidência |
|---|---|---|---|
| i | **Excluir treino** no resumo salvo | **PASS** | Remove do Histórico sem puxar para atualizar; Home atualiza o **streak** (1 → 0). **Calorias** não dá para demonstrar: o treino de força grava `calories = null`, então "Gastas" é 0 antes e depois (I1). |
| ii | Treino recém-finalizado não mostra Editar/Excluir | **PASS** | Tela "Treino concluído" só tem **Concluir**; Histórico → treino mostra Concluir, **Editar treino**, **Excluir treino**. |
| iii | Erro em vermelho / sucesso neutro em `GroupDetail` | **PASS** | B abre `Gama` (público), A a torna privada por API, B toca **Pedir para entrar** → "Não encontrado." em **`rgb(255,69,58)`** com `role=alert`. A volta a público, B toca de novo → o erro some e aparece "Pedido enviado. O dono do grupo vai analisar." em `rgb(140,198,63)` (verde da marca, sem `role=alert`) — não vermelho. |
| iv | Falha no envio da capa na criação | **PASS** | Capa de 7,7 MB → "**Grupo criado, mas a capa não foi enviada.** A imagem é grande demais (máximo de 5 MB)." Tocar de novo (2×): continua **1 só grupo** no banco (`QA Grupo Capa`); trocar para uma capa pequena e tocar → a capa vai para o **mesmo** grupo e abre o `GroupDetail`. |
| v | Código em minúsculas | **PASS** | No campo (`" 73yr vrvr "`, `fmas wwkv`) e no deep link (`/join/fmaswwkv`, `/join/6umxu4zw`). |

Consulta de consistência do ranking (Task 7) ao final: **0 linhas** divergentes (9 membros em 7 grupos).

## Achados

| ID | Sev | Achado | Reabrir |
|---|---|---|---|
| F1 | **MEDIUM** | **Texto cortado em 320 px no `GroupCard`.** A coluna de texto tem só 140 px e os textos usam `ellipsis`+`nowrap`: o nome longo (`QA Grupo com um nome muito mas muito comprido…`, 795 px de texto) e as linhas "2 membros · Encerrado em 05/10/2026" (224 px), "1 membro · Sem data de término" (190 px) e "1 membro · Começa em 5 dias" (174 px) aparecem cortadas. Justo o estado do período é a informação que se perde. O rótulo de acessibilidade do card está completo; o detalhe do grupo mostra tudo. | **Task 9** (`GroupCard`; afeta Task 10 só por usá-lo) |
| F2 | LOW | **Alvos de toque < 44 px.** Os dois `switch` do `GroupEditor` ("Grupo público", "Sem data de término") medem **40×20 px** e a linha de 270×52 não é pressável (só o switch reage). No `DatePickerModal` (compartilhado) os dias do calendário medem **33×33 px** (os botões de mês, 38×38). | **Task 12** (switches; linha toda pressável). Dias do calendário: componente compartilhado, avaliar à parte. |
| F3 | LOW | **Texto errado ao convidar quem já é membro.** O dono convida `qa_fb_…` (B, já no grupo) e vê "**Você já está neste grupo.**" — a frase é para quem entra, não para o dono que convida. O backend devolve o mesmo `409 Already a member` para "convidar a si mesmo" e "convidar membro"; o mapa `BY_MESSAGE` de `groupErrors.ts` só tem uma frase. (O plano pede "mensagem de já está neste grupo": ela aparece, mas não com a pessoa certa.) | Task 13 (`GroupManage`: passar texto próprio para o convite) |
| L4 | LOW | **500 transitório do backend em `PUT /workouts/sessions/:id`.** Na edição do fluxo 8, 3 salvamentos seguidos deram `500 {"error":"An unexpected error occurred"}` ("Algo deu errado. Tente de novo." na tela, comportamento correto do front); o mesmo corpo, reenviado por API e depois pela UI, passou (200). Na mesma janela o pooler do Supabase esteve fora do ar (Prisma `Can't reach database server` nos meus scripts) e "Gerar novo código" demorou ~30 s. Mesma classe do L1 do relatório de backend: instabilidade de rede/pool, não defeito de feature. Sem retrabalho. | — (infra; conferir o log do Furnace) |
| I1 | INFO | `calories_burned` da Home é sempre 0 para treino de força (as sessões não gravam `calories`); o requisito "Home atualiza calorias" não é demonstrável. Pré-existente. | — |
| I2 | INFO | As mensagens de validação do `WorkoutEdit` (`Tempo inválido…`, `Carga inválida…`, `Algo deu errado…`) não têm `role=alert` nem região viva — leitores de tela não as anunciam. Já as do `GroupDetail`/`GroupManage` de erro têm. | — |
| I3 | INFO | O modal de excluir treino diz "os dias dele deixam de contar nos seus grupos", mas com outro treino no mesmo dia o ponto permanece (verificado: 1/1). Texto levemente impreciso. | — |
| I4 | INFO | Em "Pedido enviado" a informação aparece duas vezes: no card ("Aguardando o dono do grupo.") e na mensagem ("O dono do grupo vai analisar."). | — |
| I5 | INFO | Detalhe de grupo sem término repete o rótulo: "→ sem data de término · Sem data de término". | — |
| I6 | INFO | Em **Descobrir**, `fill` no campo sem Enter não filtrou em 2 s; com Enter filtrou. Não confirmei se há debounce ou se é só a pesquisa por Enter (no web o `fill` pode não disparar o evento do RN). | — |
| I7 | INFO | O sucesso do `GroupDetail` usa o verde da marca (`colors.brand`), não cinza; é "não vermelho", como pedido. | — |
| I8 | INFO | Não verificados por falta de meio no navegador de mesa: teclado virtual cobrindo campo (fluxo 12), capturas de tela, `Share` nativo, deep link `torv://` (só o caminho web `/join/<código>`). | — |
| I9 | INFO | Falha de rede foi simulada no navegador, não derrubando o backend. | — |

## Limpeza (verificada por SQL via Prisma)

Apagados: 7 grupos (o 8º, `Alfa 2`, o próprio teste excluiu pela UI), as 3 contas QA (`auth.users` → `users`, treinos, rotinas, perfis por cascade) e a capa criada pelo teste em `BackEndTorv/profilePhotos/` (as outras capas foram removidas pelo próprio backend ao trocar/excluir). Antes → depois: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `activities 408→408`, `workout_routines 173→173`, `exercises 73→73`, `group_members 0`, `group_rankings 0`; nenhuma linha restante com `user_id/owner_id/created_by/follower_id/followed_id` das contas QA; `profilePhotos` idêntico (8 arquivos). O portal ficou na tela de login, sem sessão; os arquivos temporários com tokens foram apagados.

## Conclusão

Etapa FRONTEND **não passa** nesta rodada por F1 (MEDIUM) e F2 (LOW), ambos do fluxo 12. O backend e o ranking estão corretos pela interface. **Maestro: reabrir Task 9 (`GroupCard`) e Task 12 (switches do `GroupEditor`); Task 13 (F3) a seu critério.** Depois, rodar só o fluxo 12 e o que mudou (relatório `-round2`) e então o Security.
