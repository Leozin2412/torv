# Security Review: Histórico, seta de voltar e posição da lista (Round 2)

- **Data:** 2026-10-02
- **Branch:** `feat/workout-module`
- **Escopo:** só o rework do **LOW #1** do round 1, no commit `fc01ea3`. É uma linha em `FrontEndTorv/src/screens/Workouts/History.tsx:41`: `loadedType.current = null` no início do `loadFirst`. O diff `7b6c532..ad915ea` tem só essa linha de código e o relatório de QA.
- **Round 1:** `docs/security-workout-history-backarrow-2026-10-02.md` (`7b6c532`), PASS com 1 LOW. Numa troca rápida A → B → A, o atalho do foco (`loadedType === type` → `refreshTop`) deixava a resposta de B valer sob o chip A.
- **Pré-condição:** reteste PASS (`docs/qa-workout-history-backarrow-2026-10-02-round2.md`, `ad915ea`).
- **Veredito: PASS.** O **LOW #1 está fechado** e não há achado novo.

Não imprimi nenhum segredo e não usei token no shell. Também não abri portal, não fiz request ao backend e não gravei nada no banco.

---

## Simulação determinística, agora com o código commitado

No round 1, a simulação usava uma cópia manual das funções. Neste round, o script lê o **fonte commitado** de `History.tsx` com `git show <rev>:…`, do `const loadFirst` até antes de `const chips` (linhas 38-100), e remove os tipos com `module.stripTypeScriptTypes` do Node 24. Assim, o que roda é exatamente o texto de cada commit.

- **Modelo do React:**
  - cada "render" avalia o trecho de novo, com closures novas e o estado atual;
  - os refs persistem entre renders;
  - os setters aceitam forma funcional;
  - o `useFocusEffect(useCallback(fn, [type]))` dispara quando o `type` muda (tela focada) ou num evento de foco;
  - tocar no chip já ativo não re-renderiza.
- **Dados:** o `prependNew` é o real, de `src/utils/historyGroups.ts`. A API é feita de promessas resolvidas, ou rejeitadas, na ordem escolhida.
- **Detecção de mistura:** cada resposta marca os itens e o `next_before` com o filtro que a gerou. Há mistura quando algum item, ou o cursor, tem marca diferente do chip ativo.
- O mesmo script roda no `dc84bc9`, antes do fix, e no `fc01ea3`, depois.

### Cenários dirigidos

| Cenário | `dc84bc9` (round 1) | `fc01ea3` (fix) |
|---|---|---|
| Todos → Musculação → Todos; Musculação chega antes | ❌ mistura: itens de Todos e de Musculação. O `loadMore` pede `type=Todos` com o cursor de **Musculação** | ✅ só itens de Todos. O `loadMore` pede `type=Todos` com o cursor de **Todos** |
| Idem, com Todos chegando antes | ❌ mistura | ✅ só itens de Todos, e o cursor certo |
| Musculação → Todos → Musculação, nas 2 ordens | ❌ mistura nas 2. O `loadMore` pede `type=STRENGTH` com o cursor de Todos | ✅ só itens de Musculação, com `loadMore(type=STRENGTH, before=<cursor de Musculação>)` |
| Volta do resumo com o mesmo filtro carregado | ✅ `refreshTop`: o request id não muda, o status fica `ready` (sem spinner) e o `scrollTo(2093)` repõe o `offset` | ✅ **igual**: o fluxo principal da feature não mudou |
| Erro na 1ª carga | ✅ status `error`, e o próximo foco faz `loadFirst` | ✅ igual |
| Puxar para baixo (`loadFirst(type, true)`) | ✅ lista continua na tela, status `ready`, sem mistura | ✅ igual. **Única diferença:** um foco *durante* o pull agora faz `loadFirst` (spinner) em vez de `refreshTop`. É o comportamento seguro: a carga em andamento é a única válida |

### Fuzz

Rodei 4 seeds (mulberry32) × 5.000 sequências × 20 ações aleatórias. As ações são trocar de chip, foco, `loadMore` e puxar para baixo, com respostas chegando fora de ordem e 10% de falhas de rede. No fim, todas as respostas pendentes são liberadas em ordem aleatória.

| | `dc84bc9` | `fc01ea3` |
|---|---|---|
| Sequências com a tela `ready` misturada em algum passo | 859 / 20.000 | **0 / 20.000** |
| Sequências misturadas no fim | 1.464 / 20.000 | **0 / 20.000** |

O mesmo fuzz acha o defeito no código antigo e nada no novo, então a linha fecha a classe inteira de corridas, e não só as 4 sequências dirigidas.

**Nota de método:** a primeira versão do fuzz usava os bits baixos de um LCG, que alternam e geram sequências quase fixas. Ela deu 0 nos dois commits. Troquei por mulberry32 antes de confiar no resultado. Com isso o fuzz passou a distinguir os dois commits: só os números acima valem.

**Confirmação ao vivo pelo QA round 2:** o QA usou um shim na página que atrasa e marca as respostas. Nas 4 sequências (A → B → A e B → A → B, nas duas ordens de chegada), a resposta do chip abandonado foi descartada. O `loadMore` seguinte pediu o `type` e o `before` do chip final (por exemplo `/activities?type=STRENGTH&before=2026-09-08T10:00:00.000Z&limit=20`), e a volta do resumo ficou no mesmo ponto.

## O fix não abre nada novo ✅

- **Uma linha, só estado em memória.** O `loadedType` é um `useRef`, e o fix só o anula enquanto uma carga do zero está em voo. Não há chamada de API nova, nem parâmetro novo, nem log, nem storage.
- **Os guardas antigos continuam iguais.** O `request.current` é incrementado só no `loadFirst`. O `refreshTop` e o `loadMore` comparam o id. O `catch` do erro também anula o `loadedType`, e o `finally` só limpa o `refreshing` da carga vigente.
- **O pior efeito colateral é uma carga a mais.** Se um foco acontece com uma carga em voo, o atalho é trocado por um `loadFirst`. Isso custa no máximo um `GET /activities?limit=20` a mais, do próprio usuário, na rota já revisada, que tem `limit` ≤ 50.
- **O escopo ficou contido.** Não há dependência, `EXPO_PUBLIC_*`, backend nem outra tela.
- **Testes:** `node --test src/utils/*.test.mjs` passa 18/18, e `npx tsc --noEmit` termina com exit 0.

---

## Conclusão

O LOW #1 está fechado. Com o fonte commitado, as 4 trocas rápidas que misturavam listas no `dc84bc9` ficam limpas no `fc01ea3`, com o `loadMore` usando o cursor do filtro certo. O fuzz de 20.000 sequências passa de 1.464 misturadas para 0. A volta do resumo continua no mesmo ponto, sem spinner, e o fix não abre superfície nova. Com o QA round 2 e este Security round 2 verdes, o ajuste da seta e da posição do Histórico está pronto.
