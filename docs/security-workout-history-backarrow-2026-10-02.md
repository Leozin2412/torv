# Security Review: Histórico, seta de voltar e posição da lista

- **Data:** 2026-10-02
- **Branch:** `feat/workout-module`
- **Escopo:** `fa26c28..dc84bc9`, só frontend, 5 arquivos. O `3672ec0` é só o relatório de QA.
  - `WorkoutSummary/index.tsx` e `styles.ts`: seta vermelha de voltar (`navigation.goBack()`) quando o resumo abre em modo histórico (`sessionId`).
  - `Workouts/History.tsx`:
    - `refreshTop` busca a 1ª página da mesma rota `GET /activities` e mescla os ids novos com `prependNew`;
    - `restoreScroll` repõe o `offset` gravado no `onScroll`;
    - `loadedType` decide se o foco faz `refreshTop` ou `loadFirst`.
  - `utils/historyGroups.ts` (`prependNew`) e o teste dele.
- **Pré-condição:** QA PASS (`docs/qa-workout-history-backarrow-2026-10-02.md`, `3672ec0`).
- **Anteriores:** `security-workout-history-2026-10-01.md` e `-round2.md`. Lá ficou fechado o `GET /activities` (IDOR, limites, exposição, erros).
- **Veredito: PASS.** Não há CRITICAL, HIGH nem MEDIUM. Há 1 LOW (#1, frontend), que não bloqueia e tem um fix de 1 linha. Os pontos pedidos estão verdes, menos o "não mistura dados entre filtros": o guarda por request id cobre as respostas atrasadas, mas uma troca rápida A → B → A escapa dele. Ver LOW #1.

Não imprimi nenhum segredo e não usei token no shell. Também não abri portal, não fiz request ao backend e não gravei nada no banco.

---

## Checklist

### Nenhuma chamada de API nova ✅

- **Linhas adicionadas no diff:** a única chamada de API é `activitiesApi.list({ type, limit: PAGE })` (`History.tsx:80`). É a mesma rota `GET /activities`, com os mesmos parâmetros do `loadFirst`, e passa pela mesma instância `api`, com o mesmo `baseURL` e o mesmo interceptor.
  - O `type` vem do estado do chip, que só assume valores do enum `ACTIVITY_TYPES` ou `undefined`.
  - O `limit` é a constante 20.
  - Não há `before` nem id vindo de outro lugar.
- A seta só chama `navigation.goBack()` (`WorkoutSummary/index.tsx:74`). Não é chamada de rede nem navegação para URL externa.
- **O que o backend já garante:** a rota filtra pelo `userId` do token. Por isso, nada do que o front mescla pode ser dado de outro usuário.

### Nada de token ou dado sensível em log ou estado persistente ✅

- O grep nas linhas adicionadas não achou `console.`, `AsyncStorage`, `SecureStore`, `localStorage`, `sessionStorage`, `Authorization`/`token`, `JSON.stringify`, `Linking`, `WebView`, `dangerouslySetInnerHTML` nem `eval`.
- Os 2 `catch` novos (`History.tsx:50-53`, `:82-84`) não logam nada.
- O estado novo é só de memória:
  - `loadedType` guarda o filtro;
  - `offset` guarda um número de pixels;
  - `listRef` aponta para a lista.

  Nada vai para storage, e tudo some ao desmontar a tela.
- O `prependNew` (`historyGroups.ts:36-40`) só compara `id` e não toca em outros campos.

### Respostas atrasadas: o guarda por request id ✅, com uma exceção ❌ (LOW #1)

Testei com uma **simulação determinística** de `History.tsx:38-99`:

- o corpo das funções foi copiado;
- `useRef`/`useState` viraram variáveis com setter funcional;
- o `useFocusEffect` dispara a cada troca de `type`, que é o que o hook faz com a tela focada;
- uso o **`prependNew` real**, importado de `src/utils/historyGroups.ts`;
- a API é feita de promessas que eu resolvo na ordem escolhida.

Os dados fictícios fazem "Todos" ter um item que "Musculação" não tem e vice-versa, para a mistura aparecer.

| Cenário | Resultado |
|---|---|
| Volta do resumo (`refreshTop` em voo) e troca de filtro antes da resposta | ✅ O `loadFirst` incrementa `request.current` e o `refreshTop` atrasado é **descartado** |
| Dois retornos seguidos com o mesmo filtro (2 `refreshTop` em voo) | ✅ O `prependNew` deduplica por id: nenhum id repetido |
| Puxar para baixo, falha de rede, `loadMore` concorrente | ✅ Cobertos pelo mesmo guarda e pelos setters funcionais |
| **Troca rápida A → B → A**: "Todos" carregado, toca "Musculação" e volta para "Todos" antes da resposta de Musculação | ❌ **Mistura.** Ver LOW #1 |

### Sem dependência nova e sem `EXPO_PUBLIC_*` ✅

O diff não toca em `package.json`, lockfile, `.env*` nem `app.json`/`app.config.*`. Nenhuma linha adicionada usa `EXPO_PUBLIC`.

### Testes ✅

`node --test src/utils/*.test.mjs` passa **18/18**, com o teste novo do `prependNew`. `npx tsc --noEmit` termina com exit 0.

---

## Achados

### #1 LOW: troca rápida de filtro mistura listas de filtros diferentes (integridade de exibição, só dados do próprio usuário)

- **Camada:** frontend
- **Onde:** `FrontEndTorv/src/screens/Workouts/History.tsx:95` (`if (loadedType.current === type)`), com `:49` e `:78-81`.
- **Causa:**
  - `loadedType` guarda o filtro da última carga **concluída**, e não o da última **pedida**.
  - Enquanto um `loadFirst(B)` está em voo, voltar para o filtro A faz o atalho entrar em `refreshTop`, que não incrementa `request.current`. O `loadFirst(A)` não roda.
  - Por isso, a resposta de B continua válida para o guarda e é aplicada sob o chip A. O `refreshTop(A)` usa o mesmo id e também passa.
  - Os chips continuam clicáveis durante o spinner, porque o `return` de `status !== 'ready'` renderiza `{chips}`.
- **Prova (simulação):** "Todos" carregado → toca "Musculação" → toca "Todos" antes da resposta.

  | Ordem das respostas | Tela final com o chip "Todos" ativo |
  |---|---|
  | Musculação chega, depois o `refreshTop(Todos)` | itens de Musculação + os novos de Todos mesclados no topo: `[cardio-1, s-1, s-0]`. O `s-0` só existe em Musculação |
  | `refreshTop(Todos)` chega, depois Musculação | a lista de Musculação inteira sob "Todos": `[s-1, s-0]` |

  Nos dois casos, `loadedType` fica `STRENGTH` com o chip em "Todos". O `loadMore` seguinte pede `type=undefined` com o `next_before` de Musculação. O estado só se corrige no próximo foco ou na próxima troca de chip.
- **Impacto:**
  - **Não há vazamento:** os dois filtros vêm do mesmo `GET /activities`, já filtrado pelo usuário do token. Nunca aparece dado de outro usuário.
  - **É um problema de integridade do que a tela mostra:** um filtro exibe a lista do outro. Isso é uma **regressão do Review Focus 3 do plano** ("Trocar de chip rápido… a lista mostra só o resultado do filtro atual").
  - **Hoje é latente.** Só existe o tipo `STRENGTH` (`ACTIVITY_TYPES`), e no banco as 145 activities são STRENGTH, então "Todos" e "Musculação" trazem os mesmos itens. Fica visível quando entrar um segundo tipo de activity.
  - O QA não pegou: no item (5) ele testou cada troca de chip depois da resposta anterior.
- **Fix mínimo:** 1 linha, no frontend, em `History.tsx`, dentro do `loadFirst`, junto do `offset.current = 0` (`:40`):

  ```ts
  loadedType.current = null; // carga em voo: o próximo foco não usa o atalho do refreshTop
  ```

  - **Validado na simulação:** com essa linha, nas duas ordens, a volta para "Todos" dispara um `loadFirst` novo, a resposta de Musculação é descartada e a tela fica só com `[cardio-1, s-1]`.
  - **O caminho principal da feature não muda:** voltar do resumo com o mesmo filtro já carregado continua usando `refreshTop` + `restoreScroll`.
  - **Puxar para baixo também não muda:** a lista fica visível e o `loadedType` volta a valer ao concluir.
  - O reteste se limita à troca rápida A → B → A no Histórico, mais a volta do resumo (posição mantida).

---

## Conclusão

- A seta e a restauração da posição não criam chamada de API nova, não logam nem persistem nada, e não trazem dependência nem `EXPO_PUBLIC_*`.
- O guarda por request id descarta as respostas atrasadas nos casos de volta do resumo, puxar para baixo e paginação.
- O **LOW #1** é a exceção: uma troca rápida A → B → A deixa a resposta de B valer sob o chip A. Não há vazamento entre usuários, mas é uma regressão funcional do Review Focus 3, latente enquanto só existir o tipo STRENGTH.
- O fix é 1 linha no frontend (`loadedType.current = null` no início do `loadFirst`). Recomendo aplicá-lo antes de entrar um segundo tipo de activity.
