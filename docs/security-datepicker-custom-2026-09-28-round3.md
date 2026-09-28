# Security Review — DatePicker custom TORV (Round 3)

- **Data:** 2026-09-28
- **Branch:** `perf/api-latency` (código da feature **não commitado**, working tree)
- **Escopo (delta desde o round 2):**
  - `FrontEndTorv/src/components/DatePickerModal/index.tsx` e `styles.ts`, v3:
    - modo `'years'`: grade de 12 anos paginada e ancorada no ano de `maxDate`, setas de 12 em 12 e `clampToMax` ao escolher o ano
    - JSX de pill compartilhado entre meses e anos
    - layout de 320 pt: `aspectRatio`, `navPrev`/`navNext`, `numberOfLines`, `hitSlop`
  - QA rounds 4–6: `docs/qa-datepicker-custom-2026-09-28-round{4,5,6}.md` (commits `7ca13d3`, `fd8ae76`, `67fe856`, `f1af2e6`, cada um só com o próprio `.md`)
- **Anterior:** round 2, `docs/security-datepicker-custom-2026-09-28-round2.md`: PASS
- **Pré-condição:** QA round 6 verde, exceto o item 1c. O 1c (320 pt: um toque logo à direita da seta anterior cai no rótulo) foi aceito pelo Maestro como limitação conhecida LOW de UX, fora da lente de segurança.
- **Lente:** OWASP Top 10 (A01, A03, A04, A06, A08), mais segredos e dados de teste
- **Veredito: PASS.**
  - O delta não introduz vulnerabilidade nem dependência.
  - Há 1 INFO novo (#5): a grade de anos não tem piso, e datas malformadas são recusadas pelo backend (fail-closed).
  - Os achados do round 1 seguem iguais, e o LOW #1 teve o alcance pela UI atualizado.
  - Não há segredo nem dado de teste novo.

Nenhum segredo foi impresso, nenhuma conta foi criada e nada foi escrito no banco. As contagens de toques abaixo vêm de uma simulação em Node da lógica pura do componente (`:61-72`, `:118-128`) com o `utils/date.ts` real, não de testes na UI.

---

## Delta: verificado OK

- **A saída de dados não mudou.**
  - O único caminho para fora continua sendo `onConfirm(selected)` (`DatePickerModal/index.tsx:241`).
  - `selected` só muda em dois lugares: `setSelected(iso)` num dia habilitado (`:216`, com `disabled` em `:217`) e o reset ao reabrir (`:44`).
  - Os modos meses e anos só mexem em `month`, `mode` e `yearPageEnd` (`:65`, `:72`, `:113-114`, `:128-129`). Escolher um mês ou ano não gera data.
  - `MyDiet` e as chamadas à API continuam idênticas às dos rounds 1 e 2.
- **Os clamps são UX, não controle.**
  - `clampToMax` (`:61`) prende `month` em `firstOfMonth(maxDate)`.
  - Na grade de anos, `nextDisabled: yearPageEnd >= anchor` (`:97`) e `isDisabled: y > anchor` (`:126`).
  - A barreira real continua sendo o backend (#1).
  - Um `Date` inválido (ano fora de ±271821) vira `"NaN-NaN-NaN"`, que é maior que `maxDate` em comparação de string, então também é preso no mês de `maxDate` (fail-safe).
- **Injeção e renderização (A03).** Os textos novos são números (`String(y)`, `` `${yearPageEnd - 11} – ${yearPageEnd}` ``) e constantes. Não há HTML, input de texto nem dado do servidor.
- **Estado.** O `yearPageEnd` não é resetado ao reabrir, mas é recalculado a partir de `year` toda vez que se entra no modo anos (`:72`). Não sobra estado de uma abertura para a outra.
- **`styles.ts`.** Só layout: margens negativas, `aspectRatio` e `flexShrink`. O item 1c do QA é sobreposição de área de toque entre a seta e o rótulo, dentro do próprio modal. Isso é usabilidade, não tapjacking: não há outro app nem outra origem envolvida.
- **Dependências (A06/A08).**
  - Não há dependência nova.
  - `package.json`, `package-lock.json` e `app.json` estão iguais aos do round 1: stat idêntico e mtime 10:51–10:52.
  - O `npm audit` rodado de novo segue em `{"moderate":13,"high":3,"total":16}`.
- **Segredos e dados de teste.**
  - `gitleaks dir` (8.30.1) sobre `DatePickerModal/*` e os QA 4–6: `no leaks found`.
  - `gitleaks git --log-opts=119fc7e..f1af2e6`: `no leaks found`.
  - Um grep nos QA 4–6 por senha, token, JWT, URL, IP, e-mail e UUID só achou a conta sintética `qa.datepicker.1790604006@torvtest.dev` (NXDOMAIN) e o prefixo truncado `3aaaf2a3-…` de uma refeição já apagada (round 4, 15/03/2010). Os rounds 5 e 6 não semearam dados.
  - O código do modal não tem data nem valor de teste fixo, e não há script de edge case solto no repositório.

---

## 5. INFO (novo): a grade de anos não tem piso

A seta "Anos anteriores" (`:65`) decrementa `yearPageEnd` sem limite. Pela UI, com a página inicial ancorada em 2026:

| Ano escolhido | Toques em "Anos anteriores" | O que vira | `GET`/`POST` no backend |
|---|---|---|---|
| 1900 | 10 | `1900-01-15` | 200 (grava, ver #1) |
| 1000 | 85 | `1000-01-15` | 200 (grava, ver #1) |
| 100–999 | 85–160 | `999-01-15` (ano sem zero à esquerda) | **400** |
| 0–99 | 160–168 | `new Date(50, …)` vira **1950** (mapeamento legado do JS) | 200, mas no ano errado (bug de UX) |
| ≤ −1 | ≥ 169 | `-5-01-15` | **400** |

- **O resultado é fail-closed.** Todo ano que gera string fora de `YYYY-MM-DD` é recusado pelo Ajv (`diet.routes.js:40`, `:77`).
- **No cliente, o efeito é só visual.** O `MyDiet` guarda a string malformada, e `parseLocalDate('-5-01-15')` monta a faixa semanal em 1900 (`Number('')` = 0 vira 1900).
  - O `GET` falha, e o `catch` (`MyDiet/index.tsx:150-152`) zera as métricas: o dia aparece vazio, sem crash.
  - O `POST` devolve 400.
  - O `console.log(error)` nesse `catch` é o INFO pré-existente de `AxiosError` no log (calorie-calculator rounds 1–5).
- **Ação (opcional, junto do #1):** uma prop `minDate` no modal (por exemplo `1900-01-01`, ou a data de cadastro), para desabilitar "Anos anteriores" quando `yearPageEnd - 11 <= ano(minDate)` e os dias antes dela. É defesa em profundidade e resolve também o bug de 0–99. O controle de verdade continua sendo o limite inferior no backend.

---

## Achados anteriores: status

| # | Sev | Achado | Status neste round |
|---|---|---|---|
| 1 | LOW (pré-existente, backend fora do diff) | `POST /diet` `logged_date` sem limite inferior. O superior é por instante UTC e aceita D+2 em BRT depois das 21h (`diet.controller.js:92-100`) | **Igual no código.** `BackEndTorv/src` não mudou (`git status`/`git diff HEAD` vazios). **O alcance pela UI subiu de novo:** chegar a 1900 levava ~1520 toques no round 1, ~126 no round 2 e agora leva **10** (+ ~5 para alternar os modos e confirmar). `1000-01-01` sai com 85. O impacto continua só nos dados do próprio usuário (streak e ranking vêm de `activities`), então segue **LOW**. Mas deixou de ser um caminho "só por cliente HTTP": a própria UI oferece datas absurdas em poucos toques, então a prioridade deste item no backlog do Torv Backend sobe |
| 2 | INFO (pré-existente) | `npm audit` 16 (13 moderate, 3 high), com `axios@1.17.0` < 1.18.0 como o único em runtime | **Igual** (rodado de novo) |
| 3 | INFO | Lockfile íntegro, troca de publisher verificada | **Igual.** O lock não mudou desde o round 1 |
| 4 | INFO | Os relatórios de QA citam a conta sintética `@torvtest.dev`, e a conta segue no Auth | **Igual.** Os QA 4–6 citam a mesma conta e o prefixo `3aaaf2a3-…`. Não há senha, token nem `Authorization` |

Fora da lente de segurança (UX, aceito pelo Maestro): o item 1c do QA round 6, em que em 320 pt o toque à direita da seta anterior cai no rótulo.

---

## Backlog acumulado (só anotado)

| Origem | Sev | Item |
|---|---|---|
| round 1 #1 (prioridade maior neste round) | LOW | `addFoodLog`: limite inferior para `logged_date` e comparação por data no limite superior |
| este round #5 | INFO | Prop `minDate` no `DatePickerModal` (piso na grade de anos e nos dias) |
| demais | — | Sem mudança: veja a tabela de backlog em `docs/security-datepicker-custom-2026-09-28.md` |
