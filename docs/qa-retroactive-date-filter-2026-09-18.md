# QA — Retroativo e Filtro de Datas (2026-09-18)

Escopo: branch `frontend/retroactive-date-filter` vs `main` (4 commits: `d5cbeae`, `92dfad3`, `2507b92`, `ee8db75`). 5 arquivos, só frontend: `MyDiet/index.tsx`, `MyDiet/styles.ts`, `app.json`, `package.json`/`package-lock.json` (nova dep `@react-native-community/datetimepicker`). Sem plano em `docs/superpowers/plans/2026-09-18-retroactive-date-filter.md` — arquivo não existe no repo nem no histórico; revisão feita a partir do diff + mensagens de commit. Revisão de código + `tsc --noEmit` + passada de usabilidade ao vivo via Maestri portal (`localhost:8081`) com `BackEndTorv` ativo na porta 3000.

## Revisão de código

**CRITICAL — `DateTimePicker` não tem implementação web; ícone de filtro é um no-op na plataforma declarada como suportada (`MyDiet/index.tsx:270-282`)**
`@react-native-community/datetimepicker` não tem arquivo `.web.js` (`node_modules/@react-native-community/datetimepicker/src/`). O Metro resolve para `datetimepicker.js` (genérico) em qualquer plataforma sem override, e esse arquivo é:
```js
export default function DateTimePicker(_props) {
  React.useEffect(() => { console.warn(`DateTimePicker is not supported on: ${Platform.OS}`); }, []);
  return null;
}
```
Ou seja: no build web, o componente sempre renderiza `null`. `app.json` declara `"web": { "favicon": ... }` — web é plataforma suportada — e é exatamente a plataforma servida pelo portal usado para QA (`localhost:8081`). Confirmado ao vivo: tocar o ícone de calendário não abre nada, tela permanece idêntica antes/depois (screenshots idênticos), nenhum overlay de erro. Toda a feature de filtro por data é inacessível nessa plataforma — bloqueia 100% do roteiro de QA pedido (abrir filtro, escolher data passada, ver semana).

