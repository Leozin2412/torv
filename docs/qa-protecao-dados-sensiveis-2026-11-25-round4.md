# QA — Proteção de dados sensíveis (rodada 4)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD:** `3ede456`
**Ambiente:** Supabase local (Docker), backend local, API + SQL. Produção não foi tocada.
**Escopo:** suíte do backend, cenário C (reenvio de cadastro de conta pendente não sobrescreve), cenário B (falha em conta nova desfaz) e check 8. Conserto em `3ede456`.

**Veredito: PASS**

Substituições: o RF4 da rodada 1 ("perfil atualizado no reenvio") foi **substituído** pelo cenário C (o reenvio não grava nada). O cenário A da rodada 3 **não se aplica mais** (o reenvio nunca chega ao salvamento). Os demais checks valem das rodadas 1 a 3.

## Suíte e diff
- Backend `npm test`: `tests 342 / pass 342 / fail 0`.
- Diff `450ee69..3ede456` em `BackEndTorv/src`: `auth.controller.js` (só chama `saveSignupProfile` se `userId && !profileExists(userId)`; o `deleteUser` volta a ser incondicional no catch, pois agora só roda para conta criada na requisição), comentário em `profile.repository.js` e ajuste do teste. Nada além.

## Cenário C — reenvio de conta pendente — PASS
1. `qa-c@torvtest.dev` cadastrada (nome NomeX, username próprio, nascimento 1990-01-01, 70 kg / 170 cm) -> 201 `{"session":null,"confirmation_required":true}`.
2. Após 62 s, recadastro do mesmo e-mail com nome NomeY, outro username, nascimento 1985-05-05, 95 kg / 195 cm -> **201**, corpo idêntico (`{"session":null,"confirmation_required":true}`).
3. SQL antes e depois idênticos: perfil `NomeX/<username original>/1990-01-01`, 1 linha em `user_measurements`, 1 conta.
4. Conta confirmada com o código do Mailpit (200); `GET /profile` -> nome NomeX, username original, `weight_kg 70`, `height_cm 170`, nascimento 1990-01-01. Nenhum dado do 2º cadastro foi gravado.

## Cenário B — falha em conta nova desfaz — PASS
Constraint temporária `check (name <> 'QA FALHA') not valid`; cadastro de e-mail novo com nome `QA FALHA` -> **502**; e-mail em `auth.users`: **0**. Constraint removida (contagem em `pg_constraint`: 0).

## Check 8 — PASS
Cadastros simultâneos, mesmo username novo: **201 + 409 USERNAME_TAKEN**; contas sem perfil: **0**; contas do par: 1.

## Limpeza
Contas `qa-*@torvtest.dev` apagadas (contagem 0); constraint `qa_force_fail` ausente (0); backend local parado.
