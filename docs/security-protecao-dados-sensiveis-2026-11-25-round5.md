# Segurança — proteção de dados sensíveis (LGPD) — rodada 5

- Data: 2026-11-25 · Branch: `feature/criptografia-dados-sensiveis` · Commit revisado `5597a87`
- Escopo: somente `git show 5597a87` (`auth.routes.js` + testes). Rodadas anteriores inalteradas (`docs/security-protecao-dados-sensiveis-2026-11-25-round4.md` e anteriores). QA: `docs/qa-protecao-dados-sensiveis-2026-11-25-round7.md` (todos PASS).
- Método: leitura do diff, teste isolado da regex em Node com a flag `u`, leitura de `profile.repository.js:saveSignupProfile`. Nenhum `.env` lido, nenhuma ferramenta Supabase/Vercel, suíte não executada (confio no QA).

## Veredito: APROVADO
Zero Critical/High/Medium. Um Low parqueado (aceito), um Info.

## Regex `^[^\u0000\ud800-\udfff]*$` (name, username)
- Correta sob flag `u` (Ajv 8 compila com `unicodeRegExp` por padrão; `server.js` não sobrescreve). Testada em Node: `'Ana 💪'` passa; `\ud800`, `a\udc00`, `\ud83d` final, `💪\ud83d`, `\udc00💪` e NUL são recusados; U+10FFFF e string vazia passam (vazio já cai em `minLength: 1`).
- Sem bypass: em modo `u` a classe opera em code points; par válido é um code point astral fora de `\ud800-\udfff`, surrogate isolado é o único que casa a faixa negada. JSON com escape (`"\ud800"`) vira o surrogate real no `JSON.parse` e é recusado. `$` sem flag `m` e classe negada aceitando `\n`: sem truque de linha extra.
- Sem ReDoS: classe negada simples, um único `*`, sem aninhamento nem alternância; 1 milhão de caracteres testado em ~5 ms (na prática limitado por `maxLength: 100`).
- Testes: `name` e `username` com surrogate solto → 400 sem `signUp`/`usernameExists`; emoji → 201.

## Outros campos de `register` que chegam à gravação
Sem mudança desde a rodada 4 e sem novo caminho controlável pelo chamador: `goal` (lista fechada, máx. 119 < 255), `gender`/`fitness_level` (chaves fixas via `hasOwn`), `birth_date` (`format: date` + idade 10–120), `weight_kg`/`height_cm` (número finito em faixa, cifrados em texto), `username` (único, só corrida). `saveSignupProfile` só grava esses campos + `user_id` vindo do provedor. Com o achado 1 da rodada 4 fechado, não encontrei outra entrada que faça a gravação falhar de forma controlada pelo chamador.

## Achados

| # | Sev. | OWASP | Local | Cenário | Correção | Bloqueia |
|---|------|-------|-------|---------|----------|----------|
| 1 | Low (parqueado, aceito) | A04/A07 | `auth.controller.js:61-70` | Invariante continua frágil: falha futura/não controlada da gravação devolve 502 só para e-mail novo. | Ruling do Maestro: PARKED. Aceito: responder 201 mandaria o usuário confirmar conta revertida; as causas restantes (banco indisponível, chave de cifra) não são controláveis pelo chamador e são visíveis a operação. Recomendo só manter teste de contrato por coluna ao adicionar campos. | Não |
| 2 | Info | A09 | `auth.routes.js` | 400 de validação não ecoa o valor; logs sem dados novos. Nenhum vazamento novo, nenhum segredo, nenhum caminho de Storage no diff. | Nenhuma. | Não |

## Fechado nesta rodada
- Achado 1 (Medium não confirmado) da rodada 4: surrogate solto em `name`: fechado pela regex e pelos testes; QA 7 confirma 400 sem conta criada.

## Não verificado
- Comportamento real do Prisma/`serde_json` com surrogate solto contra banco (a validação agora o impede antes; não testei ao vivo).
- Confirmação de e-mail e limite de envio do Auth em produção (fora do código).
- Itens das rodadas anteriores (UXCam em aparelho, RLS/`torv_api`, migration em produção, gitleaks no histórico completo).
