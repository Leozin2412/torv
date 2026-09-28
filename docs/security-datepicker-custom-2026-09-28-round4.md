# Security Review — DatePicker custom TORV (Round 4)

- **Data:** 2026-09-28
- **Branch:** `perf/api-latency` (código da feature **não commitado**, working tree)
- **Escopo (delta desde o round 3):** regra de negócio "nenhum registro de dieta antes de 2026-01-01"
  - `BackEndTorv/src/controller/diet.controller.js`: `MIN_DIET_DATE` (`:4`) e 400 em `addFoodLog` quando `logged_date < MIN_DIET_DATE` (`:99-102`). É a **primeira mudança de backend** da feature.
  - `FrontEndTorv/src/components/DatePickerModal/index.tsx`: prop `minDate`, `isOutside`, `prevDisabled` e `clampMonth`
  - `FrontEndTorv/src/screens/MyDiet/index.tsx`: `MIN_DIET_DATE`, `minDate` no modal e faixa filtrada
  - QA round 7: `docs/qa-datepicker-custom-2026-09-28-round7.md` (commit `ad500e0`, só esse arquivo)
- **Anterior:** round 3, `docs/security-datepicker-custom-2026-09-28-round3.md`: PASS
- **Pré-condição:** QA round 7: PASS (backend + frontend)
- **Lente:** OWASP Top 10 (A01, A03, A04, A06, A08), mais segredos e dados de teste
- **Veredito: PASS.**
  - O **limite inferior do LOW #1 está resolvido** e foi verificado contra as rotas e o controller reais.
  - O que sobra do #1 (limite superior em UTC) foi **reclassificado para INFO**.
  - A comparação de strings **não dá para contornar**, e o `PUT` não altera a data.
  - Não há segredo nem dado de teste novo.
  - Há 1 achado **fora do diff** que afeta o próximo commit: fotos de perfil sem `.gitignore` (#6).

Nenhum segredo foi impresso, e a `DATABASE_URL` não saiu no output. Não criei conta. As únicas consultas ao banco foram 3 `SELECT` só de leitura, como `torv_api` (contagens e as 2 contas de teste do escopo).

---

## #1 LOW → resolvido (inferior) / INFO (superior)

### Limite inferior: resolvido ✅

Rodei o `diet.routes.js` e o `diet.controller.js` **reais**, registrados num Fastify 5.12.4 via `inject`. Só o repository, o `nutritionSuggestion` e o `auth.middleware` foram trocados por stubs em memória, sem banco.

| `logged_date` no `POST /diet` | Status | Onde parou |
|---|---|---|
| `2025-12-31`, `1999-12-31`, `0001-01-01` | 400 | controller: `cannot be before 2026-01-01` |
| `2026-01-01` | 201 | gravado como `2026-01-01` |
| `["2025-12-31"]` (array de 1) | 400 | o Ajv (`coerceTypes: 'array'`) converte para string, e o mínimo pega |
| `["2026-05-01"]` | 201 | convertido para `"2026-05-01"`, que é válido e canônico |
| `20251231` (número), `""`, `null` | 400 | Ajv (`format: 'date'`) |
| `"2025-12-31 "`, `" 2026-05-01"`, `"2025-12-31\n"` | 400 | Ajv: o regex tem âncoras, e em JS o `$` não casa antes de `\n` |
| `"２０２５-12-31"` (full-width), `"٢٠٢٥-12-31"` (arábico-índico) | 400 | Ajv: `\d` sem a flag `u` só aceita ASCII |
| `"+2025-12-31"`, `"2026-1-01"`, `"2025-12-31T00:00:00Z"` | 400 | Ajv |
| `"2026-02-29"` (2026 não é bissexto) | 400 | Ajv (modo full valida o calendário) |
| ausente | 201 | padrão: hoje (UTC), `2026-09-28` ≥ mínimo |

- **A comparação de strings é segura.** O único formato que chega ao controller é `^\d{4}-\d{2}-\d{2}$` ASCII, com data de calendário real. Com ano de 4 dígitos, mês e dia com zero à esquerda, a ordem lexicográfica é igual à cronológica.
- **O comentário em `:99` se confirma:** qualquer forma não canônica morre no schema (`diet.routes.js:77`) antes do controller.
- **Outros caminhos de escrita de `logged_date`:**
  - **`PUT /diet/:logId` não altera a data.** Um teste com o body `{food_name:'y', logged_date:'2020-01-01'}` devolveu 200, e o repository recebeu só `{"food_name":"y"}`. O controller desestrutura só `food_name`/`calories`/`macros_json` (`diet.controller.js:128`, `:140`), e o `updateMany` só grava esses 3 campos (`diet.repository.js:69-79`).
  - O `POST` (`fn_log_food_and_return_remaining`, `diet.repository.js:44-47`) é o **único** caminho de escrita da data na aplicação.
  - No banco, `anon`/`authenticated`/PUBLIC não têm grant em tabela nem EXECUTE em função (anon-exposure round 2 e api-latency round 1), então não há caminho via PostgREST.
- **Estado atual do banco:** `food_logs` tem 201 linhas, com **0** antes de 2026-01-01 e **0** depois de amanhã. Não há legado que contradiga a regra.
- **Constante duplicada** no front (`MyDiet/index.tsx:18`) e no back (`diet.controller.js:4`). Se divergirem, o backend é a autoridade na escrita: um front mais permissivo só leva a 400. Aceitável.

### Limite superior: LOW → **INFO**

- Não mudou: `new Date(logged_date) > Date.now() + 24h` (`diet.controller.js:103`). No teste, às ~14h BRT, `2026-09-29` deu 201 e `2026-09-30` deu 400. Das 21h às 23h59 BRT, ainda aceita D+2 no fuso do usuário.
- **Por que INFO:** o ganho é limitado a 1–2 dias no futuro, só nos dados do próprio usuário, e streak e ranking vêm de `activities`, não de `food_logs`. O front já prende em hoje (`maxDate`). O banco tem 0 linhas depois de amanhã.
- **Ação opcional (inalterada):** comparar a string com `tomorrowUTC` em vez do instante. Isso fecha o D+2 e deixa a regra simétrica à do mínimo.

---

## Frontend: verificado OK

- **A saída não mudou.** A data só sai por `onConfirm(selected)` (`DatePickerModal/index.tsx:258`), e `selected` só muda num dia habilitado (`:233`, com `disabled={isOutside(iso, iso)}` em `:229`/`:234`) ou no reset (`:48`).
- **O piso fecha o INFO #5 do round 3 para o MyDiet**, o único chamador (`MyDiet/index.tsx:326-337`, `minDate={MIN_DIET_DATE}`):
  - `prevDisabled` nos 3 modos (`:95`, `:103`, `:111`)
  - pílulas de mês e ano com `isOutside` (`:126`, `:141`)
  - `clampMonth` nas duas pontas (`:68-73`)
  - Na grade `2015 – 2026` só 2026 fica habilitado e as duas setas desabilitadas (QA 2c). Os anos < 1000, negativos e 0–99 do round 3 deixam de ser alcançáveis.
  - Tudo isso continua sendo **UX**. O controle é o backend, verificado acima.
- **Faixa semanal** (`MyDiet/index.tsx:113`, `.filter(fullDate >= MIN_DIET_DATE)`): só apresentação.
- **Injeção e renderização:** o código novo só produz strings de constantes, números e `toISODate`. Não há HTML nem dado do servidor.
- **Dependências:** não há nova. `package*.json` e `app.json` têm o mesmo mtime (10:51–10:52) e o mesmo stat do round 1, e o `npm audit` rodado de novo segue em 16 (13 moderate, 3 high). O backend não teve mudança de dependência (`BackEndTorv/package*.json` sem modificação).

---

## Segredos e dados de teste

- **gitleaks 8.30.1:**
  - `dir` sobre o diff do delta (backend + MyDiet), `DatePickerModal/*` e o QA round 7: `no leaks found`
  - `git --log-opts=f1af2e6..ad500e0`: `no leaks found`
- **QA round 7:**
  - Cita as contas sintéticas `qa.datepicker.1790604006@torvtest.dev` e `claude.dietmin.1790614803689@torvtest.dev` (domínio NXDOMAIN) e os prefixos truncados `6b2ffa18-…`/`c2064c86-…` de refeições apagadas.
  - Um grep por senha, token, JWT, URL, IP e UUID completo não achou nada. PIDs e portas locais não são sensíveis.
- **Contas (consulta de leitura como `torv_api`):**

  | Conta | Criada | `food_logs` |
  |---|---|---|
  | `claude.dietmin.1790614803689@torvtest.dev` (Torv Backend) | 2026-09-28 | **0** |
  | `qa.datepicker.1790604006@torvtest.dev` (Review and Tests) | 2026-09-28 | **0** |

  - A senha da `claude.dietmin` **não aparece** em nenhum arquivo do repositório, incluindo `.maestri/`, `.claude/`, `graphify-out/`, `orchestration.md` e `docs/`. A única referência é o QA round 7.
  - Não verifiquei o terminal do Torv Backend, que não está conectado a este recruta.
  - O servidor de verificação em `:3001` **não está mais escutando**.
- **Resíduo:** há 13 contas `@torvtest.dev` no total, e o item de limpeza segue no backlog (INFO #4).
- Não há script de edge case (`date-edge-*.mts`) solto no repositório.

---

## #6 (novo, fora do diff): fotos de perfil sem `.gitignore`

- **Sev:** LOW (pré-existente, processo). Sobe para **MEDIUM** se as fotos forem de pessoas reais.
- **OWASP:** A01/A04 (exposição de dado pessoal)
- `BackEndTorv/profilePhotos/` guarda os uploads de avatar (`@fastify/static`). Ele **não** está em nenhum `.gitignore` (`git check-ignore`: nada).
  - **6 fotos já estão versionadas** (commit `331b18e`, "versão fina"). O repositório é público, então elas estão no histórico público.
  - **7 fotos novas estão untracked** neste working tree, incluindo as de hoje, e um `git add -A` ou `git add .` no commit da feature as publicaria.
- **Não abri as imagens.** Só o usuário sabe se são de contas de teste ou de pessoas reais.
- **Ação:**
  - **No commit desta feature, use `git add` só com os caminhos da feature.** Não use `git add -A`/`git add .`.
  - Adicionar `BackEndTorv/profilePhotos/` ao `.gitignore` e rodar `git rm --cached` nas 6 versionadas.
  - Se alguma for de pessoa real, avaliar reescrever o histórico, porque o `rm --cached` não remove do histórico público.

---

## Achados: status consolidado

| # | Sev | Achado | Status |
|---|---|---|---|
| 1a | ~~LOW~~ | `logged_date` sem limite inferior | **Resolvido** (`diet.controller.js:99-102`), verificado com 22 entradas contra as rotas e o controller reais |
| 1b | ~~LOW~~ → **INFO** | Limite superior por instante UTC, aceita D+2 em BRT das 21h às 23h59 (`diet.controller.js:103`) | Reclassificado: 1–2 dias no futuro, só dados próprios |
| 2 | INFO (pré-existente) | `npm audit` 16, `axios@1.17.0` → 1.18.0 | Igual |
| 3 | INFO | Lockfile íntegro | Igual (inalterado desde o round 1) |
| 4 | INFO | Contas `@torvtest.dev` citadas em relatórios e vivas no Auth | Igual. Agora são 13 contas, 2 no escopo, com 0 refeições |
| 5 | ~~INFO~~ | Grade de anos sem piso | **Resolvido** para o MyDiet (prop `minDate`) |
| 6 | LOW (pré-existente, fora do diff) | `profilePhotos/` fora do `.gitignore`, com 6 fotos no histórico público | **Novo.** Não bloqueia a feature, mas **condiciona o commit** (adicionar só os caminhos da feature) |
| — | INFO (endossa o QA round 7) | Defesa em profundidade da regra de 2026-01-01 | Opcional: (a) um caso `node --test` com 2025-12-31 → 400 e 2026-01-01 → 201, já que nenhum `*.test.js` cobre `MIN_DIET_DATE`; (b) `CHECK (logged_date >= '2026-01-01')` em `food_logs`, que se aplica sem limpeza porque há 0 linhas antigas |

Fora da lente de segurança: o item 1c de 320 pt (UX, aceito pelo Maestro) e o texto "nada hoje" no dia passado vazio.

---

## Backlog acumulado (só anotado)

| Origem | Sev | Item |
|---|---|---|
| este round #6 | LOW | `.gitignore` para `BackEndTorv/profilePhotos/`, `git rm --cached` nas 6 versionadas e avaliar o histórico |
| este round #1b | INFO | Limite superior de `logged_date` por data (`<= tomorrowUTC`) |
| este round (QA r7) | INFO | Teste `node --test` do mínimo e `CHECK` no banco |
| round 1 #2 | INFO | `axios` → `^1.18.0` |
| round 1 #4 | processo | Limpeza das 13 contas `@torvtest.dev` |
| demais | — | Sem mudança: veja o backlog de `docs/security-datepicker-custom-2026-09-28.md` |