**HIGH — valor inicial do picker usa `new Date(string)`, que interpreta `YYYY-MM-DD` como UTC (`MyDiet/index.tsx:272`)**
```js
value={filterDate ? new Date(filterDate) : new Date()}
```
`new Date("2026-09-15")` é meia-noite UTC. Em horário de Brasília (UTC-3) isso exibe **14/09 às 21h local**, um dia antes do `filterDate` real. Contraste direto com `getWeekOf` (linha 78-80), que evita exatamente esse bug fazendo `new Date(year, month-1, day)` a partir das partes — o padrão certo já existe no mesmo arquivo, só não foi reaproveitado aqui. Não verificável ao vivo (picker não renderiza no portal web, achado #1), mas reproduzível por leitura de código/console em qualquer engine JS.

**HIGH — chip "Hoje" reseta a tira de dias, mas não o dia selecionado nem os dados carregados (`MyDiet/index.tsx:250-259`)**
```js
onPress={() => setFilterDate(null)}
```
Isso só recalcula `displayedDates` (volta pros últimos 5 dias). `selectedDate` — o estado que decide qual card fica ativo e quais dados aparecem (calorias, macros, refeições) — não é tocado. Se o usuário estava vendo uma data retroativa de uma semana diferente dos "últimos 5 dias" e toca "Hoje", a tira volta ao normal mas nenhum card fica destacado como ativo e a tela continua mostrando os dados da data antiga, não os de hoje. Contradiz diretamente o passo pedido no roteiro ("tocar Hoje e confirmar reset"). Não verificável ao vivo neste portal porque o passo anterior (escolher uma data fora dos últimos 5 dias) depende do picker quebrado (achado #1); confirmado por leitura de código.

**MEDIUM — escolher uma data no picker não seleciona o dia, só troca a semana exibida (`MyDiet/index.tsx:275-280`)**
`onChange` chama só `setFilterDate(...)`, nunca `setSelectedDate(...)`. Mesmo que o picker funcionasse, escolher uma data mostraria a semana certa mas nenhum dia ficaria ativo/carregado até o usuário tocar de novo em um chip dentro da semana — dois toques onde o usuário provavelmente espera um. Pode ser intencional, mas vale confirmar com quem desenhou o fluxo.

**MEDIUM — bug de fuso pré-existente propagado para `getWeekOf` (`MyDiet/index.tsx:62-66`)**
`toDateEntry` usa `d.toISOString().split('T')[0]` sobre uma `Date` construída em horário local. Em UTC-3, qualquer horário local entre 21h e 23h59 vira o dia seguinte em UTC — a tira de dias (e o próprio `selectedDate` inicial, linha 50) mostra a data errada (adiantada em 1 dia) nesse intervalo, todo dia. Esse padrão já existia em `generateDates` antes deste diff (não é regressão nova), mas o refactor o copiou para dentro de `getWeekOf` em vez de corrigir. Não bloqueia este round (comportamento herdado), mas mora no mesmo arquivo que `getWeekOf` já resolve corretamente para o cálculo do domingo-âncora (linha 80) — inconsistência interna vale nota.

**Sem achados nos demais pontos do diff.** `logged_date` no POST (`index.tsx:165`) está correto e testado ao vivo (ver usabilidade). Backend já validava `logged_date` antes deste diff (`diet.controller.js:84-90`, não alterado aqui) — sem superfície nova de risco.

## `tsc --noEmit`

Mesmos 3 erros pré-existentes de rounds anteriores (`Login/index.tsx:69`, `MyDiet/index.tsx:117,119` — linhas deslocadas pelo diff, mesmo erro de sempre em `macros.protein`/`macros.fat`). Nenhum erro novo introduzido por este diff.

## Passada de usabilidade ao vivo (Maestri portal, `localhost:8081`, backend ativo na 3000)

**(a) Tira padrão de 5 dias sem filtro.** Confirmado: SEG 14, TER 15, QUA 16, QUI 17, SEX 18 (hoje), SEX 18 ativo. OK.

**(b) Abrir filtro de data → escolher data passada → confirmar semana domingo-sábado.** **Bloqueado.** Tocar o ícone de calendário não faz nada — ver achado CRITICAL acima. Não foi possível prosseguir com este passo do roteiro.

**(c) Tocar Hoje e confirmar reset.** **Não testável** — depende do passo (b), que está bloqueado.

**(d) Adicionar refeição num dia passado e confirmar persistência no resumo daquele dia.** Testado com um dia alcançável sem o picker (QUI 17, dentro da tira padrão, já que a data anterior a 17/09 não é alcançável sem o filtro): refeição "QA Retroativo Teste" (200 kcal) adicionada com QUI 17 selecionado → total do dia foi de 650→850 kcal, macros atualizaram, refeição apareceu na lista. Trocar para SEX 18 (hoje) e voltar confirmou isolamento por dia: hoje continuou em 0/2000 kcal, sem vazamento; QUI 17 manteve a refeição nova junto das duas pré-existentes. `logged_date` funcionando corretamente para dias dentro da tira. Refeição de teste removida ao final (cleanup).

## Veredito

**FAIL.** Achado CRITICAL bloqueia a feature inteira na plataforma web (que é a mesma usada para QA e está declarada como suportada em `app.json`) — sem picker funcional, os passos (b) e (c) do roteiro não puderam ser executados. Dois achados HIGH adicionais (fuso do valor inicial do picker; chip "Hoje" não reseta `selectedDate`) confirmados por leitura de código e prontos para reprodução assim que o picker estiver acessível.

**Não libera para Security.** Rework escopado ao frontend (`torv-frontend`), `MyDiet/index.tsx`:
1. Resolver o gap de plataforma do `DateTimePicker` no web (ex.: `Platform.select` com `<input type="date">` nativo do browser, ou equivalente) — sem isso a feature não existe nessa plataforma.
2. Trocar `new Date(filterDate)` por parse local (mesmo padrão de `getWeekOf`) no `value` do picker.
3. Fazer o chip "Hoje" também chamar `setSelectedDate(todayISO)`, não só `setFilterDate(null)`.
4. Decidir e, se necessário, corrigir se `onChange` do picker deve chamar `setSelectedDate` junto com `setFilterDate`.

Novo round de teste necessário depois do rework (`qa-retroactive-date-filter-2026-09-18-round2.md`).
