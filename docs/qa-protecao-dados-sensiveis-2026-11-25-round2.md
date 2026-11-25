# QA — Proteção de dados sensíveis (rodada 2)

**Data:** 2026-11-25
**Recruta:** Torv Review and Tests
**Branch:** `feature/criptografia-dados-sensiveis`
**HEAD:** `364cf16`
**Ambiente:** Supabase local (Docker), backend local, API + SQL (sem telas). Produção não foi tocada.
**Escopo:** só o check 8 (corrida de username) e a suíte do backend. Rodada 1: `docs/qa-protecao-dados-sensiveis-2026-11-25.md`.

**Veredito: PASS**

Os checks 1–7, 9, 10 e RF2/RF4 valem da rodada 1: o conserto (`3b6d382..364cf16`) mexeu só em `auth.controller.js` e no teste dele.

## Suíte
Backend `npm test`: `tests 340 / pass 340 / fail 0`.

## Diff do conserto
`auth.controller.js`: a checagem por `err.meta.target` foi trocada por `err.code === 'P2002'` (qualquer P2002 do `saveSignupProfile` -> `deleteUser` + 409 `USERNAME_TAKEN`). Bate com a causa da rodada 1 (Prisma real manda `meta.target` nulo). As outras chaves únicas envolvidas são `user_id` (upsert) e id aleatório, então o P2002 só pode ser username. O teste agora usa o formato real (`meta: { modelName: "user_profiles", target: null }`).

## Check 8 — PASS
Dois cadastros simultâneos (e-mails diferentes, mesmo username novo), 4 tentativas:

| Tentativa | Respostas | `auth.users` sem `user_profiles` | Contas do par | Perfis com o username |
|---|---|---|---|---|
| 1 | 409 USERNAME_TAKEN + 201 | 0 | 1 | 1 |
| 2 | 201 + 409 USERNAME_TAKEN | 0 | 1 | 1 |
| 3 | 409 USERNAME_TAKEN + 201 | 0 | 1 | 1 |
| 4 | 201 + 409 USERNAME_TAKEN | 0 | 1 | 1 |

Sempre um 201 e um 409; a conta perdedora foi desfeita.

## Limpeza
Contas `qa-*@torvtest.dev` apagadas do Supabase local (4); contagem final 0. Backend local parado.
