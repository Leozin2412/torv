# Security Review — DatePicker custom TORV (Round 2)

- **Data:** 2026-09-28
- **Branch:** `perf/api-latency` (código da feature **não commitado**, working tree)
- **Escopo (delta desde o round 1):**
  - `FrontEndTorv/src/components/DatePickerModal/index.tsx` e `styles.ts`: v2 com modo `'months'` (grade Jan..Dez), setas de ano e clamp em `maxDate`
  - `docs/qa-datepicker-custom-2026-09-28-round3.md` (commit local `119fc7e`, que só tem esse arquivo)
- **Anterior:** round 1, `docs/security-datepicker-custom-2026-09-28.md`: PASS (1 LOW pré-existente e 3 INFO)
- **Pré-condição:** QA `qa-datepicker-custom-2026-09-28-round3.md`: PASS
- **Lente:** OWASP Top 10 (A01, A03, A04, A06, A08), mais segredos e dados de teste
- **Veredito: PASS.**
  - O delta não introduz vulnerabilidade nem dependência.
  - Os 4 achados do round 1 seguem iguais, e o LOW #1 ganhou só uma nota de alcance.
  - Não há segredo nem dado de teste novo no código ou no relatório de QA.

Nenhum segredo foi impresso, nenhuma conta foi criada e nada foi escrito no banco.

---

## Delta: verificado OK

- **A saída de dados não mudou.**
  - O único caminho para fora do modal continua sendo `onConfirm(selected)` (`DatePickerModal/index.tsx:174`).
  - `selected` só muda em dois lugares: `setSelected(iso)` num dia habilitado (`:149`, com `disabled={isDisabled}` em `:150`) e o reset para `value` ao reabrir (`:37`).
  - O modo meses só mexe em `month` e `mode` (`:111-112`), nunca em `selected`. Escolher um mês não gera data.
  - O uso em `MyDiet/index.tsx:324-335` e as chamadas `GET /diet/summary` (`:148`) e `POST /diet` (`:214`) estão idênticas às do round 1.
- **O clamp é UX, não controle.** `shift()` (`:52-55`) prende `month` em `firstOfMonth(maxDate)` e `nextStart` (`:48`) desabilita "Próximo ano". Como no round 1, a barreira real é o backend (achado #1).
- **Injeção e renderização (A03).**
  - Os textos novos vêm só de constantes (`MONTHS` + `capitalize`, `:17`, `:122`, `:127`) e de números (`year`, `:86`).
  - Não há HTML, input de texto nem dado do servidor. `capitalize` só recebe nomes de mês não vazios.
- **Datas fora do formato continuam fail-closed.**
  - Agora dá para recuar um ano por toque. Mesmo assim, anos 100–999 viram string de 3 dígitos em `toISODate` (`999-01-01`), e o Ajv `format: 'date'` do backend devolve 400.
  - A menor data válida que se alcança pela UI é `1000-01-01`, com 1026 toques.
- **Dependências (A06/A08).**
  - Não há dependência nova. `ChevronDown`/`ChevronUp` vêm do `lucide-react-native` que já está instalado e que o `.d.ts` já exporta.
  - `package.json`, `package-lock.json` e `app.json` têm o mesmo diff do round 1: o stat é idêntico (1/122/5 linhas) e o mtime (10:51–10:52) é anterior à revisão do round 1.
  - O `npm audit` rodado de novo segue em 16 (13 moderate, 3 high).
- **`styles.ts`:** só entraram `modeToggle`, `monthCell` e `monthPill`, que são layout.
- **Segredos e dados de teste:**
  - `gitleaks dir` (8.30.1) sobre `DatePickerModal/*`, o QA round 3 e o patch de `119fc7e`: `no leaks found`.
  - `gitleaks git --log-opts=5c6ecd6..119fc7e`: `no leaks found`.
  - Um grep por `20XX-XX`, `QA`, `torvtest` e `@` no código do modal e em `utils/date.ts` não achou nada. Não há data nem valor de teste fixo no código.
  - O script `date-edge-months.mts` citado pelo QA **não** ficou no repositório (`find` sem resultado).

---

## Achados do round 1: status

| # | Sev | Achado | Status neste round |
|---|---|---|---|
| 1 | LOW (pré-existente, backend fora do diff) | `POST /diet` `logged_date` sem limite inferior. O superior é por instante UTC e aceita D+2 em BRT depois das 21h (`diet.controller.js:92-100`) | **Igual.** `BackEndTorv/src` não mudou (`git status`/`git diff HEAD` vazios) e as linhas 92–100 são idênticas. **Nota de alcance:** a v2 torna datas antigas mais fáceis de alcançar pela UI oficial. Chegar a 1900 levava ~1520 toques (mês a mês) e agora leva ~126 (ano a ano). O impacto continua só nos dados do próprio usuário, então segue LOW e fica no backlog do Torv Backend |
| 2 | INFO (pré-existente) | `npm audit` 16 (13 moderate, 3 high), com `axios@1.17.0` < 1.18.0 como o único em runtime | **Igual.** Rodado de novo: `{"moderate":13,"high":3,"total":16}` |
| 3 | INFO | Lockfile íntegro, troca de publisher verificada, versões recém-publicadas | **Igual.** O lock não mudou desde o round 1 e não há entrada nova |
| 4 | INFO | Os relatórios de QA citam a conta sintética `qa.datepicker.1790604006@torvtest.dev` (NXDOMAIN), e a conta segue no Auth | **Igual.** O round 3 cita a mesma conta e o prefixo truncado `095cce82-…` de uma refeição já apagada (15/03/2024). Não há senha, token nem `Authorization` |

Fora da lente de segurança (UX/a11y, já registrados pelo QA round 3): a sobreposição de 5,1 px dos dias em 320 px (`styles.ts:30`) e o `aria-selected` em `role="button"` no web.

---

## Backlog acumulado (só anotado)

Sem mudança em relação ao round 1: veja a tabela em `docs/security-datepicker-custom-2026-09-28.md`. O único acréscimo é a nota de alcance do #1 acima, que reforça a prioridade do limite inferior de `logged_date` no `addFoodLog`.
