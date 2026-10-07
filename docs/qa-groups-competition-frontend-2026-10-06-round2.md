# QA — Grupos e competição — etapa FRONTEND, usabilidade — ROUND 2 (2026-10-06)

**Veredito: PASS.** F1 (MEDIUM), F2 (LOW) e F3 (LOW) do round 1 estão corrigidos, e os itens de a11y/copy também. Nenhum achado novo acima de INFO. 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW / 6 INFO. Sem retrabalho; a etapa pode seguir para o Security.

Escopo (só o que mudou desde o round 1, relatório `docs/qa-groups-competition-frontend-2026-10-06.md`, não alterado): `07f7a9a` (GroupCard), `9801ba2` (switches do GroupEditor), `5ed41d2` (convite a quem já é membro), `b8f975e` (copy/a11y). Expo `:8081` e Furnace `:3000` já no ar, não parados.

## Automatizados

| Comando (em `FrontEndTorv`) | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `node --test src/utils/*.test.mjs` | **47 testes, 47 PASS, 0 fail** |

## Método

Igual ao round 1: portal `QA Home` em **uma só aba**, viewport **320×691** (o portal oscilou para 320×682 durante a rodada), token só no `localStorage` do navegador, contas QA A (dono) e B (convidado) registradas por `/auth/register` e logadas pela UI; troca de conta gravando a sessão no `localStorage`. API só para preparar dados (grupos `Gama`, `Futuro`, `Fim Membro`, `Fim Externo`, um de nome longo e 1 treino com 3 séries). SQL só via Prisma; conector Supabase **não usado**. Sem capturas de tela (o `screenshot` do portal segue dando "not rendering"): evidência por estilos computados, `getBoundingClientRect`, árvore de acessibilidade e SQL. O portal respondeu "not rendering" duas vezes e voltou sozinho após ~20 s; nenhum laço de espera.

## (1) Fluxo 12 — `GroupCard` em 320 px (F1) — **PASS**

Medido por `getBoundingClientRect`/`scrollWidth`/`scrollHeight` nos cartões reais (`Meus grupos`, 320 px). `scrollWidth da página = 320 = innerWidth` (sem rolagem horizontal); nenhum texto passa da borda do cartão (`right 290`/`300`); coluna de texto de 140–150 px.

| Caso | Cartão (alt × larg.) | Texto | Resultado |
|---|---|---|---|
| Encerrado | 124 × 270 | "1 membro · Encerrado em 05/10/2026" (e "2 membros · …" no cartão de B, 124 × 280) quebra em 2 linhas (36 px = 2 × 18); `scrollHeight == clientHeight` → **nada cortado** | PASS |
| Sem data de término | 103 × 270 | "1 membro · Sem data de término" quebra em 2 linhas, inteiro | PASS |
| Começa em 5 dias | 103 × 270 | "1 membro · Começa em 5 dias" quebra em 2 linhas, inteiro | PASS |
| Nome longo (91 caracteres) | 124 × 270 | nome em 2 linhas com `…` (`numberOfLines=2`, por desenho); subtítulo e "#1 · 0 dias" inteiros e sem estouro | PASS (ver I1) |

Todos os cartões ≥ 80 px (103 e 124 px), chevron dentro do cartão. Rótulo de acessibilidade completo em todos ("<nome>. <subtítulo>. #1 · 0 dias").

## (2) F2 — switches do `GroupEditor` — **PASS**

- A linha agora é `role=switch` de **270×52 px** (270×64 quando o texto de ajuda de "Grupo público" quebra), `tabindex=0`, `cursor:pointer`, com `aria-label` e **`aria-checked` correto**: "Grupo público" `false` → `true` ao tocar no texto da linha (x=60, longe do botão); "Sem data de término" começa `true`, vai a `false` ao tocar na linha (aparece "Fim: 06/10/2026") e volta a `true` ao tocar no `Switch` da direita (um único toggle, sem duplo disparo). O `Switch` interno de 40×20 virou só decoração (`pointer-events: none`).
- **Criar continua igual:** `QA Smoke`, capa (PNG 640×360 carregada, `naturalWidth 640`), público, fim 13/10 → `GroupDetail` com "06/10/2026 → 13/10/2026 · 7 dias restantes", A em 1º. A lógica dos dois `onPress` (`PUBLIC`↔`PRIVATE`; `null`↔`startsAt`) é a mesma dos antigos `onValueChange` (lida no diff de `9801ba2`).
- **Editar não foi re-executado na UI** nesta rodada: o diff só toca nos dois toggles do componente compartilhado por criar e editar, e o round 1 já validou editar (nome, capa, fim). Declaro como limite.
- `DatePickerModal` (dias de 33×33 px): **fora de escopo, INFO conhecido** (I6).

