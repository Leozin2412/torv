# Security Review — DatePicker custom TORV (Round 1)

- **Data:** 2026-09-28
- **Branch:** `perf/api-latency` (código da feature **não commitado**, working tree)
- **Escopo:**
  - novos: `FrontEndTorv/src/utils/date.ts`, `FrontEndTorv/src/components/DatePickerModal/{index.tsx,styles.ts}`
  - alterados: `FrontEndTorv/src/screens/MyDiet/index.tsx`, `FrontEndTorv/app.json`, `FrontEndTorv/package.json`, `FrontEndTorv/package-lock.json`
  - relatórios de QA da feature: `docs/qa-datepicker-custom-2026-09-28.md` e `-round2.md` (commits locais `ae9e5fa`/`5c6ecd6`, ainda não enviados ao remoto)
  - fora do escopo (alterações do usuário): `BancoDeDadosTorv/Gestao_e_Performance.sql`, `FrontEndTorv/tsconfig.json`
- **Fora do diff, mas no caminho da feature:** `BackEndTorv/src/routes/diet.routes.js`, `controller/diet.controller.js`, `repository/diet.repository.js` (só leitura, só reportado)
- **Pré-condição:** QA `qa-datepicker-custom-2026-09-28-round2.md`: PASS
- **Lente:** OWASP Top 10 (A01 authz, A03 injeção, A04 design/validação, A06 componentes vulneráveis, A08 integridade de software/supply chain), mais segredos e dados de teste
- **Veredito: PASS.**
  - O diff não introduz vulnerabilidade. Ele remove um módulo nativo e um `<input>` DOM cru, então a superfície diminui.
  - O lockfile está íntegro: origem, hash, assinatura e publisher conferidos pacote a pacote.
  - Ficam 1 LOW pré-existente no backend (fora do diff) e 3 INFO, nenhum bloqueante.

Nenhum segredo foi impresso nesta revisão. Nenhuma conta foi criada e nada foi escrito no banco: a validação do backend foi testada com o Fastify e o TypeBox reais do projeto numa instância isolada (`inject`), sem o servidor nem o banco.

---

## Achados

| # | Sev | Camada | OWASP | Achado | Bloqueia? |
|---|---|---|---|---|---|
| 1 | LOW (pré-existente) | Backend (fora do diff) | A04 | `POST /diet`: `logged_date` não tem limite inferior, e o superior é "amanhã em UTC", que vira D+2 no fuso BRT depois das 21h. O `maxDate` do front é só UX | não |
| 2 | INFO (pré-existente) | Front/deps | A06 | `npm audit`: 16 (13 moderate, 3 high), **nenhum novo**. O diff remove 1 (era 17). O único em runtime é `axios@1.17.0` (< 1.18.0) | não |
| 3 | INFO | Front/deps | A08 | Lockfile íntegro. Troca de publisher em `babel-plugin-react-native-web` verificada (mantenedor listado, diff só de metadado). Versões publicadas há 0–4 dias, sem provenance | não |
| 4 | INFO | Processo | — | Os relatórios de QA citam a conta sintética `qa.datepicker.…@torvtest.dev` (domínio NXDOMAIN, sem senha nem token). A conta segue no Auth, com 0 refeições | não |

---

### 1. LOW (pré-existente): limites de `logged_date` no backend

**O que o front manda.** A data escolhida vai para `GET /diet/summary?date=…` (`MyDiet/index.tsx:148`) e `POST /diet` `logged_date` (`MyDiet/index.tsx:214`). O `maxDate={toISODate(new Date())}` (`MyDiet/index.tsx:327`) só desabilita botões no modal (`DatePickerModal/index.tsx:43`, `:92`). Qualquer cliente HTTP ignora isso. Já era assim com o `DateTimePicker` (`maximumDate`) e o `<input max>`.

**O que o backend valida por conta própria.**

- **Formato:** `Type.String({ format: 'date' })` em `diet.routes.js:40` (querystring) e `:77` (body). O `server.js` não sobrescreve as opções do Ajv, então vale o `@fastify/ajv-compiler` 4.0.6 com `ajv-formats` em modo full (calendário real). Testado com o Fastify 5.12.4 e o TypeBox do projeto:

  | Entrada | `GET ?date=` | `POST logged_date` |
  |---|---|---|
  | `2026-09-28` | 200 | 200 |
  | `2026-02-30`, `2026-13-01` | 400 | 400 |
  | `2026-09-28' OR 1=1--` | 400 | 400 |
  | `2026-09-28T00:00:00Z`, `20260928`, `+275760-09-13`, `""` | 400 | 400 |
  | `0001-01-01` | **200** | **200** (chega ao controller) |
  | `9999-12-31` | 200 | 200 no schema, depois 400 no controller |

