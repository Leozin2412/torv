# QA — Carga por série, período, senha e boas-vindas — teste completo — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, estado final em `c571a74` · **Escopo:** Task 7 do plano `docs/superpowers/plans/2026-10-02-loads-period-welcome.md` (spec `docs/superpowers/specs/2026-10-02-loads-period-welcome-design.md`). Junta as etapas (Database, Backend e Frontend) de ponta a ponta e faz a regressão do módulo de treinos e do histórico.

Relatórios anteriores desta feature: `docs/qa-loads-welcome-database-2026-10-02.md`, `docs/qa-loads-welcome-backend-2026-10-02.md` (+ `-round2`) e `docs/qa-loads-welcome-frontend-2026-10-02.md`.

## Ambiente

- **Antes de tudo:** o terminal mostrava "1 shell still running". Eram sobras minhas da sessão headless que travou na etapa Frontend: um `agent-browser` e o Chrome headless dele (processos órfãos).
  - Encerrei os dois e confirmei que **não sobrou nenhum processo do agent-browser**.
  - A tarefa de fundo que o disparou também terminou.
  - Não toquei no backend do Furnace nem no Expo.
- **Servidores:** Expo web em `http://localhost:8081` e backend no Furnace, sem reinício. `FrontEndTorv/.env` vazio e não editado.
- **Sem ajuste na página:** nenhum shim. O app falou direto com `http://127.0.0.1:3000` (o fallback do `api.ts` no web), e cadastro, login e telas funcionaram assim.
- **Portal:** "Torv Mobile #2", em 412×915 e 320×915, fuso `America/Sao_Paulo`, sex 02/10/2026.
  - Medidas pelo DOM e pelas requests do `performance`. O token nunca saiu do navegador, e a sessão original do portal foi guardada em outra chave e restaurada no fim.
  - **Sem screenshots:** não precisei de imagens, e o headless não foi usado nesta tarefa.
- **Contas novas, criadas pela tela de Cadastro** (os 5 passos):
  - `qa.lwfull.f1.1790968427519@torvtest.dev`: o fluxo em 412 (feminina, Iniciante, "Melhorar Condicionamento").
  - `qa.lwfull.f2.1790968975524@torvtest.dev`: o passe em 320 (masculino, Intermediário, "Ganhar Massa Muscular").
  - As duas tiveram 34 treinos semeados com `fetch` dentro da página (hoje até 200 dias atrás), para o Histórico ter o que filtrar e paginar.

## Veredito: PASS (5/5 blocos)

Nenhuma falha. Há só observações, nenhuma delas é regressão.

| Bloco | Resultado |
|---|---|
| Automatizados | ✅ PASS |
| Fluxo ponta a ponta em 412 | ✅ PASS |
| Passe em 320 | ✅ PASS |
| Regressão do módulo de treinos e do histórico | ✅ PASS |
| Console sem erros | ✅ PASS (ver o bloco do console) |

## Automatizados

| Item | Resultado |
|---|---|
| `BackEndTorv: npm test` | ✅ **92/92** |
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |
| `FrontEndTorv: node --test "src/**/*.test.mjs"` | ✅ **32/32** |

## Fluxo ponta a ponta — 412 (conta F1)