## (3) F3 — convidar quem já é membro — **PASS**

Dono convida B (já membro de `QA Smoke`, depois de aceitar) → "**Essa pessoa já está no grupo.**" (vermelho `rgb(255,69,58)`). Convidar a si mesmo (também membro) → a mesma frase. Antes do aceite, "Convite enviado." normalmente.

## (4) Copy e a11y — **PASS**

- **WorkoutEdit:** "Tempo" vazio → `Tempo inválido em "…série 1".`; "Carga" `abc` → `Carga inválida em "…série 1".` — ambos em **`role=alert`**, cor `rgb(255,69,58)`.
- **Excluir treino:** modal com o texto novo: "O treino sai do histórico. Se for o único do dia, esse dia deixa de contar nos seus grupos. Isso não pode ser desfeito." Confirmar → treino some do Histórico.
- **GroupDetail:** em andamento e sem término → "06/10/2026 · Sem data de término" (**sem repetir**); começa no futuro → "11/10/2026 → sem data de término · Começa em 5 dias" (**mantém** o "→ sem data de término").

## (5) Fumaça — caminho feliz — **PASS**

A cria `QA Smoke` com capa → convida B por username ("Convite enviado.") → B vê **Convites recebidos** e **Aceita** → cai no `GroupDetail` com o ranking (A em 1º, B "(você)" em 2º, 2 membros) → B **Sair do grupo** (modal) → o grupo some da lista de B. Consulta de consistência do ranking: **0 linhas** (7 membros em 6 grupos).

## Achados

| ID | Sev | Achado |
|---|---|---|
| I1 | INFO | Nome muito longo (> ~2 linhas, p. ex. 91 caracteres) é cortado com `…` no `GroupCard` por desenho (`numberOfLines=2`). O nome inteiro continua no rótulo de acessibilidade do cartão e no detalhe do grupo (o detalhe do grupo de nome longo não foi reaberto nesta rodada). |
| I2 | INFO | O `Switch` decorativo continua na árvore de acessibilidade da web como um segundo `role=switch` aninhado (40×20), sem rótulo, dentro da linha `role=switch`. O `importantForAccessibility` do React Native não é traduzido pelo react-native-web. Inofensivo para o toque; leitores de tela podem ler o estado duas vezes. |
| I3 | INFO | A tecla **Espaço** com a linha focada não alternou o switch no navegador (só o toque/clique alterna). Teclado físico não é o alvo do app móvel. |
| I4 | INFO | A mensagem de erro de `GroupManage` ("Essa pessoa já está no grupo.") é vermelha mas sem `role=alert` (a de `GroupDetail` e de `WorkoutEdit` têm). |
| I5 | INFO | O botão "Salvar alterações" do `WorkoutEdit` fica parcialmente abaixo da dobra quando a mensagem de erro aparece (320×682): é preciso rolar. Os primeiros cliques cegos (antes de rolar) não salvaram nem alteraram nada; clicando depois da rolagem a mensagem certa apareceu. Não é defeito de lógica. |
| I6 | INFO (conhecido) | Dias do `DatePickerModal` medem 33×33 px (< 44). Fora de escopo por instrução; segue como no round 1. |

Não verificados (igual ao round 1): teclado virtual cobrindo o campo, capturas de tela, `Share` nativo e deep link `torv://`.

## Limpeza (verificada por SQL via Prisma)

Apagados: 6 grupos, as 3 contas QA (`auth.users` → `users`, treinos, rotinas, perfis por cascade) e a capa de `QA Smoke` em `BackEndTorv/profilePhotos/`. Antes → depois: `users 77→77`, `auth.users 77→77`, `groups 0→0`, `group_invitations 0→0`, `activities 408→408`, `workout_routines 173→173`, `exercises 73→73`, `group_members 0`, `group_rankings 0`; nenhuma linha com `user_id/owner_id/created_by/follower_id/followed_id` das contas QA; `profilePhotos` idêntico (8 arquivos). O portal ficou na tela de login, sem sessão; arquivos temporários com tokens apagados.

## Conclusão

Etapa FRONTEND **verde no round 2**: F1, F2 e F3 corrigidos e verificados em 320 px; copy/a11y novos conferidos; caminho feliz íntegro. Sem retrabalho de camada. Testing verde nesta rodada → pode seguir para o **Security**.
