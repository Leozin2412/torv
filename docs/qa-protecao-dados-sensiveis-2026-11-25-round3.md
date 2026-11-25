# QA — Proteção de dados sensíveis (rodada 3)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD:** `b0309e7`
**Ambiente:** Supabase local (Docker), backend local, API + SQL. Produção não foi tocada.
**Escopo:** suíte do backend, check 8 e cenários A/B do rollback do cadastro (achado Médio da revisão de segurança, conserto em `b0309e7`). Rodadas anteriores: `docs/qa-protecao-dados-sensiveis-2026-11-25.md` e `-round2.md`.

**Veredito: PASS**

Os demais checks valem das rodadas 1 e 2: a mudança `b473fce..b0309e7` tocou só o rollback do cadastro.

## Suíte e diff
- Backend `npm test`: `tests 342 / pass 342 / fail 0`.
- Diff em `BackEndTorv/src`: `auth.controller.js` (antes de gravar, `profileExists(userId)`; `deleteUser` só se o perfil não existia) e `profile.repository.js` (novo `profileExists`), mais 2 testes. Nada além.

## Check 8 (2 tentativas) — PASS
Cadastros simultâneos, mesmo username novo:

| Tentativa | Respostas | `auth.users` sem `user_profiles` | Contas do par |
|---|---|---|---|
| 1 | 409 USERNAME_TAKEN + 201 | 0 | 1 |
| 2 | 201 + 409 USERNAME_TAKEN | 0 | 1 |

## Cenário A — falha no recadastro mantém a conta — PASS
1. `qa-a@torvtest.dev` cadastrada (nome "Original", 70 kg), não confirmada -> 201. Estado: 1 conta, `Original/user_b498fe81`, 1 medida.
2. Constraint temporária no banco local: `check (name <> 'QA FALHA') not valid` (presente: 1).
3. Após 62 s (para o GoTrue não engolir o reenvio), recadastro do mesmo e-mail com nome `QA FALHA` -> **502** `{"error":"Authentication provider unavailable"}`.
4. Depois: **1** conta em `auth.users`, perfil original `Original/user_b498fe81`, **1** medida. Conta e dados originais preservados.

## Cenário B — falha em conta nova ainda desfaz — PASS
Mesma constraint, e-mail novo `qa-b@torvtest.dev` com nome `QA FALHA` -> **502**; e-mail em `auth.users`: **0**; contas sem perfil: 0.

## Limpeza
Constraint `qa_force_fail` removida (contagem em `pg_constraint`: 0, conferida após o cenário e de novo no fim). Contas `qa-*@torvtest.dev` apagadas; contagem final 0. Backend local parado.