- **Limite superior (`POST`):** `diet.controller.js:97` recusa `new Date(logged_date) > Date.now() + 24h`. `new Date('YYYY-MM-DD')` é meia-noite **UTC**, então o limite real é "amanhã em UTC". Das 21h às 23h59 BRT (00h–02h59 UTC do dia seguinte), isso aceita **D+2** no fuso do usuário. Por exemplo, às 21h30 de 28/09 BRT, `logged_date=2026-09-30` passa.
- **Limite inferior (`POST`):** não existe. `0001-01-01` passa pelo `isNaN` (`:94`) e é gravado (`food_logs.logged_date` é `@db.Date`).
- **`GET ?date`:** sem limites, o que é aceitável: é só leitura, sempre filtrada pelo `userId` do token (`diet.repository.js:5-6`, `:32`).
- **`PUT /diet/:logId`:** não altera a data. O controller só repassa `food_name`/`calories`/`macros_json` (`diet.controller.js:134`).

**Impacto.** Só nos dados do próprio usuário. O `userId` vem do JWT e a data não muda o dono. Streaks e ranking **não** dependem de `food_logs`: os triggers são `AFTER INSERT ON activities` (`prisma/migrations/20260915170948_init_postgres/migration.sql:405-406`, `:425`). Sobra a integridade dos dados: registros com datas absurdas no histórico do próprio usuário e em qualquer agregação futura por data.

**Ação (backlog do Torv Backend, não bloqueia esta feature).** O Ajv já garante `YYYY-MM-DD`, então dá para comparar como string em `addFoodLog`:

```js
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10); // tolerância p/ fusos à frente de UTC
const minDate = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10); // ou users.created_at
if (logged_date && (logged_date < minDate || logged_date > tomorrow)) return reply.status(400)…
```

Isso fecha o limite inferior e troca a comparação de instante pela de data, o que elimina o caso D+2. A janela mínima (365 dias ou `created_at`) é decisão de produto.

### 2. INFO (pré-existente): `npm audit`

| | Total | high | moderate |
|---|---|---|---|
| `HEAD` (lockfile commitado) | 17 | 3 | 14 |
| working tree (com a feature) | 16 | 3 | 13 |

- A diferença é a `@react-native-community/datetimepicker` (moderate, via cadeia `>=8.2.0`), que saiu. Nenhum advisory novo entrou.
- Os 3 high são pré-existentes:
  - `axios@1.17.0`: dependência direta, em runtime. 10 advisories, corrigidos em 1.18.0. Vários são do adapter Node (`GHSA-gcfj-64vw-6mp9`, proxy herdado) ou exigem uma fonte separada de prototype pollution, e no RN o adapter é XHR/fetch. Mesmo assim, é o único que vai no bundle.
  - `form-data@4.0.5`: transitiva do `axios`, só na plataforma Node.
  - `shell-quote@1.8.4`: via `react-native` → `react-devtools-core`, tooling de dev.
- **Ação:** subir `axios` para `^1.18.0` num PR separado (fora desta feature).

### 3. INFO: integridade do lockfile e supply chain

| Checagem | Resultado |
|---|---|
| Origem (`resolved`) das 584 entradas | todas `https://registry.npmjs.org` ✅ |
| Algoritmo de `integrity` | todas `sha512` ✅ |
| `integrity` das 9 entradas alteradas vs `npm view <pkg>@<ver> dist.integrity` | idênticas ✅ (`expo` 57.0.25, `expo-image-picker` 57.0.20, `expo-modules-core` 57.0.19, `expo-modules-jsi` 57.1.1, `babel-preset-expo` 57.0.13, `@expo/cli` 57.0.27, `@expo/router-server` 57.0.11, `babel-plugin-react-native-web` 0.21.3, `ws` 8.22.0) |
| `npm audit signatures` | 574 pacotes com assinatura de registro verificada ✅ |
| Install scripts (`hasInstallScript`) | nenhum no lockfile inteiro ✅ |
| Instalado (`node_modules`) vs lock | versões batem, e `@react-native-community/datetimepicker` não está mais instalado ✅ |
| Resíduo da lib removida | `grep` em `FrontEndTorv/` (sem `node_modules`): 0 ocorrências. Não há `android/`/`ios/` versionados ✅ |
| Publishers | 7 pacotes Expo: `alanhughes`, o mesmo das versões anteriores. `ws`: `lpinca`, o mesmo de antes ✅ |
| **Troca de publisher** em `babel-plugin-react-native-web` (0.21.2 `necolas` → 0.21.3 `zoontek`) | `zoontek` é mantenedor listado do pacote e do `react-native-web`, e publicou também o `react-native-web@0.21.3`. `npm pack` das duas versões: o diff é **só** `version` e o formato da URL do repositório (`git://` → `git+https://`). Sem `scripts`, sha512 do tarball igual ao do lock ✅ |
| Dedupe | O `hermes-parser`/`hermes-estree`/`babel-plugin-syntax-hermes-parser` 0.36.1 aninhados saíram. O `babel-preset-expo` 57.0.13 (`^0.36.0`) passou a usar o 0.36.0 do topo, cuja entrada não mudou no lock ✅ |
| `package.json` | `expo` `^57.0.24` → `~57.0.25`: o range ficou mais estreito (só patch), com menos deriva ✅ |