| Etapa | Resultado |
|---|---|
| **Cadastro** pela tela | ✅ 5 passos, entra direto na Home. Na tela de senha, os 2 campos mascarados usam a **pilha do sistema** (`-apple-system, …`), o e-mail usa Sora |
| **Boas-vindas** | ✅ "Bem-vindo(a) ao Torv, **Camila**!" (cadastro "Camila Teste Rocha"), 3 pontos e "Começar", caixa em x 24–388 sem overflow. "Começar" fecha. **Recarregar a página** não mostra de novo |
| **Logout e login:** senha com bolinhas | ✅ No Login, a senha oculta usa a **pilha do sistema** (`type=password`); com o olho aberto vira `type=text` em **Sora_400Regular**. Depois do login, a boas-vindas **não volta** (esperei 10 s) |
| **Criar a rotina "QA Completa"** | ✅ 2 exercícios, cargas 20 / 25 / vazio e 10 / 10 (a 3ª série do segundo exercício removida com "− Série"). A rotina aparece na lista |
| **Editar a rotina** | ✅ Mudei a carga da série 3 para "27,5" e salvei: a API mostra `[[20,25,27.5],[10,10]]` |
| **Treino com carga ajustada** | ✅ **−/+:** 20 → 17,5 → 20. **Digitando:** "30", "28,5" e "12,5". **Tela:** "+" na série 2 (25 → 27,5) e "−" no exercício 2 (10 → 7,5). A série seguinte volta à carga da rotina, como decidido |
| **Continuar treino** | ✅ Saí no meio (série 2 com 27,5), toquei em "Continuar": **sem aviso nenhum**, volta na série 2 com "27,5 kg". Terminou o treino com as 5 séries |
| **Resumo** | ✅ "Treino concluído", **sem seta de voltar** (resumo recém-salvo). Carga por série: "30 kg", "27,5 kg", "28,5 kg", "7,5 kg", "12,5 kg". O **card "Cargas diferentes da rotina"** lista as 5 mudanças, por exemplo "série 1: 20 kg → 30 kg" e "série 1: 10 kg → 7,5 kg" |
| **Atualizar rotina** | ✅ "Rotina atualizada". A API mostra `[[30,27.5,28.5],[7.5,12.5]]` |
| **Editor com as cargas novas** | ✅ `30`, `27,5`, `28,5`, `7,5` e `12,5` |
| **Histórico: tipo + período, preset** | ✅ Musculação + 7 dias → `type=STRENGTH&from=2026-09-26T03:00:00Z&limit=20` → 8 treinos (5 de hoje e 3 dos últimos 6 dias) |
| **Histórico: tipo + Personalizado** | ✅ Musculação + 09/09–18/09 → chip "**09/09 – 18/09**", `type=STRENGTH&from=…&before=…09-19…` → 4 treinos |
| **Abrir o treino: a carga aparece** | ✅ O treino de 5 séries, aberto pelo Histórico, mostra as 5 cargas ("30 kg", …), **sem card**, com a **seta vermelha** (`stroke="#FF453A"`, 44 × 44, `aria-label="Voltar"`) |
| **Voltar na mesma posição** | ✅ Musculação + 3 meses, 2ª página carregada (36 treinos, `before` = cursor, mesmo `from`): abri o item 22 (`scrollTop` 2345, topo a 504 px), voltei pela seta e ficaram os mesmos **2345 / 504**, 36 itens, mesmos chips, sem spinner |

## Passe em 320 (conta F2)

| Etapa | Resultado |
|---|---|
| Cadastro, boas-vindas, senha | ✅ Cadastro pela tela. Campos de senha com 272 px de largura, pilha do sistema, sem overflow. "Bem-vindo(a) ao Torv, **Bruno**!" em x 24–296 (272 × 554), botão 224 × 50, `scrollWidth` 320. "Começar" fecha. **Recarregar** e **logout e login** não mostram de novo. No login, senha mascarada em fonte do sistema |
| Treino com carga | ✅ "QA Cargas A": −/+ (20 → 17,5 → 20), digitando "35", série 2 com "+" (22,5), série 3 "Sem carga". `scrollWidth` 320 |
| Resumo e "Atualizar rotina" | ✅ Cargas por série ("35 kg", "22,5 kg"), card com 2 mudanças, botões de 50 px de altura e sem overflow. "Rotina atualizada" |
| Editor | ✅ `35`, `22,5`, vazio, `10` e `10`, `scrollWidth` 320 |
| Histórico | ✅ Musculação + 30 dias (`type=STRENGTH&from=2026-09-03…`, 12 treinos). Musculação + 09/09–18/09 (4). Musculação + 3 meses paginado até **32** treinos, o último em 05/07 |
| Abrir e voltar | ✅ Item 22 em `scrollTop` 2508 / topo 504, e voltou nos mesmos 2508 / 504 |
| Treino aberto pelo Histórico | ✅ "35 kg" e "22,5 kg", com a seta de 44 × 44, `scrollWidth` 320 |

## Regressão do módulo de treinos e do histórico

