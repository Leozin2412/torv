# QA — Histórico: seta de voltar no resumo e posição da lista — 2026-10-02

**Owner:** Torv Review and Tests (Loupe) · **Branch:** `feat/workout-module`, código em `dc84bc9` (só frontend) · **Pedido do usuário:**
1. O resumo de um treino já feito (`WorkoutSummary` com `sessionId`) ganhou uma seta vermelha no topo à esquerda, que volta.
2. O Histórico volta no mesmo ponto da rolagem, sem recarregar. No foco com o mesmo filtro: `refreshTop` (`prependNew`) + `restoreScroll`. Com filtro novo: `loadFirst`.

Contas **novas**, semeadas via `POST /workouts/sessions` (todas `@torvtest.dev`):
- `qa.arrow.H.1790951813244`: 23 treinos.
  - Hoje 09:37: Dia 1.
  - Ontem 19:00: Treino livre.
  - **qua 30/09 às 23:30 local**: Dia 2.
  - 20 de 8 a 27 dias atrás: Dia 3.
- `qa.arrow.E.1790951813244`: 20 treinos.
- `qa.arrow.N.1790951813244`: sem treinos.

## Ambiente

- **Instâncias:** Expo web em 8081 e backend no Furnace (`localhost:3000`). Nenhum dos dois foi reiniciado e nenhuma outra instância foi aberta.
- **`.env`:** vazio e não editado.
- **Shim só na página:** reescreve o host do XHR para `localhost:3000` e registra as chamadas. Também aceita regras de uso único para atrasar uma request ou simular falha de rede.
- **Login e medidas:** login pela tela de Login. Portal "Torv Mobile #2" em 412×915 e 320×915. Medidas pelo DOM (`getBoundingClientRect`, `scrollTop`, `getComputedStyle`); não precisei de screenshot.
- **Sessão original do portal:** salva numa chave separada do `localStorage`, sem `/auth/logout`, e restaurada no fim.
  - **Ressalva:** o portal estava aberto num resumo da conta original. Depois da restauração ele volta para a Home, logado, em 412×906, e não para aquele resumo.
- **Fuso:** `America/Sao_Paulo`, sex 02/10/2026, por volta das 11h40.

## Veredito: PASS (100% verde)

Nenhuma falha bloqueante. O botão de voltar do **navegador** não volta o app, mas isso já era assim antes deste commit, porque o app não registra histórico no navegador (ver Observações).

## (1) Automatizado

| Item | Resultado |
|---|---|
| `FrontEndTorv: npx tsc --noEmit` | ✅ exit 0 |
| `FrontEndTorv: node --test src/utils/*.test.mjs` | ✅ **18/18**, com o `prependNew` novo |

## (2) Seta

| Item | 412 | 320 |
|---|---|---|
| Cor | ✅ `stroke="#FF453A"`, path `rgb(255, 69, 58)` (= `colors.error`), ícone 26 px | ✅ |
| Posição e alvo | ✅ Topo à esquerda, caixa em (8, 8) com **44 × 44**, `role="button"`, **`aria-label="Voltar"`** | ✅ (8, 8) 44 × 44; título do resumo logo abaixo (y = 60), sem overflow (`scrollWidth` 320) |
| Resumo aberto do **Histórico** | ✅ aparece e volta | ✅ |
| Resumo aberto do **Perfil** (o caminho que o implementador não conseguiu conferir) | ✅ Perfil → "Treino livre" → resumo **com a seta** → seta → **Perfil** | — |
| **Carregando** (hook atrasa o `GET /workouts/sessions/:id` em 4 s) | ✅ A seta aparece junto com o spinner; ao terminar, o resumo aparece com a seta | — |
| **"Treino não encontrado."** (hook faz o GET falhar) | ✅ seta + "Treino não encontrado." + "Voltar" | — |
| Resumo **recém-salvo** depois de um treino | ✅ **Sem seta**: "Treino concluído" com só o botão "Concluir" | — |

## (3) Posição ao voltar (H, 23 treinos, 2ª página carregada)

Item de referência: o **índice 20**, 1º da 2ª página, "Dia 3 — Corpo todo C · 07:00 · 25:25 · 3 séries".

| Volta por | Resultado |
|---|---|
| **Seta** | ✅ **Antes:** `scrollTop` 2093, item no topo 618 px. **Depois:** os **mesmos** 2093 / 618. 23 itens, todos com key única, sem spinner. Só um `GET /activities?limit=20` leve (`refreshTop`), sem novidades, sem recarga visível |
| **Concluir** | ✅ 2093 / 618, 23 únicos, sem spinner |
| Seta depois de **carregar** e de **"não encontrado"** | ✅ 2093 / 618 nos dois casos |
| Trocar de **aba** (Perfil → Treinos) | ✅ O Histórico continua aberto em 2093 / 618 |
| 320 | ✅ Item de referência índice 20 em `scrollTop` 2283 / topo 684 → seta → 2283 / 684, 24 únicos |
| **Botão/gesto de voltar do navegador** | ⚠️ Não se aplica no web. Com o resumo aberto, `history.length` = 1 e `history.state` = `null`, e `history.back()` não faz nada: o resumo continua na tela, sem reload. O app não registra navegação no histórico do navegador porque não há `linking` no `NavigationContainer`; isso já era assim antes do commit e vale para todas as telas. No nativo, o gesto do iOS e o voltar do Android chamam `goBack()`, o mesmo caminho da seta, que foi testado acima |