- **Observação (INFO):** as versões novas foram publicadas entre 24/09 e hoje (o `expo@57.0.25` às 12h25 UTC de 28/09) e nenhuma tem attestation de provenance (a Expo não publica). Não há sinal de problema: publishers e mantenedores são os de sempre e os hashes conferem.
- **Sugestão de processo:** esperar alguns dias antes de adotar patch recém-publicado. É a defesa barata contra release comprometido que é despublicado horas depois.

### 4. INFO: dados de teste nos relatórios

- Os dois relatórios de QA da feature citam `qa.datepicker.1790604006@torvtest.dev` e prefixos truncados de UUIDs de refeições já apagadas (`6cabc731-…`, `e0601ffc-…`).
- `torvtest.dev` não existe (NXDOMAIN), então o endereço é sintético e não é PII. Não há senha, token nem cabeçalho `Authorization` em nenhum dos dois. O mesmo padrão aparece em outros 15 lugares em `docs/`.
- **Resíduo:** a conta segue no Supabase Auth, com 0 refeições. Ela entra na limpeza periódica das contas `@torvtest.dev`, junto das já listadas em rounds anteriores.

---

## Diff: verificado OK

- **Injeção (A03):**
  - O diff remove o `<input type="date">` cru, que o react-native-web renderizava no DOM. O modal só renderiza strings calculadas dentro de `<Text>`, sem `dangerouslySetInnerHTML` nem HTML.
  - Toda data do front vem de `toISODate` sobre `Date` construído com inteiros: `DatePickerModal/index.tsx:90`, e em `MyDiet/index.tsx`, a `:62`, a `:305` e o `item.fullDate` da faixa semanal. Nenhum dado do servidor entra em `selectedDate`/`filterDate`, então a interpolação em `` `/diet/summary?date=${dateStr}` `` (`MyDiet/index.tsx:148`) não consegue injetar parâmetro.
  - Mesmo com um cliente malicioso, o Ajv recusa tudo que não seja data de calendário válida (tabela do #1).
  - Para ano < 1000, o `toISODate` não completa com zeros (`999-01-01`) e o backend devolve 400 (fail-closed). Só se chega lá com ~12 mil toques em "mês anterior".
- **SQL:** `$queryRaw` com template tag, parametrizado: `${targetDate}::date` em `diet.repository.js:32` e `:46`.
- **Authz (A01):** o `userId` vem só de `request.user` (preHandler `authenticateToken`, `diet.routes.js:37`). A data escolhida só muda o dia consultado ou gravado, sempre do próprio usuário.
- **Superfície:** saíram o plugin nativo `@react-native-community/datetimepicker` (`app.json`) e sua dependência `invariant`, que segue no lock via `expo-modules-core`. Há menos código nativo no binário.
- **Robustez:** `parseLocalDate` não valida a entrada, e um valor malformado quebraria o modal (`WEEKDAYS[NaN]`). Isso não é alcançável, porque as entradas são sempre internas (acima).
- **Segredos:** `gitleaks dir` 8.30.1 sobre o diff da feature, os arquivos novos e os 2 relatórios de QA: `no leaks found`. Um grep de `password|senha|secret|token|bearer|eyJ…|api_key` não achou nada além de `theme/tokens` e do e-mail sintético do #4.

---

## Backlog acumulado (só anotado)

| Origem | Sev | Item |
|---|---|---|
| este round #1 | LOW | `addFoodLog`: limite inferior para `logged_date` e comparação por data (não por instante) no limite superior |
| este round #2 | INFO | `axios` → `^1.18.0` (PR separado) |
| este round #3 | processo | Carência de alguns dias antes de adotar patch recém-publicado |
| este round #4 | processo | Limpeza das contas `@torvtest.dev` no Supabase Auth |
| api-latency #2 + anon-exposure #4 | LOW | Rate limit em rotas autenticadas (por `userId`), `pool_timeout`, `connection_limit` vs limite do Supavisor. Sem mudança |
| api-latency #3 | LOW | `sslmode=require` nas URLs e "Enforce SSL" no Supabase. Sem mudança |
| api-latency #1/#4 | processo | `.gitleaks.toml` com `postgres-url-password` + pre-commit/CI. Sem mudança |
| anon-exposure #2 | LOW | Cota por IP do GoTrue compartilhada. Sem mudança |
| calorie-calculator r1–r5 | INFO | `console.log` de `AxiosError` no front (leva `Authorization`). Sem mudança |
