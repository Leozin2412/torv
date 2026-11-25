# QA — Proteção de dados sensíveis (rodada 7)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD testado:** `5597a87`
**Ambiente:** Supabase local (Docker), backend local (porta 3999), API + SQL, Mailpit na porta 54324. Produção não foi tocada.
**Escopo:** só o commit `5597a87` (`fix(lgpd): cadastro recusa surrogate solto em nome e username`). Motivo: a rodada 4 de segurança achou que surrogate solto passava no padrão que só recusava NUL, o que provavelmente fazia a gravação falhar (502 só para e-mail novo, oráculo de existência de e-mail).

**Veredito: PASS**

## Revisão do diff — PASS
- `auth.routes.js`: o padrão de `name` e `username` (opcional) passa a ser `^[^\u0000\ud800-\udfff]*$`. O ajv compila com a flag `u`, então um par válido (emoji) é um único ponto de código e não casa com a faixa; um surrogate solto casa e é recusado.
- Testes novos (3): surrogate solto em `name` -> 400 sem `signUp`; surrogate solto em `username` -> 400 sem `usernameExists` nem `signUp`; `Ana 💪` -> 201. Cobrem recusa e não-regressão do par válido.
- Sem regressão vista: demais campos do cadastro não mudaram.

## Suíte
Backend `npm test`: `tests 352 / pass 352 / fail 0`.

## Checks de ponta a ponta
Corpo JSON enviado cru, com sequências de escape (`\ud800`, `\udc00`, `💪`) em texto, por cliente HTTP que não normaliza. Contas `qa-r7-*@torvtest.dev`.

| Check | Resultado |
|---|---|
| (a) `"name":"\ud800"` | PASS: 400 (`body/name must match pattern`); `auth.users` sem linha da conta (0) |
| (b) `"username":"a\udc00"` | PASS: 400 (`body/username must match pattern`); `auth.users` sem linha da conta (0) |
| (c) `name` "Ana 💪" (par `💪`) | PASS: 201; `user_profiles.name` gravado byte a byte igual (`416e6120f09f92aa`, emoji intacto); `GET /profile` devolve o emoji |
| (d) seis objetivos | PASS: 201; `goal` gravado com 119 caracteres |
| (d) register -> verify-email -> login -> GET /profile | PASS: 201 -> 200 -> 200 -> 200 |

- Log do backend: 0 ocorrências de 502 ou `save failed`.

## Observação sobre a execução
Na primeira tentativa o script de teste enviou surrogates soltos como caracteres reais (o escape foi consumido antes do envio), e o Node os codificou como U+FFFD; por isso as contas voltaram 201. Foi erro do script de QA, não do produto. Essas contas foram apagadas, o script foi corrigido para enviar o texto `\ud800` literal e a rodada acima foi refeita do zero. Um `curl` com o mesmo corpo cru já confirmava 400.

## Limpeza
Contas `qa-r7-*` apagadas do Supabase local (`auth.users` = 0; perfis órfãos = 0). Backend local parado (porta 3999 sem resposta).
