# Segurança — proteção de dados sensíveis (LGPD) — rodada 4

- Data: 2026-11-25 · Branch: `feature/criptografia-dados-sensiveis` · HEAD revisado `9d3a766`
- Escopo: `git diff bcd77e0..9d3a766` (commits `2074be9`, `afb0521`, `9d3a766`). Rodadas anteriores inalteradas (`docs/security-protecao-dados-sensiveis-2026-11-25.md`, `-round2.md`, `-round3.md`). QA: `docs/qa-protecao-dados-sensiveis-2026-11-25-round6.md`.
- Origem: pista `needs_validation` da auditoria `security-audit` (run-2): `POST /auth/register` como oráculo de existência de e-mail (502 só para e-mail novo quando a gravação do perfil falha). Relatório da auditoria fica fora do repositório e não é copiado aqui.
- Método: leitura do diff e do código que o diff toca; nenhum `.env` lido, nenhuma ferramenta Supabase/Vercel usada, suíte não executada (confio no QA).

## Veredito: APROVADO
Zero Critical/High confirmado. Um Medium não confirmado (pendência, não bloqueia pela regra "só `confirmed` bloqueia"), um Low e dois Info.

## Notas por mudança

### 2074be9 — dedupe de objetivos (`profileValidation.js:16`)
- `[...new Set(goals)]` depois de `trim().normalize('NFC')` e da checagem contra `GOAL_NAMES`: duplicata só colapsa valores já válidos. Máximo possível: os 6 objetivos = 119 caracteres. Também vale para `PUT /profile` (mesmo helper), sem efeito de segurança novo.
- Entrada grande (muitas repetições) é limitada pelo `bodyLimit` do Fastify; custo do split é linear.

### afb0521 — padrão anti-NUL em `name` e `username` (`auth.routes.js:5,36-37`)
- Regex `^[^\u0000]*$`: classe negada simples, sem quantificador aninhado nem alternância, tempo linear, sem ReDoS (além do `maxLength: 100` que roda antes).
- Sem bypass por quebra de linha: `$` sem flag `m` só casa no fim e a classe negada aceita `\n`, então não há truque de "linha extra". `\u0000` é escape válido com ou sem a flag `u` do Ajv. NUL escapado em JSON (`\u0000`) vira o caractere real no `JSON.parse`, que o padrão recusa. Testes cobrem `name` e `username` (400 e `signUp`/`usernameExists` não chamados).
- `username` com NUL já não era sonda (o pré-check falhava igual para todo e-mail), mas agora vira 400 limpo em vez de 500.

### 9d3a766 — migration `20261125140000_widen_user_profiles_goal`
- `ALTER COLUMN goal TYPE varchar(255)`: alargar varchar no Postgres não reescreve a tabela nem perde dado (sem truncamento possível). Lock `ACCESS EXCLUSIVE` só no catálogo, instantâneo; tabela de produção vazia (banco zerado em 2026-11-25).
- Dependências da coluna: busca em `prisma/migrations` não achou view/policy/regra que cite `user_profiles.goal` (a view com `goal_calories` usa `nt.daily_calories`; a função do trigger antigo só lê `meta->>'goal'`). Nada que bloqueie o `ALTER`.
- `schema.prisma` bate com a migration (`@db.VarChar(255)`): sem drift. Nenhum segredo, nenhum SQL de RLS tocado; nenhum caminho de Storage no diff.

## Cobertura do oráculo por campo do corpo de `register` que chega à gravação

| Campo | Limite no banco | Garantia na rota/controller | Pode falhar a gravação? |
|---|---|---|---|
| `name` | varchar(100), sem NUL | `maxLength` 100 (code points, igual ao Postgres) + `pattern` anti-NUL | NUL fechado; surrogate solto: ver achado 1 |
| `username` | varchar(100), único | `maxLength` 100 + anti-NUL; `usernameExists` roda antes de `signUp`, igual para todo e-mail | Só corrida (achado 3) |
| `goal` | varchar(255) | lista fechada, dedupe, máx. 119 | Não |
| `gender` | varchar(50) | `Object.hasOwn(GENDERS)` (chaves curtas) | Não |
| `fitness_level` | varchar(50) | `Object.hasOwn(ACTIVITY_FACTORS)` | Não |
| `birth_date` | `date` | `format: date` + idade 10–120 | Não |
| `weight_kg`, `height_cm` | text cifrado | `Type.Number` (Ajv recusa NaN/Infinity), faixas 20–300 e inteiro 50–250 | Não |

## Achados

| # | Sev. | OWASP | Local | Cenário | Correção | Bloqueia |
|---|------|-------|-------|---------|----------|----------|
| 1 | Medium (não confirmado) | A07 | `auth.routes.js:36` | `name` com surrogate UTF-16 solto (`"\ud800"` em JSON) passa em `maxLength` e no padrão anti-NUL; `JSON.stringify` do Prisma emite o escape e o motor Rust (`serde_json`) costuma recusar surrogate solto, o que faria a gravação falhar só para e-mail novo (502 vs 201): o mesmo oráculo. Não consegui confirmar: sem banco, o Prisma falha na conexão antes. | Trocar o padrão por `'^[^\u0000\ud800-\udfff]*$'` (flag `u`: astral continua válido, surrogate solto é recusado) e testar localmente com e-mail novo vs existente; ou o fix estrutural do achado 2. | Não (precisa de validação) |
| 2 | Low | A04/A07 | `auth.controller.js:61-70` | A correção fecha as causas conhecidas campo a campo, mas a invariante continua frágil: qualquer falha futura da gravação (nova coluna, chave de cifra, indisponibilidade do banco) volta a distinguir e-mail novo de existente. | Decidir se vale uniformizar (ex.: falha da gravação responde o mesmo 201 sem sessão e registra só o código) ou manter a validação por campo com teste de contrato por coluna. | Não |
| 3 | Info | A07 | `auth.controller.js:65` | Corrida de `username`: pré-check passa, a gravação cai em P2002 e devolve 409 só para conta nova. Exige o atacante controlar dois cadastros simultâneos com o mesmo username; não revela e-mail alheio. | Nenhuma. | Não |
| 4 | Info | A09 | `auth.controller.js:68` | Logs seguem só com `code` do erro; nenhum valor, e-mail, id ou corpo. 400 de validação não ecoa o campo. Nenhum vazamento novo. | Nenhuma. | Não |

## Não verificado
- Achado 1 (surrogate solto): comportamento do Prisma/`serde_json` não testado ao vivo; fica em "Não verificado / pendências" até rodar com banco local.
- Plano local da auditoria (Supabase local com confirmação ligada: 502 vs 201 antes/depois da correção) não executado por mim; dependo do QA da rodada 6.
- Configuração de confirmação e limite de envio de e-mail do Auth em produção (não está no código; verificação do responsável).
- Mesmos itens das rodadas anteriores (UXCam em aparelho, RLS/`torv_api`, migration em produção, gitleaks no histórico completo).
