# QA — Retroativo e Filtro de Datas — Round 2 (2026-09-18)

Escopo: rework do round 1 (`docs/qa-retroactive-date-filter-2026-09-18.md`). Commit `2eefafb` (`fix(diet): make date filter work on web, fix Hoje reset and picker timezone/selection`) + merge `30abc49` (só trouxe docs de `main`, sem impacto no diff avaliado). Único arquivo alterado: `FrontEndTorv/src/screens/MyDiet/index.tsx`. Revisão de código + `tsc --noEmit` + repasse completo do roteiro de usabilidade que ficou bloqueado no round 1, via Maestri portal (`localhost:8081`) com `BackEndTorv` ativo na porta 3000.

## Revisão de código — os 3 achados do round 1

**CRITICAL (picker sem build web) — RESOLVIDO.** `Platform.select` adicionado (linhas ~277-311): ramo `web` renderiza `<input type="date">` nativo do browser; ramo `default` mantém o `DateTimePicker` original para iOS/Android, inalterado. `app.json` continua declarando web como plataforma suportada — agora a feature existe de fato lá.

**HIGH (fuso no `value` do picker) — RESOLVIDO.** `parseLocalDate` extraído (linha 78-81) a partir do parsing que só `getWeekOf` tinha, e reaproveitado tanto no `value` do `DateTimePicker` nativo (`parseLocalDate(filterDate)`, linha ~301) quanto em `getWeekOf`. `new Date(string)` (que lia como UTC) não aparece mais nesse caminho. Único `new Date(string)`-like remanescente é o `toISOString().split('T')[0]` do "hoje"/limite máximo — é o mesmo padrão pré-existente já anotado como MEDIUM não-bloqueante no round 1 (drift de fuso só entre 21h-23h59 local), não fazia parte do escopo pedido para este fix e não regride nada.

**HIGH (chip "Hoje" não resetava `selectedDate`) — RESOLVIDO.** `onPress` do chip agora chama `setFilterDate(null)` **e** `setSelectedDate(new Date().toISOString().split('T')[0])` (linha ~256-259). Confirmado ao vivo abaixo.

**Bônus (não pedido, mas relatado como MEDIUM no round 1): seleção no picker exigia 2 toques.** Corrigido também — tanto o `onChange` do `input` web quanto do `DateTimePicker` nativo agora chamam `setFilterDate` e `setSelectedDate` juntos, então escolher uma data já carrega o dia direto, sem precisar tocar de novo num chip da semana.

**Nenhum bug novo introduzido.** Diff é cirúrgico, só toca os 3 pontos apontados + o bônus; resto do arquivo intacto.

## `tsc --noEmit`

Mesmos 3 erros pré-existentes de sempre (`Login/index.tsx:69`, `MyDiet/index.tsx:121,123` — linhas deslocadas pelo diff, mesmo erro de sempre em `macros.protein`/`macros.fat`). Nenhum erro novo, inclusive o `<input type="date">` cru dentro do TSX compilou limpo.

## Passada de usabilidade ao vivo (Maestri portal, `localhost:8081`, backend ativo na 3000) — roteiro completo desta vez

**(a) Tira padrão de 5 dias sem filtro.** SEG 14, TER 15, QUA 16, QUI 17, SEX 18 (hoje), SEX 18 ativo, vazio. OK.

**(b) Abrir filtro → escolher data retroativa fora dos últimos 5 dias → semana domingo-sábado certa → dia escolhido já carregado.** Escolhido `2026-09-03` (quinta-feira) via `<input type="date">` — que agora aparece no DOM (achado CRITICAL confirmado corrigido). Semana exibida: DOM 30/08, SEG 31/08, TER 01/09, QUA 02/09, QUI 03/09, SEX 04/09 (SÁB 05/09 fora da viewport, mas na tira — scroll horizontal). Domingo-sábado corretos. **QUI 3 já veio com o card ativo (borda verde) e dados carregados (0/2000 kcal, sem precisar de segundo toque)** — confirma o fix do "2 toques" também.

**(c) Tocar Hoje → reset completo, incluindo card ativo.** Antes de testar, adicionei uma refeição de teste em QUI 3 (ver item (d)) pra garantir que "Hoje" não deixaria dado antigo na tela por acidente. Depois de tocar "Hoje": tira voltou a SEG 14 - SEX 18, **SEX 18 (hoje) veio destacado como ativo**, dados voltaram a 0/2000 kcal e "Nenhuma refeição ainda" — nenhum resquício da refeição de QUI 3. Chip "Hoje" também sumiu (filtro limpo). Reset completo confirmado, resolve o achado HIGH do round 1.

**(d) Adicionar refeição num dia passado (fora dos últimos 5 dias) e confirmar persistência.** Com QUI 3 (02026-09-03) selecionado via filtro: refeição "QA Round2 Retroativo" (300 kcal, P15/C30/G8) salva → total do dia foi de 0→300 kcal, macros bateram exatamente com o formulário, refeição apareceu na lista. Voltar pra "Hoje" e checar SEX 18: seguiu em 0/2000 kcal, sem vazamento entre dias. Refeição de teste removida ao final (cleanup, via o mesmo fluxo de filtro).

## Veredito

**PASS.** Os 3 achados do round 1 (1 CRITICAL, 2 HIGH) confirmados corrigidos por leitura de código e reproduzidos ao vivo. Roteiro completo de usabilidade — inclusive os passos (b) e (c) que ficaram bloqueados no round anterior — executado do início ao fim sem achados novos. `tsc` limpo (mesmos erros pré-existentes, nada novo). Diff do fix é escopado e não introduz regressão.

**Libera para Security.**