| Item | Resultado |
|---|---|
| **Criar e editar rotina** | ✅ Ver o fluxo em 412 (criei "QA Completa" e editei a carga da série 3) |
| **Treino completo** | ✅ 5 séries de ponta a ponta, mais 4 treinos curtos (Dia 1, 2, 3 e "QA Completa" de novo) |
| **Selo "Concluído"** | ✅ O cartão de "QA Completa" na aba Treinos ganha o selo "Concluído" depois do treino |
| **Aviso ao refazer, aba Treinos** | ✅ "Iniciar QA Completa" abre "**Treino já concluído** — Você já fez esse treino nos últimos 7 dias…", com "Treinar mesmo assim" e "Cancelar". **Cancelar** não inicia nada |
| **Aviso ao refazer, Iniciar da Home** | ✅ Depois de completar os Dias 1, 2 e 3, a Home mostra "Treino de hoje: QA Completa". O "Iniciar" abre o mesmo aviso, e "Treinar mesmo assim" começa o treino |
| **Continuar treino (rascunho) sem aviso** | ✅ Ver o fluxo em 412: sem modal, na mesma série e com as cargas |
| **Seta vermelha de voltar** | ✅ No resumo aberto pelo **Histórico** e pelo **Perfil**: `#FF453A`, 44 × 44, `aria-label="Voltar"`. Não aparece no resumo recém-salvo |
| **Perfil "Atividade Física"** | ✅ Lista os 5 treinos mais recentes ("QA Completa · 02/10 · 1 min · 5 séries", …). Abrir o de 5 séries mostra as 5 cargas e a seta, que volta para o Perfil |
| **Paginação do Histórico** | ✅ 20 → uma request com `before` → 36, sem repetir. Com Musculação + 3 meses, o `from` se repete e o `before` é o cursor |
| **Pull-to-refresh** | ✅ Com `onRefresh` pela fiber (o web não tem o gesto) e a lista no topo: `GET /activities?type=STRENGTH&from=…&limit=20` sem `before`, **20** itens. Rolar até o fim busca a 2ª página de novo → 36 |
| **Histórico, períodos** | ✅ Na F1 (412): Musculação + 7 dias (8 treinos, os 5 de hoje e 3 dos últimos 6 dias), 3 meses (36, paginado) e Tudo (20 na 1ª página). Na F2 (320): 30 dias, 3 meses e o Personalizado. Os 5 períodos, um a um, estão no relatório da etapa Frontend |

## Console

| Janela | Resultado |
|---|---|
| 320: cadastro da F2, boas-vindas, recarregar, login, treino, resumo, editor e Histórico (captura contínua desde a tela de Login) | ✅ Nenhum erro do app, só `props.pointerEvents is deprecated. Use style.pointerEvents`, que já existia. Apareceram **2 erros de `querySelector`** (`'Error: Cannot read properties of undefined (reading getBoundingClientRect)' is not a valid selector`), **do meu script de teste, não do app**: foi um passo em que cliquei na aba errada (My Diet) e o script repassou a mensagem de erro como seletor |
| 412: da tela de Login, depois do 1º recarregamento (login, treino, resumo, editor, Histórico, Perfil) | ✅ nenhum erro nem aviso |
| 412: o cadastro da F1 | A captura não foi lida antes do recarregamento que vem logo depois da boas-vindas, então essa janela se perdeu. O mesmo cadastro foi repetido e lido em 320 |

## Observações

- **INFO (harness):** o `onRefresh` chamado pela fiber com a lista **rolada para o meio** recarrega e, como o conteúdo encolhe, o `onEndReached` busca a 2ª página de novo (voltam os 36). O gesto real só acontece no topo da lista, e a mesma chamada a partir do topo deu 20 itens, então não considero falha.
- **INFO (usabilidade, da etapa anterior):** a linha de chips de período rola na horizontal sem indicador. Em 320, "Personalizado" fica fora da tela e "3 meses" já aparece cortado em 2 px.
- **INFO:** ao reabrir o seletor do Personalizado, ele já vem no período atual, e só confirmar deixa um único dia.
- **INFO (já existia):** a Home de conta recém-criada mostra "Streak 12 dias seguidos" e um feed com dados fixos de exemplo.
- **Conta do usuário no portal:** depois de restaurar a sessão original, a Home dela abriu com a mensagem de boas-vindas (`welcome_pending: true`, sem backfill, como a spec). Eu não toquei no "Começar".
- **Dados de teste:** as contas `qa.lwfull.f1.1790968427519@torvtest.dev` e `qa.lwfull.f2.1790968975524@torvtest.dev` continuam no banco, com 34+ treinos e as rotinas, porque não existe endpoint para apagar conta. Portal: restaurado para a sessão original, na Home, em 412×906.