## (4) Treino novo com o Histórico aberto

| Item | Resultado |
|---|---|
| Histórico aberto na aba Treinos (2ª página, 2093/618) → Home → **Iniciar** (Dia 2, concluído → modal → Treinar mesmo assim) → 1 série → Finalizar | ✅ `POST` ok, resumo "Treino concluído" **sem seta** |
| **Concluir** → Treinos | ✅ O Histórico continua ativo. O treino novo, "**Dia 2 — Corpo todo B · 11:41 · 0:09 · 1 série**", aparece **no topo**, em "Hoje". **24 itens únicos**, sem duplicata e sem spinner |
| Posição | ✅ O item de referência continua no mesmo ponto da tela (topo 618). O `scrollTop` foi para 2174 porque o item novo entrou acima, e a âncora de rolagem compensou |

## (5) Trocar de chip e puxar para baixo

| Item | Resultado |
|---|---|
| Puxar para baixo (`onRefresh` chamado pela fiber, porque o web não tem o gesto), com 24 itens e a 2ª página carregada | ✅ `GET /activities?limit=20` → **20 itens** e `scrollTop` 0, ou seja, recarregou do topo. Rolar até o fim busca a 2ª página de novo (`before=…`) → 24 |
| Chip "Musculação" | ✅ `type=STRENGTH&limit=20` → 20 itens, `scrollTop` 0, `aria-selected` acompanha. A paginação do filtro funciona |
| Voltar para "Todos" depois de paginar | ✅ Carga nova `limit=20` → 20 itens no topo; a 2ª página anterior foi descartada |

## (6) Regressão do Histórico

| Item | Resultado |
|---|---|
| Paginação | ✅ 20 → **uma** request `before=2026-09-08T10:00:00.000Z` → 23, sem repetir. Spinner some no fim |
| Cabeçalhos | ✅ "Hoje", "Ontem", "**qua, 30/09**" com o treino das 23:30 local (em UTC cairia em "Ontem"), "qui, 24/09"… |
| Estado de erro (hook) | ✅ "Não foi possível carregar o histórico." + "Tentar de novo" → 20 itens |
| Estado vazio (N) | ✅ "Nenhum treino ainda" + "Ver meus treinos" → "Meus treinos" | 
| Layout 320 | ✅ `scrollWidth` 320 no Histórico com itens, no vazio e no resumo. Segmentado/chips com 44 px. Títulos em 2 linhas, sem corte |
| Console | ✅ Só o aviso que já existia (`props.pointerEvents is deprecated`), lido em 2 trechos: H depois de todos os passos de (2)–(6), e N |

## Revisão do diff (`dc84bc9`)

| Arquivo | Resultado |
|---|---|
| `WorkoutSummary/index.tsx:72` | ✅ **Condição:** `backHeader` só aparece quando há `sessionId`. Por isso surge no Histórico e no Perfil, e não no resumo recém-salvo, que abre com `replace('WorkoutSummary', {})`. **Onde:** é renderizado no loading/missing (`:83`) e no resumo (`:98`). **Ação e acessibilidade:** `goBack()`, `accessibilityLabel="Voltar"`, alvo de 44 px (`styles.ts`) |
| `Workouts/History.tsx:77-99` | ✅ **Filtro:** `loadedType` guarda o filtro da última carga ok (e vira `null` no erro). **Volta com o mesmo filtro:** `refreshTop` busca a 1ª página e o `prependNew` adiciona só ids novos; descarta resposta de filtro antigo pelo mesmo `request`. **Rolagem:** `restoreScroll` repõe o `offset` gravado no `onScroll` (`:184`). **Filtro novo ou erro:** `loadFirst` zera o `offset`. A limitação de mais de 20 treinos novos fora da tela está marcada com `ponytail:` e tem saída (puxar para baixo) |
| `utils/historyGroups.ts` (`prependNew`) + teste | ✅ Função pura. Sem nada novo, devolve o mesmo array e não provoca re-render |

## Observações

- **INFO (frontend, já existia, fora do diff):** no web, o botão de voltar do navegador não navega dentro do app, porque não há `linking` no `NavigationContainer` e por isso não há entradas no `history`. Se quiserem esse comportamento no web, o caminho é configurar o `linking` do React Navigation. No app nativo não se aplica.
- **INFO (frontend, já existia):** no resumo do histórico, qualquer falha do `GET /workouts/sessions/:id` (inclusive rede fora) mostra "Treino não encontrado." (`WorkoutSummary/index.tsx`, `catch` → `missing`). Agora o usuário tem a seta e o "Voltar" para sair.
- **Dados de teste:** as contas `qa.arrow.{H,E,N}.1790951813244@torvtest.dev` continuam no banco, porque não existe endpoint para apagar conta. H ficou com 24 treinos (23 semeados + 1 pelo app). Nenhum dado do usuário foi lido nem alterado.
